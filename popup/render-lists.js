/**
 * Popup 题单页渲染
 * 版本：1.0.63
 */

(function () {
    'use strict';

    const popupModules = window.NoteHelperPopupModules = window.NoteHelperPopupModules || {};
    const stateUtils = popupModules.state || {};

    function renderListsSummary(elements, state) {
        elements.listsSummary.innerHTML = `
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">已导入题单</div>
              <div class="summary-value">${state.listSummary.totalLists}</div>
              <div class="summary-note">你导入的题单会在这里按折叠卡片展示。</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">题单已完成题目</div>
              <div class="summary-value">${state.listSummary.completed}</div>
              <div class="summary-note">只要触发过插件行为的题目会计入这里，跨题单重复题目按一次统计。</div>
            </div>
          </div>
        `;
    }

    function buildListItemTooltip(item) {
        const fullTitle = item.translatedTitle || item.title || item.titleSlug || '未命名题目';
        return [
            `题目：${fullTitle}`,
            `题号：${item.frontendQuestionId || '暂无'}`,
            `难度：${item.difficulty || '未知'}`,
            `进度：${item.progressLabel || '未记录'}`,
            `最近更新：${stateUtils.formatDateTime(item.matchedRecord && item.matchedRecord.updatedAt)}`
        ].join('\n');
    }

    function renderListItems(list, state) {
        const keyword = stateUtils.normalizeSearchText(state.listQuery);
        const statusFilter = state.listStatusFilter || 'all';
        const filteredItems = (list.items || []).filter((item) => {
            const statusMatched = statusFilter === 'all' || item.progressState === statusFilter;
            if (!statusMatched) return false;
            if (!keyword) return true;
            return stateUtils.buildListItemSearchText(item).includes(keyword);
        });

        const hasFilter = Boolean(keyword) || statusFilter !== 'all';
        if (hasFilter && !filteredItems.length) {
            return '';
        }

        const currentPage = keyword ? 1 : (state.listPages[list.listId] || 1);
        const pageData = stateUtils.paginate(filteredItems, currentPage, state.pageSize);
        state.listPages[list.listId] = pageData.page;

        const rows = pageData.items.map((item, index) => {
            const badge = stateUtils.getProgressBadge(item.progressState);
            const order = item.order || ((pageData.page - 1) * state.pageSize + index + 1);
            return `
              <div class="compact-line" title="${stateUtils.escapeHtml(buildListItemTooltip(item))}">
                <button
                  type="button"
                  class="compact-open"
                  data-open-url="${stateUtils.escapeHtml(item.url || item.baseUrl || '')}">
                  <div class="compact-main">
                    <div class="compact-index">${stateUtils.escapeHtml(String(order))}</div>
                    <div class="compact-title">${stateUtils.escapeHtml(item.translatedTitle || item.title || item.titleSlug || '未命名题目')}</div>
                  </div>
                </button>
                <div class="compact-right">
                  <span class="status-badge ${stateUtils.escapeHtml(badge.code)}">${stateUtils.escapeHtml(badge.label)}</span>
                  <button
                    type="button"
                    class="row-action-btn note"
                    data-open-note-url="${stateUtils.escapeHtml(item.url || item.baseUrl || '')}"
                    data-open-note-title="${stateUtils.escapeHtml(item.translatedTitle || item.title || item.titleSlug || '未命名题目')}"
                    data-open-note-source="lists"
                    data-open-note-list-id="${stateUtils.escapeHtml(list.listId)}">
                    📝
                  </button>
                </div>
              </div>
            `;
        }).join('');

        const pagination = filteredItems.length
            ? stateUtils.buildPaginationHtml(`list:${list.listId}`, pageData)
            : '';

        if (!filteredItems.length) {
            return '<div class="empty-state">这个题单里还没有可显示的题目。</div>';
        }

        return `
          <div class="list-shell">${rows}</div>
          ${pagination}
        `;
    }

    function renderLists(elements, state) {
        renderListsSummary(elements, state);

        if (!state.lists.length) {
            elements.problemLists.innerHTML = `
              <div class="empty-state">
                还没有导入题单。你可以先导入 Hot100，或者粘贴题单链接继续扩展。
              </div>
            `;
            return;
        }

        const keyword = stateUtils.normalizeSearchText(state.listQuery);
        const statusFilter = state.listStatusFilter || 'all';
        const hasFilter = Boolean(keyword) || statusFilter !== 'all';
        const cards = state.lists.map((list, index) => {
            const filteredBody = renderListItems(list, state);
            if (hasFilter && !filteredBody) {
                return '';
            }

            if (state.expandedLists[list.listId] === undefined) {
                state.expandedLists[list.listId] = index === 0;
            }

            const expanded = Boolean(state.expandedLists[list.listId]);
            return `
              <div class="list-card ${expanded ? '' : 'is-collapsed'}" data-list-card="${stateUtils.escapeHtml(list.listId)}">
                <div class="list-header">
                  <div class="list-header-main">
                    <div class="list-title" title="${stateUtils.escapeHtml(list.title || '未命名题单')}">${stateUtils.escapeHtml(list.title || '未命名题单')}</div>
                    <div class="list-meta">已完成 ${list.stats.completed} / ${list.stats.total} · 来源 ${stateUtils.escapeHtml(list.site || '未知')}</div>
                  </div>
                  <div class="list-header-actions">
                    <button class="icon-btn" data-toggle-list="${stateUtils.escapeHtml(list.listId)}">${expanded ? '收起' : '展开'}</button>
                    <button class="icon-btn" data-open-url="${stateUtils.escapeHtml(list.sourceUrl || '')}">来源</button>
                    <button class="icon-btn" data-delete-list="${stateUtils.escapeHtml(list.listId)}">删除</button>
                  </div>
                </div>
                <div class="list-body">
                  ${filteredBody}
                </div>
              </div>
            `;
        }).filter(Boolean).join('');

        elements.problemLists.innerHTML = cards || `
          <div class="empty-state">${hasFilter ? '没有找到符合当前筛选条件的题单题目。' : '没有找到符合检索条件的题单题目。'}</div>
        `;
    }

    popupModules.renderLists = {
        renderLists
    };
})();
