/**
 * 刷题记录共享仓库兼容入口
 * 版本：1.0.43
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    if (typeof modules.createApi !== 'function') {
        console.error('[ProblemData] createApi 未准备完成，无法挂载共享仓库');
        return;
    }

    window.NoteHelperProblemData = modules.createApi();
})();
