/**
 * LeetCode 笔记助手 入口模块
 * 版本：1.0.47
 */

(function () {
    'use strict';

    if (window.__LEETCODE_NOTE_HELPER_BOOTSTRAPPED__) return;
    window.__LEETCODE_NOTE_HELPER_BOOTSTRAPPED__ = true;

    console.log('[CodeNote Helper] Content script loaded (v1.0.47)');

    const getAdapterByHost = (host) => {
        const sites = window.LeetCodeSites || {};
        for (const key of Object.keys(sites)) {
            const adapter = sites[key];
            if (adapter && typeof adapter.matches === 'function') {
                if (adapter.matches(host)) return adapter;
            } else if (host.includes(key)) {
                return adapter;
            }
        }
        return null;
    };

    const getCurrentAdapter = () => {
        const host = window.location.hostname;
        return getAdapterByHost(host);
    };

    const fetchSolutionFromUrl = async (url) => {
        if (!url || typeof url !== 'string') return null;
        try {
            const urlObj = new URL(url.trim());
            const host = urlObj.hostname;
            const adapter = getAdapterByHost(host);
            if (adapter && typeof adapter.fetchSolutionFromUrl === 'function') {
                return await adapter.fetchSolutionFromUrl(url);
            }
        } catch (e) {
            console.error('从自定义URL获取题解失败:', e);
        }
        return null;
    };

    window.NoteHelperSiteRouter = {
        getCurrentAdapter,
        fetchSolutionFromUrl
    };

    if (!window.NoteHelperRecommendation) {
        console.warn('[Note Helper] Recommendation 模块未加载，将降级为基础推荐规则');
    }

    if (!window.NoteHelperUI || typeof window.NoteHelperUI.init !== 'function') {
        console.error('[Note Helper] 错误: UI 模块未加载');
        return;
    }

    window.NoteHelperUI.init();
})();
