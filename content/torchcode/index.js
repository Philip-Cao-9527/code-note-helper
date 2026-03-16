/**
 * TorchCode 深度学习笔记助手入口
 * 版本：1.0.52
 */

(function () {
    'use strict';

    if (window.__TORCHCODE_NOTE_HELPER_BOOTSTRAPPED__) return;
    window.__TORCHCODE_NOTE_HELPER_BOOTSTRAPPED__ = true;
    let initializedHref = '';
    let skipLogKey = '';
    const UI_GUARD_INTERVAL_MS = 1200;

    function getAllAdapters() {
        const sites = window.TorchCodeSites || {};
        return Object.keys(sites)
            .map((key) => sites[key])
            .filter(Boolean);
    }

    function getAdapterByHost(host) {
        const adapters = getAllAdapters();
        for (const adapter of adapters) {
            if (adapter && typeof adapter.matches === 'function' && adapter.matches(host)) {
                return adapter;
            }
        }
        return null;
    }

    function getCurrentAdapter() {
        return getAdapterByHost(window.location.hostname);
    }

    window.TorchCodeSiteRouter = {
        getCurrentAdapter,
        getAdapterByHost,
        getAllAdapters
    };

    function logSkipOnce(reason) {
        const key = `${reason}|${window.location.hostname}|${window.location.pathname}`;
        if (skipLogKey === key) return;
        skipLogKey = key;
        if (reason === 'unsupported') {
            console.log('[TorchCode Note Helper] 当前页面不在支持列表中');
            return;
        }
        if (reason === 'hf-entry') {
            console.log('[TorchCode Note Helper] Hugging Face 入口页不显示悬浮按钮，请在工作区页面使用');
            return;
        }
        console.error('[TorchCode Note Helper] 当前页面初始化条件不足');
    }

    function canInitOnCurrentPage() {
        const host = String(window.location.hostname || '').toLowerCase();
        if (host === 'huggingface.co') {
            return { ok: false, reason: 'hf-entry' };
        }

        const adapter = getCurrentAdapter();
        if (!adapter) {
            return { ok: false, reason: 'unsupported' };
        }

        if (!window.TorchCodeNotebookUtils || typeof window.TorchCodeNotebookUtils.buildPromptContext !== 'function') {
            return { ok: false, reason: 'context-missing' };
        }

        if (!window.TorchCodePromptGenerator || typeof window.TorchCodePromptGenerator.generatePrompt !== 'function') {
            return { ok: false, reason: 'prompt-missing' };
        }

        if (!window.TorchCodeUI || typeof window.TorchCodeUI.init !== 'function') {
            return { ok: false, reason: 'ui-missing' };
        }

        return { ok: true, adapter };
    }

    function setUiVisibility(visible) {
        if (!window.TorchCodeUI || typeof window.TorchCodeUI.setVisible !== 'function') return;
        window.TorchCodeUI.setVisible(Boolean(visible));
    }

    function tryInitForCurrentLocation() {
        if (initializedHref === window.location.href && document.getElementById('torchcode-note-helper-btn')) {
            return;
        }

        const result = canInitOnCurrentPage();
        if (!result.ok) {
            logSkipOnce(result.reason);
            setUiVisibility(false);
            return;
        }

        skipLogKey = '';
        initializedHref = window.location.href;
        console.log('[TorchCode Note Helper] Content script loaded (v1.0.52)');
        window.TorchCodeUI.init();
        setUiVisibility(true);
    }

    function ensureUiStillMounted() {
        const result = canInitOnCurrentPage();
        if (!result.ok) {
            setUiVisibility(false);
            return;
        }
        setUiVisibility(true);
        if (document.getElementById('torchcode-note-helper-btn')) return;
        window.TorchCodeUI.init();
    }

    function setupRouteWatcher() {
        let lastHref = window.location.href;
        const onRouteMaybeChanged = () => {
            if (window.location.href === lastHref) return;
            lastHref = window.location.href;
            initializedHref = '';
            tryInitForCurrentLocation();
        };

        window.addEventListener('popstate', () => {
            setTimeout(onRouteMaybeChanged, 0);
        });
        window.addEventListener('hashchange', () => {
            setTimeout(onRouteMaybeChanged, 0);
        });

        setInterval(() => {
            onRouteMaybeChanged();
            ensureUiStillMounted();
        }, UI_GUARD_INTERVAL_MS);
    }

    tryInitForCurrentLocation();
    setupRouteWatcher();
})();
