/**
 * Popup 入口脚本
 * 版本：1.0.81
 */

(function () {
    'use strict';

    const AUTO_SYNC_INTERVAL_MS = 1 * 60 * 1000;
    const SYNC_INDICATOR_CRUISE_INTERVAL_MS = 2000;
    const SYNC_INDICATOR_CRUISE_DURATION_MS = 1200;

    document.addEventListener('DOMContentLoaded', async () => {
        const popupModules = window.NoteHelperPopupModules || {};
        const stateUtils = popupModules.state;
        const renderOverview = popupModules.renderOverview;
        const renderProblems = popupModules.renderProblems;
        const renderLists = popupModules.renderLists;
        const popupActions = popupModules.actions;
        const store = window.NoteHelperProblemData;

        if (!stateUtils || !renderOverview || !renderProblems || !renderLists || !popupActions) {
            console.error('[Popup] Popup 模块未完整加载');
            return;
        }

        if (!store ||
            typeof store.getSortedProblemRecords !== 'function' ||
            typeof store.getProblemListsWithProgress !== 'function' ||
            typeof store.getProblemListSummary !== 'function' ||
            typeof store.getSyncOverview !== 'function') {
            console.error('[Popup] 共享数据仓库未加载完成');
            return;
        }

        const elements = stateUtils.createElements();
        const state = stateUtils.createInitialState(store.PAGE_SIZE || 5);
        const showToast = popupActions.createToastController(elements);

        if (elements.problemsSearchInput) {
            elements.problemsSearchInput.value = '';
        }
        if (elements.listsSearchInput) {
            elements.listsSearchInput.value = '';
        }
        if (elements.problemsStatusFilter) {
            elements.problemsStatusFilter.value = 'all';
        }
        if (elements.listsStatusFilter) {
            elements.listsStatusFilter.value = 'all';
        }

        state.problemStatusFilter = 'all';
        state.listStatusFilter = 'all';

        let schedulerStarted = false;
        let syncIndicatorTimer = null;
        let syncIndicatorCruiseTimer = null;
        let removeSyncListener = null;

        function syncActiveView() {
            elements.navButtons.forEach((button) => {
                button.classList.toggle('active', button.dataset.view === state.activeView);
            });
            elements.views.forEach((view) => {
                view.classList.toggle('active', view.id === state.activeView);
            });
        }

        function normalizeListState() {
            const listIds = new Set(state.lists.map((list) => list.listId));
            Object.keys(state.listPages).forEach((listId) => {
                if (!listIds.has(listId)) {
                    delete state.listPages[listId];
                }
            });
            Object.keys(state.expandedLists).forEach((listId) => {
                if (!listIds.has(listId)) {
                    delete state.expandedLists[listId];
                }
            });
            if (!Object.keys(state.expandedLists).length && state.lists.length) {
                state.expandedLists[state.lists[0].listId] = true;
            }
        }

        function renderAll() {
            syncActiveView();
            renderOverview.renderOverview(elements, state);
            renderProblems.renderProblems(elements, state, store);
            renderLists.renderLists(elements, state);
        }

        function clearSyncIndicatorTimer() {
            if (!syncIndicatorTimer) return;
            clearTimeout(syncIndicatorTimer);
            syncIndicatorTimer = null;
        }

        function clearSyncIndicatorCruiseTimer() {
            if (!syncIndicatorCruiseTimer) return;
            clearInterval(syncIndicatorCruiseTimer);
            syncIndicatorCruiseTimer = null;
        }

        function getIndicatorHidden(syncOverview) {
            if (!syncOverview) return true;
            if (typeof store.shouldShowSyncIndicator === 'function') {
                return !store.shouldShowSyncIndicator(syncOverview);
            }
            return !(syncOverview.chromeSyncEnabled || syncOverview.webdavEnabled);
        }

        function buildIdleTitle(syncOverview) {
            const suffix = '（状态提示，真实同步按自动周期或点击触发）';
            if (!syncOverview) return '同步已关闭';
            if (syncOverview.chromeSyncEnabled && syncOverview.webdavEnabled) {
                return `Cloud Sync 与坚果云已启用，点击立即同步${suffix}`;
            }
            if (syncOverview.chromeSyncEnabled) {
                return `Cloud Sync 已启用，点击立即同步${suffix}`;
            }
            if (syncOverview.webdavEnabled) {
                return `坚果云已启用，点击立即同步${suffix}`;
            }
            return '同步已关闭';
        }

        function buildWarningTitle(syncOverview) {
            if (!syncOverview || !syncOverview.webdavEnabled) return '';
            if (syncOverview.webdavConfigComplete) return '';
            return syncOverview.webdavConfigWarning || '坚果云配置未完整，点击前往设置页补全';
        }

        function resolveIndicatorText(status, customText) {
            if (customText) return customText;
            if (status === 'syncing' || status === 'cruise-syncing') return '同步中';
            if (status === 'warning') return '需配置';
            if (status === 'error') return '同步失败';
            return '已同步';
        }

        function setIndicatorVisualStatus(status, titleText, textLabel) {
            const indicator = elements.syncIndicatorBtn;
            if (!indicator) return;
            indicator.classList.remove('syncing', 'cruise-syncing', 'success', 'error', 'warning');
            if (status) {
                indicator.classList.add(status);
            }
            const finalTitle = titleText || '同步状态';
            indicator.title = finalTitle;
            indicator.setAttribute('aria-label', finalTitle);
            if (elements.syncIndicatorText) {
                elements.syncIndicatorText.textContent = resolveIndicatorText(status, textLabel);
            }
        }

        function shouldRunCruiseAnimation() {
            const indicator = elements.syncIndicatorBtn;
            if (!indicator || indicator.hidden) return false;
            if (syncIndicatorTimer) return false;
            if (indicator.classList.contains('syncing')) return false;
            if (indicator.classList.contains('warning')) return false;
            if (indicator.classList.contains('error')) return false;
            return true;
        }

        function startSyncIndicatorCruise() {
            if (syncIndicatorCruiseTimer) return;
            syncIndicatorCruiseTimer = setInterval(() => {
                if (!shouldRunCruiseAnimation()) return;
                applyTransientIndicatorState(
                    'cruise-syncing',
                    buildIdleTitle(state.syncOverview),
                    SYNC_INDICATOR_CRUISE_DURATION_MS,
                    '同步中'
                );
            }, SYNC_INDICATOR_CRUISE_INTERVAL_MS);
        }

        function applyBaseIndicatorState() {
            const indicator = elements.syncIndicatorBtn;
            if (!indicator) return;
            clearSyncIndicatorTimer();

            const syncOverview = state.syncOverview;
            const hidden = getIndicatorHidden(syncOverview);
            indicator.hidden = hidden;

            if (hidden) {
                clearSyncIndicatorCruiseTimer();
                setIndicatorVisualStatus('', '同步已关闭', '已关闭');
                return;
            }

            const warningTitle = buildWarningTitle(syncOverview);
            if (warningTitle) {
                clearSyncIndicatorCruiseTimer();
                setIndicatorVisualStatus('warning', warningTitle, '需配置');
                return;
            }

            setIndicatorVisualStatus('', buildIdleTitle(syncOverview), '已同步');
            startSyncIndicatorCruise();
        }

        function applyTransientIndicatorState(status, titleText, durationMs, textLabel) {
            const indicator = elements.syncIndicatorBtn;
            if (!indicator || indicator.hidden) return;
            clearSyncIndicatorTimer();
            if (status === 'syncing') {
                clearSyncIndicatorCruiseTimer();
            }
            setIndicatorVisualStatus(status, titleText, textLabel);
            if (!durationMs || durationMs <= 0) return;
            syncIndicatorTimer = setTimeout(() => {
                syncIndicatorTimer = null;
                applyBaseIndicatorState();
            }, durationMs);
        }

        async function syncAutoScheduler() {
            const shouldStart = Boolean(state.syncOverview && (state.syncOverview.chromeSyncEnabled || state.syncOverview.webdavEnabled));
            if (!shouldStart && schedulerStarted) {
                if (typeof store.stopAutoSyncScheduler === 'function') {
                    store.stopAutoSyncScheduler();
                }
                schedulerStarted = false;
                return;
            }
            if (shouldStart && !schedulerStarted && typeof store.startAutoSyncScheduler === 'function') {
                const startResult = await store.startAutoSyncScheduler({
                    intervalMs: AUTO_SYNC_INTERVAL_MS
                });
                schedulerStarted = Boolean(startResult && startResult.started);
            }
        }

        async function refreshData() {
            const [records, recordSummary, lists, listSummary, syncOverview] = await Promise.all([
                store.getSortedProblemRecords(),
                store.getProblemRecordSummary(),
                store.getProblemListsWithProgress(),
                store.getProblemListSummary(),
                store.getSyncOverview()
            ]);

            state.records = records;
            state.recordSummary = recordSummary;
            state.lists = lists;
            state.listSummary = listSummary;
            state.syncOverview = syncOverview;
            normalizeListState();
            await syncAutoScheduler();
            renderAll();
            applyBaseIndicatorState();
        }

        async function openSettingsPageFromIndicator() {
            if (typeof chrome !== 'undefined' &&
                chrome.runtime &&
                typeof chrome.runtime.openOptionsPage === 'function') {
                await chrome.runtime.openOptionsPage();
                return;
            }
            throw new Error('当前环境无法打开设置页');
        }

        async function onSyncIndicatorClick() {
            if (!state.syncOverview) {
                await refreshData();
            }

            if (!state.syncOverview || getIndicatorHidden(state.syncOverview)) {
                showToast('请先在设置页启用同步', 2400);
                return;
            }

            const warningTitle = buildWarningTitle(state.syncOverview);
            if (warningTitle) {
                showToast('坚果云配置未完整，已为你打开设置页', 2800);
                await openSettingsPageFromIndicator();
                return;
            }

            if (elements.syncIndicatorBtn && elements.syncIndicatorBtn.classList.contains('syncing')) {
                showToast('同步进行中，请稍候', 2200);
                return;
            }

            if (typeof store.runUnifiedSyncNow !== 'function') {
                showToast('当前版本未加载统一同步能力，请刷新后重试', 2800);
                return;
            }

            const result = await store.runUnifiedSyncNow({
                reason: 'popup-indicator-manual',
                source: 'popup-indicator'
            });

            if (result && result.queued) {
                showToast('已有同步任务在执行，已加入队列', 2600);
                return;
            }
            if (result && result.warning) {
                showToast('坚果云配置未完整，请先补全设置', 2800);
                await refreshData();
                return;
            }
            if (result && result.error) {
                showToast(`同步失败：${result.error}`, 3000);
                await refreshData();
                return;
            }

            showToast('同步任务已触发', 2200);
            await refreshData();
        }

        popupActions.bindActions({
            elements,
            state,
            store,
            showToast,
            renderAll,
            refreshData,
            onSyncIndicatorClick
        });

        try {
            const manifest = chrome.runtime.getManifest();
            if (elements.versionText) {
                elements.versionText.textContent = `v${manifest.version}`;
            }

            if (typeof store.addSyncListener === 'function') {
                removeSyncListener = store.addSyncListener((event) => {
                    if (!event || !event.status) return;
                    if (event.status === 'syncing') {
                        applyTransientIndicatorState('syncing', '正在同步...', 0, '同步中');
                        return;
                    }
                    if (event.status === 'success') {
                        applyTransientIndicatorState('success', event.message || '同步成功', 2600, '已同步');
                        return;
                    }
                    if (event.status === 'warning') {
                        applyTransientIndicatorState('warning', event.message || '同步配置未完整', 3200, '需配置');
                        return;
                    }
                    if (event.status === 'error') {
                        applyTransientIndicatorState('error', event.message || '同步失败', 3200, '同步失败');
                        return;
                    }
                    applyBaseIndicatorState();
                });
            }

            window.addEventListener('unload', () => {
                clearSyncIndicatorTimer();
                clearSyncIndicatorCruiseTimer();
                if (typeof removeSyncListener === 'function') {
                    removeSyncListener();
                    removeSyncListener = null;
                }
                if (schedulerStarted && typeof store.stopAutoSyncScheduler === 'function') {
                    store.stopAutoSyncScheduler();
                    schedulerStarted = false;
                }
            });

            await refreshData();
        } catch (error) {
            console.error('[Popup] 初始化失败：', error);
            showToast('Popup 初始化失败，请重试', 2600);
        }
    });
})();

