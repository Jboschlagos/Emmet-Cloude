/* ─────────────────────────────────────────
   EMMET GUIDE — script.js
───────────────────────────────────────── */

(function () {
    'use strict';

    // ─── CONSTANTS ────────────────────────
    const LOREM_WORDS = [
        'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
        'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
        'magna', 'aliqua', 'ut', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
        'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo'
    ];

    const VOID_TAGS = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    const SECTIONS_ORDER = [
        'html-base', 'operadores', 'atributos', 'css-emmet', 'playground', 'cheatsheet'
    ];

    // ─── TABS ─────────────────────────────
    function initTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                const targetId = tab.dataset.section;
                activateSection(targetId);

                tabs.forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');

                // Scroll tab into view on mobile
                tab.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
            });
        });
    }

    function activateSection(id) {
        document.querySelectorAll('.section').forEach(function (s) {
            s.classList.remove('active');
        });
        var target = document.getElementById(id);
        if (target) target.classList.add('active');
        updateProgress(id);
    }

    function updateProgress(activeId) {
        var idx = SECTIONS_ORDER.indexOf(activeId);
        if (idx === -1) return;
        var pct = ((idx + 1) / SECTIONS_ORDER.length) * 100;
        var fill = document.getElementById('progressFill');
        var label = document.getElementById('progressLabel');
        if (fill) fill.style.width = pct + '%';
        if (label) label.textContent = (idx + 1) + ' / ' + SECTIONS_ORDER.length;
    }

    // ─── COPY TO CLIPBOARD ────────────────
    var toastTimer = null;

    function copyText(text) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(function () {
            showToast('¡Copiado: ' + text.substring(0, 30) + (text.length > 30 ? '…' : '') + '');
        }).catch(function () {
            // Fallback for older browsers
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); showToast('¡Copiado!'); } catch (e) { }
            document.body.removeChild(ta);
        });
    }

    function showToast(msg) {
        var toast = document.getElementById('toast');
        var msgEl = document.getElementById('toastMsg');
        if (!toast) return;
        if (msgEl) msgEl.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('show');
        }, 2000);
    }

    function initCopyHandlers() {
        // Snippet rows
        document.querySelectorAll('.snippet[data-copy]').forEach(function (el) {
            el.addEventListener('click', function () {
                copyText(el.dataset.copy);
            });
        });

        // Cheat sheet cells
        document.querySelectorAll('[data-copy]').forEach(function (el) {
            if (!el.classList.contains('snippet')) {
                el.addEventListener('click', function () {
                    copyText(el.dataset.copy);
                });
            }
        });
    }

    // ─── PLAYGROUND ───────────────────────
    function initPlayground() {
        var input = document.getElementById('emmetInput');
        var output = document.getElementById('emmetOutput');
        if (!input || !output) return;

        // Live expand on input
        input.addEventListener('input', function () {
            var val = input.value.trim();
            if (!val) {
                output.textContent = '// El resultado aparece aquí...';
                output.classList.add('playground__output--empty');
                return;
            }
            output.classList.remove('playground__output--empty');
            try {
                output.textContent = expandEmmet(val);
            } catch (e) {
                output.textContent = '// Sintaxis no reconocida.\n// Prueba: div.card*3>h2+p>lorem5';
            }
        });

        // Example buttons
        document.querySelectorAll('.example-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                input.value = btn.dataset.abbr;
                input.dispatchEvent(new Event('input'));
                input.focus();
            });
        });
    }

    // ─── EMMET PARSER ─────────────────────
    // Supports: tag, .class, #id, [attrs], {text}, >, +, ^, *, $, $$, (), lorem
    function expandEmmet(abbr) {
        abbr = abbr.trim();
        abbr = preprocessAbbr(abbr);

        // Special: boilerplate
        if (abbr === '!') {
            return [
                '<!DOCTYPE html>',
                '<html lang="en">',
                '<head>',
                '  <meta charset="UTF-8">',
                '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
                '  <title>Document</title>',
                '</head>',
                '<body>',
                '  ',
                '</body>',
                '</html>'
            ].join('\n');
        }

        // Special: lorem
        var loremMatch = abbr.match(/^lorem(\d*)$/i);
        if (loremMatch) {
            var count = parseInt(loremMatch[1], 10) || 30;
            return generateLorem(count);
        }

        return parseExpression(abbr, 0).html;
    }

    function generateLorem(n) {
        var words = [];
        for (var i = 0; i < n; i++) {
            words.push(LOREM_WORDS[i % LOREM_WORDS.length]);
        }
        var text = words.join(' ');
        return text.charAt(0).toUpperCase() + text.slice(1) + '.';
    }

    // Pre-process: expand input:type → input[type="type"] shorthands
    var INPUT_TYPES = new Set(['text', 'email', 'password', 'number', 'tel', 'url',
        'search', 'date', 'time', 'datetime', 'month', 'week', 'color', 'range',
        'checkbox', 'radio', 'file', 'submit', 'reset', 'button', 'hidden', 'image']);

    function preprocessAbbr(abbr) {
        // Replace input:type (and select:, textarea: etc) with attribute form
        abbr = abbr.replace(/\b(input|select|textarea|button):([\w-]+)/g, function (_, tag, type) {
            if (tag === 'input' && INPUT_TYPES.has(type)) {
                return 'input[type=' + type + ']';
            }
            return tag + ':' + type;
        });
        // link:css, script:src
        abbr = abbr.replace(/\blink:css\b/g, 'link[rel=stylesheet href=style.css]');
        abbr = abbr.replace(/\bscript:src\b/g, 'script[src=]');
        abbr = abbr.replace(/\bbtn\b/g, 'button');
        return abbr;
    }

    // Core parser — returns { html, rest }
    function parseExpression(str, depth) {
        var parts = [];
        var rest = str;

        while (rest.length > 0) {
            // Bare text node: {text} as a sibling (e.g. h2>{Title}+p)
            if (rest.charAt(0) === '{') {
                var closeB = rest.indexOf('}');
                if (closeB !== -1) {
                    parts.push(rest.slice(1, closeB));
                    rest = rest.slice(closeB + 1);
                    if (rest.charAt(0) === '+') rest = rest.slice(1);
                    continue;
                }
            }
            // Grouped expression: (...)
            if (rest.charAt(0) === '(') {
                var closeIdx = findCloseParen(rest, 0);
                var inner = rest.slice(1, closeIdx);
                var mul = 1;
                var afterParen = rest.slice(closeIdx + 1);
                var mulMatch = afterParen.match(/^\*(\d+)/);
                if (mulMatch) {
                    mul = parseInt(mulMatch[1], 10);
                    afterParen = afterParen.slice(mulMatch[0].length);
                }
                for (var i = 1; i <= mul; i++) {
                    var substituted = substituteCounter(inner, i, mul);
                    parts.push(parseExpression(substituted, depth).html);
                }
                rest = afterParen;
            } else {
                // Parse a single element node
                var node = parseNode(rest);
                parts.push(buildElement(node, depth));
                rest = node.rest;
            }

            // Check what follows
            if (rest.length === 0) break;
            var next = rest.charAt(0);

            if (next === '+') {
                rest = rest.slice(1);
                // continue loop = next sibling
            } else if (next === '^') {
                // go up: stop here, return remaining for parent
                rest = rest.slice(1);
                break;
            } else {
                break;
            }
        }

        return { html: parts.join('\n'), rest: rest };
    }

    // Parse a single element (with possible children via >)
    function parseNode(str) {
        var tagInfo = parseTagInfo(str);
        var rest = tagInfo.rest;
        var childHtml = '';
        var childText = '';

        // Children: >
        if (rest.charAt(0) === '>') {
            var childStr = rest.slice(1);

            // If the only child is a bare {text} block, treat as inner text
            var bareText = childStr.match(/^\{([^}]*)\}(.*)/);
            if (bareText) {
                childText = bareText[1];
                rest = bareText[2];
            } else {
                var childResult = parseExpression(childStr, 1);
                childHtml = childResult.html;
                rest = childResult.rest;
            }

            // Handle ^ after children
            while (rest.charAt(0) === '^') {
                rest = rest.slice(1);
                break;
            }
        }

        return {
            tag: tagInfo.tag,
            classes: tagInfo.classes,
            id: tagInfo.id,
            attrs: tagInfo.attrs,
            text: tagInfo.text || childText,
            mul: tagInfo.mul,
            childHtml: childHtml,
            rest: rest
        };
    }

    function buildElement(node, depth) {
        var results = [];
        var mul = node.mul || 1;

        for (var i = 1; i <= mul; i++) {
            var tag = node.tag || 'div';
            var classes = substituteCounter(node.classes.join(' '), i, mul);
            var id = substituteCounter(node.id, i, mul);
            var attrStr = substituteCounter(node.attrs, i, mul);
            var textStr = substituteCounter(node.text, i, mul);
            var childHtml = substituteCounter(node.childHtml, i, mul);

            // Build opening tag
            var open = '<' + tag;
            if (id) open += ' id="' + id + '"';
            if (classes) open += ' class="' + classes + '"';
            if (attrStr) open += ' ' + attrStr;

            if (VOID_TAGS.has(tag)) {
                open += '>';
                results.push(open);
                continue;
            }

            open += '>';

            // Determine inner content
            var inner = '';
            if (childHtml) {
                inner = '\n' + indent(childHtml, 1) + '\n';
            } else if (textStr) {
                // Handle lorem inside text
                textStr = textStr.replace(/lorem(\d*)/gi, function (m, n) {
                    return generateLorem(parseInt(n, 10) || 30);
                });
                inner = textStr;
            }

            var close = '</' + tag + '>';
            results.push(open + inner + close);
        }

        return results.join('\n');
    }

    function indent(str, level) {
        var prefix = '  '.repeat(level);
        return str.split('\n').map(function (line) {
            return prefix + line;
        }).join('\n');
    }

    // Parse tag, .class, #id, [attrs], {text}, *N from the start of str
    function parseTagInfo(str) {
        var tag = '', classes = [], id = '', attrs = '', text = '', mul = 1;
        var i = 0;

        // Tag name
        while (i < str.length && /[a-zA-Z0-9_-]/.test(str[i])) {
            tag += str[i++];
        }
        if (!tag) tag = 'div';

        // Modifiers loop
        while (i < str.length) {
            var c = str[i];

            if (c === '.') {
                // Class
                i++;
                var cls = '';
                while (i < str.length && /[a-zA-Z0-9_$-]/.test(str[i])) cls += str[i++];
                if (cls) classes.push(cls);

            } else if (c === '#') {
                // ID
                i++;
                var idStr = '';
                while (i < str.length && /[a-zA-Z0-9_$-]/.test(str[i])) idStr += str[i++];
                id = idStr;

            } else if (c === '[') {
                // Attributes
                i++;
                var attrRaw = '';
                while (i < str.length && str[i] !== ']') attrRaw += str[i++];
                if (str[i] === ']') i++;
                // Convert to HTML attrs: key=val → key="val", lone keys stay
                attrs = attrRaw.replace(/(\w[\w-]*)=([\S]+)/g, function (_, k, v) {
                    return k + '="' + v + '"';
                });

            } else if (c === '{') {
                // Text content
                i++;
                var txt = '';
                var depth = 1;
                while (i < str.length) {
                    if (str[i] === '{') depth++;
                    if (str[i] === '}') { depth--; if (depth === 0) { i++; break; } }
                    txt += str[i++];
                }
                text = txt;

            } else if (c === '*') {
                // Multiply
                i++;
                var num = '';
                while (i < str.length && /\d/.test(str[i])) num += str[i++];
                mul = parseInt(num, 10) || 1;

            } else {
                break;
            }
        }

        return {
            tag: tag,
            classes: classes,
            id: id,
            attrs: attrs,
            text: text,
            mul: mul,
            rest: str.slice(i)
        };
    }

    // Replace $ and $$ with current index
    function substituteCounter(str, i, total) {
        if (!str) return str;
        // $$ → zero-padded
        str = str.replace(/\$\$/g, String(i).padStart(2, '0'));
        // $ → plain number
        str = str.replace(/\$/g, String(i));
        return str;
    }

    // Find matching closing paren
    function findCloseParen(str, start) {
        var depth = 0;
        for (var i = start; i < str.length; i++) {
            if (str[i] === '(') depth++;
            if (str[i] === ')') { depth--; if (depth === 0) return i; }
        }
        return str.length - 1;
    }

    // ─── INIT ─────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        initTabs();
        initCopyHandlers();
        initPlayground();
        updateProgress('html-base');
    });

}());