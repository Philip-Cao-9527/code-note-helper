/**
 * 坚果云 WebDAV 提供方
 * 版本：1.0.64
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const helpers = modules.helpers || {};
    const syncCore = modules.syncCore || {};

    const REQUEST_TIMEOUT = 15000;
    const REQUEST_RETRY_ATTEMPTS = 3;
    const REQUEST_RETRY_DELAY = 240;
    const STRATEGY_CACHE_KEY = 'note_helper_webdav_strategy_cache_v1';
    const METHOD_MODES = ['native', 'override'];
    const OVERRIDE_METHODS = new Set(['PROPFIND', 'MKCOL']);
    const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

    const STAGE_LABELS = {
        config: '配置错误',
        connect: '连接失败',
        directory: '目录确认失败',
        upload: '上传失败',
        restore: '恢复失败'
    };

    function createWebdavError(message, detail = {}) {
        const error = new Error(message || 'WebDAV 请求失败');
        Object.assign(error, detail || {});
        return error;
    }

    function getErrorMessage(error, fallback = '未知错误') {
        if (!error) return fallback;
        return String(error.message || error || fallback).trim() || fallback;
    }

    function buildStatusText(response) {
        if (!response || typeof response.status !== 'number') return '未知状态';
        if (response.statusText) return `${response.status} ${response.statusText}`;
        return String(response.status);
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function getHostFromUrl(url) {
        try {
            return new URL(url).host;
        } catch (error) {
            return '';
        }
    }

    async function getStrategyCache() {
        return helpers.readLocal(STRATEGY_CACHE_KEY, {});
    }

    async function saveStrategyCache(cache) {
        await helpers.writeLocal(STRATEGY_CACHE_KEY, cache || {});
    }

    async function updateStrategyCache(baseUrl, strategy) {
        const host = getHostFromUrl(baseUrl);
        if (!host) return;

        try {
            const cache = await getStrategyCache();
            cache[host] = {
                ...(cache[host] || {}),
                ...(strategy || {}),
                updatedAt: new Date().toISOString()
            };
            await saveStrategyCache(cache);
        } catch (error) {
            console.warn('[ProblemData] WebDAV 策略缓存写入失败：', error);
        }
    }

    function shouldUseOverride(methodMode, method) {
        if (methodMode !== 'override') return false;
        const upperMethod = String(method || '').toUpperCase();
        return OVERRIDE_METHODS.has(upperMethod);
    }

    function isRetryableError(error) {
        if (!error) return false;
        if (error.errorType === 'network' || error.errorType === 'timeout' || error.errorType === 'runtime') {
            return true;
        }
        if (typeof error.status === 'number' && RETRYABLE_STATUS.has(error.status)) {
            return true;
        }
        return false;
    }

    function buildErrorWithStage(error, stage, fallback) {
        if (error && error.stage === stage && error.message) {
            return error;
        }

        const stageLabel = STAGE_LABELS[stage] || '同步失败';
        const detailMessage = getErrorMessage(error, fallback || `${stageLabel}，请稍后重试`);
        const finalMessage = detailMessage.startsWith(`${stageLabel}：`)
            ? detailMessage
            : `${stageLabel}：${detailMessage}`;

        return createWebdavError(finalMessage, {
            stage,
            errorType: (error && error.errorType) || stage || 'webdav',
            status: error && error.status,
            response: error && error.response,
            originalError: error || null
        });
    }

    async function sendWebdavRequest(request) {
        try {
            return await helpers.sendRuntimeMessage('WEBDAV_REQUEST', request);
        } catch (error) {
            throw createWebdavError(`WebDAV 请求失败：${getErrorMessage(error)}`, {
                errorType: 'runtime'
            });
        }
    }

    async function getNutstoreConfig() {
        const settings = await syncCore.getSyncSettings();
        const webdav = settings.webdav || {};
        const email = String(webdav.email || '').trim();
        const appPassword = String(webdav.appPassword || '').trim();

        if (!email || !appPassword) {
            throw createWebdavError('请先填写坚果云邮箱和应用密码', {
                stage: 'config',
                errorType: 'config'
            });
        }

        const remotePath = helpers.sanitizeRemotePath(webdav.remotePath);
        const baseUrlCandidates = helpers.buildNutstoreBaseUrlCandidates(webdav.baseUrl);

        return {
            email,
            appPassword,
            remotePath,
            authorization: helpers.buildBasicAuth(email, appPassword),
            baseUrlCandidates
        };
    }

    function buildHeaders(context, extraHeaders = {}) {
        return {
            Authorization: context.config.authorization,
            ...(extraHeaders || {})
        };
    }

    async function requestWebdav(context, method, url, options = {}) {
        const methodMode = context.methodMode || 'native';
        const useOverride = shouldUseOverride(methodMode, method);
        const headers = buildHeaders(context, options.headers || {});

        const requestPayload = {
            method: String(method || 'GET').toUpperCase(),
            methodOverride: useOverride ? String(method || 'GET').toUpperCase() : '',
            url,
            headers,
            body: options.body,
            timeout: Number(options.timeout || REQUEST_TIMEOUT)
        };

        const acceptStatuses = Array.isArray(options.acceptStatuses) && options.acceptStatuses.length
            ? options.acceptStatuses
            : [200, 201, 204, 207];

        let lastError = null;
        const attempts = options.retry === false
            ? 1
            : Number(options.attempts || REQUEST_RETRY_ATTEMPTS);

        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                const response = await sendWebdavRequest(requestPayload);

                if (!response || (response.status === 0 && response.errorType)) {
                    throw createWebdavError(
                        response && response.errorMessage
                            ? response.errorMessage
                            : '网络连接异常，请检查网络后重试',
                        {
                            errorType: (response && response.errorType) || 'network',
                            status: 0,
                            response
                        }
                    );
                }

                if (!acceptStatuses.includes(response.status)) {
                    throw createWebdavError(
                        `${options.errorMessage || 'WebDAV 请求失败'}：${buildStatusText(response)}`,
                        {
                            errorType: 'http-status',
                            status: response.status,
                            response
                        }
                    );
                }

                return response;
            } catch (error) {
                lastError = error;
                if (attempt >= attempts || !isRetryableError(error)) {
                    throw lastError;
                }
                await sleep(REQUEST_RETRY_DELAY * attempt);
            }
        }

        throw lastError || createWebdavError('WebDAV 请求失败');
    }

    async function probeRoot(context) {
        return requestWebdav(context, 'PROPFIND', context.pathInfo.rootUrl, {
            headers: { Depth: '0' },
            acceptStatuses: [200, 207],
            errorMessage: '根目录连接失败',
            stage: 'connect'
        });
    }

    async function resolveConnectionStrategy(config) {
        const cache = await getStrategyCache();
        const baseUrlCandidates = Array.isArray(config.baseUrlCandidates) && config.baseUrlCandidates.length
            ? config.baseUrlCandidates
            : helpers.buildNutstoreBaseUrlCandidates();

        const strategyCandidates = [];
        baseUrlCandidates.forEach((baseUrl) => {
            const host = getHostFromUrl(baseUrl);
            const cached = host ? cache[host] : null;
            const modes = cached && cached.methodMode
                ? [cached.methodMode, ...METHOD_MODES.filter((mode) => mode !== cached.methodMode)]
                : METHOD_MODES;

            modes.forEach((methodMode) => {
                strategyCandidates.push({ baseUrl, methodMode });
            });
        });

        const errors = [];

        for (const candidate of strategyCandidates) {
            const pathInfo = helpers.buildNutstorePathInfo(config.remotePath, candidate.baseUrl);
            const context = {
                config,
                methodMode: candidate.methodMode,
                pathInfo
            };

            try {
                await probeRoot(context);
                await updateStrategyCache(candidate.baseUrl, {
                    baseUrl: candidate.baseUrl,
                    methodMode: candidate.methodMode
                });
                return context;
            } catch (error) {
                const reason = getErrorMessage(error);
                errors.push(`${candidate.baseUrl}(${candidate.methodMode}) -> ${reason}`);
            }
        }

        console.error('[ProblemData] WebDAV 连接策略全部失败：', errors);
        throw createWebdavError('无法连接到坚果云 WebDAV，请检查地址、账号和应用密码。', {
            stage: 'connect',
            errorType: 'strategy-exhausted',
            details: errors
        });
    }

    async function ensureRemoteDirectory(context) {
        const { directorySegments } = context.pathInfo;
        if (!Array.isArray(directorySegments) || !directorySegments.length) {
            return;
        }

        for (let index = 0; index < directorySegments.length; index += 1) {
            const currentSegments = directorySegments.slice(0, index + 1);
            const currentPath = currentSegments.join('/');
            const currentUrl = helpers.buildNutstoreUrlFromSegments(currentSegments, {
                trailingSlash: true,
                baseUrl: context.pathInfo.baseUrl
            });

            const probeResponse = await requestWebdav(context, 'PROPFIND', currentUrl, {
                headers: { Depth: '0' },
                acceptStatuses: [200, 207, 404],
                errorMessage: `检查远端目录失败：${currentPath}`,
                retry: false
            });

            if (probeResponse.status === 200 || probeResponse.status === 207) {
                continue;
            }

            if (probeResponse.status === 404) {
                await requestWebdav(context, 'MKCOL', currentUrl, {
                    acceptStatuses: [200, 201, 204, 405],
                    errorMessage: `创建远端目录失败：${currentPath}`
                });
                continue;
            }

            throw createWebdavError(`检查远端目录失败：${buildStatusText(probeResponse)}`, {
                stage: 'directory',
                errorType: 'directory',
                status: probeResponse.status,
                response: probeResponse
            });
        }
    }

    async function prepareWebdavContext(options = {}) {
        const ensureDirectory = options.ensureDirectory !== false;
        const config = await getNutstoreConfig();
        const context = await resolveConnectionStrategy(config);

        if (ensureDirectory) {
            try {
                await ensureRemoteDirectory(context);
            } catch (error) {
                throw buildErrorWithStage(error, 'directory', '远端目录不可用');
            }
        }

        return context;
    }

    async function testNutstoreConnection() {
        try {
            const context = await prepareWebdavContext({ ensureDirectory: true });
            await syncCore.markSyncSuccess('webdav', 'WebDAV 连接与远端目录可用');
            return {
                success: true,
                remotePath: context.config.remotePath,
                methodMode: context.methodMode,
                baseUrl: context.pathInfo.baseUrl
            };
        } catch (error) {
            const stage = error && error.stage ? error.stage : 'connect';
            const stageError = buildErrorWithStage(error, stage, '连接测试失败');
            await syncCore.markSyncError('webdav', stageError, 'WebDAV 连接失败');
            throw stageError;
        }
    }

    async function backupToNutstore() {
        try {
            const context = await prepareWebdavContext({ ensureDirectory: true });
            const snapshot = await syncCore.buildFullSnapshot();

            const response = await requestWebdav(context, 'PUT', context.pathInfo.remoteUrl, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(snapshot, null, 2),
                acceptStatuses: [200, 201, 204],
                errorMessage: '上传备份文件失败'
            });

            await syncCore.markSyncSuccess('webdav', 'WebDAV 备份成功');
            return {
                success: true,
                status: response.status,
                remotePath: context.config.remotePath,
                methodMode: context.methodMode,
                baseUrl: context.pathInfo.baseUrl
            };
        } catch (error) {
            const stage = error && error.stage ? error.stage : 'upload';
            const stageError = buildErrorWithStage(error, stage, '上传备份文件失败');
            await syncCore.markSyncError('webdav', stageError, 'WebDAV 备份失败');
            throw stageError;
        }
    }

    async function restoreFromNutstore() {
        try {
            const context = await prepareWebdavContext({ ensureDirectory: true });
            const response = await requestWebdav(context, 'GET', context.pathInfo.remoteUrl, {
                acceptStatuses: [200, 404],
                errorMessage: '读取备份文件失败',
                retry: false
            });

            if (response.status === 404) {
                throw createWebdavError('云端还没有找到备份文件，请先执行一次立即备份', {
                    stage: 'restore',
                    errorType: 'remote-not-found',
                    status: 404
                });
            }

            const snapshot = helpers.safeJsonParse(response.data);
            if (!snapshot) {
                throw createWebdavError('云端备份内容不是有效的 JSON', {
                    stage: 'restore',
                    errorType: 'invalid-json'
                });
            }

            await syncCore.mergeSnapshotToLocal(snapshot, {
                autoSync: false
            });
            await syncCore.markSyncSuccess('webdav', 'WebDAV 恢复成功');
            return {
                success: true,
                status: response.status,
                remotePath: context.config.remotePath,
                methodMode: context.methodMode,
                baseUrl: context.pathInfo.baseUrl
            };
        } catch (error) {
            const stage = error && error.stage ? error.stage : 'restore';
            const stageError = buildErrorWithStage(error, stage, '恢复云端备份失败');
            await syncCore.markSyncError('webdav', stageError, 'WebDAV 恢复失败');
            throw stageError;
        }
    }

    modules.providers = modules.providers || {};
    modules.providers.webdav = {
        getNutstoreConfig,
        sendWebdavRequest,
        requestWebdav,
        resolveConnectionStrategy,
        ensureRemoteDirectory,
        prepareWebdavContext,
        testNutstoreConnection,
        backupToNutstore,
        restoreFromNutstore
    };
})();
