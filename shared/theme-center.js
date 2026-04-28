/**
 * ThemeCenter - 全局主题系统核心模块
 * 版本：1.0.0
 * 功能：主题解析、渲染、状态管理与全局同步
 */

(function () {
    'use strict';

    const THEME_STORAGE_KEY = 'cn_helper_theme_config';
    const THEME_CHANGE_EVENT = 'cn_helper_theme_changed';
    const THEME_CHANGE_MESSAGE = 'THEME_CHANGED';

    const PRESET_THEMES = {
        light: {
            id: 'light',
            name: '明亮',
            type: 'preset',
            colors: {
                bg: '#f8fafc',
                bgSoft: '#f1f5f9',
                bgCard: 'rgba(255, 255, 255, 0.95)',
                bgPanel: 'rgba(248, 250, 252, 0.92)',
                bgSoftHover: 'rgba(226, 232, 240, 0.92)',
                border: 'rgba(148, 163, 184, 0.25)',
                borderSoft: 'rgba(148, 163, 184, 0.18)',
                textMain: '#1e293b',
                textStrong: '#0f172a',
                textMuted: '#64748b',
                textSubtle: '#475569',
                accent: '#2563eb',
                accentSoft: 'rgba(37, 99, 235, 0.15)',
                success: '#16a34a',
                successSoft: 'rgba(22, 163, 74, 0.15)',
                warning: '#d97706',
                warningSoft: 'rgba(217, 119, 6, 0.15)',
                danger: '#dc2626',
                dangerSoft: 'rgba(220, 38, 38, 0.14)',
                shadow: '0 18px 42px rgba(15, 23, 42, 0.12)',
                shadowSoft: '0 12px 34px rgba(15, 23, 42, 0.08)',
                shadowCard: '0 8px 22px rgba(15, 23, 42, 0.06)'
            },
            gradients: {
                primary: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                secondary: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                accent: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                background: 'linear-gradient(160deg, #f8fafc 0%, #f1f5f9 56%, #e2e8f0 100%)',
                bgGlow: [
                    'radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 34%)',
                    'radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.08), transparent 28%)'
                ]
            },
            fonts: {
                base: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
                code: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                heading: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
            },
            transitions: {
                fast: '0.15s ease',
                normal: '0.2s ease',
                slow: '0.3s ease'
            }
        },
        dark: {
            id: 'dark',
            name: '暗黑',
            type: 'preset',
            colors: {
                bg: '#0f172a',
                bgSoft: '#1e293b',
                bgCard: 'rgba(15, 23, 42, 0.74)',
                bgPanel: 'rgba(15, 23, 42, 0.82)',
                bgSoftHover: 'rgba(37, 52, 73, 0.92)',
                border: 'rgba(148, 163, 184, 0.25)',
                borderSoft: 'rgba(148, 163, 184, 0.18)',
                textMain: '#dbe4f0',
                textStrong: '#f8fafc',
                textMuted: '#94a3b8',
                textSubtle: '#cbd5e1',
                accent: '#38bdf8',
                accentSoft: 'rgba(56, 189, 248, 0.18)',
                success: '#22c55e',
                successSoft: 'rgba(34, 197, 94, 0.18)',
                warning: '#f59e0b',
                warningSoft: 'rgba(245, 158, 11, 0.18)',
                danger: '#fb7185',
                dangerSoft: 'rgba(251, 113, 133, 0.16)',
                shadow: '0 18px 42px rgba(2, 6, 23, 0.38)',
                shadowSoft: '0 12px 34px rgba(2, 6, 23, 0.25)',
                shadowCard: '0 8px 22px rgba(2, 6, 23, 0.2)'
            },
            gradients: {
                primary: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                secondary: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                accent: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                background: 'linear-gradient(160deg, #0f172a 0%, #111827 56%, #020617 100%)',
                bgGlow: [
                    'radial-gradient(circle at top right, rgba(56, 189, 248, 0.24), transparent 34%)',
                    'radial-gradient(circle at bottom left, rgba(34, 197, 94, 0.18), transparent 28%)'
                ]
            },
            fonts: {
                base: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
                code: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                heading: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
            },
            transitions: {
                fast: '0.15s ease',
                normal: '0.2s ease',
                slow: '0.3s ease'
            }
        },
        minimal: {
            id: 'minimal',
            name: '极简',
            type: 'preset',
            colors: {
                bg: '#ffffff',
                bgSoft: '#fafafa',
                bgCard: 'rgba(255, 255, 255, 0.98)',
                bgPanel: 'rgba(255, 255, 255, 0.95)',
                bgSoftHover: 'rgba(245, 245, 245, 0.98)',
                border: 'rgba(229, 229, 229, 0.8)',
                borderSoft: 'rgba(229, 229, 229, 0.5)',
                textMain: '#171717',
                textStrong: '#0a0a0a',
                textMuted: '#737373',
                textSubtle: '#525252',
                accent: '#171717',
                accentSoft: 'rgba(23, 23, 23, 0.08)',
                success: '#16a34a',
                successSoft: 'rgba(22, 163, 74, 0.1)',
                warning: '#d97706',
                warningSoft: 'rgba(217, 119, 6, 0.1)',
                danger: '#dc2626',
                dangerSoft: 'rgba(220, 38, 38, 0.1)',
                shadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                shadowSoft: '0 2px 8px rgba(0, 0, 0, 0.02)',
                shadowCard: '0 1px 3px rgba(0, 0, 0, 0.02)'
            },
            gradients: {
                primary: 'linear-gradient(135deg, #171717 0%, #262626 100%)',
                secondary: 'linear-gradient(135deg, #a3a3a3 0%, #737373 100%)',
                accent: 'linear-gradient(135deg, #171717 0%, #262626 100%)',
                background: 'linear-gradient(160deg, #ffffff 0%, #fafafa 56%, #f5f5f5 100%)',
                bgGlow: []
            },
            fonts: {
                base: '"SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
                code: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
                heading: '"SF Pro Display", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
            },
            transitions: {
                fast: '0.1s ease',
                normal: '0.15s ease',
                slow: '0.2s ease'
            }
        },
        gradient: {
            id: 'gradient',
            name: '渐变',
            type: 'preset',
            colors: {
                bg: '#1a1a2e',
                bgSoft: 'rgba(30, 30, 60, 0.8)',
                bgCard: 'rgba(26, 26, 46, 0.7)',
                bgPanel: 'rgba(26, 26, 46, 0.85)',
                bgSoftHover: 'rgba(46, 46, 86, 0.9)',
                border: 'rgba(139, 92, 246, 0.3)',
                borderSoft: 'rgba(139, 92, 246, 0.15)',
                textMain: '#e2e8f0',
                textStrong: '#f8fafc',
                textMuted: '#94a3b8',
                textSubtle: '#cbd5e1',
                accent: '#a78bfa',
                accentSoft: 'rgba(167, 139, 250, 0.2)',
                success: '#34d399',
                successSoft: 'rgba(52, 211, 153, 0.18)',
                warning: '#fbbf24',
                warningSoft: 'rgba(251, 191, 36, 0.18)',
                danger: '#f87171',
                dangerSoft: 'rgba(248, 113, 113, 0.16)',
                shadow: '0 18px 42px rgba(0, 0, 0, 0.35)',
                shadowSoft: '0 12px 34px rgba(139, 92, 246, 0.15)',
                shadowCard: '0 8px 22px rgba(0, 0, 0, 0.25)'
            },
            gradients: {
                primary: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #ec4899 100%)',
                secondary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                accent: 'linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)',
                background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 56%, #0f0f23 100%)',
                bgGlow: [
                    'radial-gradient(circle at top right, rgba(139, 92, 246, 0.35), transparent 40%)',
                    'radial-gradient(circle at bottom left, rgba(236, 72, 153, 0.25), transparent 35%)',
                    'radial-gradient(circle at center top, rgba(59, 130, 246, 0.15), transparent 50%)'
                ]
            },
            fonts: {
                base: '"Inter", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
                code: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                heading: '"Inter", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
            },
            transitions: {
                fast: '0.2s ease',
                normal: '0.3s ease',
                slow: '0.4s ease'
            }
        }
    };

    const DEFAULT_THEME_CONFIG = {
        currentTheme: 'dark',
        customThemes: {},
        transitionDuration: 0.3,
        animationEnabled: true,
        lastUpdated: Date.now()
    };

    let _currentTheme = null;
    let _styleElement = null;
    let _listeners = [];
    let _storageChangeListener = null;
    let _initialized = false;

    const ThemeCrypto = {
        _getKey() {
            const keyStr = 'cn_helper_theme_key_2024';
            return Array.from(keyStr).map(c => c.charCodeAt(0));
        },

        encrypt(data) {
            try {
                const key = this._getKey();
                const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
                let result = '';
                for (let i = 0; i < jsonStr.length; i++) {
                    const charCode = jsonStr.charCodeAt(i) ^ key[i % key.length];
                    result += String.fromCharCode(charCode);
                }
                return btoa(result);
            } catch (e) {
                console.warn('[ThemeCrypto] 加密失败，使用明文存储:', e);
                return btoa(unescape(encodeURIComponent(typeof data === 'string' ? data : JSON.stringify(data))));
            }
        },

        decrypt(encrypted) {
            try {
                const key = this._getKey();
                const decoded = atob(encrypted);
                let result = '';
                for (let i = 0; i < decoded.length; i++) {
                    const charCode = decoded.charCodeAt(i) ^ key[i % key.length];
                    result += String.fromCharCode(charCode);
                }
                return JSON.parse(result);
            } catch (e) {
                try {
                    return JSON.parse(decodeURIComponent(escape(atob(encrypted))));
                } catch (e2) {
                    console.warn('[ThemeCrypto] 解密失败，返回默认值:', e2);
                    return null;
                }
            }
        }
    };

    const ThemeStorage = {
        async load() {
            try {
                const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
                if (result[THEME_STORAGE_KEY]) {
                    const decrypted = ThemeCrypto.decrypt(result[THEME_STORAGE_KEY]);
                    if (decrypted) {
                        return { ...DEFAULT_THEME_CONFIG, ...decrypted };
                    }
                }
            } catch (e) {
                console.warn('[ThemeStorage] 加载主题配置失败:', e);
            }
            return { ...DEFAULT_THEME_CONFIG };
        },

        async save(config) {
            try {
                const encrypted = ThemeCrypto.encrypt(config);
                await chrome.storage.local.set({ [THEME_STORAGE_KEY]: encrypted });
                return true;
            } catch (e) {
                console.error('[ThemeStorage] 保存主题配置失败:', e);
                return false;
            }
        }
    };

    const ThemeRenderer = {
        _getStyleElement() {
            if (_styleElement) return _styleElement;

            _styleElement = document.getElementById('cn-helper-theme-styles');
            if (!_styleElement) {
                _styleElement = document.createElement('style');
                _styleElement.id = 'cn-helper-theme-styles';
                document.head.appendChild(_styleElement);
            }
            return _styleElement;
        },

        _generateCSSVariables(theme) {
            const { colors, gradients, fonts, transitions } = theme;
            const lines = [];

            lines.push(':root {');

            Object.entries(colors).forEach(([key, value]) => {
                const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
                lines.push(`  ${cssVar}: ${value};`);
            });

            Object.entries(gradients).forEach(([key, value]) => {
                const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
                if (Array.isArray(value)) {
                    value.forEach((v, i) => {
                        lines.push(`  ${cssVar}-${i + 1}: ${v};`);
                    });
                } else {
                    lines.push(`  ${cssVar}: ${value};`);
                }
            });

            Object.entries(fonts).forEach(([key, value]) => {
                const cssVar = '--font-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
                lines.push(`  ${cssVar}: ${value};`);
            });

            Object.entries(transitions).forEach(([key, value]) => {
                const cssVar = '--transition-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
                lines.push(`  ${cssVar}: ${value};`);
            });

            lines.push('}');

            lines.push(`
html, body {
  transition: background-color var(--transition-normal), color var(--transition-normal);
}

* {
  transition: background-color var(--transition-normal), 
              border-color var(--transition-normal),
              color var(--transition-fast),
              box-shadow var(--transition-normal);
}
`);

            return lines.join('\n');
        },

        applyTheme(theme, config) {
            const styleEl = this._getStyleElement();
            const css = this._generateCSSVariables(theme);
            styleEl.textContent = css;

            document.documentElement.setAttribute('data-theme', theme.id);
            document.documentElement.setAttribute('data-theme-type', theme.type);
            document.body.setAttribute('data-theme', theme.id);

            if (config.animationEnabled === false) {
                document.documentElement.classList.add('theme-no-animations');
            } else {
                document.documentElement.classList.remove('theme-no-animations');
            }

            _currentTheme = theme;
        },

        removeTheme() {
            if (_styleElement) {
                _styleElement.remove();
                _styleElement = null;
            }
            document.documentElement.removeAttribute('data-theme');
            document.documentElement.removeAttribute('data-theme-type');
            document.body.removeAttribute('data-theme');
        }
    };

    const ThemeCenter = {
        getPresetThemes() {
            return Object.values(PRESET_THEMES);
        },

        getPresetTheme(themeId) {
            return PRESET_THEMES[themeId] || null;
        },

        async getConfig() {
            return await ThemeStorage.load();
        },

        async setConfig(newConfig) {
            const currentConfig = await ThemeStorage.load();
            const mergedConfig = { ...currentConfig, ...newConfig, lastUpdated: Date.now() };
            await ThemeStorage.save(mergedConfig);
            return mergedConfig;
        },

        async getCurrentTheme() {
            if (_currentTheme) return _currentTheme;

            const config = await this.getConfig();
            const preset = this.getPresetTheme(config.currentTheme);

            if (preset) {
                return preset;
            }

            if (config.customThemes && config.customThemes[config.currentTheme]) {
                return this._mergeCustomTheme(config.customThemes[config.currentTheme]);
            }

            return PRESET_THEMES.dark;
        },

        _mergeCustomTheme(customTheme) {
            const baseTheme = PRESET_THEMES[customTheme.baseTheme || 'dark'] || PRESET_THEMES.dark;
            return {
                ...baseTheme,
                id: customTheme.id,
                name: customTheme.name,
                type: 'custom',
                colors: { ...baseTheme.colors, ...customTheme.colors },
                gradients: { ...baseTheme.gradients, ...customTheme.gradients }
            };
        },

        async applyTheme(themeId) {
            try {
                const config = await this.getConfig();
                let theme = this.getPresetTheme(themeId);

                if (!theme && config.customThemes && config.customThemes[themeId]) {
                    theme = this._mergeCustomTheme(config.customThemes[themeId]);
                }

                if (!theme) {
                    throw new Error(`主题 "${themeId}" 不存在`);
                }

                ThemeRenderer.applyTheme(theme, config);
                config.currentTheme = themeId;
                config.lastUpdated = Date.now();
                await ThemeStorage.save(config);

                this._notifyListeners({
                    type: 'themeChanged',
                    themeId: themeId,
                    theme: theme
                });

                await this._broadcastThemeChange(themeId);

                return { success: true, theme };
            } catch (error) {
                console.error('[ThemeCenter] 应用主题失败:', error);
                this._notifyListeners({
                    type: 'themeError',
                    error: error.message
                });
                return { success: false, error: error.message };
            }
        },

        async _broadcastThemeChange(themeId) {
            try {
                if (chrome.runtime && chrome.runtime.sendMessage) {
                    await chrome.runtime.sendMessage({
                        type: THEME_CHANGE_MESSAGE,
                        themeId: themeId,
                        timestamp: Date.now()
                    });
                }
            } catch (e) {
                if (!e.message?.includes('Extension context invalidated')) {
                    console.warn('[ThemeCenter] 广播主题变化失败:', e);
                }
            }
        },

        async saveCustomTheme(customTheme) {
            const config = await this.getConfig();

            if (!config.customThemes) {
                config.customThemes = {};
            }

            const themeId = customTheme.id || 'custom_' + Date.now();
            config.customThemes[themeId] = {
                ...customTheme,
                id: themeId,
                type: 'custom',
                createdAt: customTheme.createdAt || Date.now(),
                updatedAt: Date.now()
            };

            config.lastUpdated = Date.now();
            await ThemeStorage.save(config);

            return { success: true, themeId };
        },

        async deleteCustomTheme(themeId) {
            const config = await this.getConfig();

            if (config.currentTheme === themeId) {
                config.currentTheme = Object.keys(PRESET_THEMES)[0] || 'dark';
            }

            if (config.customThemes && config.customThemes[themeId]) {
                delete config.customThemes[themeId];
            }

            config.lastUpdated = Date.now();
            await ThemeStorage.save(config);

            return { success: true };
        },

        async getCustomThemes() {
            const config = await this.getConfig();
            return config.customThemes || {};
        },

        async exportThemeConfig() {
            const config = await this.getConfig();
            return JSON.stringify(config, null, 2);
        },

        async importThemeConfig(jsonString) {
            try {
                const imported = JSON.parse(jsonString);

                const validConfig = {
                    ...DEFAULT_THEME_CONFIG,
                    currentTheme: imported.currentTheme || 'dark',
                    customThemes: imported.customThemes || {},
                    transitionDuration: imported.transitionDuration || 0.3,
                    animationEnabled: typeof imported.animationEnabled === 'boolean' ? imported.animationEnabled : true,
                    lastUpdated: Date.now()
                };

                if (validConfig.currentTheme !== 'dark' &&
                    !this.getPresetTheme(validConfig.currentTheme) &&
                    !validConfig.customThemes[validConfig.currentTheme]) {
                    validConfig.currentTheme = 'dark';
                }

                await ThemeStorage.save(validConfig);

                await this.applyTheme(validConfig.currentTheme);

                return { success: true };
            } catch (error) {
                console.error('[ThemeCenter] 导入主题配置失败:', error);
                return { success: false, error: error.message };
            }
        },

        addChangeListener(listener) {
            if (typeof listener === 'function') {
                _listeners.push(listener);
                return () => {
                    const index = _listeners.indexOf(listener);
                    if (index > -1) {
                        _listeners.splice(index, 1);
                    }
                };
            }
            return () => {};
        },

        _notifyListeners(event) {
            _listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (e) {
                    console.error('[ThemeCenter] 通知监听器失败:', e);
                }
            });
        },

        async init() {
            if (_initialized) return { success: true };

            try {
                const config = await this.getConfig();
                const theme = await this.getCurrentTheme();

                ThemeRenderer.applyTheme(theme, config);

                this._setupStorageListener();

                this._setupRuntimeMessageListener();

                _initialized = true;

                this._notifyListeners({
                    type: 'initialized',
                    themeId: config.currentTheme,
                    theme: theme
                });

                return { success: true };
            } catch (error) {
                console.error('[ThemeCenter] 初始化失败:', error);
                return { success: false, error: error.message };
            }
        },

        _setupStorageListener() {
            if (_storageChangeListener) return;

            _storageChangeListener = (changes, areaName) => {
                if (areaName === 'local' && changes[THEME_STORAGE_KEY]) {
                    this._handleExternalThemeChange();
                }
            };

            if (chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener(_storageChangeListener);
            }
        },

        async _handleExternalThemeChange() {
            const config = await this.getConfig();
            const currentTheme = await this.getCurrentTheme();

            if (currentTheme && _currentTheme && currentTheme.id !== _currentTheme.id) {
                ThemeRenderer.applyTheme(currentTheme, config);

                this._notifyListeners({
                    type: 'themeChanged',
                    themeId: config.currentTheme,
                    theme: currentTheme,
                    source: 'external'
                });
            }
        },

        _setupRuntimeMessageListener() {
            if (chrome.runtime && chrome.runtime.onMessage) {
                chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                    if (message.type === THEME_CHANGE_MESSAGE) {
                        this._handleExternalThemeChange();
                        sendResponse({ received: true });
                    }
                    return true;
                });
            }
        },

        destroy() {
            ThemeRenderer.removeTheme();
            _listeners = [];

            if (_storageChangeListener && chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.removeListener(_storageChangeListener);
                _storageChangeListener = null;
            }

            _currentTheme = null;
            _initialized = false;
        }
    };

    const ThemeToggleButton = {
        create(options = {}) {
            const {
                container,
                position = 'top-right',
                showDropdown = true,
                onThemeChange,
                onError
            } = options;

            let buttonContainer = null;
            let dropdownMenu = null;
            let isDropdownOpen = false;

            const buttonId = 'cn-theme-toggle-' + Date.now();
            const dropdownId = 'cn-theme-dropdown-' + Date.now();

            async function render() {
                const config = await ThemeCenter.getConfig();
                const currentTheme = await ThemeCenter.getCurrentTheme();
                const presets = ThemeCenter.getPresetThemes();
                const customThemes = await ThemeCenter.getCustomThemes();

                if (buttonContainer) {
                    buttonContainer.remove();
                }

                buttonContainer = document.createElement('div');
                buttonContainer.id = buttonId;
                buttonContainer.className = 'cn-theme-toggle-container';
                buttonContainer.style.cssText = `
                    position: fixed;
                    z-index: 99999;
                    font-family: var(--font-base, "Segoe UI", sans-serif);
                `;

                switch (position) {
                    case 'top-right':
                        buttonContainer.style.top = '16px';
                        buttonContainer.style.right = '16px';
                        break;
                    case 'top-left':
                        buttonContainer.style.top = '16px';
                        buttonContainer.style.left = '16px';
                        break;
                    case 'bottom-right':
                        buttonContainer.style.bottom = '16px';
                        buttonContainer.style.right = '16px';
                        break;
                    case 'bottom-left':
                        buttonContainer.style.bottom = '16px';
                        buttonContainer.style.left = '16px';
                        break;
                }

                buttonContainer.innerHTML = `
                    <button class="cn-theme-toggle-btn" type="button" aria-haspopup="true" aria-expanded="false">
                        <span class="cn-theme-icon">🎨</span>
                        <span class="cn-theme-label">${currentTheme.name}</span>
                        <span class="cn-theme-arrow">▼</span>
                    </button>
                    ${showDropdown ? `
                    <div class="cn-theme-dropdown" id="${dropdownId}" style="display: none;">
                        <div class="cn-theme-dropdown-header">
                            <span>选择主题</span>
                        </div>
                        <div class="cn-theme-presets">
                            ${presets.map(theme => `
                                <button class="cn-theme-option ${theme.id === config.currentTheme ? 'active' : ''}" 
                                        data-theme-id="${theme.id}" 
                                        data-theme-type="preset"
                                        type="button">
                                    <span class="cn-theme-preview" style="background: ${theme.gradients.primary}"></span>
                                    <span class="cn-theme-name">${theme.name}</span>
                                    <span class="cn-theme-badge">预设</span>
                                </button>
                            `).join('')}
                        </div>
                        ${Object.keys(customThemes).length > 0 ? `
                        <div class="cn-theme-custom-header">
                            <span>自定义主题</span>
                        </div>
                        <div class="cn-theme-customs">
                            ${Object.values(customThemes).map(theme => `
                                <button class="cn-theme-option ${theme.id === config.currentTheme ? 'active' : ''}" 
                                        data-theme-id="${theme.id}" 
                                        data-theme-type="custom"
                                        type="button">
                                    <span class="cn-theme-preview" style="background: ${theme.gradients?.primary || '#6366f1'}"></span>
                                    <span class="cn-theme-name">${theme.name}</span>
                                    <span class="cn-theme-badge custom">自定义</span>
                                </button>
                            `).join('')}
                        </div>
                        ` : ''}
                        <div class="cn-theme-dropdown-footer">
                            <button class="cn-theme-manage-btn" type="button" data-action="open-options">
                                ⚙️ 自定义主题
                            </button>
                        </div>
                    </div>
                    ` : ''}
                `;

                const style = document.createElement('style');
                style.textContent = `
                    .cn-theme-toggle-container .cn-theme-toggle-btn {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 14px;
                        border: 1px solid var(--border, rgba(148, 163, 184, 0.25));
                        border-radius: 12px;
                        background: var(--bg-card, rgba(255, 255, 255, 0.95));
                        color: var(--text-main, #1e293b);
                        cursor: pointer;
                        transition: all var(--transition-normal, 0.2s ease);
                        box-shadow: var(--shadow-card, 0 4px 12px rgba(0, 0, 0, 0.08));
                        font-size: 13px;
                        font-weight: 500;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-toggle-btn:hover {
                        border-color: var(--accent, #2563eb);
                        box-shadow: var(--shadow, 0 8px 24px rgba(0, 0, 0, 0.12));
                        transform: translateY(-1px);
                    }
                    
                    .cn-theme-toggle-container .cn-theme-toggle-btn:active {
                        transform: translateY(0);
                    }
                    
                    .cn-theme-toggle-container .cn-theme-toggle-btn.loading {
                        opacity: 0.7;
                        pointer-events: none;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-toggle-btn.loading .cn-theme-icon {
                        animation: cn-theme-spin 1s linear infinite;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-icon {
                        font-size: 16px;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-arrow {
                        font-size: 10px;
                        opacity: 0.6;
                        transition: transform 0.2s ease;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-toggle-btn[aria-expanded="true"] .cn-theme-arrow {
                        transform: rotate(180deg);
                    }
                    
                    .cn-theme-toggle-container .cn-theme-dropdown {
                        position: absolute;
                        top: 100%;
                        right: 0;
                        margin-top: 8px;
                        min-width: 240px;
                        background: var(--bg-card, rgba(255, 255, 255, 0.98));
                        border: 1px solid var(--border, rgba(148, 163, 184, 0.25));
                        border-radius: 16px;
                        box-shadow: var(--shadow, 0 12px 32px rgba(0, 0, 0, 0.15));
                        overflow: hidden;
                        backdrop-filter: blur(12px);
                        animation: cn-theme-dropdown-fade-in 0.2s ease;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-dropdown-header,
                    .cn-theme-toggle-container .cn-theme-custom-header {
                        padding: 12px 16px;
                        font-size: 12px;
                        font-weight: 600;
                        color: var(--text-muted, #64748b);
                        background: var(--bg-soft, rgba(248, 250, 252, 0.8));
                        border-bottom: 1px solid var(--border-soft, rgba(148, 163, 184, 0.12));
                    }
                    
                    .cn-theme-toggle-container .cn-theme-option {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        width: 100%;
                        padding: 12px 16px;
                        border: none;
                        background: transparent;
                        color: var(--text-main, #1e293b);
                        cursor: pointer;
                        text-align: left;
                        transition: background 0.15s ease;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-option:hover {
                        background: var(--bg-soft, rgba(248, 250, 252, 0.8));
                    }
                    
                    .cn-theme-toggle-container .cn-theme-option.active {
                        background: var(--accent-soft, rgba(37, 99, 235, 0.1));
                    }
                    
                    .cn-theme-toggle-container .cn-theme-preview {
                        width: 24px;
                        height: 24px;
                        border-radius: 6px;
                        flex-shrink: 0;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-name {
                        flex: 1;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-badge {
                        padding: 2px 8px;
                        border-radius: 999px;
                        font-size: 10px;
                        font-weight: 600;
                        background: var(--accent-soft, rgba(37, 99, 235, 0.15));
                        color: var(--accent, #2563eb);
                    }
                    
                    .cn-theme-toggle-container .cn-theme-badge.custom {
                        background: var(--success-soft, rgba(22, 163, 74, 0.15));
                        color: var(--success, #16a34a);
                    }
                    
                    .cn-theme-toggle-container .cn-theme-dropdown-footer {
                        padding: 12px 16px;
                        border-top: 1px solid var(--border-soft, rgba(148, 163, 184, 0.12));
                    }
                    
                    .cn-theme-toggle-container .cn-theme-manage-btn {
                        width: 100%;
                        padding: 10px 14px;
                        border: 1px solid var(--border-soft, rgba(148, 163, 184, 0.18));
                        border-radius: 10px;
                        background: var(--bg-soft, rgba(248, 250, 252, 0.6));
                        color: var(--text-main, #1e293b);
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        transition: all 0.15s ease;
                    }
                    
                    .cn-theme-toggle-container .cn-theme-manage-btn:hover {
                        background: var(--bg-soft-hover, rgba(226, 232, 240, 0.9));
                        border-color: var(--border, rgba(148, 163, 184, 0.25));
                    }
                    
                    @keyframes cn-theme-spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    
                    @keyframes cn-theme-dropdown-fade-in {
                        from {
                            opacity: 0;
                            transform: translateY(-8px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                `;
                buttonContainer.appendChild(style);

                if (container) {
                    container.appendChild(buttonContainer);
                } else {
                    document.body.appendChild(buttonContainer);
                }

                bindEvents();
            }

            function bindEvents() {
                const toggleBtn = buttonContainer.querySelector('.cn-theme-toggle-btn');
                dropdownMenu = buttonContainer.querySelector('.cn-theme-dropdown');

                if (toggleBtn) {
                    toggleBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        e.preventDefault();

                        if (!showDropdown) {
                            await toggleTheme();
                        } else {
                            toggleDropdown();
                        }
                    });
                }

                if (dropdownMenu) {
                    dropdownMenu.querySelectorAll('.cn-theme-option').forEach(option => {
                        option.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const themeId = option.dataset.themeId;
                            await selectTheme(themeId);
                        });
                    });

                    const manageBtn = dropdownMenu.querySelector('.cn-theme-manage-btn');
                    if (manageBtn) {
                        manageBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            closeDropdown();
                            if (chrome.runtime && chrome.runtime.openOptionsPage) {
                                await chrome.runtime.openOptionsPage();
                            } else {
                                if (onError) {
                                    onError(new Error('无法打开设置页'));
                                }
                            }
                        });
                    }
                }

                document.addEventListener('click', (e) => {
                    if (isDropdownOpen && !buttonContainer.contains(e.target)) {
                        closeDropdown();
                    }
                });
            }

            function toggleDropdown() {
                if (!dropdownMenu) return;

                isDropdownOpen = !isDropdownOpen;
                const toggleBtn = buttonContainer.querySelector('.cn-theme-toggle-btn');

                if (isDropdownOpen) {
                    dropdownMenu.style.display = 'block';
                    toggleBtn.setAttribute('aria-expanded', 'true');
                } else {
                    dropdownMenu.style.display = 'none';
                    toggleBtn.setAttribute('aria-expanded', 'false');
                }
            }

            function closeDropdown() {
                if (dropdownMenu && isDropdownOpen) {
                    isDropdownOpen = false;
                    dropdownMenu.style.display = 'none';
                    const toggleBtn = buttonContainer.querySelector('.cn-theme-toggle-btn');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                }
            }

            async function toggleTheme() {
                const presets = ThemeCenter.getPresetThemes();
                const config = await ThemeCenter.getConfig();
                const currentIndex = presets.findIndex(t => t.id === config.currentTheme);
                const nextIndex = (currentIndex + 1) % presets.length;
                await selectTheme(presets[nextIndex].id);
            }

            async function selectTheme(themeId) {
                const toggleBtn = buttonContainer.querySelector('.cn-theme-toggle-btn');
                toggleBtn.classList.add('loading');
                toggleBtn.disabled = true;

                try {
                    const result = await ThemeCenter.applyTheme(themeId);

                    if (result.success) {
                        closeDropdown();
                        await render();

                        if (onThemeChange) {
                            onThemeChange({
                                themeId: themeId,
                                theme: result.theme
                            });
                        }
                    } else {
                        if (onError) {
                            onError(new Error(result.error || '主题切换失败'));
                        }
                    }
                } catch (error) {
                    console.error('[ThemeToggleButton] 切换主题失败:', error);
                    if (onError) {
                        onError(error);
                    }
                } finally {
                    toggleBtn.classList.remove('loading');
                    toggleBtn.disabled = false;
                }
            }

            function remove() {
                if (buttonContainer) {
                    buttonContainer.remove();
                    buttonContainer = null;
                }
            }

            return {
                render,
                remove,
                toggleTheme,
                closeDropdown
            };
        }
    };

    if (typeof window !== 'undefined') {
        window.ThemeCenter = ThemeCenter;
        window.ThemeCrypto = ThemeCrypto;
        window.ThemeStorage = ThemeStorage;
        window.ThemeRenderer = ThemeRenderer;
        window.ThemeToggleButton = ThemeToggleButton;
        window.PRESET_THEMES = PRESET_THEMES;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            ThemeCenter,
            ThemeCrypto,
            ThemeStorage,
            ThemeRenderer,
            ThemeToggleButton,
            PRESET_THEMES
        };
    }
})();
