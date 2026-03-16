/**
 * LeetCode 笔记助手 通用工具
 * 版本：1.0.33
 */

(function () {
    'use strict';

    // === Utils ===
    const Utils = {
        async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                try {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
                    document.body.appendChild(textarea);
                    textarea.select();
                    const success = document.execCommand('copy');
                    textarea.remove();
                    return success;
                } catch (e2) {
                    console.error('[Utils] 复制失败:', e2);
                    return false;
                }
            }
        }
    };

    window.NoteHelperUtils = Utils;
})();
