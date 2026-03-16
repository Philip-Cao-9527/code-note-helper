/**
 * LeetCode 笔记助手 API 客户端（兼容壳层）
 * 版本：1.0.47
 */

(function () {
    'use strict';

    if (window.NoteHelperApiClient && typeof window.NoteHelperApiClient.callAI === 'function') {
        window.ApiClient = window.NoteHelperApiClient;
        return;
    }

    console.error('[Note Helper] 共享 API 客户端未加载，已降级为占位实现');
    window.ApiClient = {
        async callAI() {
            throw new Error('AI 客户端未加载，请刷新页面后重试。');
        }
    };
})();
