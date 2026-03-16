/**
 * 共享生成状态控制器
 * 版本：1.0.47
 */

(function () {
    'use strict';

    function createAbortController() {
        if (typeof AbortController !== 'function') return null;
        return new AbortController();
    }

    function create(config = {}) {
        const getButton = typeof config.getButton === 'function'
            ? config.getButton
            : () => null;
        const getPlatform = typeof config.getPlatform === 'function'
            ? config.getPlatform
            : () => 'copy_only';
        const texts = config.texts && typeof config.texts === 'object' ? config.texts : {};
        const loadingClass = String(config.loadingClass || '').trim();

        let activeController = null;
        let activeRequestId = 0;

        function getIdleText() {
            const platform = String(getPlatform() || '');
            if (platform === 'direct_api') {
                return texts.directStartText || '开始生成';
            }
            return texts.defaultStartText || '执行操作';
        }

        function setButtonState({ text, disabled, loading }) {
            const button = getButton();
            if (!button) return;

            if (typeof text === 'string') {
                button.textContent = text;
            }
            if (typeof disabled === 'boolean') {
                button.disabled = disabled;
            }
            if (loadingClass) {
                if (loading) {
                    button.classList.add(loadingClass);
                } else {
                    button.classList.remove(loadingClass);
                }
            }
        }

        function abortCurrentController() {
            if (activeController && typeof activeController.abort === 'function') {
                activeController.abort();
            }
            activeController = null;
        }

        function resetButtonState() {
            setButtonState({
                text: getIdleText(),
                disabled: false,
                loading: false
            });
        }

        function syncButtonForPlatformChange() {
            const button = getButton();
            if (!button || button.disabled) return;
            resetButtonState();
        }

        function cancelActiveGeneration(options = {}) {
            activeRequestId += 1;
            abortCurrentController();
            resetButtonState();

            if (options.showHint && typeof options.onHint === 'function') {
                options.onHint();
            }
        }

        function startGeneration(options = {}) {
            abortCurrentController();
            activeRequestId += 1;
            const requestId = activeRequestId;
            activeController = createAbortController();

            const loadingText = options.loadingText || texts.loadingText || '生成中...';
            setButtonState({
                text: loadingText,
                disabled: true,
                loading: true
            });

            return {
                requestId,
                controller: activeController,
                signal: activeController ? activeController.signal : undefined
            };
        }

        function isCurrentRequest(requestId) {
            return requestId === activeRequestId;
        }

        function updateProgress(requestId, progressInfo = {}) {
            if (!isCurrentRequest(requestId)) return false;
            const charCount = Number(progressInfo.charCount || 0);
            let progressText = progressInfo.text || '';
            if (!progressText) {
                if (typeof texts.progressTextBuilder === 'function') {
                    progressText = texts.progressTextBuilder(charCount);
                } else {
                    progressText = `生成中（${charCount}字）...`;
                }
            }
            setButtonState({
                text: progressText,
                disabled: true,
                loading: true
            });
            return true;
        }

        function finishRequest(requestId, options = {}) {
            if (!isCurrentRequest(requestId)) return false;
            activeController = null;

            const state = options.state || 'retry';
            if (state === 'reset') {
                resetButtonState();
                return true;
            }

            const retryText = options.retryText || texts.retryText || '重新生成';
            setButtonState({
                text: retryText,
                disabled: false,
                loading: false
            });
            return true;
        }

        return {
            resetButtonState,
            syncButtonForPlatformChange,
            cancelActiveGeneration,
            startGeneration,
            isCurrentRequest,
            updateProgress,
            finishRequest
        };
    }

    window.NoteHelperGenerationController = {
        create
    };
})();
