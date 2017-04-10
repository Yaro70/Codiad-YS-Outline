/*
 * Copyright (c) Yaro, distributed
 * as-is and without warranty under the MIT License.
 * See http://opensource.org/licenses/MIT for more information.
 * This information must remain intact.
 */

(function(window) {
    window.htmlentities = {
        /**
         * Converts a string to its html characters completely.
         *
         * @param {String} str String with unescaped HTML characters
         **/
        encode: function(str) {
            var buf = [];

            for (var i = str.length - 1; i >= 0; i--) {
                buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''));
            }

            return buf.join('');
        },
        /**
         * Converts an html characterSet into its original character.
         *
         * @param {String} str htmlSet entities
         **/
        decode: function(str) {
            return str.replace(/&#(\d+);/g, function(match, dec) {
                return String.fromCharCode(dec);
            });
        }
    };

    window.strArrHasDups = function(strArr) {
        var valuesSoFar = Object.create(null);
        for (var i = 0; i < strArr.length; i++) {
            if (strArr[i] in valuesSoFar) {
                return true;
            }
            valuesSoFar[strArr[i]] = true;
        }
        return false;
    };
})(window);

(function(global, $) {
    var codiad = global.codiad,
        scripts = document.getElementsByTagName('script'),
        path = scripts[scripts.length - 1].src.split('?')[0],
        curpath = path.split('/').slice(0, -1).join('/') + '/';

    $(function() {
        codiad.Outline.init();
    });

    codiad.Outline = {
        modes: {},

        init: function() {
            var OutlineButton, OutlineMenu,
                _this = this;
            OutlineButton = '<div class="divider"></div><a id="OutlineButton">Outline</a>';
            OutlineMenu = '<ul id="OutlineMenu" class="options-menu">\
                           <li>Outline is not available.</li>\
                           </ul>';
            $('#editor-bottom-bar').append(OutlineButton);
            this.$OutlineButton = $('#OutlineButton');
            this.$OutlineMenu = $(OutlineMenu);

            codiad.editor.initMenuHandler(this.$OutlineButton, this.$OutlineMenu);

            this.$Outline = $('<div class="sb-right-category">Outline</div>\
                               <ul class="Outline">\
                               <li>Outline is not available.</li>\
                               </ul>\
                               <hr>');
            $('.sb-right-content hr:first').after(this.$Outline);
            this.$Outline = $('.Outline');

            this.$OutlineButton.click(function(e) {
                $('#OutlineMenu').css({
                    'overflow': 'auto',
                    'max-height': $('#root-editor-wrapper').height()
                });
            });

            this.$OutlineMenu.on('click', 'li a', function(element) {
                var line = $(element.currentTarget).data('line');
                if (line) {
                    codiad.active.gotoLine(line);
                }
            });

            this.$Outline.on('click', 'li a', function(element) {
                var line = $(element.currentTarget).data('line');
                if (line) {
                    codiad.active.gotoLine(line);
                }
            });

            amplify.subscribe('active.onFocus', function() {
                return _this.updateOutline();
            });
            amplify.subscribe('active.onSave', function() {
                return _this.updateOutline();
            });
            amplify.subscribe('active.onClose', function() {
                return _this.$Outline.empty();
            });
            return amplify.subscribe('active.onClose', function() {
                return _this.disableOutline();
            });
        },

        _buildOutlineNode: function(node) {
            var _this = this;
            if ('children' in node) {
                var children = $('<ul class="children" style="padding-left: 16px;"></ul>');
                node.children.forEach(function(child) {
                    children.append(_this._buildOutlineNode(child));
                });
                node.data.append(children);
            }

            return node.data;
        },

        updateOutline: function() {
            var _this = this;
            var editor, line, matches;
            editor = codiad.editor.getActive();

            var outline = null;
            var mode = $('#current-mode').text();
            if (mode in this.modes) {
                outline = this.modes[mode].getOutline();
            } else {
                $.getScript(curpath + 'modes/' + mode + '.js').done(function() {
                    outline = _this.modes[mode].getOutline();
                    _this.updateOutline();
                }).fail(function() {
                    _this.disableOutline();
                });
            }

            if (outline) {
                this.$Outline.empty();
                this.$OutlineMenu.empty();
                if (outline.length === 0) {
                    this.$Outline.append("<li>Empty</li>");
                    this.$OutlineMenu.append("<li>Empty</li>");
                } else {
                    for (var i = 0; i < outline.length; i++) {
                        var node = this._buildOutlineNode(outline[i]);
                        this.$Outline.append(node);
                        this.$OutlineMenu.append(node.clone());
                    }
                }
                return this.$OutlineButton;
            } else {
                return this.disableOutline();
            }
        },

        disableOutline: function() {
            this.$Outline.empty().append("<li>Outline is not available.</li>");
            this.$OutlineMenu.empty().append("<li>Outline is not available.</li>");
            return this.$OutlineButton;
        }
    };
})(this, jQuery);