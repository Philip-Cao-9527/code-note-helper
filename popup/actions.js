/**
 * Popup 交互动作
 * 版本：1.1.1
 */

(function () {
    'use strict';

    const popupModules = window.NoteHelperPopupModules = window.NoteHelperPopupModules || {};

    function createToastController(elements) {
        let timer = null;
        return function showToast(message, duration) {
            if (!elements.toast) return;
            elements.toast.textContent = message;
            elements.toast.classList.add('show');
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                elements.toast.classList.remove('show');
            }, duration || 2200);
        };
    }

    async function openUrl(url) {
        if (!url) return;
        await chrome.tabs.create({ url, active: true });
    }

    function buildNotesPageUrl(noteTarget) {
        const problemUrl = String(noteTarget.getAttribute('data-open-note-url') || '').trim();
        const params = new URLSearchParams();
        if (problemUrl) {
            params.set('url', problemUrl);
        }

        const site = String(noteTarget.getAttribute('data-open-note-site') || '').trim();
        const problemKey = String(noteTarget.getAttribute('data-open-note-problem-key') || '').trim();
        const canonicalId = String(noteTarget.getAttribute('data-open-note-canonical-id') || '').trim();
        const titleSlug = String(noteTarget.getAttribute('data-open-note-title-slug') || '').trim();
        if (site) params.set('site', site);
        if (problemKey) params.set('problemKey', problemKey);
        if (canonicalId) params.set('canonicalId', canonicalId);
        if (titleSlug) params.set('titleSlug', titleSlug);
        if (!problemUrl && !site && !problemKey && !canonicalId && !titleSlug) {
            return '';
        }

        const title = String(noteTarget.getAttribute('data-open-note-title') || '').trim();
        if (title) {
            params.set('title', title);
        }

        const source = String(noteTarget.getAttribute('data-open-note-source') || 'problems').trim();
        params.set('from', source === 'lists' ? 'lists' : 'problems');

        const listId = String(noteTarget.getAttribute('data-open-note-list-id') || '').trim();
        if (listId) {
            params.set('listId', listId);
        }

        return chrome.runtime.getURL(`notes/notes.html?${params.toString()}`);
    }

    async function openSettingsPage() {
        await chrome.runtime.openOptionsPage();
    }

    function resolveErrorMessage(error) {
        if (error && typeof error.message === 'string') {
            return error.message.trim();
        }
        return String(error || '').trim();
    }

    function isExpectedListImportError(error) {
        const code = String(error && error.code || '').trim();
        if (code === 'list_exists' || code === 'unsupported_list_source') {
            return true;
        }
        const message = resolveErrorMessage(error);
        if (!message) return false;
        return message.includes('当前题单已经存在')
            || message.includes('暂不在支持范围内');
    }

    function logListImportFailure(prefix, error) {
        if (isExpectedListImportError(error)) {
            // 可预期业务分支（例如重复导入/不支持来源）仅通过 UI 提示，不写控制台错误或警告。
            return;
        }
        console.error(prefix, error);
    }

    function createReviewRatingController(elements) {
        const hasDialogElements = Boolean(
            elements.reviewOverlay &&
            elements.reviewCloseBtn &&
            Array.isArray(elements.reviewRatingOptions) &&
            elements.reviewRatingOptions.length
        );

        if (!hasDialogElements) {
            return async function fallbackPromptReviewRating() {
                if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
                    const text = window.prompt('请选择记忆状态：\n1 = 很难想起\n2 = 有点吃力\n3 = 基本记得\n4 = 很熟练', '3');
                    if (text === null) return 0;
                    const rating = Number(String(text).trim());
                    return Number.isInteger(rating) && rating >= 1 && rating <= 4 ? rating : -1;
                }
                return 0;
            };
        }

        let pendingResolve = null;

        function applyPreviewMap(previewMap) {
            elements.reviewRatingOptions.forEach((button) => {
                const rating = Number(button.getAttribute('data-review-rating') || 0);
                const previewEl = button.querySelector('.review-rating-preview');
                if (!previewEl) return;
                const previewEntry = previewMap && (previewMap[rating] || previewMap[String(rating)]);
                const previewText = String(previewEntry && previewEntry.previewText || '').trim() || '计算中';
                previewEl.textContent = `预计下次复习：${previewText}`;
            });
        }

        function finish(result) {
            elements.reviewOverlay.classList.remove('show');
            elements.reviewOverlay.setAttribute('aria-hidden', 'true');
            const resolve = pendingResolve;
            pendingResolve = null;
            if (resolve) resolve(result);
        }

        elements.reviewCloseBtn.addEventListener('click', () => finish(0));
        elements.reviewOverlay.addEventListener('click', (event) => {
            if (event.target === elements.reviewOverlay) {
                finish(0);
            }
        });
        elements.reviewRatingOptions.forEach((button) => {
            button.addEventListener('click', () => {
                const rating = Number(button.getAttribute('data-review-rating') || 0);
                if (!Number.isInteger(rating) || rating < 1 || rating > 4) {
                    finish(-1);
                    return;
                }
                finish(rating);
            });
        });

        if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
            document.addEventListener('keydown', (event) => {
                if (!pendingResolve) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    finish(0);
                }
            });
        }

        return async function showReviewRatingDialog(previewMap) {
            if (pendingResolve) {
                finish(0);
            }
            applyPreviewMap(previewMap);
            elements.reviewOverlay.classList.add('show');
            elements.reviewOverlay.setAttribute('aria-hidden', 'false');
            const defaultButton = elements.reviewRatingOptions.find((button) => String(button.getAttribute('data-review-rating')) === '3')
                || elements.reviewRatingOptions[0];
            if (defaultButton && typeof defaultButton.focus === 'function') {
                defaultButton.focus();
            }
            return new Promise((resolve) => {
                pendingResolve = resolve;
            });
        };
    }

    function createConfirmController(elements) {
        if (!elements.confirmOverlay || !elements.confirmMessage || !elements.confirmCancelBtn || !elements.confirmOkBtn) {
            return async function fallbackConfirm(message) {
                return window.confirm(message);
            };
        }

        let pendingResolve = null;

        function finish(result) {
            elements.confirmOverlay.classList.remove('show');
            elements.confirmOverlay.setAttribute('aria-hidden', 'true');
            const resolve = pendingResolve;
            pendingResolve = null;
            if (resolve) resolve(result);
        }

        elements.confirmCancelBtn.addEventListener('click', () => finish(false));
        elements.confirmOkBtn.addEventListener('click', () => finish(true));
        elements.confirmOverlay.addEventListener('click', (event) => {
            if (event.target === elements.confirmOverlay) {
                finish(false);
            }
        });
        document.addEventListener('keydown', (event) => {
            if (!pendingResolve) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(true);
            }
        });

        return async function showConfirm(message) {
            if (pendingResolve) {
                finish(false);
            }
            elements.confirmMessage.textContent = message || '确认执行当前操作吗？';
            elements.confirmOverlay.classList.add('show');
            elements.confirmOverlay.setAttribute('aria-hidden', 'false');
            elements.confirmCancelBtn.focus();
            return new Promise((resolve) => {
                pendingResolve = resolve;
            });
        };
    }

    function bindActions(context) {
        const {
            elements,
            state,
            store,
            showToast,
            renderAll,
            refreshData,
            onSyncIndicatorClick
        } = context;
        const showConfirm = createConfirmController(elements);
        const showReviewRatingDialog = createReviewRatingController(elements);

        function setListImportStatus(message) {
            if (!elements.listImportStatus) return;
            if (!message) {
                elements.listImportStatus.textContent = '';
                elements.listImportStatus.hidden = true;
                return;
            }
            elements.listImportStatus.textContent = message;
            elements.listImportStatus.hidden = false;
        }

        function setListImportPending(pending, message) {
            if (elements.importHot100Btn) {
                elements.importHot100Btn.disabled = pending;
            }
            if (elements.importListUrlBtn) {
                elements.importListUrlBtn.disabled = pending;
            }
            if (elements.listImportUrl) {
                elements.listImportUrl.disabled = pending;
            }

            if (pending) {
                setListImportStatus(message || '正在导入，请稍候...');
                return;
            }
            setListImportStatus('');
        }

        elements.navButtons.forEach((button) => {
            button.addEventListener('click', () => {
                state.activeView = button.dataset.view;
                renderAll();
            });
        });

        if (elements.openSettingsBtn) {
            elements.openSettingsBtn.addEventListener('click', async () => {
                try {
                    await openSettingsPage();
                } catch (error) {
                    console.error('[Popup] 打开设置页失败：', error);
                    showToast('打开设置页失败，请稍后重试');
                }
            });
        }

        if (elements.syncIndicatorBtn && typeof onSyncIndicatorClick === 'function') {
            elements.syncIndicatorBtn.addEventListener('click', async () => {
                try {
                    await onSyncIndicatorClick();
                } catch (error) {
                    console.error('[Popup] 同步器点击处理失败：', error);
                    showToast('同步失败，请稍后重试', 2600);
                }
            });
        }

        if (elements.problemsSearchInput) {
            elements.problemsSearchInput.addEventListener('input', () => {
                state.problemQuery = elements.problemsSearchInput.value;
                state.problemPage = 1;
                renderAll();
            });
        }

        if (elements.problemsStatusFilter) {
            elements.problemsStatusFilter.addEventListener('change', () => {
                state.problemStatusFilter = elements.problemsStatusFilter.value || 'all';
                state.problemPage = 1;
                renderAll();
            });
        }

        if (elements.deepmlSearchInput) {
            elements.deepmlSearchInput.addEventListener('input', () => {
                state.deepmlQuery = elements.deepmlSearchInput.value;
                state.deepmlPage = 1;
                renderAll();
            });
        }

        if (elements.deepmlStatusFilter) {
            elements.deepmlStatusFilter.addEventListener('change', () => {
                state.deepmlStatusFilter = elements.deepmlStatusFilter.value || 'all';
                state.deepmlPage = 1;
                renderAll();
            });
        }

        if (elements.listsSearchInput) {
            elements.listsSearchInput.addEventListener('input', () => {
                state.listQuery = elements.listsSearchInput.value;
                state.listPages = {};
                renderAll();
            });
        }

        if (elements.listsStatusFilter) {
            elements.listsStatusFilter.addEventListener('change', () => {
                state.listStatusFilter = elements.listsStatusFilter.value || 'all';
                state.listPages = {};
                renderAll();
            });
        }

        if (elements.importHot100Btn) {
            elements.importHot100Btn.addEventListener('click', async () => {
                try {
                    setListImportPending(true, '正在导入 Hot100，请稍候...');
                    await store.importHot100StudyPlan();
                    await refreshData();
                    showToast('Hot100 已导入');
                } catch (error) {
                    logListImportFailure('[Popup] 导入 Hot100 提示：', error);
                    showToast(resolveErrorMessage(error) || '导入失败，请稍后重试', 2600);
                } finally {
                    setListImportPending(false);
                }
            });
        }

        if (elements.importListUrlBtn) {
            elements.importListUrlBtn.addEventListener('click', async () => {
                const url = String(elements.listImportUrl && elements.listImportUrl.value || '').trim();
                if (!url) {
                    showToast('请先粘贴题单链接');
                    return;
                }
                try {
                    setListImportPending(true, '正在导入题单，请稍候...');
                    await store.importProblemListFromUrl(url);
                    elements.listImportUrl.value = '';
                    await refreshData();
                    showToast('题单已导入');
                } catch (error) {
                    logListImportFailure('[Popup] 导入题单提示：', error);
                    showToast(resolveErrorMessage(error) || '导入失败，请稍后重试', 2600);
                } finally {
                    setListImportPending(false);
                }
            });
        }

        function handlePagination(payload) {
            const parts = String(payload || '').split(':');
            const action = parts.pop();
            const scope = parts.join(':');
            if (scope === 'problems') {
                state.problemPage = action === 'next' ? state.problemPage + 1 : state.problemPage - 1;
                renderAll();
                return;
            }

            if (scope === 'deepml') {
                state.deepmlPage = action === 'next' ? state.deepmlPage + 1 : state.deepmlPage - 1;
                renderAll();
                return;
            }

            if (scope.startsWith('list:')) {
                const listId = scope.slice(5);
                const currentPage = state.listPages[listId] || 1;
                state.listPages[listId] = action === 'next' ? currentPage + 1 : currentPage - 1;
                renderAll();
            }
        }

        async function handleActionClick(target) {
            const noteTarget = target.closest('[data-open-note-url]');
            if (noteTarget) {
                const notesUrl = buildNotesPageUrl(noteTarget);
                if (!notesUrl) {
                    showToast('当前题目缺少可用标识，无法打开笔记');
                    return;
                }
                try {
                    await openUrl(notesUrl);
                } catch (error) {
                    console.error('[Popup] 打开笔记页失败：', error);
                    showToast('打开笔记页失败，请稍后重试');
                }
                return;
            }

            const openTarget = target.closest('[data-open-url]');
            if (openTarget) {
                const url = openTarget.getAttribute('data-open-url');
                try {
                    await openUrl(url);
                } catch (error) {
                    console.error('[Popup] 打开链接失败：', error);
                    showToast('打开链接失败，请稍后重试');
                }
                return;
            }

            const paginationTarget = target.closest('[data-pagination]');
            if (paginationTarget) {
                handlePagination(paginationTarget.getAttribute('data-pagination'));
                return;
            }

            const toggleTarget = target.closest('[data-toggle-list]');
            if (toggleTarget) {
                const listId = toggleTarget.getAttribute('data-toggle-list');
                state.expandedLists[listId] = !state.expandedLists[listId];
                renderAll();
                return;
            }

            const switchViewTarget = target.closest('[data-switch-view]');
            if (switchViewTarget) {
                const nextView = String(switchViewTarget.getAttribute('data-switch-view') || '').trim();
                if (nextView) {
                    state.activeView = nextView;
                    renderAll();
                }
                return;
            }

            const reviewTarget = target.closest('[data-review-record]');
            if (reviewTarget) {
                const recordId = String(reviewTarget.getAttribute('data-review-record') || '').trim();
                const record = state.records.find((item) => String(item && item.id || '') === recordId);
                if (!record) {
                    showToast('未找到题目记录，请刷新后重试');
                    return;
                }

                const reviewMeta = typeof store.getRecordReviewMeta === 'function'
                    ? store.getRecordReviewMeta(record)
                    : null;
                if (!reviewMeta || !reviewMeta.enabled || !reviewMeta.isLeetcode) {
                    showToast('请先在题目详情页加入复习计划');
                    return;
                }
                if (reviewMeta.ratedToday || reviewMeta.reviewedToday) {
                    showToast('当前题目今天已经记录过评分，请明天再复习');
                    return;
                }

                const reviewNowTime = Date.now();
                let previewMap = null;
                if (typeof store.getReviewRatingPreviews === 'function') {
                    try {
                        previewMap = await store.getReviewRatingPreviews({
                            url: record.url || record.baseUrl || '',
                            site: record.site || '',
                            problemKey: record.problemKey || '',
                            title: record.title || record.problemKey || '未命名题目',
                            nowTime: reviewNowTime
                        });
                    } catch (error) {
                        console.warn('[Popup] 获取复习预估失败：', error);
                    }
                }

                const rating = await showReviewRatingDialog(previewMap);
                if (rating === 0) return;
                if (rating < 0) {
                    showToast('请输入 1-4 的评分');
                    return;
                }

                try {
                    const result = await store.rateProblemMemory({
                        url: record.url || record.baseUrl || '',
                        site: record.site || '',
                        problemKey: record.problemKey || '',
                        title: record.title || record.problemKey || '未命名题目',
                        rating,
                        nowTime: reviewNowTime
                    });
                    if (!result || result.success === false) {
                        if (result && result.reason === 'already_rated_today') {
                            showToast('当前题目今天已经记录过评分，请明天再复习');
                            return;
                        }
                        if (result && result.reason === 'unsupported') {
                            showToast('当前题目缺少有效链接，请先在题目详情页打开后再复习');
                            return;
                        }
                        if (result && result.reason === 'site_not_supported') {
                            showToast('当前站点暂不支持复习评分');
                            return;
                        }
                        showToast('更新失败，请稍后重试');
                        return;
                    }
                    await refreshData();
                    showToast('记忆状态已更新');
                } catch (error) {
                    console.error('[Popup] 快捷复习失败：', error);
                    showToast('更新失败，请稍后重试');
                }
                return;
            }

            const deleteRecordTarget = target.closest('[data-delete-record]');
            if (deleteRecordTarget) {
                const recordId = deleteRecordTarget.getAttribute('data-delete-record');
                if (!recordId) {
                    showToast('未找到可删除的记录');
                    return;
                }

                const confirmed = await showConfirm('确认删除这条题目记录吗？删除后将无法恢复。');
                if (!confirmed) return;

                try {
                    await store.deleteProblemRecord(recordId);
                    await refreshData();
                    showToast('题目记录已删除');
                } catch (error) {
                    console.error('[Popup] 删除题目记录失败：', error);
                    showToast(error.message || '删除失败，请稍后重试');
                }
                return;
            }

            const deleteTarget = target.closest('[data-delete-list]');
            if (deleteTarget) {
                const listId = deleteTarget.getAttribute('data-delete-list');
                const confirmed = await showConfirm('确认删除这份题单吗？题单进度会一起清除。');
                if (!confirmed) return;
                try {
                    await store.deleteProblemList(listId);
                    await refreshData();
                    showToast('题单已删除');
                } catch (error) {
                    console.error('[Popup] 删除题单失败：', error);
                    showToast(error.message || '删除失败，请稍后重试');
                }
            }
        }

        [elements.overviewReviewCard, elements.problemsList, elements.problemsPagination, elements.deepmlList, elements.deepmlPagination, elements.problemLists].forEach((container) => {
            if (!container) return;
            container.addEventListener('click', (event) => {
                handleActionClick(event.target);
            });
        });

        if (elements.githubHomeBtn) {
            elements.githubHomeBtn.addEventListener('click', async () => {
                try {
                    await openUrl(store.PROJECT_LINKS.githubHome);
                } catch (error) {
                    console.error('[Popup] 打开 GitHub 项目失败：', error);
                    showToast('打开 GitHub 项目失败');
                }
            });
        }

        if (elements.githubIssuesBtn) {
            elements.githubIssuesBtn.addEventListener('click', async () => {
                try {
                    await openUrl(store.PROJECT_LINKS.githubIssues);
                } catch (error) {
                    console.error('[Popup] 打开 Issue 页面失败：', error);
                    showToast('打开 Issue 页面失败');
                }
            });
        }
    }

    popupModules.actions = {
        createToastController,
        bindActions
    };
})();
