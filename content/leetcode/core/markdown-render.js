/**
 * Markdown renderer
 * Version: 1.0.90
 */

(function () {
    'use strict';

    // === Markdown 渲染 ===
    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function fallbackMarkdown(md) {
        const placeholders = [];
        const createPlaceholder = (content) => {
            const placeholder = `___MD_BLOCK_${placeholders.length}___`;
            placeholders.push(content);
            return placeholder;
        };

        let html = (md || '').replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (m, lang, code) => {
            return createPlaceholder(`<pre><code class="lang-${lang || 'plain'}">${escapeHtml(code.trim())}</code></pre>`);
        });

        // 保护 $$...$$ 显示公式，避免被后续段落包装拆成多个节点。
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formulaBody) => {
            const compactFormula = String(formulaBody || '')
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .join(' ');

            if (!compactFormula) return match;
            return createPlaceholder(`<div class="md-math-block">\\[${escapeHtml(compactFormula)}\\]</div>`);
        });

        // table
        html = html.replace(/^(\|.+\|)\r?\n(\|[-:\|\s]+\|)\r?\n((?:\|.+\|\r?\n?)+)/gm, (match, headerRow, separatorRow, bodyRows) => {
            const headers = headerRow.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim());
            const alignments = separatorRow.split('|').filter(cell => cell.trim() !== '').map(cell => {
                const trimmed = cell.trim();
                if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
                if (trimmed.endsWith(':')) return 'right';
                return 'left';
            });
            const rows = bodyRows.trim().split('\n').map(row =>
                row.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim())
            );
            let tableHtml = '<table class="md-table"><thead><tr>';
            headers.forEach((header, i) => {
                tableHtml += `<th style="text-align:${alignments[i] || 'left'}">${escapeHtml(header)}</th>`;
            });
            tableHtml += '</tr></thead><tbody>';
            rows.forEach(row => {
                tableHtml += '<tr>';
                row.forEach((cell, i) => {
                    tableHtml += `<td style="text-align:${alignments[i] || 'left'}">${escapeHtml(cell)}</td>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody></table>';
            return tableHtml;
        });

        const inlineCodePlaceholders = [];
        html = html.replace(/`([^`]+?)`/g, (_, t) => {
            const token = `___MD_INLINE_CODE_${inlineCodePlaceholders.length}___`;
            inlineCodePlaceholders.push(`<code>${escapeHtml(t)}</code>`);
            return token;
        });

        html = html
            .replace(/^\s*###### (.*)$/gm, (_, t) => `<h6>${escapeHtml(t)}</h6>`)
            .replace(/^\s*##### (.*)$/gm, (_, t) => `<h5>${escapeHtml(t)}</h5>`)
            .replace(/^\s*#### (.*)$/gm, (_, t) => `<h4>${escapeHtml(t)}</h4>`)
            .replace(/^\s*### (.*)$/gm, (_, t) => `<h3>${escapeHtml(t)}</h3>`)
            .replace(/^\s*## (.*)$/gm, (_, t) => `<h2>${escapeHtml(t)}</h2>`)
            .replace(/^\s*# (.*)$/gm, (_, t) => `<h1>${escapeHtml(t)}</h1>`)
            .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '<hr>')
            .replace(/^\s*\> (.*)$/gm, (_, t) => `<blockquote>${escapeHtml(t)}</blockquote>`)
            .replace(/^\s*[-*]\s+(.*)$/gm, (_, t) => `<li>${escapeHtml(t)}</li>`)
            .replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`)
            .replace(/\*(.+?)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`)
            .replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(text)}</a>`);

        const lines = html.split('\n');
        let out = [];
        let inList = false;
        for (const line of lines) {
            if (line.trim().startsWith('<li>')) {
                if (!inList) {
                    out.push('<ul>');
                    inList = true;
                }
                out.push(line);
            } else {
                if (inList) {
                    out.push('</ul>');
                    inList = false;
                }
                out.push(line);
            }
        }
        if (inList) out.push('</ul>');

        html = out.map(l => {
            const trimmed = l.trim();
            if (!trimmed) return '';
            if (/___MD_BLOCK_\d+___/.test(trimmed)) return l;
            if (/^<\/?(h[1-6]|ul|li|blockquote|a|p|div|pre|table|hr)/.test(trimmed)) return l;
            return `<p>${l}</p>`;
        }).join('\n');

        placeholders.forEach((blockHtml, index) => {
            html = html.replace(`___MD_BLOCK_${index}___`, () => blockHtml);
        });
        inlineCodePlaceholders.forEach((inlineCodeHtml, index) => {
            html = html.replace(`___MD_INLINE_CODE_${index}___`, () => inlineCodeHtml);
        });

        return html;
    }

    function renderMarkdown(mdText) {
        let rawText = mdText || '';

        // 解码 HTML 实体，例如 &lt;、&gt;、&amp;
        // 防止重复转义导致显示异常
        rawText = rawText
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        // 自动闭合未完成的代码块，避免流式输出时闪烁
        // 检测 ``` 的数量；如果是奇数，说明还有一个代码块未闭合
        const fenceCount = (rawText.match(/```/g) || []).length;
        if (fenceCount % 2 !== 0) {
            rawText += '\n```';
        }

        rawText = rawText.replace(/\|\s*\|\s*(?=[^\-\n])/g, '|\n| ');
        rawText = rawText.replace(/(\|[-:\s]+\|)\s*(\|)/g, '$1\n$2');

        if (window.marked && typeof window.marked.parse === 'function') {
            try {
                return window.marked.parse(rawText);
            } catch (e) {
                console.warn('Markdown 解析失败，已回退到内置渲染:', e);
            }
        }
        return fallbackMarkdown(rawText);
    }

    window.MarkdownRenderer = {
        renderMarkdown,
        fallbackMarkdown,
        escapeHtml
    };
})();
