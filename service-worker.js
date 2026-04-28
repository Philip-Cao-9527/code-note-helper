/**
 * 后台 Service Worker
 * 版本：1.0.91
 * 
 * 调试说明：
 * - 打开 chrome://extensions/
 * - 点击扩展的 "Service Worker" 链接查看控制台
 * - 状态码 2 通常表示语法错误或文件路径问题
 */

console.log('[Service Worker] 开始初始化...');
console.log('[Service Worker] 当前时间:', new Date().toISOString());

try {
    console.log('[Service Worker] 尝试注册事件监听器...');
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Service Worker] 收到消息:', message?.type);
        handleMessage(message, sender)
            .then(sendResponse)
            .catch((error) => {
                console.error('[Service Worker] 消息处理失败：', error);
                console.error('[Service Worker] 错误堆栈：', error?.stack);
                sendResponse({
                    error: error && error.message ? error.message : String(error),
                    errorType: error && error.errorType ? error.errorType : 'runtime'
                });
            });
        return true;
    });
    
    console.log('[Service Worker] onMessage 监听器已注册');
    
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
    
    console.log('[Service Worker] tabs.onUpdated 监听器已注册');
    
    chrome.tabs.onRemoved.addListener((tabId) => {
        injectedTabs.delete(tabId);
    });
    
    console.log('[Service Worker] tabs.onRemoved 监听器已注册');
    
    chrome.storage.onChanged.addListener((changes, areaName) => {
        console.log('[Service Worker] storage.onChanged 事件:', areaName, Object.keys(changes));
        if (areaName === 'local' && changes.note_helper_theme_config) {
            console.log('[Service Worker] 检测到主题存储变化');
        }
    });
    
    console.log('[Service Worker] storage.onChanged 监听器已注册');
    
} catch (error) {
    console.error('[Service Worker] 初始化阶段发生致命错误：');
    console.error('[Service Worker] 错误信息：', error?.message || String(error));
    console.error('[Service Worker] 错误堆栈：', error?.stack);
    console.error('[Service Worker] 错误类型：', error?.name || typeof error);
}

async function handleMessage(message, sender) {
    console.log('[Service Worker] handleMessage 开始处理:', message?.type);
    
    try {
        const { type } = message || {};

        switch (type) {
            case 'FETCH_REQUEST':
                console.log('[Service Worker] 处理 FETCH_REQUEST');
                return handleFetchRequest(message);
            case 'CHECK_API_DOMAIN_PERMISSION':
                console.log('[Service Worker] 处理 CHECK_API_DOMAIN_PERMISSION');
                return handleCheckApiDomainPermission(message);
            case 'REQUEST_API_DOMAIN_PERMISSION':
                console.log('[Service Worker] 处理 REQUEST_API_DOMAIN_PERMISSION');
                return handleRequestApiDomainPermission(message);
            case 'OPEN_TAB':
                console.log('[Service Worker] 处理 OPEN_TAB');
                return handleOpenTab(message);
            case 'GET_MONACO_CODE':
                console.log('[Service Worker] 处理 GET_MONACO_CODE');
                return handleGetMonacoCode(sender.tab?.id);
            case 'GET_STORAGE':
                console.log('[Service Worker] 处理 GET_STORAGE，keys:', message.keys);
                return handleGetStorage(message.keys);
            case 'SET_STORAGE':
                console.log('[Service Worker] 处理 SET_STORAGE，keys:', Object.keys(message.data || {}));
                return handleSetStorage(message.data);
            case 'WEBDAV_REQUEST':
                console.log('[Service Worker] 处理 WEBDAV_REQUEST');
                return handleWebdavRequest(message);
            case 'THEME_CHANGED':
                console.log('[Service Worker] 处理 THEME_CHANGED');
                return handleThemeChanged(message, sender);
            default:
                console.error('[Service Worker] 未知消息类型：', type);
                throw new Error(`未知消息类型：${type}`);
        }
    } catch (error) {
        console.error('[Service Worker] handleMessage 内部错误：');
        console.error('[Service Worker] 错误信息：', error?.message);
        console.error('[Service Worker] 错误堆栈：', error?.stack);
        throw error;
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
        console.log('[Service Worker] API 权限检查结果:', granted);
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
        console.log('[Service Worker] API 权限申请结果:', granted);
        return { granted };
    } catch (error) {
        if (error && error.errorType) throw error;
        const wrapped = new Error(`API 域名权限申请失败：${error && error.message ? error.message : String(error)}`);
        wrapped.errorType = 'permission_request';
        throw wrapped;
    }
}

async function handleFetchRequest({ url, options = {} }) {
    console.log('[Service Worker] Fetch 请求:', options.method || 'GET', url);
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body
        });

        console.log('[Service Worker] Fetch 响应状态:', response.status);

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
        console.error('[Service Worker] Fetch 失败：', error?.message);
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
    console.log('[Service Worker] WebDAV 请求:', method, url);
    
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

        console.log('[Service Worker] WebDAV 响应状态:', response.status);

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
        console.error('[Service Worker] WebDAV 请求失败：', error?.message);
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
    console.log('[Service Worker] 打开标签页:', url);
    const tab = await chrome.tabs.create({ url, active });
    return { tabId: tab.id };
}

async function handleGetMonacoCode(tabId) {
    console.log('[Service Worker] 获取 Monaco 代码，tabId:', tabId);
    
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
        console.error('[Service Worker] 获取 Monaco 代码失败：', error?.message);
        throw new Error(`获取 Monaco 代码失败：${error.message}`);
    }
}

async function handleGetStorage(keys) {
    console.log('[Service Worker] 获取存储，keys:', keys);
    return chrome.storage.local.get(keys);
}

async function handleSetStorage(data) {
    console.log('[Service Worker] 设置存储，keys:', Object.keys(data || {}));
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

async function injectTimelineScript(tabId) {
    console.log('[Service Worker] 注入时间轴脚本到 tab:', tabId);
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

async function handleThemeChanged(message, sender) {
    const { theme, config, source } = message;

    console.log('[Service Worker] 收到主题变化通知，来源:', source, '主题:', theme);

    try {
        await broadcastThemeChangeToAllPages(theme, config, sender?.id);
        await broadcastThemeChangeToContentScripts(theme, config);

        return { success: true, message: '主题变化已广播' };
    } catch (error) {
        console.error('[Service Worker] 广播主题变化失败：', error);
        return { success: false, error: error.message };
    }
}

async function broadcastThemeChangeToAllPages(theme, config, excludeSenderId) {
    const runtimeMessage = {
        type: 'THEME_SYNC',
        theme: theme,
        config: config,
        source: 'service-worker'
    };

    try {
        console.log('[Service Worker] 广播主题变化给扩展页面');
        await chrome.runtime.sendMessage(runtimeMessage);
    } catch (error) {
        if (!error.message.includes('Could not establish connection')) {
            console.warn('[Service Worker] 广播主题变化给扩展页面失败：', error.message);
        }
    }
}

async function broadcastThemeChangeToContentScripts(theme, config) {
    console.log('[Service Worker] 广播主题变化给所有内容脚本');
    
    try {
        const tabs = await chrome.tabs.query({});
        console.log('[Service Worker] 查询到', tabs.length, '个标签页');
        
        for (const tab of tabs) {
            if (!tab.id) continue;

            try {
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'THEME_SYNC',
                    theme: theme,
                    config: config,
                    source: 'service-worker'
                });
            } catch (error) {
                if (!error.message.includes('Could not establish connection')) {
                    console.debug(`[Service Worker] 标签页 ${tab.id} 没有内容脚本或已关闭`);
                }
            }
        }
    } catch (error) {
        console.error('[Service Worker] 查询标签页失败：', error?.message);
    }
}

console.log('[Service Worker] 初始化完成，所有监听器已就绪');
console.log('[Service Worker] ========================================');
console.log('[Service Worker] 调试提示：');
console.log('[Service Worker] 1. 检查扩展管理页面是否有错误图标');
console.log('[Service Worker] 2. 点击 "Service Worker" 链接查看详细错误');
console.log('[Service Worker] 3. 如果状态码为 2，通常表示语法错误');
console.log('[Service Worker] 4. 检查 manifest.json 中的 service_worker 路径');
console.log('[Service Worker] ========================================');
