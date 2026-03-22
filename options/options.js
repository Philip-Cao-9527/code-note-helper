/**
 * 高级设置页脚本
 * 版本：1.0.80
 */

(function () {
    'use strict';

    const DEFAULT_WEBDAV_REMOTE_PATH = 'CodeNote-Helper/backups/full-backup.json';
    const optionsModules = window.NoteHelperOptionsModules = window.NoteHelperOptionsModules || {};

    function resolveWebdavPanelVisible(webdavEnabled, syncDisabled) {
        return !syncDisabled && Boolean(webdavEnabled);
    }

    optionsModules.resolveWebdavPanelVisible = resolveWebdavPanelVisible;

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

    function formatStatusText(status) {
        if (!status || !status.state) return '暂无';
        const stateMap = {
            success: '成功',
            error: '失败'
        };
        const label = stateMap[status.state] || status.state;
        const message = status.message ? `：${status.message}` : '';
        return `${label}${message}`;
    }

    function createToast(toastElement) {
        let timer = null;
        return function showToast(message, duration) {
            toastElement.textContent = message;
            toastElement.classList.add('show');
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                toastElement.classList.remove('show');
            }, duration || 2200);
        };
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const store = window.NoteHelperProblemData;
        if (!store) {
            console.error('[Options] 共享数据仓库未加载');
            return;
        }

        const elements = {
            timelineToggle: document.getElementById('timeline-toggle'),
            localLabel: document.getElementById('local-label'),
            localRevision: document.getElementById('local-revision'),
            lastLocalWrite: document.getElementById('last-local-write'),
            btnExportJson: document.getElementById('btn-export-json'),
            btnImportJson: document.getElementById('btn-import-json'),
            importJsonFile: document.getElementById('import-json-file'),
            chromeSyncToggle: document.getElementById('chrome-sync-toggle'),
            btnOpenBrowserSync: document.getElementById('btn-open-browser-sync'),
            btnRunChromeSync: document.getElementById('btn-run-chrome-sync'),
            chromeSyncBrowser: document.getElementById('chrome-sync-browser'),
            chromeSyncHint: document.getElementById('chrome-sync-hint'),
            chromeSyncSettingsUrl: document.getElementById('chrome-sync-settings-url'),
            chromeSyncLastAt: document.getElementById('chrome-sync-last-at'),
            chromeSyncLastStatus: document.getElementById('chrome-sync-last-status'),
            chromeSyncLastError: document.getElementById('chrome-sync-last-error'),
            webdavToggle: document.getElementById('webdav-toggle'),
            webdavEmail: document.getElementById('webdav-email'),
            webdavPassword: document.getElementById('webdav-password'),
            webdavRemotePath: document.getElementById('webdav-remote-path'),
            btnSaveSync: document.getElementById('btn-save-sync'),
            btnTestWebdav: document.getElementById('btn-test-webdav'),
            btnBackupWebdav: document.getElementById('btn-backup-webdav'),
            btnRestoreWebdav: document.getElementById('btn-restore-webdav'),
            webdavBaseUrl: document.getElementById('webdav-base-url'),
            webdavRemoteLabel: document.getElementById('webdav-remote-label'),
            webdavLastAt: document.getElementById('webdav-last-at'),
            webdavLastStatus: document.getElementById('webdav-last-status'),
            webdavLastError: document.getElementById('webdav-last-error'),
            webdavSettingsPanel: document.getElementById('webdav-settings-panel'),
            apiUrl: document.getElementById('api-url'),
            apiKey: document.getElementById('api-key'),
            apiModel: document.getElementById('api-model'),
            btnSaveApi: document.getElementById('btn-save-api'),
            btnResetApi: document.getElementById('btn-reset-api'),
            cloudSyncSection: document.getElementById('cloud-sync-section'),
            toast: document.getElementById('toast')
        };

        const showToast = createToast(elements.toast);
        if (elements.webdavSettingsPanel) {
            elements.webdavSettingsPanel.style.display = 'none';
        }

        // 同步设置未保存状态追踪
        const syncDirtyHint = document.getElementById('sync-dirty-hint');
        const apiDirtyHint = document.getElementById('api-dirty-hint');
        let syncDirty = false;
        let apiDirty = false;

        function markSyncDirty() {
            if (syncDirty) return;
            syncDirty = true;
            if (syncDirtyHint) {
                syncDirtyHint.style.display = '';
            }
        }

        function clearSyncDirty() {
            syncDirty = false;
            if (syncDirtyHint) {
                syncDirtyHint.style.display = 'none';
            }
        }

        function markApiDirty() {
            if (apiDirty) return;
            apiDirty = true;
            if (apiDirtyHint) {
                apiDirtyHint.style.display = '';
            }
        }

        function clearApiDirty() {
            apiDirty = false;
            if (apiDirtyHint) {
                apiDirtyHint.style.display = 'none';
            }
        }

        // 离开页面前如果有未保存配置变更，弹出确认
        window.addEventListener('beforeunload', (event) => {
            if (!syncDirty && !apiDirty) return;
            event.preventDefault();
            event.returnValue = '';
        });

        function setBusy(button, busy) {
            if (!button) return;
            button.disabled = busy;
        }

        function isCloudSyncTemporarilyDisabled() {
            if (typeof store.isCloudSyncTemporarilyDisabled === 'function') {
                return store.isCloudSyncTemporarilyDisabled();
            }
            return false;
        }

        function applyCloudSyncVisibility(syncDisabled) {
            if (elements.cloudSyncSection) {
                elements.cloudSyncSection.style.display = syncDisabled ? 'none' : '';
            }
        }

        function applyCloudSyncInteractivity(syncDisabled) {
            const targets = [
                elements.chromeSyncToggle,
                elements.btnOpenBrowserSync,
                elements.btnRunChromeSync,
                elements.webdavToggle,
                elements.webdavEmail,
                elements.webdavPassword,
                elements.webdavRemotePath,
                elements.btnSaveSync,
                elements.btnTestWebdav,
                elements.btnBackupWebdav,
                elements.btnRestoreWebdav
            ];
            targets.forEach((node) => {
                if (node) {
                    node.disabled = Boolean(syncDisabled);
                }
            });
        }

        function ensureSyncAllowed(showToastOnBlocked = false) {
            const blocked = isCloudSyncTemporarilyDisabled();
            if (blocked && showToastOnBlocked) {
                showToast('云同步功能当前不可用，请稍后再试');
            }
            return !blocked;
        }

        function applyWebdavPanelVisibility(syncDisabled) {
            if (!elements.webdavSettingsPanel) return;
            const visible = resolveWebdavPanelVisible(
                elements.webdavToggle && elements.webdavToggle.checked,
                syncDisabled
            );
            elements.webdavSettingsPanel.style.display = visible ? '' : 'none';
        }

        function formatWebdavErrorMessage(error, action) {
            if (error && error.message) {
                return String(error.message);
            }
            const stageFallback = {
                config: '配置错误，请先填写坚果云邮箱和应用密码',
                connect: '连接失败，请检查账号、应用密码和 WebDAV 地址',
                directory: '目录确认失败，请检查远端目录是否可访问',
                upload: '上传失败，请稍后重试',
                restore: '恢复失败，请稍后重试'
            };
            if (error && error.stage && stageFallback[error.stage]) {
                return stageFallback[error.stage];
            }
            const actionFallback = {
                test: stageFallback.connect,
                backup: stageFallback.upload,
                restore: stageFallback.restore
            };
            return actionFallback[action] || '同步失败，请稍后重试';
        }

        async function loadApiSettings() {
            const result = await chrome.storage.local.get(['api_url', 'api_key', 'api_model']);
            elements.apiUrl.value = result.api_url || 'https://api.openai.com/v1';
            elements.apiKey.value = result.api_key || '';
            elements.apiModel.value = result.api_model || 'gpt-4o';
            clearApiDirty();
        }

        async function loadSyncSection() {
            const [overview, settings, timelineEnabled] = await Promise.all([
                store.getSyncOverview(),
                store.getSyncSettings(),
                store.getTimelineEnabled()
            ]);
            const syncDisabled = isCloudSyncTemporarilyDisabled();

            elements.timelineToggle.checked = timelineEnabled;
            elements.localLabel.textContent = overview.localLabel || '当前浏览器';
            elements.localRevision.textContent = String(overview.localRevision || 0);
            elements.lastLocalWrite.textContent = `最近写入：${formatDateTime(overview.lastLocalWriteAt)}`;
            applyCloudSyncVisibility(syncDisabled);
            applyCloudSyncInteractivity(syncDisabled);

            if (syncDisabled) {
                elements.chromeSyncToggle.checked = false;
                elements.webdavToggle.checked = false;
                applyWebdavPanelVisibility(true);
                clearSyncDirty();
                return;
            }

            elements.chromeSyncToggle.checked = Boolean(settings.chromeSyncEnabled);
            elements.chromeSyncBrowser.textContent = overview.chromeSyncStorageReady
                ? `${overview.chromeSyncBrowserName || '浏览器同步'}（可用）`
                : '当前环境暂不可用';
            elements.chromeSyncHint.textContent = overview.chromeSyncHint || '暂无';
            elements.chromeSyncSettingsUrl.textContent = overview.chromeSyncSettingsUrl || '暂无';
            elements.chromeSyncLastAt.textContent = formatDateTime(overview.chromeSyncLastSyncAt);
            elements.chromeSyncLastStatus.textContent = formatStatusText(overview.chromeSyncLastStatus);
            elements.chromeSyncLastError.textContent = overview.chromeSyncLastError?.message || '暂无';

            elements.webdavToggle.checked = Boolean(settings.webdav && settings.webdav.enabled);
            elements.webdavEmail.value = settings.webdav?.email || '';
            elements.webdavPassword.value = settings.webdav?.appPassword || '';
            elements.webdavRemotePath.value = settings.webdav?.remotePath || DEFAULT_WEBDAV_REMOTE_PATH;
            if (elements.webdavBaseUrl) {
                elements.webdavBaseUrl.textContent = overview.webdavBaseUrl || '暂无';
            }
            elements.webdavRemoteLabel.textContent = overview.webdavRemotePath || '暂无';
            elements.webdavLastAt.textContent = formatDateTime(overview.webdavLastSyncAt);
            elements.webdavLastStatus.textContent = formatStatusText(overview.webdavLastStatus);
            elements.webdavLastError.textContent = overview.webdavLastError?.message || '暂无';
            applyWebdavPanelVisibility(syncDisabled);
            clearSyncDirty();
        }

        async function refreshView() {
            await Promise.all([
                loadApiSettings(),
                loadSyncSection()
            ]);
        }

        async function saveSyncSettings() {
            if (!ensureSyncAllowed(false)) {
                const current = await store.getSyncSettings();
                const fallbackSettings = {
                    ...(current || {}),
                    chromeSyncEnabled: false,
                    webdav: {
                        ...((current && current.webdav) || {}),
                        enabled: false
                    }
                };
                await store.setSyncSettings(fallbackSettings);
                return fallbackSettings;
            }
            const current = await store.getSyncSettings();
            const nextSettings = {
                chromeSyncEnabled: elements.chromeSyncToggle.checked,
                webdav: {
                    enabled: elements.webdavToggle.checked,
                    provider: 'nutstore',
                    email: elements.webdavEmail.value.trim(),
                    appPassword: elements.webdavPassword.value.trim(),
                    baseUrl: (current && current.webdav && current.webdav.baseUrl) || '',
                    remotePath: elements.webdavRemotePath.value.trim() || DEFAULT_WEBDAV_REMOTE_PATH
                }
            };
            await store.setSyncSettings(nextSettings);
            return nextSettings;
        }

        async function enforceCloudSyncDisabledState() {
            if (!isCloudSyncTemporarilyDisabled()) return;
            const current = await store.getSyncSettings();
            const hasEnabledSync = Boolean(current && current.chromeSyncEnabled) ||
                Boolean(current && current.webdav && current.webdav.enabled);
            if (!hasEnabledSync) return;
            await store.setSyncSettings({
                ...(current || {}),
                chromeSyncEnabled: false,
                webdav: {
                    ...((current && current.webdav) || {}),
                    enabled: false
                }
            });
        }

        elements.timelineToggle.addEventListener('change', async () => {
            try {
                await store.setTimelineEnabled(elements.timelineToggle.checked);
                showToast(elements.timelineToggle.checked ? 'AI 时间轴已开启' : 'AI 时间轴已关闭');
                await loadSyncSection();
            } catch (error) {
                console.error('[Options] 保存时间轴设置失败：', error);
                showToast('保存失败，请稍后重试');
            }
        });

        if (elements.webdavToggle) {
            elements.webdavToggle.addEventListener('change', () => {
                applyWebdavPanelVisibility(isCloudSyncTemporarilyDisabled());
                markSyncDirty();
            });
        }

        // Cloud Sync 开关变更也标记 dirty
        if (elements.chromeSyncToggle) {
            elements.chromeSyncToggle.addEventListener('change', () => {
                markSyncDirty();
            });
        }

        // 坚果云表单输入变更标记 dirty
        [elements.webdavEmail, elements.webdavPassword, elements.webdavRemotePath].forEach((input) => {
            if (input) {
                input.addEventListener('input', () => {
                    markSyncDirty();
                });
            }
        });

        elements.btnExportJson.addEventListener('click', async () => {
            try {
                const snapshot = await store.exportLocalSnapshot();
                const blob = new Blob([snapshot], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `code-note-helper-backup-${Date.now()}.json`;
                anchor.click();
                URL.revokeObjectURL(url);
                showToast('本地备份已导出');
            } catch (error) {
                console.error('[Options] 导出 JSON 失败：', error);
                showToast('导出失败，请稍后重试');
            }
        });

        elements.btnImportJson.addEventListener('click', () => {
            elements.importJsonFile.click();
        });

        elements.importJsonFile.addEventListener('change', async () => {
            const file = elements.importJsonFile.files && elements.importJsonFile.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                await store.importLocalSnapshot(text);
                await refreshView();
                showToast('本地数据已导入');
            } catch (error) {
                console.error('[Options] 导入 JSON 失败：', error);
                showToast(error.message || '导入失败，请检查文件内容', 2800);
            } finally {
                elements.importJsonFile.value = '';
            }
        });

        elements.btnSaveSync.addEventListener('click', async () => {
            try {
                if (!ensureSyncAllowed(true)) return;
                setBusy(elements.btnSaveSync, true);
                const nextSettings = await saveSyncSettings();
                if (nextSettings.chromeSyncEnabled && typeof store.runChromeSync === 'function') {
                    await store.runChromeSync({ reason: 'settings-save', silent: true });
                }
                await loadSyncSection();
                clearSyncDirty();
                showToast('同步设置已保存');
            } catch (error) {
                console.error('[Options] 保存同步设置失败：', error);
                showToast(error.message || '保存失败，请稍后重试', 2600);
            } finally {
                setBusy(elements.btnSaveSync, false);
            }
        });

        elements.btnRunChromeSync.addEventListener('click', async () => {
            try {
                if (!ensureSyncAllowed(true)) return;
                setBusy(elements.btnRunChromeSync, true);
                await saveSyncSettings();
                const result = await store.runChromeSync({ reason: 'manual' });
                if (!result.enabled) {
                    showToast('请先启用 Cloud Sync');
                } else if (result.queued) {
                    showToast('已有同步任务在执行，已加入队列');
                } else if (result.error) {
                    showToast(`同步失败：${result.error}`, 3000);
                } else {
                    showToast('Cloud Sync 已完成');
                }
                await loadSyncSection();
            } catch (error) {
                console.error('[Options] 执行 Cloud Sync 失败：', error);
                showToast(error.message || '同步失败，请稍后重试', 2600);
            } finally {
                setBusy(elements.btnRunChromeSync, false);
            }
        });

        elements.btnOpenBrowserSync.addEventListener('click', async () => {
            try {
                if (!ensureSyncAllowed(true)) return;
                if (typeof store.openBrowserSyncSettings !== 'function') {
                    throw new Error('当前环境无法打开浏览器同步设置');
                }
                const info = await store.openBrowserSyncSettings();
                showToast(`已打开 ${info.browserName} 同步设置`);
            } catch (error) {
                console.error('[Options] 打开浏览器同步设置失败：', error);
                showToast(error.message || '打开失败，请手动进入浏览器同步设置', 2800);
            }
        });

        elements.btnTestWebdav.addEventListener('click', async () => {
            try {
                if (!ensureSyncAllowed(true)) return;
                setBusy(elements.btnTestWebdav, true);
                await saveSyncSettings();
                await store.testNutstoreConnection();
                await loadSyncSection();
                showToast('连接成功，可以开始备份');
            } catch (error) {
                console.error('[Options] 测试坚果云失败：', error);
                showToast(formatWebdavErrorMessage(error, 'test'), 3200);
            } finally {
                setBusy(elements.btnTestWebdav, false);
            }
        });

        elements.btnBackupWebdav.addEventListener('click', async () => {
            try {
                if (!ensureSyncAllowed(true)) return;
                setBusy(elements.btnBackupWebdav, true);
                await saveSyncSettings();
                await store.backupToNutstore();
                await loadSyncSection();
                showToast('完整备份已上传到坚果云');
            } catch (error) {
                console.error('[Options] 备份到坚果云失败：', error);
                showToast(formatWebdavErrorMessage(error, 'backup'), 3200);
            } finally {
                setBusy(elements.btnBackupWebdav, false);
            }
        });

        elements.btnRestoreWebdav.addEventListener('click', async () => {
            try {
                if (!ensureSyncAllowed(true)) return;
                setBusy(elements.btnRestoreWebdav, true);
                await saveSyncSettings();
                await store.restoreFromNutstore();
                await refreshView();
                showToast('云端数据已恢复到当前浏览器');
            } catch (error) {
                console.error('[Options] 从坚果云恢复失败：', error);
                showToast(formatWebdavErrorMessage(error, 'restore'), 3200);
            } finally {
                setBusy(elements.btnRestoreWebdav, false);
            }
        });

        elements.btnSaveApi.addEventListener('click', async () => {
            try {
                await chrome.storage.local.set({
                    api_url: elements.apiUrl.value.trim(),
                    api_key: elements.apiKey.value.trim(),
                    api_model: elements.apiModel.value.trim() || 'gpt-4o'
                });
                clearApiDirty();
                showToast('API 配置已保存');
            } catch (error) {
                console.error('[Options] 保存 API 配置失败：', error);
                showToast('保存失败，请稍后重试');
            }
        });

        elements.btnResetApi.addEventListener('click', async () => {
            elements.apiUrl.value = 'https://api.openai.com/v1';
            elements.apiKey.value = '';
            elements.apiModel.value = 'gpt-4o';
            markApiDirty();
            showToast('已恢复默认 API 配置，请点击“保存 API 配置”后生效');
        });

        [elements.apiUrl, elements.apiKey, elements.apiModel].forEach((input) => {
            if (!input) return;
            input.addEventListener('input', () => {
                markApiDirty();
            });
        });

        try {
            await enforceCloudSyncDisabledState();
            await refreshView();
        } catch (error) {
            console.error('[Options] 初始化失败：', error);
            showToast('设置页初始化失败，请刷新页面', 2600);
        }
    });
})();

