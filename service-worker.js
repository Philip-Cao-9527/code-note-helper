/**
 * 后台 Service Worker
 * 版本：1.0.9
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
            console.error('[Service Worker] 消息处理失败：', error);
            sendResponse({
                error: error && error.message ? error.message : String(error),
                errorType: error && error.errorType ? error.errorType : 'runtime'
            });
        });
    return true;
});

async function handleMessage(message, sender) {
    const { type } = message || {};

    switch (type) {
        case 'FETCH_REQUEST':
            return handleFetchRequest(message);
        case 'CHECK_API_DOMAIN_PERMISSION':
            return handleCheckApiDomainPermission(message);
        case 'REQUEST_API_DOMAIN_PERMISSION':
            return handleRequestApiDomainPermission(message);
        case 'OPEN_TAB':
            return handleOpenTab(message);
        case 'GET_MONACO_CODE':
            return handleGetMonacoCode(sender.tab?.id);
        case 'GET_STORAGE':
            return handleGetStorage(message.keys);
        case 'SET_STORAGE':
            return handleSetStorage(message.data);
        case 'WEBDAV_REQUEST':
            return handleWebdavRequest(message);
        default:
            throw new Error(`未知消息类型：${type}`);
    }
}

function normalizeApiPermissionPattern(pattern) {
    const value = String(pattern || '').trim();
    if (!value) {
        const error = new Error('缺少 API 域名权限模式');
        error.errorType = 'permission_validation';
        throw error;
    }
    if (!value.startsWith('https://') || !value.endsWith('/*')) {
        const error = new Error('API 域名权限模式无效，仅支持 https://host/*');
        error.errorType = 'permission_validation';
        throw error;
    }
    return value;
}

async function handleCheckApiDomainPermission({ pattern }) {
    try {
        const normalizedPattern = normalizeApiPermissionPattern(pattern);
        const granted = await chrome.permissions.contains({
            origins: [normalizedPattern]
        });
        return { granted };
    } catch (error) {
        if (error && error.errorType) throw error;
        const wrapped = new Error(`API 域名权限检查失败：${error && error.message ? error.message : String(error)}`);
        wrapped.errorType = 'permission_check';
        throw wrapped;
    }
}

async function handleRequestApiDomainPermission({ pattern }) {
    try {
        const normalizedPattern = normalizeApiPermissionPattern(pattern);
        const granted = await chrome.permissions.request({
            origins: [normalizedPattern]
        });
        return { granted };
    } catch (error) {
        if (error && error.errorType) throw error;
        const wrapped = new Error(`API 域名权限申请失败：${error && error.message ? error.message : String(error)}`);
        wrapped.errorType = 'permission_request';
        throw wrapped;
    }
}

async function handleFetchRequest({ url, options = {} }) {
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body
        });

        if (options.stream) {
            const text = await response.text();
            return {
                ok: response.ok,
                status: response.status,
                data: text
            };
        }

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

        return {
            ok: response.ok,
            status: response.status,
            data
        };
    } catch (error) {
        throw new Error(`Fetch 失败：${error.message}`);
    }
}

function classifyWebdavError(error) {
    if (!error) {
        return {
            errorType: 'unknown',
            errorMessage: '未知错误'
        };
    }

    if (error.name === 'AbortError') {
        return {
            errorType: 'timeout',
            errorMessage: '请求超时'
        };
    }

    const message = String(error.message || error).trim();
    if (/ERR_CERT|SSL|CERTIFICATE|证书/i.test(message)) {
        return {
            errorType: 'ssl',
            errorMessage: message
        };
    }

    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_INTERNET|ERR_NAME_NOT_RESOLVED|ERR_NETWORK/i.test(message)) {
        return {
            errorType: 'network',
            errorMessage: message
        };
    }

    return {
        errorType: 'unknown',
        errorMessage: message || '未知错误'
    };
}

function normalizeWebdavMethod(method) {
    const value = String(method || 'GET').trim().toUpperCase();
    return value || 'GET';
}

function normalizeHeaders(headers) {
    const source = headers && typeof headers === 'object' ? headers : {};
    const result = {};
    Object.keys(source).forEach((key) => {
        const value = source[key];
        if (value === undefined || value === null) return;
        result[key] = String(value);
    });
    return result;
}

async function handleWebdavRequest({
    method = 'GET',
    url,
    headers = {},
    body,
    timeout = 15000,
    methodOverride = ''
}) {
    if (!url) {
        return {
            ok: false,
            status: 0,
            statusText: '',
            headers: {},
            data: '',
            errorType: 'validation',
            errorMessage: '缺少 WebDAV 请求地址'
        };
    }

    const normalizedTimeout = Number(timeout) > 0 ? Number(timeout) : 15000;
    const normalizedMethod = normalizeWebdavMethod(method);
    const normalizedHeaders = normalizeHeaders(headers);
    const overrideValue = String(methodOverride || '').trim().toUpperCase();

    const fetchMethod = overrideValue ? 'POST' : normalizedMethod;
    if (overrideValue) {
        normalizedHeaders['X-HTTP-Method-Override'] = overrideValue;
        normalizedHeaders['X-Method-Override'] = overrideValue;
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), normalizedTimeout);

        const response = await fetch(url, {
            method: fetchMethod,
            headers: normalizedHeaders,
            body,
            signal: controller.signal
        });

        clearTimeout(timer);

        const data = await response.text();
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data,
            request: {
                method: fetchMethod,
                originalMethod: normalizedMethod,
                methodOverride: overrideValue || null,
                timeout: normalizedTimeout
            }
        };
    } catch (error) {
        const classified = classifyWebdavError(error);
        return {
            ok: false,
            status: 0,
            statusText: '',
            headers: {},
            data: '',
            errorType: classified.errorType,
            errorMessage: classified.errorMessage,
            request: {
                method: fetchMethod,
                originalMethod: normalizedMethod,
                methodOverride: overrideValue || null,
                timeout: normalizedTimeout
            }
        };
    }
}

async function handleOpenTab({ url, active = true }) {
    const tab = await chrome.tabs.create({ url, active });
    return { tabId: tab.id };
}

async function handleGetMonacoCode(tabId) {
    if (!tabId) {
        throw new Error('无法获取标签页 ID');
    }

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => {
                try {
                    if (window.monaco && window.monaco.editor) {
                        const models = window.monaco.editor.getModels();
                        if (models && models.length > 0) {
                            const validModel = models.reverse().find((model) => model.getValue().trim().length > 0);
                            if (validModel) {
                                return { success: true, code: validModel.getValue() };
                            }
                            return { success: true, code: models[0].getValue() };
                        }
                    }
                    return { success: false, error: 'Monaco 编辑器未找到' };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
        });

        if (results && results[0] && results[0].result) {
            return results[0].result;
        }

        return { success: false, error: '脚本执行后没有拿到结果' };
    } catch (error) {
        throw new Error(`获取 Monaco 代码失败：${error.message}`);
    }
}

async function handleGetStorage(keys) {
    return chrome.storage.local.get(keys);
}

async function handleSetStorage(data) {
    await chrome.storage.local.set(data);
    return { success: true };
}

const TIMELINE_PATTERNS = [
    'https://gemini.google.com/*',
    'https://chatgpt.com/*',
    'https://gpt.aimonkey.plus/*',
    'https://c.aimonkey.plus/*',
    'https://claude.ai/*'
];

const injectedTabs = new Map();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const shouldInject = TIMELINE_PATTERNS.some((pattern) => {
            const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
            return regex.test(tab.url);
        });

        if (!shouldInject) {
            return;
        }

        const lastUrl = injectedTabs.get(tabId);
        if (lastUrl !== tab.url) {
            injectedTabs.set(tabId, tab.url);
            setTimeout(() => {
                injectTimelineScript(tabId);
            }, 500);
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    injectedTabs.delete(tabId);
});

async function injectTimelineScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                if (window.__AI_TIMELINE_INJECTED__) {
                    window.dispatchEvent(new CustomEvent('ai-timeline-reinit'));
                }
            }
        });
    } catch (error) {
        console.warn('[Service Worker] 时间轴补注入失败：', error.message);
    }
}

console.log('[Service Worker] 已启动');

