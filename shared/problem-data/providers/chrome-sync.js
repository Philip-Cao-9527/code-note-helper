/**
 * Chrome Sync 轻量同步提供方
 * 版本：1.0.43
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const helpers = modules.helpers || {};
    const syncCore = modules.syncCore || {};
    const records = modules.records || {};
    const lists = modules.lists || {};

    const STORAGE_KEYS = constants.STORAGE_KEYS;
    const CHROME_SYNC_CHUNK_SIZE = constants.CHROME_SYNC_CHUNK_SIZE || 7000;
    const CHROME_SYNC_MAX_CHUNKS = constants.CHROME_SYNC_MAX_CHUNKS || 16;

    modules.state = modules.state || {
        chromeSyncTimer: null,
        chromeSyncInFlight: false,
        chromeSyncPendingReason: null
    };

    function ensureSyncStorageApi() {
        const syncApi = helpers.getSyncStorageApi();
        if (!syncApi) {
            const error = new Error('当前环境不支持 Chrome Sync');
            error.errorType = 'sync-api-unavailable';
            throw error;
        }
        return syncApi;
    }

    async function readCloudPayload() {
        const syncApi = ensureSyncStorageApi();
        const manifest = await helpers.readSync(STORAGE_KEYS.chromeSyncManifest, null);
        if (!manifest || !manifest.chunkCount) {
            return null;
        }

        const chunkCount = Number(manifest.chunkCount || 0);
        if (chunkCount <= 0) {
            return null;
        }

        const chunkKeys = Array.from({ length: chunkCount }, (_, index) => {
            return `${STORAGE_KEYS.chromeSyncChunkPrefix}${index}`;
        });

        const chunksData = await syncApi.getMultiple(chunkKeys);
        const serialized = chunkKeys.map((key) => chunksData[key] || '').join('');
        if (!serialized) {
            return null;
        }

        const payload = helpers.safeJsonParse(serialized);
        if (!payload) {
            const error = new Error('Chrome Sync 云端数据解析失败');
            error.errorType = 'payload-parse-failed';
            throw error;
        }

        return payload;
    }

    async function writeCloudPayload(payload) {
        ensureSyncStorageApi();

        const serialized = JSON.stringify(payload);
        const chunks = [];
        for (let index = 0; index < serialized.length; index += CHROME_SYNC_CHUNK_SIZE) {
            chunks.push(serialized.slice(index, index + CHROME_SYNC_CHUNK_SIZE));
        }

        if (chunks.length > CHROME_SYNC_MAX_CHUNKS) {
            const error = new Error('Chrome Sync 数据体积过大，请改用坚果云完整备份');
            error.errorType = 'payload-too-large';
            throw error;
        }

        const previousManifest = await helpers.readSync(STORAGE_KEYS.chromeSyncManifest, null);
        const data = {};
        chunks.forEach((chunk, index) => {
            data[`${STORAGE_KEYS.chromeSyncChunkPrefix}${index}`] = chunk;
        });
        data[STORAGE_KEYS.chromeSyncManifest] = {
            schemaVersion: 2,
            chunkCount: chunks.length,
            exportedAt: payload.exportedAt,
            deviceId: payload.deviceId,
            revision: payload.revision
        };

        await helpers.writeSyncMultiple(data);

        const previousChunkCount = Number(previousManifest && previousManifest.chunkCount || 0);
        if (previousChunkCount > chunks.length) {
            const obsoleteKeys = [];
            for (let index = chunks.length; index < previousChunkCount; index += 1) {
                obsoleteKeys.push(`${STORAGE_KEYS.chromeSyncChunkPrefix}${index}`);
            }
            await helpers.removeSync(obsoleteKeys);
        }

        return data[STORAGE_KEYS.chromeSyncManifest];
    }

    function buildCloudPayload(bundle) {
        const recordDigests = {};
        Object.entries(bundle.records || {}).forEach(([recordId, record]) => {
            recordDigests[recordId] = records.buildRecordSyncDigest(record);
        });

        const listManifests = {};
        Object.entries(bundle.lists || {}).forEach(([listId, list]) => {
            listManifests[listId] = lists.buildListManifest(list);
        });

        return {
            schemaVersion: 2,
            exportedAt: new Date().toISOString(),
            deviceId: bundle.meta.deviceId,
            revision: bundle.meta.localRevision,
            records: recordDigests,
            lists: listManifests,
            tombstones: bundle.tombstones
        };
    }

    async function mergeCloudPayloadToLocal(payload) {
        if (!payload) return { merged: false };

        const localLists = await lists.getProblemLists();
        const tombstones = syncCore.normalizeTombstones(payload.tombstones);
        const incomingRecords = {};
        Object.entries(payload.records || {}).forEach(([recordId, digest]) => {
            incomingRecords[recordId] = records.inflateRecordFromDigest(digest);
        });

        const incomingLists = {};
        for (const [listId, manifest] of Object.entries(payload.lists || {})) {
            const tombstoneAt = tombstones.lists[listId];
            if (new Date(tombstoneAt || 0).getTime() > new Date(manifest.updatedAt || 0).getTime()) {
                continue;
            }

            const localList = localLists[listId];
            if (localList &&
                new Date(localList.updatedAt || 0).getTime() > new Date(manifest.updatedAt || 0).getTime()) {
                continue;
            }

            if (manifest.sourceUrl) {
                try {
                    const resolvedList = await lists.resolveProblemListFromUrl(manifest.sourceUrl);
                    incomingLists[listId] = {
                        ...resolvedList,
                        ...manifest,
                        importedAt: manifest.importedAt || resolvedList.importedAt || resolvedList.updatedAt,
                        updatedAt: manifest.updatedAt || resolvedList.updatedAt
                    };
                    continue;
                } catch (error) {
                    console.warn('[ProblemData] 重新导入题单失败，改为保留本地或占位：', manifest.sourceUrl, error);
                }
            }

            if (localList) {
                incomingLists[listId] = localList;
            } else {
                incomingLists[listId] = {
                    ...manifest,
                    items: []
                };
            }
        }

        await syncCore.mergeSnapshotToLocal({
            records: incomingRecords,
            lists: incomingLists,
            tombstones
        }, {
            autoSync: false
        });

        return {
            merged: true,
            listCount: Object.keys(incomingLists).length,
            recordCount: Object.keys(incomingRecords).length
        };
    }

    function tryTriggerQueuedSync() {
        if (!modules.state.chromeSyncPendingReason) return;

        const nextReason = modules.state.chromeSyncPendingReason;
        modules.state.chromeSyncPendingReason = null;

        setTimeout(() => {
            runChromeSync({
                silent: true,
                reason: `queued:${nextReason}`
            }).catch((error) => {
                console.warn('[ProblemData] 排队 Chrome Sync 失败：', error);
            });
        }, 0);
    }

    async function runChromeSync(options) {
        const config = {
            silent: false,
            reason: 'manual',
            ...(options || {})
        };

        const settings = await syncCore.getSyncSettings();
        if (!settings.chromeSyncEnabled) {
            return {
                enabled: false,
                reason: config.reason
            };
        }

        if (modules.state.chromeSyncInFlight) {
            modules.state.chromeSyncPendingReason = config.reason || 'queued';
            return {
                enabled: true,
                queued: true,
                reason: config.reason
            };
        }

        modules.state.chromeSyncInFlight = true;

        try {
            const remotePayload = await readCloudPayload();
            await mergeCloudPayloadToLocal(remotePayload);

            const bundle = await syncCore.getLocalDataBundle();
            const nextPayload = buildCloudPayload(bundle);
            await writeCloudPayload(nextPayload);

            await syncCore.markSyncSuccess('chromeSync', 'Chrome Sync 同步完成');
            return {
                enabled: true,
                syncedAt: new Date().toISOString(),
                reason: config.reason
            };
        } catch (error) {
            await syncCore.markSyncError('chromeSync', error, 'Chrome Sync 同步失败');
            if (config.silent) {
                return {
                    enabled: true,
                    error: error.message,
                    reason: config.reason
                };
            }
            throw error;
        } finally {
            modules.state.chromeSyncInFlight = false;
            tryTriggerQueuedSync();
        }
    }

    modules.providers = modules.providers || {};
    modules.providers.chromeSync = {
        readCloudPayload,
        writeCloudPayload,
        buildCloudPayload,
        mergeCloudPayloadToLocal,
        runChromeSync
    };
    modules.providers.runChromeSync = runChromeSync;
})();
