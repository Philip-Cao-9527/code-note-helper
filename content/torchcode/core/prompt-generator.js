/**
 * TorchCode Prompt 生成入口
 * 版本：1.0.53
 */

(function () {
    'use strict';

    function getDeepMlGenerator() {
        const module = window.TorchCodeDeepMlPrompt;
        if (module && typeof module.generateDeepMlPrompt === 'function') {
            return module.generateDeepMlPrompt;
        }
        return null;
    }

    function getWorkspaceGenerator() {
        const module = window.TorchCodeWorkspacePrompt;
        if (module && typeof module.generateWorkspacePrompt === 'function') {
            return module.generateWorkspacePrompt;
        }
        return null;
    }

    function generatePrompt(data) {
        const normalized = data || {};
        const sourceType = String(normalized.sourceType || '').trim();
        const deepMlGenerator = getDeepMlGenerator();
        const workspaceGenerator = getWorkspaceGenerator();

        if (sourceType === 'deep-ml') {
            if (!deepMlGenerator) {
                console.error('[TorchCode] Deep-ML Prompt 模块未加载');
                return 'Deep-ML Prompt 模块未加载，请刷新页面后重试。';
            }
            return deepMlGenerator(normalized);
        }

        if (!workspaceGenerator) {
            console.error('[TorchCode] Workspace Prompt 模块未加载');
            return 'Workspace Prompt 模块未加载，请刷新页面后重试。';
        }
        return workspaceGenerator(normalized);
    }

    window.TorchCodePromptGenerator = {
        generatePrompt
    };
})();
