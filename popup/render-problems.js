/**
 * Popup 题目页渲染
 * 版本：1.1.0
 */

(function () {
    'use strict';

    const popupModules = window.NoteHelperPopupModules = window.NoteHelperPopupModules || {};
    const stateUtils = popupModules.state || {};

    function isDeepLearningRecord(record, store) {
        if (store && typeof store.isDeepLearningSite === 'function') {
            return Boolean(store.isDeepLearningSite(record && record.site));
        }
        const site = String(record && record.site || '').trim().toLowerCase();
        return site === 'deep-ml.com' || site === 'duoan-torchcode.hf.space';
    }

    function compareUpdatedAtDesc(left, right) {
        return new Date(right && right.updatedAt || 0).getTime() - new Date(left && left.updatedAt || 0).getTime();
    }

    function formatRecallProbability(probability) {
        if (!Number.isFinite(probability)) return '暂无';
        return `${(Math.max(0, Math.min(1, probability)) * 100).toFixed(1)}%`;
    }

    function buildProblemTooltip(store, record, includeReview) {
        const fullTitle = record.title || record.problemKey || '未命名题目';
        const stage = store.getRecordStage(record);
        const stageLabel = stage && stage.code === 'none' ? '仅入库' : stage.label;
        const lines = [
            `题目：${fullTitle}`,
            `站点：${record.site || '未知'}`,
            `状态：${stageLabel}`,
            `最近动作：${store.getActionLabel(record.lastActionType)}`,
            `最近更新：${stateUtils.formatDateTime(record.updatedAt)}`
        ];

        if (includeReview && store && typeof store.getRecordReviewMeta === 'function') {
            const reviewMeta = store.getRecordReviewMeta(record);
            if (reviewMeta && reviewMeta.enabled && reviewMeta.isLeetcode) {
                lines.push(`Recall probability：${formatRecallProbability(reviewMeta.recallProbability)}`);
                lines.push(`当前记忆状态：${reviewMeta.ratingLabel || '未设置'}`);
            } else {
                lines.push('Recall probability：暂无');
                lines.push('当前记忆状态：未设置');
            }
        }

        return lines.join('\n');
    }

    function filterRecordsBySearchAndStatus(records, keyword, statusFilter, store) {
        return records.filter((record) => {
            const stageCode = store.getRecordStage(record).code;
            const statusMatched = statusFilter === 'all' || stageCode === statusFilter;
            if (!statusMatched) return false;
            if (!keyword) return true;
            return stateUtils.buildProblemSearchText(record).includes(keyword);
        });
    }

    function sortLeetcodeRecords(records, store) {
        return records.slice().sort((left, right) => {
            const leftMeta = store && typeof store.getRecordReviewMeta === 'function'
                ? store.getRecordReviewMeta(left)
                : null;
            const rightMeta = store && typeof store.getRecordReviewMeta === 'function'
                ? store.getRecordReviewMeta(right)
                : null;
            const leftHasReview = Boolean(
                leftMeta &&
                leftMeta.enabled &&
                leftMeta.isLeetcode &&
                Number(leftMeta.nextReviewTime || 0) > 0
            );
            const rightHasReview = Boolean(
                rightMeta &&
                rightMeta.enabled &&
                rightMeta.isLeetcode &&
                Number(rightMeta.nextReviewTime || 0) > 0
            );

            if (leftHasReview !== rightHasReview) {
                return leftHasReview ? -1 : 1;
            }

            if (leftHasReview && rightHasReview) {
                const leftNext = Number(leftMeta.nextReviewTime || 0);
                const rightNext = Number(rightMeta.nextReviewTime || 0);
                if (leftNext !== rightNext) {
                    return leftNext - rightNext;
                }
            }
            return compareUpdatedAtDesc(left, right);
        });
    }

    function formatCompactDate(value) {
        const time = new Date(value || 0).getTime();
        if (!Number.isFinite(time) || time <= 0) return '未设置';
        const dt = new Date(time);
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function buildRecordRow(record, stage, compactLabel, tooltip, options) {
        const reviewMeta = options.reviewMeta || null;
        const dueClass = reviewMeta && reviewMeta.dueToday ? ' review-due' : '';
        const nextReviewText = options.showNextReview
            ? `下次复习：${reviewMeta && reviewMeta.review && reviewMeta.review.nextReviewAt
                ? formatCompactDate(reviewMeta.review.nextReviewAt)
                : '未设置'}`
            : '';
        const source = options.source || 'problems';
        const openUrl = record.url || record.baseUrl || '';

        return `
          <div class="compact-line${dueClass}" title="${stateUtils.escapeHtml(tooltip)}" data-review-due="${reviewMeta && reviewMeta.dueToday ? 'true' : 'false'}">
            <button
              type="button"
              class="compact-open"
              data-open-url="${stateUtils.escapeHtml(openUrl)}">
              <div class="compact-main">
                <div class="compact-title">${stateUtils.escapeHtml(record.title || record.problemKey || '未命名题目')}</div>
                ${options.showNextReview ? `<div class="compact-review-time">${stateUtils.escapeHtml(nextReviewText)}</div>` : ''}
              </div>
            </button>
            <div class="compact-right">
              <span class="status-badge ${stateUtils.escapeHtml(stage.code)}">${stateUtils.escapeHtml(compactLabel)}</span>
              <button
                type="button"
                class="row-action-btn note"
                data-open-note-url="${stateUtils.escapeHtml(openUrl)}"
                data-open-note-title="${stateUtils.escapeHtml(record.title || record.problemKey || '未命名题目')}"
                data-open-note-source="${stateUtils.escapeHtml(source)}"
                title="打开笔记">
                📝
              </button>
              ${options.showQuickReview ? `
              <button
                type="button"
                class="row-action-btn review"
                data-review-record="${stateUtils.escapeHtml(record.id || '')}"
                title="快速复习评分">
                🧠
              </button>
              ` : ''}
              <button
                type="button"
                class="row-action-btn danger"
                data-delete-record="${stateUtils.escapeHtml(record.id || '')}"
                title="删除题目记录">
                －
              </button>
            </div>
          </div>
        `;
    }

    function renderLeetcodeProblems(elements, state, store) {
        const keyword = stateUtils.normalizeSearchText(state.problemQuery);
        const statusFilter = state.problemStatusFilter || 'all';
        const sourceRecords = state.records.filter((record) => !isDeepLearningRecord(record, store));
        const filtered = filterRecordsBySearchAndStatus(sourceRecords, keyword, statusFilter, store);
        const sorted = sortLeetcodeRecords(filtered, store);

        if (!sorted.length) {
            const hasFilter = Boolean(keyword) || statusFilter !== 'all';
            elements.problemsList.innerHTML = `
              <div class="empty-state">
                ${hasFilter ? '没有找到符合当前筛选条件的题目' : '这里会显示 LeetCode / CodeFun2000 的题目记录。'}
              </div>
            `;
            elements.problemsPagination.innerHTML = '';
            return;
        }

        const pageData = stateUtils.paginate(sorted, state.problemPage, state.pageSize);
        state.problemPage = pageData.page;
        elements.problemsList.innerHTML = pageData.items.map((record) => {
            const stage = store.getRecordStage(record);
            const compactLabel = stateUtils.getCompactStageLabel(stage.code);
            const tooltip = buildProblemTooltip(store, record, true);
            const reviewMeta = store && typeof store.getRecordReviewMeta === 'function'
                ? store.getRecordReviewMeta(record)
                : null;
            return buildRecordRow(record, stage, compactLabel, tooltip, {
                source: 'problems',
                showNextReview: true,
                reviewMeta,
                showQuickReview: Boolean(reviewMeta && reviewMeta.enabled && reviewMeta.isLeetcode)
            });
        }).join('');

        elements.problemsPagination.innerHTML = stateUtils.buildPaginationHtml('problems', pageData);
    }

    function renderDeepmlProblems(elements, state, store) {
        if (!elements.deepmlList || !elements.deepmlPagination) return;

        const keyword = stateUtils.normalizeSearchText(state.deepmlQuery);
        const statusFilter = state.deepmlStatusFilter || 'all';
        const sourceRecords = state.records.filter((record) => isDeepLearningRecord(record, store));
        const filtered = filterRecordsBySearchAndStatus(sourceRecords, keyword, statusFilter, store)
            .sort(compareUpdatedAtDesc);

        if (!filtered.length) {
            const hasFilter = Boolean(keyword) || statusFilter !== 'all';
            elements.deepmlList.innerHTML = `
              <div class="empty-state">
                ${hasFilter ? '没有找到符合当前筛选条件的题目' : '这里会显示 Deep-ML / TorchCode 的题目记录。'}
              </div>
            `;
            elements.deepmlPagination.innerHTML = '';
            return;
        }

        const pageData = stateUtils.paginate(filtered, state.deepmlPage, state.pageSize);
        state.deepmlPage = pageData.page;
        elements.deepmlList.innerHTML = pageData.items.map((record) => {
            const stage = store.getRecordStage(record);
            const compactLabel = stateUtils.getCompactStageLabel(stage.code);
            const tooltip = buildProblemTooltip(store, record, false);
            return buildRecordRow(record, stage, compactLabel, tooltip, {
                source: 'problems',
                showNextReview: false,
                reviewMeta: null
            });
        }).join('');

        elements.deepmlPagination.innerHTML = stateUtils.buildPaginationHtml('deepml', pageData);
    }

    popupModules.renderProblems = {
        renderProblems: renderLeetcodeProblems,
        renderLeetcodeProblems,
        renderDeepmlProblems
    };
})();
