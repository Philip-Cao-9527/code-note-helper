/**
 * 刷题记录共享仓库组装入口
 * 版本：1.1.1
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const syncCore = modules.syncCore || {};
    const records = modules.records || {};
    const lists = modules.lists || {};
    const providers = modules.providers || {};

    modules.createApi = function createApi() {
        return {
            STORAGE_KEYS: constants.STORAGE_KEYS,
            PROJECT_LINKS: constants.PROJECT_LINKS,
            HOT100_CONFIG: constants.HOT100_CONFIG,
            STAGE_LABELS: constants.STAGE_LABELS,
            ACTION_LABELS: constants.ACTION_LABELS,
            PAGE_SIZE: constants.PAGE_SIZE,
            extractProblemIdentity: records.extractProblemIdentity,
            createIdentityFromSiteAndProblemKey: records.createIdentityFromSiteAndProblemKey,
            buildProblemUrlFromSiteAndProblemKey: records.buildProblemUrlFromSiteAndProblemKey,
            isLeetcodeSite: records.isLeetcodeSite,
            isDeepLearningSite: records.isDeepLearningSite,
            getActionLabel: records.getActionLabel,
            getRecordStage: records.getRecordStage,
            getRecordReviewMeta: records.getRecordReviewMeta,
            getProblemRecords: records.getProblemRecords,
            getProblemRecordSummary: records.getProblemRecordSummary,
            getSortedProblemRecords: records.getSortedProblemRecords,
            getProblemRecordByUrl: records.getProblemRecordByUrl,
            getLeetcodeReviewSummary: records.getLeetcodeReviewSummary,
            trackProblemAction: records.trackProblemAction,
            getReviewRatingPreviews: records.getReviewRatingPreviews,
            rateProblemMemory: records.rateProblemMemory,
            markProblemReviewReminded: records.markProblemReviewReminded,
            deleteProblemRecord: records.deleteProblemRecord,
            saveProblemNote: records.saveProblemNote,
            getProblemLists: lists.getProblemLists,
            resolveProblemListFromUrl: lists.resolveProblemListFromUrl,
            getProblemListsWithProgress: lists.getProblemListsWithProgress,
            getProblemListSummary: lists.getProblemListSummary,
            importProblemListFromUrl: lists.importProblemListFromUrl,
            importHot100StudyPlan: lists.importHot100StudyPlan,
            deleteProblemList: lists.deleteProblemList,
            getSyncMeta: syncCore.getSyncMeta,
            getSyncSettings: syncCore.getSyncSettings,
            setSyncSettings: syncCore.setSyncSettings,
            getSyncOverview: syncCore.getSyncOverview,
            isWebdavConfigComplete: syncCore.isWebdavConfigComplete,
            isAnySyncEnabled: syncCore.isAnySyncEnabled,
            shouldShowSyncIndicator: syncCore.shouldShowSyncIndicator,
            buildWebdavConfigWarning: syncCore.buildWebdavConfigWarning,
            exportLocalSnapshot: syncCore.exportLocalSnapshot,
            importLocalSnapshot: syncCore.importLocalSnapshot,
            runUnifiedSyncNow: syncCore.runUnifiedSync,
            startAutoSyncScheduler: syncCore.startAutoSyncScheduler,
            stopAutoSyncScheduler: syncCore.stopAutoSyncScheduler,
            addSyncListener: syncCore.addSyncListener,
            removeSyncListener: syncCore.removeSyncListener,
            testNutstoreConnection: providers.webdav && providers.webdav.testNutstoreConnection,
            backupToNutstore: providers.webdav && providers.webdav.backupToNutstore,
            restoreFromNutstore: providers.webdav && providers.webdav.restoreFromNutstore,
            getTimelineEnabled: syncCore.getTimelineEnabled,
            setTimelineEnabled: syncCore.setTimelineEnabled
        };
    };
})();
