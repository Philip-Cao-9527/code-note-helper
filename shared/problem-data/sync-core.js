/**
 * 刷题记录同步核心
 * 版本：1.1.0
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const helpers = modules.helpers || {};

    const STORAGE_KEYS = constants.STORAGE_KEYS;
    const DEFAULT_SYNC_META = constants.DEFAULT_SYNC_META;
    const DEFAULT_SYNC_SETTINGS = constants.DEFAULT_SYNC_SETTINGS;
    const DEFAULT_SYNC_TOMBSTONES = constants.DEFAULT_SYNC_TOMBSTONES;
    const UNIFIED_SYNC_DEBOUNCE_MS = 2000;
    const UNIFIED_SYNC_INTERVAL_MS = 1 * 60 * 1000;
    const UNIFIED_SYNC_RETRY_MAX_ATTEMPTS = 3;
    const UNIFIED_SYNC_RETRY_DELAY_MS = 2000;

    modules.state = modules.state || {};
    modules.state.localWriteSyncTimer = modules.state.localWriteSyncTimer || null;
    modules.state.unifiedSyncInFlight = Boolean(modules.state.unifiedSyncInFlight);
    modules.state.unifiedSyncPendingReason = modules.state.unifiedSyncPendingReason || null;
    modules.state.unifiedSyncCycleTimer = modules.state.unifiedSyncCycleTimer || null;
    modules.state.unifiedSyncIntervalMs = Number(modules.state.unifiedSyncIntervalMs || UNIFIED_SYNC_INTERVAL_MS);
    modules.state.syncListeners = modules.state.syncListeners instanceof Set
        ? modules.state.syncListeners
        : new Set();
    modules.providers = modules.providers || {};

    function normalizeSyncSettings(settings) {
        const webdav = {
            ...helpers.cloneValue(DEFAULT_SYNC_SETTINGS.webdav),
            ...((settings && settings.webdav) || {})
        };

        return {
            ...helpers.cloneValue(DEFAULT_SYNC_SETTINGS),
            ...(settings || {}),
            webdav: {
                ...webdav,
                enabled: Boolean(webdav.enabled),
                provider: webdav.provider || 'nutstore',
                email: String(webdav.email || '').trim(),
                appPassword: String(webdav.appPassword || '').trim(),
                baseUrl: helpers.normalizeBaseUrl(webdav.baseUrl),
                remotePath: helpers.sanitizeRemotePath(webdav.remotePath)
            }
        };
    }

    function normalizeSyncMeta(meta) {
        const normalized = {
            ...helpers.cloneValue(DEFAULT_SYNC_META),
            ...(meta || {})
        };
        normalized.deviceId = normalized.deviceId || helpers.createDeviceId();
        normalized.localRevision = Number(normalized.localRevision || 0);
        normalized.lastSyncAt = {
            ...helpers.cloneValue(DEFAULT_SYNC_META.lastSyncAt),
            ...((meta && meta.lastSyncAt) || {})
        };
        normalized.lastError = {
            ...helpers.cloneValue(DEFAULT_SYNC_META.lastError),
            ...((meta && meta.lastError) || {})
        };
        normalized.lastStatus = {
            webdav: {
                state: null,
                message: '',
                at: null,
                ...((((meta || {}).lastStatus || {}).webdav) || {})
            }
        };
        return normalized;
    }

    function normalizeTombstones(tombstones) {
        return {
            ...helpers.cloneValue(DEFAULT_SYNC_TOMBSTONES),
            ...(tombstones || {}),
            lists: {
                ...helpers.cloneValue(DEFAULT_SYNC_TOMBSTONES.lists),
                ...(((tombstones || {}).lists) || {})
            },
            records: {
                ...helpers.cloneValue(DEFAULT_SYNC_TOMBSTONES.records),
                ...(((tombstones || {}).records) || {})
            }
        };
    }

    async function ensureSyncMeta() {
        const meta = normalizeSyncMeta(await helpers.readLocal(STORAGE_KEYS.syncMeta, DEFAULT_SYNC_META));
        if (!meta.deviceId) {
            meta.deviceId = helpers.createDeviceId();
        }
        await helpers.writeLocal(STORAGE_KEYS.syncMeta, meta);
        return meta;
    }

    async function getSyncMeta() {
        return normalizeSyncMeta(await helpers.readLocal(STORAGE_KEYS.syncMeta, DEFAULT_SYNC_META));
    }

    async function getSyncSettings() {
        return normalizeSyncSettings(await helpers.readLocal(STORAGE_KEYS.syncSettings, DEFAULT_SYNC_SETTINGS));
    }

    function isWebdavConfigComplete(settings) {
        const normalized = normalizeSyncSettings(settings);
        if (!normalized.webdav.enabled) return true;
        return Boolean(normalized.webdav.email && normalized.webdav.appPassword);
    }

    function isAnySyncEnabled(settings) {
        const normalized = normalizeSyncSettings(settings);
        return Boolean(normalized.webdav.enabled);
    }

    function shouldShowSyncIndicator(source) {
        if (!source || typeof source !== 'object') return false;
        const webdavEnabled = source.webdav && typeof source.webdav === 'object'
            ? Boolean(source.webdav.enabled)
            : Boolean(source.webdavEnabled);
        return webdavEnabled;
    }

    function buildWebdavConfigWarning(settings) {
        const normalized = normalizeSyncSettings(settings);
        if (!normalized.webdav.enabled) return '';
        if (isWebdavConfigComplete(normalized)) return '';
        return '坚果云已开启，但邮箱或应用密码未填写完整，请先到设置页补全。';
    }

    async function setSyncSettings(nextSettings) {
        const merged = normalizeSyncSettings(nextSettings);
        await writeLocalNamespace(STORAGE_KEYS.syncSettings, merged, {
            autoSync: false,
            markDirty: true
        });
        return merged;
    }

    async function getSyncTombstones() {
        return normalizeTombstones(await helpers.readLocal(STORAGE_KEYS.syncTombstones, DEFAULT_SYNC_TOMBSTONES));
    }

    async function setSyncStatus(provider, state, message, extra = {}) {
        const meta = await getSyncMeta();
        const now = new Date().toISOString();

        meta.lastStatus = meta.lastStatus || {};
        meta.lastStatus[provider] = {
            state,
            message: message || '',
            at: now,
            ...extra
        };

        await helpers.writeLocal(STORAGE_KEYS.syncMeta, meta);
        return meta;
    }

    async function markSyncSuccess(provider, message = '同步成功') {
        const meta = await getSyncMeta();
        const now = new Date().toISOString();
        meta.lastSyncAt[provider] = now;
        meta.lastError[provider] = null;
        meta.lastStatus = meta.lastStatus || {};
        meta.lastStatus[provider] = {
            state: 'success',
            message,
            at: now
        };
        await helpers.writeLocal(STORAGE_KEYS.syncMeta, meta);
        return meta;
    }

    async function markSyncError(provider, error, message = '') {
        const meta = await getSyncMeta();
        const now = new Date().toISOString();
        const errorMessage = error && error.message ? error.message : String(error || '未知错误');
        meta.lastError[provider] = {
            message: errorMessage,
            at: now,
            ...(error && error.errorType ? { errorType: error.errorType } : {})
        };
        meta.lastStatus = meta.lastStatus || {};
        meta.lastStatus[provider] = {
            state: 'error',
            message: message || errorMessage,
            at: now,
            ...(error && error.errorType ? { errorType: error.errorType } : {})
        };
        await helpers.writeLocal(STORAGE_KEYS.syncMeta, meta);
        return meta;
    }

    async function writeLocalNamespace(key, value, options) {
        const config = {
            autoSync: true,
            markDirty: true,
            ...(options || {})
        };
        return writeLocalMultiple({ [key]: value }, config);
    }

    async function writeLocalMultiple(data, options) {
        const config = {
            autoSync: true,
            markDirty: true,
            ...(options || {})
        };
        const payload = {
            ...(data || {})
        };

        if (config.markDirty) {
            const meta = await getSyncMeta();
            meta.localRevision = Number(meta.localRevision || 0) + 1;
            meta.lastLocalWriteAt = new Date().toISOString();
            payload[STORAGE_KEYS.syncMeta] = meta;
        }

        await helpers.writeLocalMultiple(payload);

        if (config.autoSync) {
            scheduleDebouncedUnifiedSync('local-write');
        }
    }

    async function getTimelineEnabled() {
        const enabled = await helpers.readLocal('note_helper_timeline_enabled_v1', true);
        return enabled !== false;
    }

    async function setTimelineEnabled(enabled) {
        await helpers.writeLocal('note_helper_timeline_enabled_v1', Boolean(enabled));
        return Boolean(enabled);
    }

    function addSyncListener(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        modules.state.syncListeners.add(listener);
        return () => {
            modules.state.syncListeners.delete(listener);
        };
    }

    function removeSyncListener(listener) {
        modules.state.syncListeners.delete(listener);
    }

    function notifySyncListeners(event) {
        if (!modules.state.syncListeners || !(modules.state.syncListeners instanceof Set)) return;
        modules.state.syncListeners.forEach((listener) => {
            try {
                listener(event || {});
            } catch (error) {
                console.error('[ProblemData] 同步监听器执行失败：', error);
            }
        });
    }

    function sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, Number(ms) > 0 ? Number(ms) : 0);
        });
    }

    function normalizeProviderError(provider, error) {
        const normalized = error instanceof Error ? error : new Error(String(error || '同步失败'));
        if (!normalized.provider) {
            normalized.provider = provider;
        }
        if (!normalized.errorType && error && error.errorType) {
            normalized.errorType = error.errorType;
        }
        if (typeof normalized.status !== 'number' && error && typeof error.status === 'number') {
            normalized.status = error.status;
        }
        return normalized;
    }

    function shouldRetryUnifiedError(error) {
        if (!error) return false;

        const nonRetryableErrorTypes = new Set([
            'config-incomplete',
            'auth',
            'validation',
            'provider-missing'
        ]);
        const errorType = String(error.errorType || '').toLowerCase();
        if (errorType && nonRetryableErrorTypes.has(errorType)) {
            return false;
        }

        if (errorType === 'network' || errorType === 'timeout' || errorType === 'runtime') {
            return true;
        }

        const retryableStatus = new Set([408, 425, 429, 500, 502, 503, 504]);
        if (typeof error.status === 'number' && retryableStatus.has(error.status)) {
            return true;
        }

        const message = String(error.message || error || '').toLowerCase();
        return /timeout|network|econn|err_|503|502|500|429|temporarily|temporary/.test(message);
    }

    async function runProviderWithRetry(provider, runner, context) {
        let lastError = null;
        for (let attempt = 1; attempt <= UNIFIED_SYNC_RETRY_MAX_ATTEMPTS; attempt += 1) {
            try {
                return await runner();
            } catch (error) {
                const normalizedError = normalizeProviderError(provider, error);
                lastError = normalizedError;
                const canRetry = shouldRetryUnifiedError(normalizedError)
                    && attempt < UNIFIED_SYNC_RETRY_MAX_ATTEMPTS;
                if (!canRetry) {
                    throw normalizedError;
                }

                notifySyncListeners({
                    status: 'syncing',
                    reason: context.reason,
                    source: context.source,
                    message: '坚果云临时失败，正在重试（' + attempt + '/' + (UNIFIED_SYNC_RETRY_MAX_ATTEMPTS - 1) + '）'
                });
                await sleep(UNIFIED_SYNC_RETRY_DELAY_MS * attempt);
            }
        }

        throw lastError || new Error('同步失败');
    }

    function tryTriggerQueuedUnifiedSync() {
        if (!modules.state.unifiedSyncPendingReason) return;
        const nextReason = modules.state.unifiedSyncPendingReason;
        modules.state.unifiedSyncPendingReason = null;

        setTimeout(() => {
            runUnifiedSync({
                silent: true,
                reason: 'queued:' + nextReason,
                source: 'queue'
            }).catch((error) => {
                console.warn('[ProblemData] 排队同步失败：', error);
            });
        }, 0);
    }

    async function runUnifiedSync(options) {
        const config = {
            silent: false,
            reason: 'manual',
            source: 'manual',
            ...(options || {})
        };
        const settings = await getSyncSettings();
        const webdavEnabled = Boolean(settings.webdav.enabled);

        if (!webdavEnabled) {
            notifySyncListeners({
                status: 'idle',
                reason: config.reason,
                source: config.source,
                message: '未启用任何同步能力'
            });
            return {
                enabled: false,
                reason: config.reason
            };
        }

        if (modules.state.unifiedSyncInFlight) {
            modules.state.unifiedSyncPendingReason = config.reason || 'queued';
            return {
                enabled: true,
                queued: true,
                reason: config.reason
            };
        }

        modules.state.unifiedSyncInFlight = true;
        notifySyncListeners({
            status: 'syncing',
            reason: config.reason,
            source: config.source,
            message: '正在同步...'
        });

        const result = {
            enabled: true,
            reason: config.reason,
            source: config.source,
            providers: {
                webdav: {
                    enabled: webdavEnabled,
                    synced: false,
                    skipped: false
                }
            }
        };

        try {
            const warningMessage = buildWebdavConfigWarning(settings);
            if (warningMessage) {
                result.warning = true;
                result.providers.webdav.skipped = true;
                const warningError = new Error(warningMessage);
                warningError.errorType = 'config-incomplete';
                await markSyncError('webdav', warningError, warningMessage);
                notifySyncListeners({
                    status: 'warning',
                    reason: config.reason,
                    source: config.source,
                    message: warningMessage
                });
                return result;
            }

            const webdavResult = await runProviderWithRetry('webdav', async () => {
                if (!modules.providers ||
                    !modules.providers.webdav ||
                    typeof modules.providers.webdav.backupToNutstore !== 'function') {
                    const providerError = new Error('坚果云同步提供方未加载');
                    providerError.provider = 'webdav';
                    providerError.errorType = 'provider-missing';
                    throw providerError;
                }
                return modules.providers.webdav.backupToNutstore();
            }, config);
            result.providers.webdav.synced = true;
            result.providers.webdav.result = webdavResult || null;

            notifySyncListeners({
                status: 'success',
                reason: config.reason,
                source: config.source,
                message: '同步完成'
            });
            return result;
        } catch (error) {
            await markSyncError('webdav', error, '坚果云同步失败');

            notifySyncListeners({
                status: 'error',
                reason: config.reason,
                source: config.source,
                message: error && error.message ? error.message : '同步失败',
                error: error && error.message ? error.message : String(error || '')
            });
            if (config.silent) {
                return {
                    enabled: true,
                    error: error && error.message ? error.message : String(error || '同步失败'),
                    reason: config.reason,
                    source: config.source
                };
            }
            throw error;
        } finally {
            modules.state.unifiedSyncInFlight = false;
            tryTriggerQueuedUnifiedSync();
        }
    }

    function stopAutoSyncScheduler() {
        if (!modules.state.unifiedSyncCycleTimer) return false;
        clearInterval(modules.state.unifiedSyncCycleTimer);
        modules.state.unifiedSyncCycleTimer = null;
        return true;
    }

    async function startAutoSyncScheduler(options) {
        const config = {
            intervalMs: UNIFIED_SYNC_INTERVAL_MS,
            ...(options || {})
        };
        stopAutoSyncScheduler();

        const intervalMs = Number(config.intervalMs) > 0
            ? Number(config.intervalMs)
            : UNIFIED_SYNC_INTERVAL_MS;
        modules.state.unifiedSyncIntervalMs = intervalMs;

        const settings = await getSyncSettings();
        if (!isAnySyncEnabled(settings)) {
            return {
                started: false,
                intervalMs,
                reason: 'no-enabled-provider'
            };
        }

        modules.state.unifiedSyncCycleTimer = setInterval(() => {
            runUnifiedSync({
                silent: true,
                reason: 'auto-interval',
                source: 'interval'
            }).catch((error) => {
                console.error('[ProblemData] 周期自动同步失败：', error);
            });
        }, intervalMs);

        return {
            started: true,
            intervalMs
        };
    }

    async function scheduleDebouncedUnifiedSync(reason, options) {
        const config = {
            delayMs: UNIFIED_SYNC_DEBOUNCE_MS,
            source: 'local-write',
            ...(options || {})
        };
        const settings = await getSyncSettings();
        if (!isAnySyncEnabled(settings)) return;

        if (modules.state.localWriteSyncTimer) {
            clearTimeout(modules.state.localWriteSyncTimer);
        }

        modules.state.localWriteSyncTimer = setTimeout(() => {
            modules.state.localWriteSyncTimer = null;
            runUnifiedSync({
                silent: true,
                reason: reason || 'auto',
                source: config.source || 'local-write'
            }).catch((error) => {
                console.error('[ProblemData] 防抖自动同步失败：', error);
            });
        }, Number(config.delayMs) > 0 ? Number(config.delayMs) : UNIFIED_SYNC_DEBOUNCE_MS);
    }

    async function getLocalDataBundle() {
        const result = await helpers.readLocal(STORAGE_KEYS.problemRecords, {});
        const records = result || {};
        const lists = await helpers.readLocal(STORAGE_KEYS.problemLists, {});
        const tombstones = await getSyncTombstones();
        const meta = await getSyncMeta();
        const settings = await getSyncSettings();
        const timelineEnabled = await getTimelineEnabled();

        return {
            records,
            lists,
            tombstones,
            meta,
            settings,
            timelineEnabled
        };
    }

    function sanitizeSettingsForExport(settings) {
        const normalized = normalizeSyncSettings(settings);
        return {
            ...normalized,
            webdav: {
                ...normalized.webdav,
                appPassword: normalized.webdav.appPassword ? '***' : ''
            }
        };
    }

    async function buildFullSnapshot() {
        const bundle = await getLocalDataBundle();
        return {
            schemaVersion: 2,
            exportedAt: new Date().toISOString(),
            deviceId: bundle.meta.deviceId,
            records: bundle.records,
            lists: bundle.lists,
            tombstones: bundle.tombstones,
            syncMeta: bundle.meta,
            timelineEnabled: bundle.timelineEnabled,
            settings: sanitizeSettingsForExport(bundle.settings)
        };
    }

    async function exportLocalSnapshot() {
        const snapshot = await buildFullSnapshot();
        return JSON.stringify(snapshot, null, 2);
    }

    function pickLaterRecord(localRecord, incomingRecord) {
        const localUpdated = new Date(localRecord && localRecord.updatedAt || 0).getTime();
        const incomingUpdated = new Date(incomingRecord && incomingRecord.updatedAt || 0).getTime();
        if (incomingUpdated >= localUpdated) {
            const merged = {
                ...(localRecord || {}),
                ...(incomingRecord || {})
            };
            if (!merged.noteContent && localRecord && localRecord.noteContent) {
                merged.noteContent = localRecord.noteContent;
            }
            return merged;
        }
        return localRecord;
    }

    function resolveRecordWithTombstone(localRecord, incomingRecord, tombstoneAt) {
        const mergedRecord = pickLaterRecord(localRecord, incomingRecord);
        if (!mergedRecord) return null;

        const mergedUpdated = new Date(mergedRecord.updatedAt || 0).getTime();
        const tombstoneUpdated = new Date(tombstoneAt || 0).getTime();
        if (tombstoneUpdated >= mergedUpdated) {
            return null;
        }

        return mergedRecord;
    }

    function mergeListMaps(localLists, incomingLists, tombstones) {
        const nextLists = { ...(localLists || {}) };
        Object.entries(incomingLists || {}).forEach(([listId, incomingList]) => {
            const localList = nextLists[listId];
            const tombstoneAt = tombstones.lists[listId];
            const incomingUpdated = new Date(incomingList && incomingList.updatedAt || 0).getTime();
            const localUpdated = new Date(localList && localList.updatedAt || 0).getTime();
            const tombstoneUpdated = new Date(tombstoneAt || 0).getTime();

            if (tombstoneUpdated > incomingUpdated) {
                delete nextLists[listId];
                return;
            }

            if (!localList || incomingUpdated >= localUpdated) {
                nextLists[listId] = {
                    ...(localList || {}),
                    ...(incomingList || {})
                };
            }
        });

        Object.entries(tombstones.lists || {}).forEach(([listId, deletedAt]) => {
            const localList = nextLists[listId];
            const localUpdated = new Date(localList && localList.updatedAt || 0).getTime();
            const deletedUpdated = new Date(deletedAt || 0).getTime();
            if (deletedUpdated >= localUpdated) {
                delete nextLists[listId];
            }
        });

        return nextLists;
    }

    async function mergeSnapshotToLocal(snapshotOrText, options) {
        const config = {
            autoSync: false,
            ...(options || {})
        };

        const incoming = typeof snapshotOrText === 'string'
            ? helpers.safeJsonParse(snapshotOrText)
            : helpers.cloneValue(snapshotOrText);

        if (!incoming || typeof incoming !== 'object') {
            throw new Error('导入数据无效，无法完成合并');
        }

        const localRecords = await helpers.readLocal(STORAGE_KEYS.problemRecords, {});
        const localLists = await helpers.readLocal(STORAGE_KEYS.problemLists, {});
        const localTombstones = await getSyncTombstones();

        const incomingTombstones = normalizeTombstones(incoming.tombstones);
        const nextTombstones = normalizeTombstones({
            lists: {
                ...(localTombstones.lists || {})
            },
            records: {
                ...(localTombstones.records || {})
            }
        });
        Object.entries(incomingTombstones.lists || {}).forEach(([listId, deletedAt]) => {
            const localDeletedAt = nextTombstones.lists[listId];
            if (new Date(deletedAt || 0).getTime() >= new Date(localDeletedAt || 0).getTime()) {
                nextTombstones.lists[listId] = deletedAt;
            }
        });
        Object.entries(incomingTombstones.records || {}).forEach(([recordId, deletedAt]) => {
            const localDeletedAt = nextTombstones.records[recordId];
            if (new Date(deletedAt || 0).getTime() >= new Date(localDeletedAt || 0).getTime()) {
                nextTombstones.records[recordId] = deletedAt;
            }
        });

        const nextRecords = {};
        const incomingRecords = incoming.records || {};
        const recordIds = new Set([
            ...Object.keys(localRecords || {}),
            ...Object.keys(incomingRecords || {})
        ]);
        recordIds.forEach((recordId) => {
            const mergedRecord = resolveRecordWithTombstone(
                (localRecords || {})[recordId],
                incomingRecords[recordId],
                nextTombstones.records[recordId]
            );
            if (!mergedRecord) return;
            nextRecords[recordId] = mergedRecord;
            const tombstoneAt = nextTombstones.records[recordId];
            if (new Date(tombstoneAt || 0).getTime() < new Date(mergedRecord.updatedAt || 0).getTime()) {
                delete nextTombstones.records[recordId];
            }
        });

        const nextLists = mergeListMaps(localLists, incoming.lists || {}, nextTombstones);

        const payload = {
            [STORAGE_KEYS.problemRecords]: nextRecords,
            [STORAGE_KEYS.problemLists]: nextLists,
            [STORAGE_KEYS.syncTombstones]: nextTombstones
        };

        await writeLocalMultiple(payload, {
            autoSync: config.autoSync,
            markDirty: true
        });

        if (incoming.timelineEnabled !== undefined) {
            await setTimelineEnabled(incoming.timelineEnabled);
        }

        return {
            records: nextRecords,
            lists: nextLists,
            tombstones: nextTombstones
        };
    }

    async function importLocalSnapshot(snapshotOrText) {
        return mergeSnapshotToLocal(snapshotOrText, { autoSync: false });
    }

    async function getSyncOverview() {
        const meta = await getSyncMeta();
        const settings = await getSyncSettings();
        const timelineEnabled = await getTimelineEnabled();
        const webdavConfigComplete = isWebdavConfigComplete(settings);
        const webdavConfigWarning = buildWebdavConfigWarning(settings);

        return {
            localLabel: '当前浏览器',
            localRevision: meta.localRevision,
            lastLocalWriteAt: meta.lastLocalWriteAt,
            timelineEnabled,
            anySyncEnabled: isAnySyncEnabled(settings),
            webdavEnabled: settings.webdav.enabled,
            webdavConfigComplete,
            webdavConfigWarning,
            webdavBaseUrl: settings.webdav.baseUrl,
            webdavRemotePath: settings.webdav.remotePath,
            webdavLastSyncAt: meta.lastSyncAt.webdav,
            webdavLastError: meta.lastError.webdav,
            webdavLastStatus: meta.lastStatus.webdav,
            syncIndicatorVisible: shouldShowSyncIndicator({
                webdavEnabled: settings.webdav.enabled
            })
        };
    }

    modules.syncCore = {
        normalizeSyncSettings,
        normalizeSyncMeta,
        normalizeTombstones,
        ensureSyncMeta,
        getSyncMeta,
        getSyncSettings,
        setSyncSettings,
        getSyncTombstones,
        setSyncStatus,
        markSyncSuccess,
        markSyncError,
        writeLocalNamespace,
        writeLocalMultiple,
        isWebdavConfigComplete,
        isAnySyncEnabled,
        shouldShowSyncIndicator,
        buildWebdavConfigWarning,
        getTimelineEnabled,
        setTimelineEnabled,
        addSyncListener,
        removeSyncListener,
        runUnifiedSync,
        startAutoSyncScheduler,
        stopAutoSyncScheduler,
        scheduleDebouncedUnifiedSync,
        getLocalDataBundle,
        sanitizeSettingsForExport,
        buildFullSnapshot,
        exportLocalSnapshot,
        mergeSnapshotToLocal,
        importLocalSnapshot,
        getSyncOverview
    };
})();

