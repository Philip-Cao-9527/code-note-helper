/**
 * 题单模块
 * 版本：1.0.62
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const helpers = modules.helpers || {};
    const syncCore = modules.syncCore || {};
    const records = modules.records || {};
    const importers = modules.importers || {};

    const STORAGE_KEYS = constants.STORAGE_KEYS;
    const HOT100_CONFIG = constants.HOT100_CONFIG;

    async function getProblemLists() {
        return helpers.readLocal(STORAGE_KEYS.problemLists, {});
    }

    async function resolveProblemListFromUrl(url) {
        const normalizedUrl = String(url || '').trim();
        const registry = [
            importers.hot100
        ].filter(Boolean);

        const importer = registry.find((item) => typeof item.match === 'function' && item.match(normalizedUrl));
        if (!importer || typeof importer.importFromUrl !== 'function') {
            throw new Error('该 URL 暂时不支持导入。当前支持 Hot100、面试经典 150、灵神白名单题单（支持 circle/discuss 与 discuss/post 链接）。');
        }
        return importer.importFromUrl(normalizedUrl);
    }

    function buildListManifest(list) {
        return {
            listId: list.listId,
            sourceType: list.sourceType,
            sourceUrl: list.sourceUrl,
            title: list.title,
            site: list.site,
            importedAt: list.importedAt,
            updatedAt: list.updatedAt
        };
    }

    async function saveProblemList(problemList, options) {
        const config = {
            autoSync: true,
            ...(options || {})
        };
        const lists = await getProblemLists();
        const tombstones = await syncCore.getSyncTombstones();
        const previousList = lists[problemList.listId];
        const nextList = {
            ...(previousList || {}),
            ...(problemList || {}),
            importedAt: previousList?.importedAt || problemList.importedAt || problemList.updatedAt || new Date().toISOString(),
            updatedAt: problemList.updatedAt || new Date().toISOString()
        };

        lists[nextList.listId] = nextList;
        if (tombstones.lists[nextList.listId]) {
            delete tombstones.lists[nextList.listId];
        }

        await syncCore.writeLocalMultiple({
            [STORAGE_KEYS.problemLists]: lists,
            [STORAGE_KEYS.syncTombstones]: tombstones
        }, {
            autoSync: config.autoSync,
            markDirty: true
        });

        return nextList;
    }

    async function importProblemListFromUrl(url) {
        const nextList = await resolveProblemListFromUrl(url || HOT100_CONFIG.sourceUrl);
        const currentLists = await getProblemLists();
        if (currentLists[nextList.listId]) {
            throw new Error('当前题单已经存在，无需重复导入。');
        }
        return saveProblemList(nextList, { autoSync: true });
    }

    async function importHot100StudyPlan() {
        return importProblemListFromUrl(HOT100_CONFIG.sourceUrl);
    }

    async function deleteProblemList(listId, options) {
        const config = {
            autoSync: true,
            ...(options || {})
        };
        const lists = await getProblemLists();
        if (!lists[listId]) return false;

        const tombstones = await syncCore.getSyncTombstones();
        delete lists[listId];
        tombstones.lists[listId] = new Date().toISOString();

        await syncCore.writeLocalMultiple({
            [STORAGE_KEYS.problemLists]: lists,
            [STORAGE_KEYS.syncTombstones]: tombstones
        }, {
            autoSync: config.autoSync,
            markDirty: true
        });

        return true;
    }

    async function getProblemListsWithProgress() {
        const [lists, recordMap] = await Promise.all([
            getProblemLists(),
            records.getProblemRecords()
        ]);

        const canonicalMap = records.aggregateRecordsByCanonicalId(recordMap);
        return Object.values(lists || {})
            .sort((left, right) => helpers.compareIsoDesc(left.updatedAt, right.updatedAt))
            .map((list) => {
                const stats = {
                    total: 0,
                    completed: 0,
                    inProgress: 0,
                    pending: 0
                };
                const items = Array.isArray(list.items) ? list.items.map((item) => {
                    const matchedRecord = canonicalMap.get(item.canonicalId) || null;
                    const stage = records.getRecordStage(matchedRecord);
                    let progressState = 'pending';
                    // 题单完成口径：只要该题触发过任意插件行为即视为已完成。
                    if (matchedRecord) {
                        progressState = 'completed';
                        stats.completed += 1;
                    } else {
                        stats.pending += 1;
                    }
                    stats.total += 1;
                    return {
                        ...item,
                        progressState,
                        progressLabel: progressState === 'completed' ? '已完成' : stage.label,
                        matchedRecord
                    };
                }) : [];

                return {
                    ...list,
                    manifest: buildListManifest(list),
                    items,
                    stats
                };
            });
    }

    async function getProblemListSummary() {
        const lists = await getProblemListsWithProgress();
        const completedCanonicalSet = new Set();

        return lists.reduce((summary, list) => {
            summary.totalLists += 1;
            summary.totalItems += Number(list.stats.total || 0);
            summary.inProgress += Number(list.stats.inProgress || 0);
            summary.pending += Number(list.stats.pending || 0);

            (list.items || []).forEach((item) => {
                if (!item || item.progressState !== 'completed') return;
                const canonicalId = String(item.canonicalId || '').trim();
                if (canonicalId) {
                    completedCanonicalSet.add(canonicalId);
                    return;
                }

                const titleSlug = String(item.titleSlug || '').trim().toLowerCase();
                if (titleSlug) {
                    completedCanonicalSet.add(`slug:${titleSlug}`);
                    return;
                }

                const frontendQuestionId = String(item.frontendQuestionId || '').trim();
                if (frontendQuestionId) {
                    completedCanonicalSet.add(`qid:${frontendQuestionId}`);
                    return;
                }

                const fallbackUrl = String(item.url || item.baseUrl || '').trim();
                if (fallbackUrl) {
                    completedCanonicalSet.add(`url:${fallbackUrl}`);
                }
            });

            summary.completed = completedCanonicalSet.size;
            return summary;
        }, {
            totalLists: 0,
            totalItems: 0,
            completed: 0,
            inProgress: 0,
            pending: 0
        });
    }

    modules.lists = {
        getProblemLists,
        resolveProblemListFromUrl,
        saveProblemList,
        importProblemListFromUrl,
        importHot100StudyPlan,
        deleteProblemList,
        buildListManifest,
        getProblemListsWithProgress,
        getProblemListSummary
    };
})();
