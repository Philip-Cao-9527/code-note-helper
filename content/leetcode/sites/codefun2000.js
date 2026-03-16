/**
 * LeetCode 笔记助手 站点适配 - codefun2000.com
 * 版本：1.0.35
 * 
 * 测试注意事项：
 * 1. CodeFun2000 需要登录才能查看题目内容,
 * 在未登录的情况下测试以及验证是无效的，不要做徒劳的尝试，这时候一定要手动登录
 * 2. 登录后需要点击「进入在线编程模式」按钮才能进入题目页面
 * 3. 只有进入编程模式后，Monaco 编辑器和题目详情才会渲染
 */

(function () {
    'use strict';

    const SITE_CONFIG = {
        content: '.scratchpad__problem, #content-ZhContent, .problem_content',
        editorType: 'monaco',
        official: '#content-textSol',
        lang: 'select.select'
    };

    // ========== CodeFun2000 专用 HTML→Markdown 提取 ==========
    // 目的：正确处理 Prism.js 代码高亮、KaTeX 公式、无用 UI 元素等，
    //       使输出为干净的 Markdown 文本而非网页源码。

    /**
     * 将 CodeFun2000 页面中的一个 DOM 容器转换为干净的 Markdown 文本。
     * 
     * 处理项：
     *   - <pre><code class="language-xxx"> → ```xxx\n纯代码\n```
     *   - KaTeX <span class="katex"> → 提取 <annotation> 中的 LaTeX 文本
     *   - <style> / <script> → 移除
     *   - <a href="javascript:;">Copy</a> → 移除
     *   - tab 切换头 (.section__tab-header-item) → 移除
     *   - <label>/<input>/<button>/<select> 等表单元素 → 移除
     *   - <img> → ![alt](src)
     *   - 剩余 HTML 标签 → 保留 textContent
     */
    function htmlToMarkdown(container) {
        if (!container) return '';

        // 在克隆上操作，避免影响页面 DOM
        const clone = container.cloneNode(true);

        // 1. 移除 <style> 和 <script>
        clone.querySelectorAll('style, script').forEach(el => el.remove());

        // 2. 移除 Copy 按钮: <a href="javascript:;">Copy</a>
        clone.querySelectorAll('a[href="javascript:;"]').forEach(el => el.remove());

        // 3. 移除 tab 切换头
        clone.querySelectorAll('.section__tab-header-item').forEach(el => el.remove());

        // 4. 移除表单元素（主题选择、字体大小等 UI 控件）
        clone.querySelectorAll('label, input, button, select').forEach(el => el.remove());

        // 5. 移除 .show-hide-box-parent（折叠/展开 UI）
        clone.querySelectorAll('.show-hide-box-parent, .show-hide-box').forEach(el => el.remove());

        // 6. 处理 KaTeX 公式：替换为 LaTeX 文本
        clone.querySelectorAll('.katex').forEach(katexEl => {
            const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]');
            const latex = annotation ? annotation.textContent.trim() : '';
            const textNode = document.createTextNode(latex);
            katexEl.replaceWith(textNode);
        });

        // 7. 处理代码块：<pre> 内包含 <code class="language-xxx">
        //    提取语言标识和纯代码文本（textContent 自动去除所有 <span> 标签）
        clone.querySelectorAll('pre').forEach(preEl => {
            const codeEl = preEl.querySelector('code[class*="language-"]');
            if (codeEl) {
                const classAttr = codeEl.className || '';
                const langMatch = classAttr.match(/language-(\w+)/);
                const lang = langMatch ? langMatch[1] : '';
                const codeText = codeEl.textContent;

                const placeholder = document.createTextNode(
                    '\n```' + lang + '\n' + codeText + '\n```\n'
                );
                preEl.replaceWith(placeholder);
            } else {
                // <pre> 没有 <code>，直接提取 textContent
                const placeholder = document.createTextNode(
                    '\n```\n' + preEl.textContent + '\n```\n'
                );
                preEl.replaceWith(placeholder);
            }
        });

        // 8. 处理 <img> → ![alt](src)
        clone.querySelectorAll('img').forEach(img => {
            const alt = img.getAttribute('alt') || '';
            const src = img.getAttribute('src') || '';
            const placeholder = document.createTextNode(`![${alt}](${src})`);
            img.replaceWith(placeholder);
        });

        // 9. 现在用 innerText 提取最终的纯文本
        //    innerText 会自动根据 DOM 结构保留换行和缩进，去除所有 HTML 标签
        let text = clone.innerText || clone.textContent || '';

        // 10. 清理多余空行（超过2个连续空行合并为2个）
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
    }

    /**
     * 提取 CodeFun2000 题目内容（题目描述 tab）
     * 使用 CodeFun2000 专用的 htmlToMarkdown，而非通用 extractMarkdown。
     */
    function extractProblemContent() {
        // 按优先级尝试多个选择器
        const selectors = ['#content-ZhContent', '.scratchpad__problem', '.problem_content'];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim()) {
                console.log('[CodeFun2000] 题目内容选择器命中:', sel);
                return htmlToMarkdown(el);
            }
        }
        return '';
    }

    /**
     * 提取 CodeFun2000 参考题解（官方题解 tab）
     * 使用 CodeFun2000 专用的 htmlToMarkdown，而非通用 extractMarkdown。
     */
    function extractOfficialSolution() {
        const el = document.querySelector('#content-textSol');
        if (el && el.textContent.trim()) {
            console.log('[CodeFun2000] 参考题解选择器命中: #content-textSol');
            return htmlToMarkdown(el);
        }
        return '';
    }

    /**
     * 获取页面标题
     * @returns {string} 题目名称（去掉分数、#PXXXX. 和 第X题- 前缀）
     * 
     * ⚠️ 测试注意：必须手动登录并进入在线编程模式后才能测试！
     * 
     * 已测试场景：
     * - "100\n#P4006. 接雨水" → "接雨水"（带分数和换行）
     * - "#P1498. 第1题-小红的构造" → "小红的构造"
     * - "第1题-塔子哥刷题" → "塔子哥刷题"
     * - "#P4518. 数组操作" → "数组操作"
     */
    function getProblemTitle() {
        // CodeFun2000 的标题选择器（根据实际测试）
        // 优先级：h1 > .section__title > 其他
        const selectors = [
            'h1',
            '.section__title',
            '.problem-title',
            'h1.title',
            '.name'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                // 使用 innerText 而非 textContent，可以更好地处理嵌套元素中的文本
                const rawTitle = (el.innerText || el.textContent).trim();

                // 链式清洗正则：
                // 1. /^[\s\S]*?#P\d+\.\s*/ - 使用 [\s\S] 匹配换行，跳过分数直到 #P1234.
                // 2. /^第\d+题-/ - 清除 "第X题-" 前缀
                const cleanTitle = rawTitle
                    .replace(/^[\s\S]*?#P\d+\.\s*/, '')  // 去掉 "100\n#P4006. " 这样的前缀
                    .replace(/^第\d+题-/, '');            // 去掉 "第1题-" 这样的前缀

                if (cleanTitle) return cleanTitle;
            }
        }
        return '';
    }

    window.LeetCodeSites = window.LeetCodeSites || {};
    window.LeetCodeSites['codefun2000.com'] = {
        name: 'CodeFun2000',
        matches: (host) => host.includes('codefun2000.com'),
        config: SITE_CONFIG,
        getProblemTitle,
        getProblemContent: extractProblemContent,
        getOfficialSolution: extractOfficialSolution
    };
})();
