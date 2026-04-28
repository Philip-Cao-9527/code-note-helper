/**
 * 高级设置页脚本
 * 版本：1.1.1
 */

(function () {
    'use strict';

    const DEFAULT_WEBDAV_REMOTE_PATH = 'CodeNote-Helper/backups/full-backup.json';

    let themeRemoveListener = null;
    let currentCustomColors = {};

    const COLOR_EDITOR_FIELDS = [
        { key: 'bg', label: '背景色', type: 'color' },
        { key: 'bgSoft', label: '柔和背景色', type: 'color' },
        { key: 'bgCard', label: '卡片背景色', type: 'color' },
        { key: 'bgPanel', label: '面板背景色', type: 'color' },
        { key: 'bgSoftHover', label: '悬停背景色', type: 'color' },
        { key: 'border', label: '边框色', type: 'color' },
        { key: 'borderSoft', label: '柔和边框色', type: 'color' },
        { key: 'textMain', label: '主文字色', type: 'color' },
        { key: 'textStrong', label: '强调文字色', type: 'color' },
        { key: 'textMuted', label: '次要文字色', type: 'color' },
        { key: 'accent', label: '强调色', type: 'color' },
        { key: 'accentSoft', label: '柔和强调色', type: 'color' },
        { key: 'success', label: '成功色', type: 'color' },
        { key: 'successSoft', label: '柔和成功色', type: 'color' },
        { key: 'warning', label: '警告色', type: 'color' },
        { key: 'warningSoft', label: '柔和警告色', type: 'color' },
        { key: 'danger', label: '危险色', type: 'color' },
        { key: 'dangerSoft', label: '柔和危险色', type: 'color' }
    ];

    async function initThemeSystem(showToast) {
        if (!window.ThemeCenter) {
            console.warn('[Options] ThemeCenter 未加载');
            return;
        }

        const initResult = await window.ThemeCenter.init();
        if (!initResult.success) {
            console.error('[Options] 主题系统初始化失败:', initResult.error);
            return;
        }

        themeRemoveListener = window.ThemeCenter.addChangeListener(async (event) => {
            if (event.type === 'themeChanged') {
                await refreshThemeUI();
            }
        });

        await refreshThemeUI();
        bindThemeEvents(showToast);
    }

    async function refreshThemeUI() {
        if (!window.ThemeCenter) return;

        const config = await window.ThemeCenter.getConfig();
        const currentTheme = await window.ThemeCenter.getCurrentTheme();
        const presets = window.ThemeCenter.getPresetThemes();
        const customThemes = await window.ThemeCenter.getCustomThemes();

        const currentThemeNameEl = document.getElementById('current-theme-name');
        const currentThemeTypeEl = document.getElementById('current-theme-type');
        const animationStatusEl = document.getElementById('animation-status');
        const animationToggle = document.getElementById('animation-toggle');
        const transitionDuration = document.getElementById('transition-duration');
        const transitionDurationValue = document.getElementById('transition-duration-value');

        if (currentThemeNameEl) {
            currentThemeNameEl.textContent = currentTheme?.name || '未知';
        }
        if (currentThemeTypeEl) {
            currentThemeTypeEl.textContent = currentTheme?.type === 'custom' ? '自定义主题' : '预设主题';
        }
        if (animationStatusEl) {
            animationStatusEl.textContent = config.animationEnabled ? '已启用' : '已禁用';
        }
        if (animationToggle) {
            animationToggle.checked = config.animationEnabled;
        }
        if (transitionDuration) {
            transitionDuration.value = config.transitionDuration || 0.3;
        }
        if (transitionDurationValue) {
            transitionDurationValue.textContent = (config.transitionDuration || 0.3) + 's';
        }

        renderThemePresets(presets, config.currentTheme);
        renderCustomThemes(customThemes, config.currentTheme);
        initCustomColorEditor(currentTheme);
    }

    function renderThemePresets(presets, currentThemeId) {
        const container = document.getElementById('theme-presets-grid');
        if (!container) return;

        container.innerHTML = presets.map(theme => `
            <button class="theme-preset-btn ${theme.id === currentThemeId ? 'active' : ''}" 
                    data-theme-id="${theme.id}" 
                    type="button">
                <div class="theme-preset-preview" style="background: ${theme.gradients.primary}"></div>
                <div class="theme-preset-name">${theme.name}</div>
            </button>
        `).join('');
    }

    function renderCustomThemes(customThemes, currentThemeId) {
        const container = document.getElementById('custom-themes-list');
        if (!container) return;

        const themeList = Object.values(customThemes);

        if (themeList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 20px; color: #64748b;">
                    暂无自定义主题
                </div>
            `;
            return;
        }

        container.innerHTML = themeList.map(theme => `
            <div class="custom-theme-item ${theme.id === currentThemeId ? 'active' : ''}" data-theme-id="${theme.id}">
                <div class="custom-theme-preview" style="background: ${theme.gradients?.primary || '#6366f1'}"></div>
                <div class="custom-theme-info">
                    <div class="custom-theme-name">${theme.name}</div>
                    <div class="custom-theme-meta">
                        基于 ${window.PRESET_THEMES?.[theme.baseTheme]?.name || theme.baseTheme || '暗黑'} 预设
                    </div>
                </div>
                <div class="custom-theme-actions">
                    <button class="btn btn-secondary" data-action="apply" data-theme-id="${theme.id}" type="button" style="padding: 6px 10px; font-size: 12px;">应用</button>
                    <button class="btn btn-secondary" data-action="delete" data-theme-id="${theme.id}" type="button" style="padding: 6px 10px; font-size: 12px; color: #dc2626;">删除</button>
                </div>
            </div>
        `).join('');
    }

    function initCustomColorEditor(baseTheme) {
        const container = document.getElementById('custom-colors-grid');
        const baseThemeSelect = document.getElementById('custom-base-theme');

        if (!container) return;

        let targetTheme = baseTheme;
        if (baseThemeSelect && window.PRESET_THEMES) {
            const selectedBase = baseThemeSelect.value;
            if (window.PRESET_THEMES[selectedBase]) {
                targetTheme = window.PRESET_THEMES[selectedBase];
            }
        }

        currentCustomColors = { ...targetTheme.colors };

        container.innerHTML = COLOR_EDITOR_FIELDS.map(field => {
            const value = currentCustomColors[field.key] || '#000000';
            return `
                <div class="form-group">
                    <label for="color-${field.key}">${field.label}</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="color" id="color-${field.key}" data-color-key="${field.key}" 
                               value="${rgbToHex(value)}" style="width: 40px; height: 36px; padding: 2px; cursor: pointer;">
                        <input type="text" id="color-text-${field.key}" data-color-key="${field.key}" 
                               value="${value}" style="flex: 1; font-family: monospace; font-size: 12px;">
                    </div>
                </div>
            `;
        }).join('');

        bindColorEditorEvents();
    }

    function rgbToHex(color) {
        if (color.startsWith('#')) {
            const hex = color.length === 9 ? color.slice(0, 7) : color;
            return hex;
        }

        if (color.startsWith('rgba') || color.startsWith('rgb')) {
            const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            }
        }

        return '#000000';
    }

    function bindColorEditorEvents() {
        COLOR_EDITOR_FIELDS.forEach(field => {
            const colorInput = document.getElementById(`color-${field.key}`);
            const textInput = document.getElementById(`color-text-${field.key}`);

            if (colorInput) {
                colorInput.addEventListener('input', (e) => {
                    const hex = e.target.value;
                    currentCustomColors[field.key] = hex;
                    if (textInput) {
                        textInput.value = hex;
                    }
                });
            }

            if (textInput) {
                textInput.addEventListener('input', (e) => {
                    const value = e.target.value.trim();
                    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
                        currentCustomColors[field.key] = value;
                        if (colorInput) {
                            colorInput.value = value;
                        }
                    }
                });
            }
        });
    }

    function bindThemeEvents(showToast) {
        const presetsContainer = document.getElementById('theme-presets-grid');
        if (presetsContainer) {
            presetsContainer.addEventListener('click', async (e) => {
                const btn = e.target.closest('.theme-preset-btn');
                if (!btn) return;

                const themeId = btn.dataset.themeId;
                if (!themeId) return;

                try {
                    const result = await window.ThemeCenter.applyTheme(themeId);
                    if (result.success) {
                        showToast(`已切换到「${result.theme.name}」主题`);
                    } else {
                        showToast('主题切换失败，请重试');
                    }
                } catch (error) {
                    console.error('[Options] 切换主题失败:', error);
                    showToast('主题切换失败，请重试');
                }
            });
        }

        const customThemesContainer = document.getElementById('custom-themes-list');
        if (customThemesContainer) {
            customThemesContainer.addEventListener('click', async (e) => {
                const applyBtn = e.target.closest('[data-action="apply"]');
                const deleteBtn = e.target.closest('[data-action="delete"]');

                if (applyBtn) {
                    const themeId = applyBtn.dataset.themeId;
                    try {
                        const result = await window.ThemeCenter.applyTheme(themeId);
                        if (result.success) {
                            showToast(`已切换到自定义主题「${result.theme.name}」`);
                        } else {
                            showToast('主题切换失败，请重试');
                        }
                    } catch (error) {
                        console.error('[Options] 应用自定义主题失败:', error);
                        showToast('主题切换失败，请重试');
                    }
                }

                if (deleteBtn) {
                    const themeId = deleteBtn.dataset.themeId;
                    if (confirm('确定要删除这个自定义主题吗？')) {
                        try {
                            await window.ThemeCenter.deleteCustomTheme(themeId);
                            showToast('自定义主题已删除');
                            await refreshThemeUI();
                        } catch (error) {
                            console.error('[Options] 删除自定义主题失败:', error);
                            showToast('删除失败，请重试');
                        }
                    }
                }
            });
        }

        const animationToggle = document.getElementById('animation-toggle');
        if (animationToggle) {
            animationToggle.addEventListener('change', async () => {
                try {
                    const config = await window.ThemeCenter.getConfig();
                    config.animationEnabled = animationToggle.checked;
                    await window.ThemeCenter.setConfig(config);
                    showToast(animationToggle.checked ? '过渡动画已启用' : '过渡动画已禁用');
                    await refreshThemeUI();
                } catch (error) {
                    console.error('[Options] 保存动画设置失败:', error);
                    showToast('保存失败，请重试');
                }
            });
        }

        const transitionDuration = document.getElementById('transition-duration');
        const transitionDurationValue = document.getElementById('transition-duration-value');
        if (transitionDuration && transitionDurationValue) {
            transitionDuration.addEventListener('input', () => {
                transitionDurationValue.textContent = transitionDuration.value + 's';
            });

            transitionDuration.addEventListener('change', async () => {
                try {
                    const config = await window.ThemeCenter.getConfig();
                    config.transitionDuration = parseFloat(transitionDuration.value);
                    await window.ThemeCenter.setConfig(config);
                    showToast('过渡时长已更新');
                } catch (error) {
                    console.error('[Options] 保存过渡时长失败:', error);
                    showToast('保存失败，请重试');
                }
            });
        }

        const baseThemeSelect = document.getElementById('custom-base-theme');
        if (baseThemeSelect && window.PRESET_THEMES) {
            baseThemeSelect.addEventListener('change', () => {
                const selectedBase = baseThemeSelect.value;
                if (window.PRESET_THEMES[selectedBase]) {
                    initCustomColorEditor(window.PRESET_THEMES[selectedBase]);
                }
            });
        }

        const btnPreviewCustomTheme = document.getElementById('btn-preview-custom-theme');
        if (btnPreviewCustomTheme) {
            btnPreviewCustomTheme.addEventListener('click', async () => {
                const themeName = document.getElementById('custom-theme-name')?.value?.trim();
                const baseTheme = document.getElementById('custom-base-theme')?.value || 'dark';

                if (!window.PRESET_THEMES || !window.PRESET_THEMES[baseTheme]) {
                    showToast('请选择有效的基础主题');
                    return;
                }

                const tempTheme = {
                    id: 'temp_preview_' + Date.now(),
                    name: themeName || '预览主题',
                    baseTheme: baseTheme,
                    type: 'custom',
                    colors: currentCustomColors,
                    gradients: window.PRESET_THEMES[baseTheme].gradients
                };

                const mergedTheme = {
                    ...window.PRESET_THEMES[baseTheme],
                    ...tempTheme,
                    colors: { ...window.PRESET_THEMES[baseTheme].colors, ...currentCustomColors }
                };

                const config = await window.ThemeCenter.getConfig();
                window.ThemeRenderer.applyTheme(mergedTheme, config);
                showToast('正在预览自定义主题效果');
            });
        }

        const btnSaveCustomTheme = document.getElementById('btn-save-custom-theme');
        if (btnSaveCustomTheme) {
            btnSaveCustomTheme.addEventListener('click', async () => {
                const themeName = document.getElementById('custom-theme-name')?.value?.trim();
                const baseTheme = document.getElementById('custom-base-theme')?.value || 'dark';

                if (!themeName) {
                    showToast('请输入自定义主题名称');
                    return;
                }

                if (!window.PRESET_THEMES || !window.PRESET_THEMES[baseTheme]) {
                    showToast('请选择有效的基础主题');
                    return;
                }

                try {
                    const customTheme = {
                        id: 'custom_' + Date.now(),
                        name: themeName,
                        baseTheme: baseTheme,
                        type: 'custom',
                        colors: currentCustomColors,
                        gradients: window.PRESET_THEMES[baseTheme].gradients,
                        fonts: window.PRESET_THEMES[baseTheme].fonts,
                        transitions: window.PRESET_THEMES[baseTheme].transitions
                    };

                    const result = await window.ThemeCenter.saveCustomTheme(customTheme);
                    if (result.success) {
                        showToast(`自定义主题「${themeName}」已保存`);
                        await refreshThemeUI();
                    } else {
                        showToast('保存失败，请重试');
                    }
                } catch (error) {
                    console.error('[Options] 保存自定义主题失败:', error);
                    showToast('保存失败，请重试');
                }
            });
        }

        const btnResetCustomTheme = document.getElementById('btn-reset-custom-theme');
        if (btnResetCustomTheme) {
            btnResetCustomTheme.addEventListener('click', () => {
                const baseTheme = document.getElementById('custom-base-theme')?.value || 'dark';
                if (window.PRESET_THEMES && window.PRESET_THEMES[baseTheme]) {
                    initCustomColorEditor(window.PRESET_THEMES[baseTheme]);
                    showToast('已重置为预设主题颜色');
                }
            });
        }

        const btnExportTheme = document.getElementById('btn-export-theme');
        if (btnExportTheme) {
            btnExportTheme.addEventListener('click', async () => {
                try {
                    const configJson = await window.ThemeCenter.exportThemeConfig();
                    const blob = new Blob([configJson], { type: 'application/json;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `code-note-helper-theme-${Date.now()}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                    showToast('主题配置已导出');
                } catch (error) {
                    console.error('[Options] 导出主题配置失败:', error);
                    showToast('导出失败，请重试');
                }
            });
        }

        const btnImportTheme = document.getElementById('btn-import-theme');
        const importThemeFile = document.getElementById('import-theme-file');
        if (btnImportTheme && importThemeFile) {
            btnImportTheme.addEventListener('click', () => {
                importThemeFile.click();
            });

            importThemeFile.addEventListener('change', async () => {
                const file = importThemeFile.files && importThemeFile.files[0];
                if (!file) return;

                try {
                    const text = await file.text();
                    const result = await window.ThemeCenter.importThemeConfig(text);

                    if (result.success) {
                        showToast('主题配置已导入');
                        await refreshThemeUI();
                    } else {
                        showToast(result.error || '导入失败，请检查文件格式');
                    }
                } catch (error) {
                    console.error('[Options] 导入主题配置失败:', error);
                    showToast('导入失败，请检查文件内容');
                } finally {
                    importThemeFile.value = '';
                }
            });
        }
    }

    function resolveWebdavPanelVisible(webdavEnabled) {
        return Boolean(webdavEnabled);
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

    function formatStatusText(status) {
        if (!status || !status.state) return '暂无';
        const stateMap = {
            success: '成功',
            warning: '提示',
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

    function setBusy(button, busy) {
        if (!button) return;
        button.disabled = busy;
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

    function resolveErrorMessage(error) {
        if (error && typeof error.message === 'string') {
            return error.message.trim();
        }
        return String(error || '').trim();
    }

    function isExpectedWebdavFailure(error) {
        const stage = String(error && error.stage || '').trim();
        if (stage === 'config' || stage === 'connect' || stage === 'directory' || stage === 'upload' || stage === 'restore') {
            return true;
        }
        const message = resolveErrorMessage(error);
        if (!message) return false;
        const normalized = message.toLowerCase();
        return normalized.includes('请求超时') || normalized.includes('timeout');
    }

    function logWebdavFailure(prefix, error) {
        if (isExpectedWebdavFailure(error)) {
            // 可预期网络失败（超时/连接异常等）只走界面提示，不写控制台错误或警告。
            return;
        }
        console.error(prefix, error);
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
            overwriteConfirmToggle: document.getElementById('overwrite-confirm-toggle'),
            btnSaveApi: document.getElementById('btn-save-api'),
            btnResetApi: document.getElementById('btn-reset-api'),
            toast: document.getElementById('toast')
        };

        const syncDirtyHint = document.getElementById('sync-dirty-hint');
        const apiDirtyHint = document.getElementById('api-dirty-hint');

        let syncDirty = false;
        let apiDirty = false;

        const showToast = createToast(elements.toast);
        const permissionHelper = window.NoteHelperApiDomainPermission || null;

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

        function applyWebdavPanelVisibility() {
            if (!elements.webdavSettingsPanel) return;
            elements.webdavSettingsPanel.style.display = resolveWebdavPanelVisible(
                elements.webdavToggle && elements.webdavToggle.checked
            )
                ? ''
                : 'none';
        }

        async function loadApiSettings() {
            const result = await chrome.storage.local.get(['api_url', 'api_key', 'api_model']);
            elements.apiUrl.value = result.api_url || 'https://api.openai.com/v1';
            elements.apiKey.value = result.api_key || '';
            elements.apiModel.value = result.api_model || 'gpt-4o';
            if (elements.overwriteConfirmToggle) {
                if (permissionHelper && typeof permissionHelper.getOverwriteConfirmEnabled === 'function') {
                    elements.overwriteConfirmToggle.checked = await permissionHelper.getOverwriteConfirmEnabled(true);
                } else {
                    const fallback = await chrome.storage.local.get(['note_helper_overwrite_confirm_enabled']);
                    elements.overwriteConfirmToggle.checked = typeof fallback.note_helper_overwrite_confirm_enabled === 'boolean'
                        ? fallback.note_helper_overwrite_confirm_enabled
                        : true;
                }
            }
            clearApiDirty();
        }

        async function loadSyncSection() {
            const [overview, settings, timelineEnabled] = await Promise.all([
                store.getSyncOverview(),
                store.getSyncSettings(),
                store.getTimelineEnabled()
            ]);

            elements.timelineToggle.checked = timelineEnabled;
            elements.localLabel.textContent = overview.localLabel || '当前浏览器';
            elements.localRevision.textContent = String(overview.localRevision || 0);
            elements.lastLocalWrite.textContent = `最近写入：${formatDateTime(overview.lastLocalWriteAt)}`;

            elements.webdavToggle.checked = Boolean(settings.webdav && settings.webdav.enabled);
            elements.webdavEmail.value = settings.webdav?.email || '';
            elements.webdavPassword.value = settings.webdav?.appPassword || '';
            elements.webdavRemotePath.value = settings.webdav?.remotePath || DEFAULT_WEBDAV_REMOTE_PATH;
            elements.webdavBaseUrl.textContent = overview.webdavBaseUrl || '暂无';
            elements.webdavRemoteLabel.textContent = overview.webdavRemotePath || '暂无';
            elements.webdavLastAt.textContent = formatDateTime(overview.webdavLastSyncAt);
            elements.webdavLastStatus.textContent = formatStatusText(overview.webdavLastStatus);
            elements.webdavLastError.textContent = overview.webdavLastError?.message || '暂无';

            applyWebdavPanelVisibility();
            clearSyncDirty();
        }

        async function refreshView() {
            await Promise.all([
                loadApiSettings(),
                loadSyncSection()
            ]);
        }

        async function saveSyncSettings() {
            const current = await store.getSyncSettings();
            const nextSettings = {
                ...(current || {}),
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

        window.addEventListener('beforeunload', (event) => {
            if (!syncDirty && !apiDirty) return;
            event.preventDefault();
            event.returnValue = '';
        });

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

        elements.webdavToggle.addEventListener('change', () => {
            applyWebdavPanelVisibility();
            markSyncDirty();
        });

        [elements.webdavEmail, elements.webdavPassword, elements.webdavRemotePath].forEach((input) => {
            input.addEventListener('input', () => {
                markSyncDirty();
            });
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
                setBusy(elements.btnSaveSync, true);
                await saveSyncSettings();
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

        elements.btnTestWebdav.addEventListener('click', async () => {
            try {
                setBusy(elements.btnTestWebdav, true);
                await saveSyncSettings();
                await store.testNutstoreConnection();
                await loadSyncSection();
                showToast('连接成功，可以开始备份');
            } catch (error) {
                logWebdavFailure('[Options] 测试坚果云提示：', error);
                showToast(formatWebdavErrorMessage(error, 'test'), 3200);
            } finally {
                setBusy(elements.btnTestWebdav, false);
            }
        });

        elements.btnBackupWebdav.addEventListener('click', async () => {
            try {
                setBusy(elements.btnBackupWebdav, true);
                await saveSyncSettings();
                await store.backupToNutstore();
                await loadSyncSection();
                showToast('完整备份已上传到坚果云');
            } catch (error) {
                logWebdavFailure('[Options] 备份到坚果云提示：', error);
                showToast(formatWebdavErrorMessage(error, 'backup'), 3200);
            } finally {
                setBusy(elements.btnBackupWebdav, false);
            }
        });

        elements.btnRestoreWebdav.addEventListener('click', async () => {
            try {
                setBusy(elements.btnRestoreWebdav, true);
                await saveSyncSettings();
                await store.restoreFromNutstore();
                await refreshView();
                showToast('云端数据已恢复到当前浏览器');
            } catch (error) {
                logWebdavFailure('[Options] 从坚果云恢复提示：', error);
                showToast(formatWebdavErrorMessage(error, 'restore'), 3200);
            } finally {
                setBusy(elements.btnRestoreWebdav, false);
            }
        });

        elements.btnSaveApi.addEventListener('click', async () => {
            try {
                const apiUrl = elements.apiUrl.value.trim();
                if (!apiUrl) {
                    showToast('请先填写 API Base URL');
                    elements.apiUrl.focus();
                    return;
                }

                if (!permissionHelper || typeof permissionHelper.ensureApiDomainPermission !== 'function') {
                    showToast('权限模块未加载，请刷新后重试');
                    return;
                }
                const permissionResult = await permissionHelper.ensureApiDomainPermission(apiUrl, {
                    requestIfMissing: true
                });
                if (!permissionResult.ok) {
                    showToast(permissionResult.message || '未授予该 API 域名的网络访问权限，无法使用该接口。', 3200);
                    return;
                }

                await chrome.storage.local.set({
                    api_url: apiUrl,
                    api_key: elements.apiKey.value.trim(),
                    api_model: elements.apiModel.value.trim() || 'gpt-4o'
                });
                if (elements.overwriteConfirmToggle) {
                    const overwriteConfirmEnabled = Boolean(elements.overwriteConfirmToggle.checked);
                    if (permissionHelper && typeof permissionHelper.setOverwriteConfirmEnabled === 'function') {
                        await permissionHelper.setOverwriteConfirmEnabled(overwriteConfirmEnabled);
                    } else {
                        await chrome.storage.local.set({
                            note_helper_overwrite_confirm_enabled: overwriteConfirmEnabled
                        });
                    }
                }
                clearApiDirty();
                showToast('API 配置已保存');
            } catch (error) {
                console.error('[Options] 保存 API 配置失败：', error);
                showToast('保存失败，请稍后重试');
            }
        });

        elements.btnResetApi.addEventListener('click', () => {
            elements.apiUrl.value = 'https://api.openai.com/v1';
            elements.apiKey.value = '';
            elements.apiModel.value = 'gpt-4o';
            markApiDirty();
            showToast('已恢复默认 API 配置，请点击“保存 API 配置”后生效');
        });

        [elements.apiUrl, elements.apiKey, elements.apiModel].forEach((input) => {
            input.addEventListener('input', () => {
                markApiDirty();
            });
        });

        if (elements.overwriteConfirmToggle) {
            elements.overwriteConfirmToggle.addEventListener('change', () => {
                markApiDirty();
            });
        }

        try {
            await refreshView();
            await initThemeSystem(showToast);
        } catch (error) {
            console.error('[Options] 初始化失败：', error);
            showToast('设置页初始化失败，请刷新页面', 2600);
        }
    });

    window.addEventListener('beforeunload', () => {
        if (themeRemoveListener) {
            themeRemoveListener();
        }
    });
})();
