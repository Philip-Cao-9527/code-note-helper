/**
 * Popup 题目页渲染
 * 版本：1.0.59
 */

(function () {
    'use strict';

    const popupModules = window.NoteHelperPopupModules = window.NoteHelperPopupModules || {};
    const stateUtils = popupModules.state || {};

    function buildProblemTooltip(store, record) {
        const fullTitle = record.title || record.problemKey || '未命名题目';
        const stage = store.getRecordStage(record);
        const stageLabel = stage && stage.code === 'none' ? '仅入库' : stage.label;
        return [
            `题目：${fullTitle}`,
            `站点：${record.site || '未知'}`,
            `状态：${stageLabel}`,
            `最近动作：${store.getActionLabel(record.lastActionType)}`,
            `最近更新：${stateUtils.formatDateTime(record.updatedAt)}`
        ].join('\n');
    }

    function renderProblems(elements, state, store) {
        const keyword = stateUtils.normalizeSearchText(state.problemQuery);
        const statusFilter = state.problemStatusFilter || 'all';
        const filtered = state.records.filter((record) => {
            const stageCode = store.getRecordStage(record).code;
            const statusMatched = statusFilter === 'all' || stageCode === statusFilter;
            if (!statusMatched) return false;
            if (!keyword) return true;
            return stateUtils.buildProblemSearchText(record).includes(keyword);
        });

        if (!filtered.length) {
            const hasFilter = Boolean(keyword) || statusFilter !== 'all';
            elements.problemsList.innerHTML = `
              <div class="empty-state">
                ${hasFilter ? '没有找到符合当前筛选条件的题目' : '这里会显示你保存过笔记或用插件处理过的题目。'}
              </div>
            `;
            elements.problemsPagination.innerHTML = '';
            return;
        }

        const pageData = stateUtils.paginate(filtered, state.problemPage, state.pageSize);
        state.problemPage = pageData.page;
        elements.problemsList.innerHTML = pageData.items.map((record, index) => {
            const stage = store.getRecordStage(record);
            const compactLabel = stateUtils.getCompactStageLabel(stage.code);
            const tooltip = buildProblemTooltip(store, record);
            const order = (pageData.page - 1) * state.pageSize + index + 1;
            return `
              <div class="compact-line" title="${stateUtils.escapeHtml(tooltip)}">
                <button
                  type="button"
                  class="compact-open"
                  data-open-url="${stateUtils.escapeHtml(record.url || record.baseUrl || '')}">
                  <div class="compact-main">
                    <div class="compact-index">${order}</div>
                    <div class="compact-title">${stateUtils.escapeHtml(record.title || record.problemKey || '未命名题目')}</div>
                  </div>
                </button>
                <div class="compact-right">
                  <span class="status-badge ${stateUtils.escapeHtml(stage.code)}">${stateUtils.escapeHtml(compactLabel)}</span>
                  <button
                    type="button"
                    class="row-action-btn note"
                    data-open-note-url="${stateUtils.escapeHtml(record.url || record.baseUrl || '')}"
                    data-open-note-title="${stateUtils.escapeHtml(record.title || record.problemKey || '未命名题目')}"
                    data-open-note-source="problems">
                    📝
                  </button>
                  <button
                    type="button"
                    class="row-action-btn danger"
                    data-delete-record="${stateUtils.escapeHtml(record.id || '')}">
                    删除
                  </button>
                </div>
              </div>
            `;
        }).join('');

        elements.problemsPagination.innerHTML = stateUtils.buildPaginationHtml('problems', pageData);
    }

    popupModules.renderProblems = {
        renderProblems
    };
})();
