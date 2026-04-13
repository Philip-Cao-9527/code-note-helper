/**
 * Popup 状态与工具
 * 版本：1.1.0
 */

(function () {
    'use strict';

    const popupModules = window.NoteHelperPopupModules = window.NoteHelperPopupModules || {};

    function createElements() {
        return {
            versionText: document.getElementById('version-text'),
            navButtons: Array.from(document.querySelectorAll('.nav-btn')),
            views: Array.from(document.querySelectorAll('.view')),
            overviewSummary: document.getElementById('overview-summary'),
            overviewReviewCard: document.getElementById('overview-review-card'),
            openSettingsBtn: document.getElementById('open-settings'),
            problemsSearchInput: document.getElementById('problems-search'),
            problemsStatusFilter: document.getElementById('problems-status-filter'),
            problemsList: document.getElementById('problems-list'),
            problemsPagination: document.getElementById('problems-pagination'),
            deepmlSearchInput: document.getElementById('deepml-search'),
            deepmlStatusFilter: document.getElementById('deepml-status-filter'),
            deepmlList: document.getElementById('deepml-list'),
            deepmlPagination: document.getElementById('deepml-pagination'),
            listImportUrl: document.getElementById('list-import-url'),
            importHot100Btn: document.getElementById('import-hot100'),
            importListUrlBtn: document.getElementById('import-list-url'),
            listImportStatus: document.getElementById('list-import-status'),
            listsSearchInput: document.getElementById('lists-search'),
            listsStatusFilter: document.getElementById('lists-status-filter'),
            listsSummary: document.getElementById('lists-summary'),
            problemLists: document.getElementById('problem-lists'),
            githubHomeBtn: document.getElementById('open-github-home'),
            githubIssuesBtn: document.getElementById('open-github-issues'),
            footerNote: document.getElementById('footer-note'),
            syncIndicatorBtn: document.getElementById('sync-indicator-btn'),
            syncIndicatorIcon: document.getElementById('sync-indicator-icon'),
            syncIndicatorText: document.getElementById('sync-indicator-text'),
            toast: document.getElementById('popup-toast'),
            confirmOverlay: document.getElementById('popup-confirm-overlay'),
            confirmMessage: document.getElementById('popup-confirm-message'),
            confirmCancelBtn: document.getElementById('popup-confirm-cancel'),
            confirmOkBtn: document.getElementById('popup-confirm-ok'),
            reviewOverlay: document.getElementById('popup-review-overlay'),
            reviewCloseBtn: document.getElementById('popup-review-close'),
            reviewRatingOptions: Array.from(document.querySelectorAll('[data-review-rating]'))
        };
    }

    function createInitialState(pageSize) {
        return {
            activeView: 'overview-view',
            records: [],
            recordSummary: {
                total: 0,
                promptOnly: 0,
                generated: 0,
                saved: 0
            },
            lists: [],
            listSummary: {
                totalLists: 0,
                totalItems: 0,
                completed: 0,
                inProgress: 0,
                pending: 0
            },
            syncOverview: null,
            leetcodeReviewSummary: {
                dueCount: 0,
                dueRemainingCount: 0,
                dueTotalCount: 0,
                dueCompletedCount: 0,
                recentDueTitle: '',
                recentDueUrl: ''
            },
            problemQuery: '',
            problemStatusFilter: 'all',
            problemPage: 1,
            deepmlQuery: '',
            deepmlStatusFilter: 'all',
            deepmlPage: 1,
            listQuery: '',
            listStatusFilter: 'all',
            listPages: {},
            expandedLists: {},
            pageSize: pageSize || 5
        };
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDateTime(value) {
        if (!value) return '暂无';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '暂无';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hour}:${minute}`;
    }

    function normalizeSearchText(text) {
        return String(text || '').trim().toLowerCase();
    }

    function paginate(items, page, pageSize) {
        const totalItems = items.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const safePage = Math.min(Math.max(page || 1, 1), totalPages);
        const start = (safePage - 1) * pageSize;
        return {
            items: items.slice(start, start + pageSize),
            page: safePage,
            totalPages,
            totalItems
        };
    }

    function buildPaginationHtml(prefix, pageData) {
        return `
            <div class="pagination">
              <div class="pagination-info">第 ${pageData.page} / ${pageData.totalPages} 页，共 ${pageData.totalItems} 条</div>
              <div class="pagination-actions">
                <button class="pagination-btn" data-pagination="${prefix}:prev" ${pageData.page <= 1 ? 'disabled' : ''}>上一页</button>
                <button class="pagination-btn" data-pagination="${prefix}:next" ${pageData.page >= pageData.totalPages ? 'disabled' : ''}>下一页</button>
              </div>
            </div>
        `;
    }

    function getCompactStageLabel(stageCode) {
        if (stageCode === 'saved') return '已保存';
        if (stageCode === 'generated') return '已生成';
        if (stageCode === 'prompt') return '已处理';
        if (stageCode === 'none') return '仅入库';
        return '仅入库';
    }

    function getProgressBadge(progressState) {
        if (progressState === 'completed') return { code: 'completed', label: '已完成' };
        if (progressState === 'in_progress') return { code: 'in-progress', label: '进行中' };
        return { code: 'pending', label: '未匹配' };
    }

    function buildProblemSearchText(record) {
        return [
            record.title,
            record.problemKey,
            record.canonicalId,
            record.site,
            record.url,
            record.baseUrl
        ].filter(Boolean).join(' ').toLowerCase();
    }

    function buildListItemSearchText(item) {
        return [
            item.translatedTitle,
            item.title,
            item.titleSlug,
            item.frontendQuestionId,
            item.canonicalId,
            item.sourceSection && item.sourceSection.label,
            Array.isArray(item.topics) ? item.topics.join(' ') : ''
        ].filter(Boolean).join(' ').toLowerCase();
    }

    popupModules.state = {
        createElements,
        createInitialState,
        escapeHtml,
        formatDateTime,
        normalizeSearchText,
        paginate,
        buildPaginationHtml,
        getCompactStageLabel,
        getProgressBadge,
        buildProblemSearchText,
        buildListItemSearchText
    };
})();
