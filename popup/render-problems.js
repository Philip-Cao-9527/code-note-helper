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

    function normalizeReviewMeta(meta) {
        if (!meta || typeof meta !== 'object') {
            return {
                enabled: false,
                isLeetcode: false,
                dueByToday: false,
                reviewedToday: false,
                dueToday: false,
                overdueDays: 0,
                nextReviewTime: 0,
                review: null,
                ratingLabel: '未设置',
                recallProbability: 1
            };
        }

        const dueByToday = Boolean(meta.dueByToday ?? meta.dueToday);
        const reviewedToday = Boolean(meta.reviewedToday ?? (meta.review && meta.review.reviewedToday));
        const overdueDaysRaw = Number(meta.overdueDays || 0);

        return {
            enabled: Boolean(meta.enabled),
            isLeetcode: Boolean(meta.isLeetcode),
            dueByToday,
            reviewedToday,
            dueToday: dueByToday && !reviewedToday,
            overdueDays: Number.isFinite(overdueDaysRaw) ? Math.max(0, Math.floor(overdueDaysRaw)) : 0,
            nextReviewTime: Number(meta.nextReviewTime || 0),
            review: meta.review || null,
            ratingLabel: meta.ratingLabel || '未设置',
            recallProbability: Number(meta.recallProbability || 0)
        };
    }

    function getLeetcodeReviewGroup(reviewMeta) {
        if (!reviewMeta.enabled || !reviewMeta.isLeetcode) return 'none';
        if (reviewMeta.dueByToday && !reviewMeta.reviewedToday) return 'due-today';
        if (reviewMeta.dueByToday && reviewMeta.reviewedToday) return 'done-today';
        return 'normal';
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
            const reviewMeta = normalizeReviewMeta(store.getRecordReviewMeta(record));
            if (reviewMeta.enabled && reviewMeta.isLeetcode) {
                const nextReviewAt = reviewMeta.review && reviewMeta.review.nextReviewAt;
                lines.push(`Recall probability：${formatRecallProbability(reviewMeta.recallProbability)}`);
                lines.push(`当前记忆状态：${reviewMeta.ratingLabel || '未设置'}`);
                lines.push(`下次复习时间：${nextReviewAt ? stateUtils.formatDateTime(nextReviewAt) : '未设置'}`);
            } else {
                lines.push('Recall probability：暂无');
                lines.push('当前记忆状态：未设置');
                lines.push('下次复习时间：未设置');
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
            const leftRawMeta = store && typeof store.getRecordReviewMeta === 'function'
                ? store.getRecordReviewMeta(left)
                : null;
            const rightRawMeta = store && typeof store.getRecordReviewMeta === 'function'
                ? store.getRecordReviewMeta(right)
                : null;
            const leftMeta = normalizeReviewMeta(leftRawMeta);
            const rightMeta = normalizeReviewMeta(rightRawMeta);
            const leftGroup = getLeetcodeReviewGroup(leftMeta);
            const rightGroup = getLeetcodeReviewGroup(rightMeta);
            const groupRank = {
                'due-today': 0,
                'done-today': 1,
                normal: 2,
                none: 3
            };
            const leftRank = groupRank[leftGroup];
            const rightRank = groupRank[rightGroup];

            if (leftRank !== rightRank) {
                return leftRank - rightRank;
            }

            if (leftGroup === 'due-today') {
                if (leftMeta.nextReviewTime !== rightMeta.nextReviewTime) {
                    return leftMeta.nextReviewTime - rightMeta.nextReviewTime;
                }
                return compareUpdatedAtDesc(left, right);
            }

            if (leftGroup === 'done-today') {
                return compareUpdatedAtDesc(left, right);
            }

            if (leftGroup === 'normal') {
                if (leftMeta.nextReviewTime !== rightMeta.nextReviewTime) {
                    return leftMeta.nextReviewTime - rightMeta.nextReviewTime;
                }
                return compareUpdatedAtDesc(left, right);
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

    function buildReviewHintText(reviewMeta) {
        if (!reviewMeta || !reviewMeta.enabled || !reviewMeta.isLeetcode) {
            return '下次复习：未设置';
        }

        if (reviewMeta.dueByToday && !reviewMeta.reviewedToday) {
            if (reviewMeta.overdueDays > 0) {
                return `已拖延${reviewMeta.overdueDays}天`;
            }
            return '今天需要复习';
        }

        if (reviewMeta.dueByToday && reviewMeta.reviewedToday) {
            return '今天已经复习';
        }

        const nextReviewAt = reviewMeta.review && reviewMeta.review.nextReviewAt;
        if (!nextReviewAt) {
            return '下次复习：未设置';
        }
        return `下次复习：${formatCompactDate(nextReviewAt)}`;
    }

    function buildRecordRow(record, stage, compactLabel, tooltip, options) {
        const reviewMeta = normalizeReviewMeta(options.reviewMeta);
        const group = getLeetcodeReviewGroup(reviewMeta);
        const groupClass = group === 'due-today'
            ? ' review-due'
            : group === 'done-today'
                ? ' review-done-today'
                : '';
        const nextReviewText = options.showNextReview
            ? buildReviewHintText(reviewMeta)
            : '';
        const source = options.source || 'problems';
        const openUrl = record.url || record.baseUrl || '';

        return `
          <div class="compact-line${groupClass}" title="${stateUtils.escapeHtml(tooltip)}" data-review-group="${stateUtils.escapeHtml(group)}">
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
            const reviewRawMeta = store && typeof store.getRecordReviewMeta === 'function'
                ? store.getRecordReviewMeta(record)
                : null;
            const reviewMeta = normalizeReviewMeta(reviewRawMeta);
            return buildRecordRow(record, stage, compactLabel, tooltip, {
                source: 'problems',
                showNextReview: true,
                reviewMeta,
                showQuickReview: Boolean(reviewMeta.enabled && reviewMeta.isLeetcode)
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
