/*
 * Copyright (c) Yaro, distributed
 * as-is and without warranty under the MIT License.
 * See http://opensource.org/licenses/MIT for more information.
 * This information must remain intact.
 */

(function(global, $) {

    var codiad = global.codiad;

    codiad.Outline.modes.java = {

        parserRules: [{
                // Class
                regex: /(?:(?:(?:(public|private|protected|static|abstract|final)\s+)?(public|private|protected|static|abstract|final)\s+)?(public|private|protected|static|abstract|final)\s+)?class (\w+(?:\s*<\s*(?:[\w<>\[\]\.]|\s*,\s*|\s*<\s*|\s*>)+\s*>)?)/,
                render: function(match, line) {
                    var keywords = match.slice(1, 4).filter(function(value) {
                        return value !== undefined;
                    });
                    if (strArrHasDups(keywords)) {
                        throw 'Invalid visibility, duplicate keywords!';
                    }
                    //TODO - find is a newish method, may not work on some older and mobile browsers.
                    var visibility = keywords.find(function(value) {
                        return ['public', 'private', 'protected'].indexOf(value) >= 0;
                    }) || 'public';
                    var className = htmlentities.encode(match[4]);

                    return {
                        data: $('<li class="OutlineFunction class"><a data-line="' + line + '" title="' + className + '">' + className + '</a></li>')
                    };
                }
            },
            {
                // Function / Constructor
                regex: /(?:(?:(?:(public|private|protected|static|abstract|final)\s+)?(public|private|protected|static|abstract|final)\s+)?(public|private|protected|static|abstract|final)\s+)?(?:(\w+(?:\.\w+)*(?:<[\w<>\[\]\s\.,]+>)*(?:\[\]){0,2})\s+)?(\w+)\s*\(\s*((?:\w+(?:\.\w+)*(?:\s*<[\w<>\[\]\s\.,]+>)*(?:\[\]){0,2})\s+(?:\w+(?:\[\]){0,2})(?:\s*,\s*(?:\w+(?:\.\w+)*(?:\s*<[\w<>\[\]\s\.,]+>)*(?:\[\]){0,2})\s+(?:\w+(?:\[\]){0,2}))*|\s*)\s*\)\s*$/,
                render: function(match, line) {
                    // Constructor
                    var visibility = 'protected';
                    var returnType = '';
                    if (match[4] === undefined) {
                        if (['public', 'private', 'protected'].indexOf(match[3]) >= 0) {
                            visibility = match[3];
                        }
                    }
                    // Function
                    else {
                        var keywords = match.slice(1, 4).filter(function(value) {
                            return value !== undefined;
                        });
                        if (strArrHasDups(keywords)) {
                            throw 'Invalid visibility, duplicate keywords!';
                        }
                        //TODO - find is a newish method, may not work on some older and mobile browsers.
                        visibility = keywords.find(function(value) {
                            return ['public', 'private', 'protected'].indexOf(value) >= 0;
                        }) || 'public';
                        returnType = ': ' + match[4];
                    }

                    var functionName = match[5];
                    // Strip all variable names from function parameters, leaving only types.
                    var params = match[6].match(/(?:(?:(\w+(?:\[\])?(?:<[\w\[\]<> ,]+>)?) \w+(?:\[\])?))/g);
                    var functionParams = '';
                    if (params) {
                        params.forEach(function(param) {
                            if (functionParams.length > 0) {
                                functionParams += ', ';
                            }
                            functionParams += param.substring(0, param.lastIndexOf(' '));
                        });
                    }
                    var displayText = functionName + '(' + functionParams + ')' + returnType;
                    displayText = htmlentities.encode(displayText);

                    return {
                        data: $('<li class="OutlineFunction ' + visibility + '"><a data-line="' + line + '" title="' + displayText + '">' + displayText + '</a></li>')
                    };
                }
            }
        ],

        init: function() {},

        parseBuffer: function(buffer, line) {
            for (var i = 0; i < this.parserRules.length; i++) {
                var parserRule = this.parserRules[i];
                var match = buffer.match(parserRule.regex);
                if (match) {
                    // Definition can be spread across several lines, always point to the first.
                    var linesInMatch = match[0].split('\n').length;
                    if (linesInMatch > 1) {
                        line -= linesInMatch - 1;
                    }
                    return parserRule.render(match, line);
                }
            }
            return null;
        },

        getOutline: function() {
            try {
                var editor = codiad.editor.getActive();
                var buffer = '';
                var outline = [];
                var currentNode = null;
                var skipStack = [];
                var isMultilineCommentOpen = false;

                var stripComments = function(m, group1, group2) {
                    if (group2) isMultilineCommentOpen = true; // Opened a multiline comment.
                    return (!group1) ? m : '';
                };

                for (var i = 0; i < editor.session.getLength(); i++) {
                    line = editor.session.getLine(i);

                    if (isMultilineCommentOpen) {
                        // Check if comment is closed.
                        var closeCommentTagPos = line.indexOf('*/');
                        if (closeCommentTagPos > -1) {
                            isMultilineCommentOpen = false;
                            line = line.substring(closeCommentTagPos + 2);
                        } else {
                            continue;
                        }
                    }
                    if (!isMultilineCommentOpen) {
                        // Remove any comments from the line.
                        // All text after //
                        // All text after /* if  never closed by */
                        // All text between /* */
                        // http://stackoverflow.com/questions/6462578/alternative-to-regex-match-all-instances-not-inside-quotes
                        // Remove all /* */ ensuring these stay if inside double qutes (inside a string).
                        // Sample: stay "/* in a string stay */" /* GO */ in between /*/* GO /* TOO */ /*GO/**/
                        line = line.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|(\/\*(?:(?!\*\/).)*$)|\/\*(?:(?!\*\/).)*\*\/)/, stripComments);
                    }

                    for (var c = 0; c < line.length; c++) {
                        if (line[c] === '{') {
                            if (skipStack.length) {
                                skipStack.push('{');
                                buffer = '';
                                continue;
                            }
                            var node = this.parseBuffer(buffer, i + 1);
                            buffer = '';
                            if (node === null) {
                                skipStack.push('{');
                                continue;
                            }
                            if (currentNode !== null) {
                                if (!('children' in currentNode)) {
                                    currentNode.children = [];
                                }
                                node.parent = currentNode;
                                currentNode.children.push(node);
                            }
                            currentNode = node;
                        } else if (line[c] === '}') {
                            // Buffer needs to be reset.
                            buffer = '';
                            if (skipStack.length) {
                                skipStack.pop();
                                continue;
                            }
                            if (currentNode === null) {
                                continue;
                            }
                            if ('parent' in currentNode) {
                                currentNode = currentNode.parent;
                            } else {
                                outline.push(currentNode);
                                // Next node goes at the current level.
                                currentNode = null;
                            }
                        } else {
                            buffer += line[c];
                            if (c === line.length - 1) {
                                buffer += '\n';
                            }
                        }
                    }
                }

                return outline;
            } catch (err) {
                console.log(err);
            }

            return null;
        }
    };

    $(function() {
        codiad.Outline.modes.java.init();
    });
})(this, jQuery);