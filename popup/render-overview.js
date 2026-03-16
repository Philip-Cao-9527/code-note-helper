/**
 * Popup 概览渲染
 * 版本：1.0.68
 */

(function () {
    'use strict';

    const popupModules = window.NoteHelperPopupModules = window.NoteHelperPopupModules || {};
    const stateUtils = popupModules.state || {};

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
                note: '题单中只要触发过插件行为的题目都会计入这里，跨题单重复题目按一次统计。'
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

        if (elements.footerNote) {
            elements.footerNote.textContent = '本地默认存储，支持云同步；在“设置与同步”管理。';
        }
    }

    popupModules.renderOverview = {
        renderOverview
    };
})();
