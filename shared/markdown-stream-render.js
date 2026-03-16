/**
 * 共享 Markdown 与流式渲染工具
 * 版本：1.0.47
 */

(function () {
    'use strict';

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
        const source = String(text || '');

        targetElement.classList.remove('nh-streaming');
        targetElement.style.whiteSpace = '';
        targetElement.style.wordBreak = '';

        if (mode === 'plain') {
            targetElement.textContent = source;
            return;
        }

        const markdownRenderer = resolveMarkdownRenderer(options.markdownRenderer);
        if (markdownRenderer) {
            try {
                targetElement.innerHTML = markdownRenderer(source);
                return;
            } catch (error) {
                console.warn('[MarkdownStreamRender] Markdown 渲染失败，已回退为纯文本:', error);
            }
        }

        targetElement.textContent = source;
    }

    window.NoteHelperMarkdownStreamRender = {
        renderToElement
    };
})();
