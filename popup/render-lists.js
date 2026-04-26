/**
 * Popup 题单页渲染
 * 版本：1.1.2
 */

(function () {
    'use strict';

    const popupModules = window.NoteHelperPopupModules = window.NoteHelperPopupModules || {};
    const stateUtils = popupModules.state || {};
    const problemRenderModules = popupModules.renderProblems || {};

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
              <div class="summary-note">题单中只要触发过插件行为的题目都会计入这里。</div>
            </div>
          </div>
        `;
    }

    function buildListRecordId(site, problemKey) {
        const normalizedSite = String(site || '').trim();
        const normalizedProblemKey = String(problemKey || '').trim();
        if (!normalizedSite || !normalizedProblemKey) return '';
        return `${normalizedSite}:${normalizedProblemKey}`;
    }

    function buildListFallbackRecord(item, list, store) {
        const matchedRecord = item.matchedRecord || {};
        const site = matchedRecord.site || item.site || list.site || '';
        const title = matchedRecord.title || item.translatedTitle || item.title || item.titleSlug || '未命名题目';
        const titleSlug = matchedRecord.titleSlug || item.titleSlug || '';
        const problemKey = matchedRecord.problemKey || item.problemKey || titleSlug || '';
        const derivedIdentity = (
            store &&
            typeof store.createIdentityFromSiteAndProblemKey === 'function' &&
            site &&
            problemKey
        )
            ? store.createIdentityFromSiteAndProblemKey(site, problemKey)
            : null;
        const resolvedSite = matchedRecord.site || (derivedIdentity && derivedIdentity.site) || site;
        const resolvedProblemKey = matchedRecord.problemKey || (derivedIdentity && derivedIdentity.problemKey) || problemKey;

        return {
            ...(derivedIdentity || {}),
            ...matchedRecord,
            id: matchedRecord.id || buildListRecordId(resolvedSite, resolvedProblemKey),
            title,
            titleSlug: matchedRecord.titleSlug || titleSlug,
            problemKey: resolvedProblemKey || '',
            site: resolvedSite || '',
            canonicalId: matchedRecord.canonicalId || item.canonicalId || (derivedIdentity && derivedIdentity.canonicalId) || '',
            url: matchedRecord.url || item.url || item.baseUrl || (derivedIdentity && derivedIdentity.url) || '',
            baseUrl: matchedRecord.baseUrl || item.baseUrl || item.url || (derivedIdentity && derivedIdentity.baseUrl) || '',
            updatedAt: matchedRecord.updatedAt || '',
            lastActionType: matchedRecord.lastActionType || null
        };
    }

    function buildListItemDeleteDataset(item, list) {
        return {
            listId: String(list && list.listId || '').trim(),
            order: Number(item && item.order),
            canonicalId: String(item && item.canonicalId || '').trim(),
            titleSlug: String(item && item.titleSlug || '').trim(),
            problemKey: String(item && item.problemKey || '').trim(),
            url: String(item && (item.url || item.baseUrl) || '').trim()
        };
    }

    function buildListItemTooltip(item, list, store) {
        const noteTarget = buildListFallbackRecord(item, list, store);
        if (typeof problemRenderModules.buildProblemTooltip === 'function') {
            return problemRenderModules.buildProblemTooltip(
                store,
                noteTarget,
                Boolean(noteTarget.id)
            );
        }

        const fullTitle = noteTarget.title || '未命名题目';
        return [
            `题目：${fullTitle}`,
            `题号：${item.frontendQuestionId || '暂无'}`,
            `难度：${item.difficulty || '未知'}`,
            `进度：${item.progressLabel || '未匹配'}`,
            `最近更新：${stateUtils.formatDateTime(noteTarget.updatedAt)}`
        ].join('\n');
    }

    function renderListItems(list, state, store) {
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

        const rows = pageData.items.map((item) => {
            const badge = stateUtils.getProgressBadge(item.progressState);
            const noteTarget = buildListFallbackRecord(item, list, store);
            const deleteTarget = buildListItemDeleteDataset(item, list);
            const openUrl = noteTarget.url || noteTarget.baseUrl || item.url || item.baseUrl || '';
            const displayTitle = noteTarget.title || '未命名题目';

            return `
              <div class="compact-line compact-line-list" title="${stateUtils.escapeHtml(buildListItemTooltip(item, list, store))}">
                <button
                  type="button"
                  class="compact-open"
                  data-open-url="${stateUtils.escapeHtml(openUrl)}">
                  <div class="compact-main">
                    <div class="compact-title">${stateUtils.escapeHtml(displayTitle)}</div>
                  </div>
                </button>
                <div class="compact-right">
                  <span class="status-badge ${stateUtils.escapeHtml(badge.code)}">${stateUtils.escapeHtml(badge.label)}</span>
                  <button
                    type="button"
                    class="row-action-btn note"
                    data-open-note-url="${stateUtils.escapeHtml(openUrl)}"
                    data-open-note-site="${stateUtils.escapeHtml(noteTarget.site || item.site || list.site || '')}"
                    data-open-note-problem-key="${stateUtils.escapeHtml(noteTarget.problemKey || item.problemKey || item.titleSlug || '')}"
                    data-open-note-canonical-id="${stateUtils.escapeHtml(noteTarget.canonicalId || item.canonicalId || '')}"
                    data-open-note-title-slug="${stateUtils.escapeHtml(noteTarget.titleSlug || item.titleSlug || '')}"
                    data-open-note-title="${stateUtils.escapeHtml(displayTitle)}"
                    data-open-note-source="lists"
                    data-open-note-list-id="${stateUtils.escapeHtml(list.listId)}"
                    title="打开笔记">
                    📝
                  </button>
                  <button
                    type="button"
                    class="row-action-btn danger"
                    data-delete-list-item="1"
                    data-delete-list-id="${stateUtils.escapeHtml(deleteTarget.listId)}"
                    data-delete-list-item-order="${Number.isFinite(deleteTarget.order) ? deleteTarget.order : ''}"
                    data-delete-list-item-canonical-id="${stateUtils.escapeHtml(deleteTarget.canonicalId)}"
                    data-delete-list-item-title-slug="${stateUtils.escapeHtml(deleteTarget.titleSlug)}"
                    data-delete-list-item-problem-key="${stateUtils.escapeHtml(deleteTarget.problemKey)}"
                    data-delete-list-item-url="${stateUtils.escapeHtml(deleteTarget.url)}"
                    title="从当前题单移除">
                    －
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

    function renderLists(elements, state, store) {
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
            const filteredBody = renderListItems(list, state, store);
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
          <div class="empty-state">${hasFilter ? '没有找到符合当前筛选条件的题单题目。提示：未匹配表示题单题目尚未在本地记录中命中。' : '没有找到符合搜索条件的题单题目。'}</div>
        `;
    }

    popupModules.renderLists = {
        renderLists
    };
})();
