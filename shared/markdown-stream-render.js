/**
 * 共享 Markdown 与流式渲染工具
 * 版本：1.0.47
 */

(function () {
    'use strict';

    function renderAsPlainText(targetElement, source) {
        targetElement.style.whiteSpace = 'pre-wrap';
        targetElement.style.wordBreak = 'break-word';
        targetElement.textContent = source;
    }

    function isLikelyQaInlinePlusList(line) {
        if (!line || !/\s\+\s/.test(line)) return false;
        const numberedMatch = line.match(/^(\s*\d+\.\s+)(.+)$/);
        if (!numberedMatch) return false;
        const segments = numberedMatch[2]
            .split(/\s+\+\s+/)
            .map((item) => item.trim())
            .filter(Boolean);
        if (segments.length < 3) return false;
        const bracketLikeCount = segments.filter((segment) => /\[[^\]]+\]/.test(segment)).length;
        return bracketLikeCount >= 2;
    }

    function normalizeQaInlinePlusLine(line) {
        const numberedMatch = line.match(/^(\s*\d+\.\s+)(.+)$/);
        if (!numberedMatch) return line;
        const prefix = numberedMatch[1];
        const segments = numberedMatch[2]
            .split(/\s+\+\s+/)
            .map((item) => item.trim())
            .filter(Boolean);
        if (segments.length < 2) return line;

        const normalizedLines = [`${prefix}${segments[0]}`];
        for (let index = 1; index < segments.length; index += 1) {
            normalizedLines.push(`   - ${segments[index]}`);
        }
        return normalizedLines.join('\n');
    }

    function normalizeOutsideCodeFence(text) {
        const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
        return lines.map((line) => {
            if (!isLikelyQaInlinePlusList(line)) return line;
            return normalizeQaInlinePlusLine(line);
        }).join('\n');
    }

    function normalizeForReadableMarkdown(sourceText) {
        const source = String(sourceText || '');
        if (!source) return '';
        const parts = source.split(/(```[\s\S]*?```)/g);
        return parts.map((part) => {
            if (!part) return part;
            if (part.startsWith('```') && part.endsWith('```')) {
                return part;
            }
            return normalizeOutsideCodeFence(part);
        }).join('');
    }

    function resolveMarkdownRenderer(customRenderer) {
        if (typeof customRenderer === 'function') {
            return customRenderer;
        }

        const renderer = window.MarkdownRenderer && window.MarkdownRenderer.renderMarkdown;
        if (typeof renderer === 'function') {
            return renderer;
        }

        return null;
    }

    function renderToElement(targetElement, text, options = {}) {
        if (!targetElement) return;

        const mode = options.mode || 'markdown';
        const source = mode === 'plain'
            ? String(text || '')
            : normalizeForReadableMarkdown(text);

        targetElement.classList.remove('nh-streaming');

        if (mode === 'plain') {
            renderAsPlainText(targetElement, source);
            return;
        }

        targetElement.style.whiteSpace = '';
        targetElement.style.wordBreak = '';

        const markdownRenderer = resolveMarkdownRenderer(options.markdownRenderer);
        if (markdownRenderer) {
            try {
                targetElement.innerHTML = markdownRenderer(source);
                return;
            } catch (error) {
                console.warn('[MarkdownStreamRender] Markdown 渲染失败，已回退为纯文本:', error);
            }
        }

        renderAsPlainText(targetElement, source);
    }

    window.NoteHelperMarkdownStreamRender = {
        renderToElement,
        normalizeForReadableMarkdown
    };
})();
