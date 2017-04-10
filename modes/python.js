/*
 * Copyright (c) Yaro, distributed
 * as-is and without warranty under the MIT License.
 * See http://opensource.org/licenses/MIT for more information.
 * This information must remain intact.
 */

(function(global, $) {

    var codiad = global.codiad;

    codiad.Outline.modes.python = {

        parserRules: {

            commentOpeners: {
                '"': function(buffer) {
                    // Handle "
                    var regex = /(?:(")[^"\n])|(?:(^|[^"])("")[^"])/;
                    var match = buffer.match(regex);
                    if (match) {
                        return {
                            'id': '"',
                            'index': (match[2]) ? match.index + match[2].length : match.index
                        };
                    }

                    // Handle """
                    regex = /"""[\n]?$/;
                    match = buffer.match(regex);
                    if (match) {
                        return {
                            'id': '"""',
                            'index': match.index
                        };
                    }

                    return null;
                },
                "'": function(buffer) {
                    // Handle '
                    var regex = /(?:(')[^'\n])|(?:(^|[^'])('')[^'])/;
                    var match = buffer.match(regex);
                    if (match) {
                        return {
                            'id': "'",
                            'index': (match[2]) ? match.index + match[2].length : match.index
                        };
                    }

                    // Handle '''
                    regex = /'''[\n]?$/;
                    match = buffer.match(regex);
                    if (match) {
                        return {
                            'id': "'''",
                            'index': match.index
                        };
                    }

                    return null;
                },
                '#': function(buffer) {
                    var regex = /#/;
                    var match = buffer.match(regex);
                    if (match) {
                        return {
                            'id': "#",
                            'index': match.index
                        };
                    }

                    return null;
                }
            },

            commentClosers: {
                '"': function(skipBuffer) {
                    var regex = /(^|[^\\])"/;
                    var match = skipBuffer.match(regex);
                    if (match) {
                        return {
                            'index': match.index + 1
                        };
                    }

                    return null;
                },
                '"""': function(skipBuffer) {
                    var regex = /"""[\n]?$/;
                    var match = skipBuffer.match(regex);
                    if (match) {
                        return {
                            'index': match.index
                        };
                    }

                    return null;
                },
                "'": function(skipBuffer) {
                    var regex = /(^|[^\\])'/;
                    var match = skipBuffer.match(regex);
                    if (match) {
                        return {
                            'index': match.index + match[1].length
                        };
                    }

                    return null;
                },
                "'''": function(skipBuffer) {
                    var regex = /'''[\n]?$/;
                    var match = skipBuffer.match(regex);
                    if (match) {
                        return {
                            'index': match.index
                        };
                    }
                    return null;
                },
                '#': function(skipBuffer) {
                    var regex = /[\n]$/;
                    var match = skipBuffer.match(regex);
                    if (match) {
                        return {
                            'index': (match.index > 0) ? match.index - 1 : match.index
                        };
                    }
                    return null;
                }
            },

            nodes: {
                ':': [{
                        // Class
                        regex: /^([ \t]*)class (\w+)(\([\s\S]*\))?:/m,
                        render: function(match, line) {
                            var className = htmlentities.encode(match[2]);

                            return {
                                indent: match[1].length,
                                data: $('<li class="OutlineFunction class"><a data-line="' + line + '" title="' + className + '">' + className + '</a></li>')
                            };
                        }
                    },
                    {
                        // Function
                        regex: /^([ \t]*)def (\w+)\(([\s\S]*)\):/m,
                        render: function(match, line) {
                            var functionName = match[2];
                            var visibility = (match[2].indexOf('_') === 0) ? 'private' : 'public';
                            var functionParams = '';
                            var skipStack = [];
                            var skippers = {
                                '[': ']',
                                '{': '}',
                                '(': ')',
                                '=': ','
                            };
                            for (var i = 0; i < match[3].length; i++) {
                                var char = match[3][i];
                                if (char in skippers) {
                                    skipStack.push(char);
                                } else if (skipStack.length > 0 && char === skippers[skipStack[skipStack.length - 1]]) {
                                    if (skipStack.pop() === '=') {
                                        functionParams += ', ';
                                    }
                                } else if (skipStack.length === 0 && !(/\s/.test(char))) {
                                    functionParams += char;
                                    if (char === ',') {
                                        functionParams += ' ';
                                    }
                                }
                            }
                            var displayText = htmlentities.encode(functionName + '(' + functionParams + ')');

                            return {
                                indent: match[1].length,
                                data: $('<li class="OutlineFunction ' + visibility + '"><a data-line="' + line + '" title="' + displayText + '">' + displayText + '</a></li>')
                            };
                        }
                    }
                ]
            }
        },

        init: function() {},

        _parseCommentOpener: function(buffer) {
            for (var cmtId in this.parserRules.commentOpeners) {
                var result = this.parserRules.commentOpeners[cmtId](buffer);
                if (result !== null) {
                    return result;
                }
            }
            return null;
        },

        _parseBuffer: function(nodeId, buffer, line) {
            for (var i = 0; i < this.parserRules.nodes[nodeId].length; i++) {
                var parserRule = this.parserRules.nodes[nodeId][i];
                var match = buffer.match(parserRule.regex);
                if (match) {
                    // Definition can be spread cross several lines, always point to the first.
                    var linesInMatch = match[0].split('\n').length;
                    if (linesInMatch > 1) {
                        line = line - linesInMatch + 1;
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
                var skipBuffer = '';
                var outline = [];
                var currentNode = null;
                var skipStack = [];

                for (var i = 0; i < editor.session.getLength(); i++) {
                    line = editor.session.getLine(i);

                    for (var c = 0; c < line.length; c++) {
                        // Remove any comments from the line.
                        // All text after #
                        // All text after ''' if  never closed by '''
                        // All text after """ if never closed by """
                        // All text between ''' '''
                        // All text between """ """
                        // http://stackoverflow.com/questions/6462578/alternative-to-regex-match-all-instances-not-inside-quotes
                        // Remove all ''' ''' ensuring these stay if inside double quotes (inside a string).
                        // Remove all """ """ ensuring these stay if inside single quotes (inside a string).
                        // Sample: stay "''' in a string stay '''" ''' GO ''' in between '''""" GOT """ TO """ """GO"""'''

                        if (skipStack.length > 0) {
                            skipBuffer += line[c];
                            if (c == line.length - 1) {
                                skipBuffer += '\n';
                            }

                            var result = this.parserRules.commentClosers[skipStack[skipStack.length - 1]](skipBuffer);
                            if (result !== null) {
                                var cmtId = skipStack.pop();
                                buffer += skipBuffer.substr(result.index + cmtId.length, skipBuffer.length);
                                skipBuffer = '';
                            }
                        } else {
                            buffer += line[c];
                            if (c == line.length - 1) {
                                buffer += '\n';
                            }

                            var result = this._parseCommentOpener(buffer);
                            if (result !== null) {
                                skipStack.push(result.id);
                                skipBuffer += buffer.substr(result.index + result.id.length, buffer.length);
                                buffer = buffer.substr(0, result.index);
                                continue;
                            }
                        }

                        // Parse nodes.
                        for (var nodeId in this.parserRules.nodes) {
                            if (line[c] == nodeId) {
                                var node = this._parseBuffer(nodeId, buffer, i + 1);
                                if (node) {
                                    while (true) {
                                        if (currentNode === null) {
                                            currentNode = node;
                                            outline.push(currentNode);
                                            break;
                                        } else if (currentNode.indent < node.indent) {
                                            node.parent = currentNode;
                                            if (!('children' in currentNode)) {
                                                currentNode.children = [];
                                            }
                                            currentNode.children.push(node);
                                            currentNode = node;
                                            break;
                                        } else if ('parent' in currentNode) {
                                            // Move a step up.
                                            currentNode = currentNode.parent;
                                        } else {
                                            currentNode = null;
                                        }
                                    }
                                    buffer = '';
                                    break;
                                }
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
        codiad.Outline.modes.python.init();
    });
})(this, jQuery);