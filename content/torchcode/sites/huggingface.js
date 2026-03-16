/**
 * TorchCode 站点适配 - Hugging Face / hf.space
 * 版本：1.0.43
 */

(function () {
    'use strict';

    function getNotebookUtils() {
        return window.TorchCodeNotebookUtils || null;
    }

    function normalizeNotebookPath(path) {
        return String(path || '').replace(/^\/+/, '');
    }

    async function fetchNotebookContent(notebookPath) {
        if (!notebookPath) {
            throw new Error('未能识别当前 notebook 路径');
        }

        const encodedPath = notebookPath
            .split('/')
            .filter(Boolean)
            .map((segment) => encodeURIComponent(segment))
            .join('/');

        const response = await fetch(`${window.location.origin}/api/contents/${encodedPath}?content=1`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`读取 notebook 内容失败：${response.status}`);
        }

        return response.json();
    }

    async function collectFromHfSpace() {
        const utils = getNotebookUtils();
        if (!utils || typeof utils.extractNotebookPathFromUrl !== 'function') {
            throw new Error('TorchCode 工具模块未加载');
        }

        const notebookPath = normalizeNotebookPath(utils.extractNotebookPathFromUrl(window.location.href));
        if (!notebookPath) {
            throw new Error('请先在工作区中打开具体 notebook，再生成笔记');
        }

        const notebookContent = await fetchNotebookContent(notebookPath);
        const extracted = utils.extractNotebookPartsFromContent(notebookContent);
        const fileName = notebookPath.split('/').pop() || notebookPath;

        return {
            sourceType: 'torchcode-workspace',
            fileName,
            notebookPath,
            sourceLabel: 'TorchCode 工作区',
            sourceUrl: window.location.href,
            markdownTexts: extracted.markdownTexts,
            codeTexts: extracted.codeTexts,
            links: {
                workspaceHome: 'https://huggingface.co/spaces/duoan/TorchCode'
            }
        };
    }

    async function collectFromHuggingFaceEntry() {
        const iframe = document.querySelector('iframe[src*="duoan-torchcode.hf.space"]');
        const iframeUrl = iframe && iframe.getAttribute('src') ? iframe.getAttribute('src') : 'https://duoan-torchcode.hf.space/';

        throw new Error(`当前是 Hugging Face 入口页。请先进入工作区：${iframeUrl}`);
    }

    async function collectPageData() {
        const host = String(window.location.hostname || '').toLowerCase();
        if (host === 'duoan-torchcode.hf.space') {
            return collectFromHfSpace();
        }
        return collectFromHuggingFaceEntry();
    }

    window.TorchCodeSites = window.TorchCodeSites || {};
    window.TorchCodeSites.huggingface = {
        name: 'TorchCode HuggingFace',
        matches(host) {
            const normalizedHost = String(host || '').toLowerCase();
            if (normalizedHost === 'duoan-torchcode.hf.space') {
                return true;
            }
            if (normalizedHost !== 'huggingface.co') {
                return false;
            }
            return /^\/spaces\/duoan\/TorchCode/i.test(window.location.pathname || '');
        },
        collectPageData
    };
})();
