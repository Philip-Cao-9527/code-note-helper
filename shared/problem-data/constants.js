/**
 * 问题数据常量定义
 * 版本：1.0.83
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};

    modules.constants = {
        STORAGE_KEYS: {
            problemRecords: 'note_helper_problem_records_v1',
            problemLists: 'note_helper_problem_lists_v1',
            syncMeta: 'note_helper_sync_meta_v1',
            syncSettings: 'note_helper_sync_settings_v1',
            syncTombstones: 'note_helper_sync_tombstones_v1'
        },
        PROJECT_LINKS: {
            githubHome: 'https://github.com/Philip-Cao-9527/code-note-helper',
            githubIssues: 'https://github.com/Philip-Cao-9527/code-note-helper/issues'
        },
        HOT100_CONFIG: {
            listId: 'lc-cn:studyplan:top-100-liked',
            sourceType: 'leetcode_studyplan',
            sourceUrl: 'https://leetcode.cn/studyplan/top-100-liked/',
            title: 'LeetCode 热题 100',
            envType: 'study-plan-v2',
            envId: 'top-100-liked',
            planSlug: 'top-100-liked'
        },
        STAGE_LABELS: {
            none: '未记录',
            prompt: '已生成提示词',
            generated: '已生成笔记',
            saved: '已保存笔记'
        },
        ACTION_LABELS: {
            prompt_copied: '已复制提示词',
            note_generated: '已生成笔记',
            result_copied: '已复制结果',
            note_saved: '已保存笔记',
            manual_added: '已手动添加题目',
            submission_passed: '提交通过自动入库'
        },
        STAGE_PRIORITY: {
            none: 0,
            prompt: 1,
            generated: 2,
            saved: 3
        },
        DEFAULT_SYNC_META: {
            schemaVersion: 2,
            deviceId: null,
            localRevision: 0,
            lastLocalWriteAt: null,
            lastSyncAt: {
                webdav: null
            },
            lastError: {
                webdav: null
            },
            lastStatus: {
                webdav: {
                    state: null,
                    message: '',
                    at: null
                }
            }
        },
        DEFAULT_SYNC_SETTINGS: {
            webdav: {
                enabled: false,
                provider: 'nutstore',
                email: '',
                appPassword: '',
                remotePath: 'CodeNote-Helper/backups/full-backup.json'
            }
        },
        DEFAULT_SYNC_TOMBSTONES: {
            lists: {},
            records: {}
        },
        DEFAULT_NUTSTORE_REMOTE_DIRECTORY: 'CodeNote-Helper/backups',
        DEFAULT_NUTSTORE_REMOTE_FILE_NAME: 'full-backup.json',
        DEFAULT_NUTSTORE_REMOTE_PATH: 'CodeNote-Helper/backups/full-backup.json',
        NUTSTORE_BASE_URL: 'https://dav.jianguoyun.com/dav/',
        PAGE_SIZE: 5
    };
})();
