/**
 * Popup 概览渲染
 * 版本：1.1.0
 */

(function () {
    'use strict';

    const popupModules = window.NoteHelperPopupModules = window.NoteHelperPopupModules || {};
    const stateUtils = popupModules.state || {};
    const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    function getTodayLabel() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const weekday = WEEKDAY_LABELS[now.getDay()] || '';
        return `${month}-${day} ${weekday}`;
    }

    function renderOverview(elements, state) {
        const cards = [
            {
                label: '已记录题目',
                value: state.recordSummary.total,
                note: '这里会显示你保存过笔记或用插件处理过的题目。'
            },
            {
                label: '已保存笔记',
                value: state.recordSummary.saved,
                note: '笔记内容非空的题目会计入这里，清空后会自动移出。'
            },
            {
                label: '已导入题单',
                value: state.listSummary.totalLists,
                note: '已导入的题单会集中显示在题单页，方便继续查看进度。'
            },
            {
                label: '题单已完成题目',
                value: state.listSummary.completed,
                note: '题单中只要触发过插件行为的题目都会计入这里'
            }
        ];

        elements.overviewSummary.innerHTML = cards.map((item) => {
            return `
              <div class="summary-card">
                <div class="summary-label">${stateUtils.escapeHtml(String(item.label))}</div>
                <div class="summary-value">${stateUtils.escapeHtml(String(item.value))}</div>
                <div class="summary-note">${stateUtils.escapeHtml(item.note)}</div>
              </div>
            `;
        }).join('');

        if (elements.overviewReviewCard) {
            const reviewSummary = state.leetcodeReviewSummary || {};
            const dueRemainingCount = Number(reviewSummary.dueRemainingCount ?? reviewSummary.dueCount ?? 0);
            const dueTotalCount = Number(reviewSummary.dueTotalCount ?? dueRemainingCount);
            const recentTitle = String(reviewSummary.recentDueTitle || '').trim();
            const reviewCardClass = dueTotalCount > 0
                ? (dueRemainingCount > 0 ? 'review-summary-card has-due' : 'review-summary-card done-today')
                : 'review-summary-card is-empty';
            const todayLabel = getTodayLabel();
            let progressText = '今天没有待复习题目';
            if (dueTotalCount > 0 && dueRemainingCount === 0) {
                progressText = '恭喜你，已完成全部题目复习';
            } else if (dueTotalCount > 0) {
                progressText = `今天剩余 ${dueRemainingCount}/${dueTotalCount} 道题目需要复习`;
            }

            elements.overviewReviewCard.innerHTML = `
              <div class="${reviewCardClass}">
                <div class="review-summary-top">
                  <div class="review-summary-title">今日待复习</div>
                  <div class="review-summary-date">${stateUtils.escapeHtml(todayLabel)}</div>
                </div>
                <div class="review-summary-ring" aria-hidden="true">
                  <div class="review-summary-ring-inner">
                    <span class="review-summary-count">${stateUtils.escapeHtml(String(dueRemainingCount))}</span>
                  </div>
                </div>
                <div class="review-summary-main">${stateUtils.escapeHtml(progressText)}</div>
                <div class="review-summary-sub">${recentTitle ? `最近一题：${stateUtils.escapeHtml(recentTitle)}` : '最近一题：暂无'}</div>
                <button class="review-summary-btn" type="button" data-switch-view="leetcode-view">去力扣题目查看</button>
              </div>
            `;
        }

        if (elements.footerNote) {
            elements.footerNote.innerHTML = '在 <span class="footer-note-key">设置与备份</span> 中管理备份和 API 配置';
        }
    }

    popupModules.renderOverview = {
        renderOverview
    };
})();
