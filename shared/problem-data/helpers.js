/**
 * 刷题记录共享工具
 * 版本：1.0.64
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const STORAGE_KEYS = constants.STORAGE_KEYS || {};
    const NUTSTORE_BASE_URL = constants.NUTSTORE_BASE_URL || 'https://dav.jianguoyun.com/dav/';
    const DEFAULT_NUTSTORE_REMOTE_DIRECTORY = constants.DEFAULT_NUTSTORE_REMOTE_DIRECTORY || 'CodeNote-Helper/backups';
    const DEFAULT_NUTSTORE_REMOTE_FILE_NAME = constants.DEFAULT_NUTSTORE_REMOTE_FILE_NAME || 'full-backup.json';
    const DEFAULT_NUTSTORE_REMOTE_PATH = constants.DEFAULT_NUTSTORE_REMOTE_PATH
        || `${DEFAULT_NUTSTORE_REMOTE_DIRECTORY}/${DEFAULT_NUTSTORE_REMOTE_FILE_NAME}`;

    let hasWarnedLocalStorageUnavailable = false;
    let hasWarnedSyncStorageUnavailable = false;

    function cloneValue(value) {
        if (value === null || value === undefined) return value;
        return JSON.parse(JSON.stringify(value));
    }

    function safeJsonParse(text) {
        if (typeof text !== 'string') return null;
        try {
            return JSON.parse(text);
        } catch (error) {
            console.error('[ProblemData] JSON 解析失败：', error);
            return null;
        }
    }

    function normalizeHost(hostname) {
        return String(hostname || '').replace(/^www\./, '').toLowerCase();
    }

    function compareIsoDesc(a, b) {
        return new Date(b || 0).getTime() - new Date(a || 0).getTime();
    }

    function createDeviceId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `device-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    function base64EncodeUtf8(text) {
        const source = String(text || '');

        if (typeof Buffer !== 'undefined') {
            return Buffer.from(source, 'utf8').toString('base64');
        }

        if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
            const bytes = new TextEncoder().encode(source);
            let binary = '';
            bytes.forEach((byte) => {
                binary += String.fromCharCode(byte);
            });
            return btoa(binary);
        }

        if (typeof btoa === 'function') {
            return btoa(source);
        }

        throw new Error('当前环境不支持 Base64 编码');
    }

    function buildBasicAuth(username, password) {
        const source = `${username || ''}:${password || ''}`;
        return `Basic ${base64EncodeUtf8(source)}`;
    }

    function sanitizeRemotePath(remotePath) {
        let clean = String(remotePath || '')
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/\/{2,}/g, '/');

        if (!clean) return DEFAULT_NUTSTORE_REMOTE_PATH;

        if (clean.endsWith('/')) {
            clean = clean.replace(/\/+$/, '');
            clean = clean
                ? `${clean}/${DEFAULT_NUTSTORE_REMOTE_FILE_NAME}`
                : DEFAULT_NUTSTORE_REMOTE_PATH;
        }

        const segments = clean
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean);

        if (!segments.length) return DEFAULT_NUTSTORE_REMOTE_PATH;
        if (segments.length === 1) {
            return `${DEFAULT_NUTSTORE_REMOTE_DIRECTORY}/${segments[0]}`;
        }

        return segments.join('/');
    }

    function encodeRemotePathSegment(segment) {
        return encodeURIComponent(String(segment || '').trim());
    }

    function joinRemotePathSegments(segments, options = {}) {
        const config = {
            leadingSlash: false,
            trailingSlash: false,
            ...(options || {})
        };
        const joined = (segments || [])
            .map((segment) => String(segment || '').trim())
            .filter(Boolean)
            .join('/');

        if (!joined) {
            if (config.leadingSlash && config.trailingSlash) return '/';
            if (config.leadingSlash) return '/';
            return '';
        }

        let output = joined;
        if (config.leadingSlash) output = `/${output}`;
        if (config.trailingSlash) output = `${output}/`;
        return output;
    }

    function splitRemotePath(remotePath) {
        const sanitizedRemotePath = sanitizeRemotePath(remotePath);
        const segments = sanitizedRemotePath.split('/').map((segment) => segment.trim()).filter(Boolean);
        const fileName = segments.pop() || DEFAULT_NUTSTORE_REMOTE_FILE_NAME;
        return {
            sanitizedRemotePath,
            directorySegments: segments,
            fileName
        };
    }

    function normalizeBaseUrl(baseUrl) {
        const source = String(baseUrl || NUTSTORE_BASE_URL).trim();
        try {
            const url = new URL(source);
            const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
            return `${url.protocol}//${url.host}${path}`;
        } catch (error) {
            return NUTSTORE_BASE_URL;
        }
    }

    function buildNutstoreBaseUrlCandidates(baseUrl) {
        const normalized = normalizeBaseUrl(baseUrl);
        let parsed;

        try {
            parsed = new URL(normalized);
        } catch (error) {
            return [normalizeBaseUrl(NUTSTORE_BASE_URL)];
        }

        const host = parsed.host;
        const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;

        const candidates = [];
        ['https:', 'http:'].forEach((protocol) => {
            candidates.push(`${protocol}//${host}${pathname}`);
        });

        candidates.push(normalized);

        return Array.from(new Set(candidates));
    }

    function buildNutstoreUrlFromSegments(segments, options = {}) {
        const config = {
            trailingSlash: false,
            baseUrl: NUTSTORE_BASE_URL,
            ...(options || {})
        };
        const encodedSegments = (segments || []).map(encodeRemotePathSegment);
        const relativePath = joinRemotePathSegments(encodedSegments, {
            leadingSlash: false,
            trailingSlash: Boolean(config.trailingSlash)
        });

        return `${normalizeBaseUrl(config.baseUrl)}${relativePath}`;
    }

    function buildNutstorePathInfo(remotePath, baseUrl = NUTSTORE_BASE_URL) {
        const { sanitizedRemotePath, directorySegments, fileName } = splitRemotePath(remotePath);
        const encodedDirectorySegments = directorySegments.map(encodeRemotePathSegment);
        const encodedFileName = encodeRemotePathSegment(fileName);
        const encodedRemotePath = joinRemotePathSegments([...encodedDirectorySegments, encodedFileName]);
        const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

        return {
            sanitizedRemotePath,
            directorySegments,
            encodedDirectorySegments,
            fileName,
            encodedFileName,
            filePath: joinRemotePathSegments([...directorySegments, fileName], { leadingSlash: true }),
            directoryPath: joinRemotePathSegments(directorySegments, {
                leadingSlash: true,
                trailingSlash: directorySegments.length > 0
            }),
            encodedRemotePath,
            rootUrl: normalizedBaseUrl,
            directoryUrl: directorySegments.length > 0
                ? buildNutstoreUrlFromSegments(directorySegments, {
                    trailingSlash: true,
                    baseUrl: normalizedBaseUrl
                })
                : normalizedBaseUrl,
            remoteUrl: `${normalizedBaseUrl}${encodedRemotePath}`,
            baseUrl: normalizedBaseUrl
        };
    }

    function buildNutstoreUrl(remotePath, baseUrl = NUTSTORE_BASE_URL) {
        return buildNutstorePathInfo(remotePath, baseUrl).remoteUrl;
    }

    function getBrowserSyncInfo() {
        const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
        const isEdge = /Edg\//.test(userAgent);
        return {
            browserName: isEdge ? 'Microsoft Edge' : 'Google Chrome',
            settingsUrl: isEdge ? 'edge://settings/profiles/sync' : 'chrome://settings/syncSetup'
        };
    }

    async function openBrowserSyncSettings() {
        const browserSyncInfo = getBrowserSyncInfo();
        if (typeof chrome === 'undefined' || !chrome.tabs || typeof chrome.tabs.create !== 'function') {
            throw new Error('当前环境无法打开浏览器同步设置');
        }
        await chrome.tabs.create({
            url: browserSyncInfo.settingsUrl,
            active: true
        });
        return browserSyncInfo;
    }

    function getLocalStorageApi() {
        if (window.Storage &&
            typeof window.Storage.get === 'function' &&
            typeof window.Storage.set === 'function' &&
            typeof window.Storage.getMultiple === 'function' &&
            typeof window.Storage.setMultiple === 'function') {
            return window.Storage;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return {
                async get(key, defaultValue = null) {
                    const result = await chrome.storage.local.get(key);
                    return result[key] !== undefined ? result[key] : defaultValue;
                },
                async set(key, value) {
                    await chrome.storage.local.set({ [key]: value });
                },
                async getMultiple(keys) {
                    return chrome.storage.local.get(keys);
                },
                async setMultiple(data) {
                    await chrome.storage.local.set(data);
                },
                async remove(keys) {
                    await chrome.storage.local.remove(keys);
                }
            };
        }

        if (!hasWarnedLocalStorageUnavailable) {
            console.warn('[ProblemData] 本地存储不可用，记录能力将降级');
            hasWarnedLocalStorageUnavailable = true;
        }
        return null;
    }

    function getSyncStorageApi() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            return {
                async get(key, defaultValue = null) {
                    const result = await chrome.storage.sync.get(key);
                    return result[key] !== undefined ? result[key] : defaultValue;
                },
                async set(key, value) {
                    await chrome.storage.sync.set({ [key]: value });
                },
                async getMultiple(keys) {
                    return chrome.storage.sync.get(keys);
                },
                async setMultiple(data) {
                    await chrome.storage.sync.set(data);
                },
                async remove(keys) {
                    await chrome.storage.sync.remove(keys);
                }
            };
        }

        if (!hasWarnedSyncStorageUnavailable) {
            console.warn('[ProblemData] chrome.storage.sync 不可用，同步能力将降级');
            hasWarnedSyncStorageUnavailable = true;
        }
        return null;
    }

    async function probeSyncStorageAvailability() {
        const api = getSyncStorageApi();
        if (!api) {
            return {
                available: false,
                reason: 'sync-api-unavailable',
                message: '当前环境不支持浏览器同步存储'
            };
        }

        try {
            await api.get(STORAGE_KEYS.chromeSyncManifest || '__sync_probe__', null);
            return {
                available: true,
                reason: 'ok',
                message: '同步存储可用'
            };
        } catch (error) {
            return {
                available: false,
                reason: 'sync-api-error',
                message: error && error.message ? error.message : '同步存储访问失败'
            };
        }
    }

    async function readLocal(key, defaultValue) {
        const api = getLocalStorageApi();
        if (!api) return cloneValue(defaultValue);
        const value = await api.get(key, defaultValue);
        return value === undefined ? cloneValue(defaultValue) : value;
    }

    async function writeLocal(key, value) {
        const api = getLocalStorageApi();
        if (!api) {
            throw new Error(`本地存储不可用，无法写入 ${key}`);
        }
        await api.set(key, value);
    }

    async function writeLocalMultiple(data) {
        const api = getLocalStorageApi();
        if (!api) {
            throw new Error('本地存储不可用，无法批量写入');
        }
        await api.setMultiple(data);
    }

    async function removeLocal(keys) {
        const api = getLocalStorageApi();
        if (!api || typeof api.remove !== 'function') {
            throw new Error('本地存储不可用，无法删除数据');
        }
        await api.remove(keys);
    }

    async function readSync(key, defaultValue) {
        const api = getSyncStorageApi();
        if (!api) return cloneValue(defaultValue);
        const value = await api.get(key, defaultValue);
        return value === undefined ? cloneValue(defaultValue) : value;
    }

    async function writeSync(key, value) {
        const api = getSyncStorageApi();
        if (!api) {
            throw new Error(`同步存储不可用，无法写入 ${key}`);
        }
        await api.set(key, value);
    }

    async function writeSyncMultiple(data) {
        const api = getSyncStorageApi();
        if (!api) {
            throw new Error('同步存储不可用，无法批量写入');
        }
        await api.setMultiple(data);
    }

    async function removeSync(keys) {
        const api = getSyncStorageApi();
        if (!api) {
            throw new Error('同步存储不可用，无法删除数据');
        }
        await api.remove(keys);
    }

    async function sendRuntimeMessage(type, data) {
        if (window.Messaging && typeof window.Messaging.send === 'function') {
            return window.Messaging.send(type, data);
        }

        if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
            throw new Error('当前环境不支持 runtime 消息通信');
        }

        return chrome.runtime.sendMessage({ type, ...(data || {}) });
    }

    modules.helpers = {
        STORAGE_KEYS,
        cloneValue,
        safeJsonParse,
        normalizeHost,
        compareIsoDesc,
        createDeviceId,
        base64EncodeUtf8,
        buildBasicAuth,
        sanitizeRemotePath,
        encodeRemotePathSegment,
        joinRemotePathSegments,
        splitRemotePath,
        normalizeBaseUrl,
        buildNutstoreBaseUrlCandidates,
        buildNutstoreUrlFromSegments,
        buildNutstorePathInfo,
        buildNutstoreUrl,
        getBrowserSyncInfo,
        openBrowserSyncSettings,
        getLocalStorageApi,
        getSyncStorageApi,
        probeSyncStorageAvailability,
        readLocal,
        writeLocal,
        writeLocalMultiple,
        removeLocal,
        readSync,
        writeSync,
        writeSyncMultiple,
        removeSync,
        sendRuntimeMessage
    };
})();
