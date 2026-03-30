/**
 * TorchCode UI 模块
 * 版本：1.0.81
 */

(function () {
    'use strict';

    const AI_PLATFORMS = {
        copy_only: { name: '仅复制提示词', url: null },
        direct_api: { name: '直接调用接口生成', url: 'api' },
        claude: { name: '跳转 Claude', url: 'https://claude.ai/new' },
        chatgpt: { name: '跳转 ChatGPT', url: 'https://chatgpt.com/' },
        gemini: { name: '跳转 Gemini', url: 'https://gemini.google.com/app' },
        deepseek: { name: '跳转 DeepSeek', url: 'https://chat.deepseek.com/' }
    };

    const CAT_QUOTES = [
        '先别急着改大结构喵，先把每一层的 shape 对齐，很多问题到这里就现形了。',
        'loss 忽上忽下也没关系喵，先看学习率、数据范围和梯度是不是都正常。',
        '遇到 NaN 先深呼吸喵，优先检查输入范围、除零、softmax 前后的数值稳定。',
        '先拿一个超小 batch 跑通前向和反向喵，小样例通了，后面 usually 会顺很多。',
        '感觉模型没学到东西喵？先确认 train 和 eval 有没有切对，dropout 和 norm 很会藏细节。',
        '别一上来就怀疑人生喵，先打印中间张量的 shape、mean、max，线索往往就在里面。',
        '训练卡住的时候喵，与其盯着代码发呆，不如先看看报错栈和第一处异常输出。',
        '先让代码正确，再想提速喵；能稳定复现，已经比盲目优化强很多了。',
        '如果结果怪怪的喵，记得回头看看标签、mask 和 dtype，它们经常悄悄埋伏你。',
        '累了就歇一小会儿喵，回来再看一眼 forward 流程，常常一下子就通了。'
    ];

    const ICON_DRAG_LONG_PRESS_MS = 500;
    const ICON_DRAG_MOVE_THRESHOLD_PX = 12;
    const ICON_RATIO_PRECISION = 6;
    const STREAM_FLUSH_INTERVAL_MS = 60;
    const STREAM_FLUSH_MIN_CHUNK = 36;
    const STREAM_FLUSH_MAX_WAIT_MS = 450;
    const CAT_MEOW_TEXTS = ['喵！', '喵呜~', '(=^･ω･^=)', '呼噜呼噜', '喵喵'];

    const STORAGE_KEYS = {
        noteButton: `torchcode_note_button_pos_${window.location.hostname}`,
        coffeeButton: `torchcode_coffee_button_pos_${window.location.hostname}`,
        modalRect: `torchcode_modal_rect_${window.location.hostname}`,
        apiUrl: 'api_url',
        apiKey: 'api_key',
        apiModel: 'api_model'
    };

    let noteButton = null;
    let coffeeButton = null;
    let modal = null;
    let toast = null;
    let dialog = null;
    let currentContext = null;
    let lastAIResult = '';
    let lastAiResultIsError = false;
    let catCompanion = null;
    let uiVisible = true;
    let generationController = null;
    let isGenerating = false;
    let isPageScrollLocked = false;
    let htmlOverflowBeforeGeneration = '';
    let bodyOverflowBeforeGeneration = '';
    let currentStreamStatus = null;
    let activeOpenRequestId = 0;
    const buttonRelativePositionCache = Object.create(null);

    function shouldEnableCoffeeButton() {
        const host = String(window.location.hostname || '').toLowerCase();
        return host !== 'www.deep-ml.com' && host !== 'deep-ml.com';
    }

    function getStorageApi() {
        const api = window.Storage;
        if (api && typeof api.get === 'function' && typeof api.set === 'function') {
            return api;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return {
                async get(key, defaultValue = null) {
                    const result = await chrome.storage.local.get(key);
                    return result[key] !== undefined ? result[key] : defaultValue;
                },
                async set(key, value) {
                    await chrome.storage.local.set({ [key]: value });
                },
                async getMultiple(keys) {
                    return chrome.storage.local.get(keys);
                },
                async setMultiple(data) {
                    await chrome.storage.local.set(data);
                }
            };
        }

        return null;
    }

    async function getStorageValue(key, defaultValue = null) {
        const api = getStorageApi();
        if (!api) return defaultValue;
        try {
            return await api.get(key, defaultValue);
        } catch (error) {
            return defaultValue;
        }
    }

    async function setStorageValue(key, value) {
        const api = getStorageApi();
        if (!api) return;
        try {
            await api.set(key, value);
        } catch (error) {
            console.warn('[TorchCode] 写入存储失败：', key, error);
        }
    }

    async function setStorageValues(data) {
        const api = getStorageApi();
        if (!api) return;
        if (typeof api.setMultiple === 'function') {
            await api.setMultiple(data);
            return;
        }

        const entries = Object.entries(data || {});
        for (const [key, value] of entries) {
            await setStorageValue(key, value);
        }
    }

    function showToast(message, duration = 2500) {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        }
    }

    function setGeneratingState(generating) {
        isGenerating = Boolean(generating);
        const stopButton = document.getElementById('tc-stop-generate');
        if (stopButton) {
            stopButton.disabled = !isGenerating;
        }
    }

    function syncStopGenerateButtonVisibility() {
        const stopButton = document.getElementById('tc-stop-generate');
        if (!stopButton) return;
        stopButton.style.display = getCurrentAiPlatform() === 'direct_api' ? 'inline-flex' : 'none';
    }

    function lockPageScrollForGeneration() {
        if (isPageScrollLocked) return;
        isPageScrollLocked = true;
        htmlOverflowBeforeGeneration = document.documentElement ? document.documentElement.style.overflow : '';
        bodyOverflowBeforeGeneration = document.body ? document.body.style.overflow : '';
        if (document.documentElement) {
            document.documentElement.style.overflow = 'hidden';
        }
        if (document.body) {
            document.body.style.overflow = 'hidden';
        }
    }

    function unlockPageScrollForGeneration() {
        if (!isPageScrollLocked) return;
        if (document.documentElement) {
            document.documentElement.style.overflow = htmlOverflowBeforeGeneration;
        }
        if (document.body) {
            document.body.style.overflow = bodyOverflowBeforeGeneration;
        }
        htmlOverflowBeforeGeneration = '';
        bodyOverflowBeforeGeneration = '';
        isPageScrollLocked = false;
    }

    function scrollDialogToBottomAfterStop() {
        const container = dialog || document.getElementById('tc-dialog');
        if (!container) return;
        const targetTop = container.scrollHeight;
        if (typeof container.scrollTo === 'function') {
            container.scrollTo({
                top: targetTop,
                behavior: 'smooth'
            });
        } else {
            container.scrollTop = targetTop;
        }
    }

    function setStreamStatus(text, options = {}) {
        const statusElement = document.getElementById('tc-stream-status');
        if (!statusElement) return;
        const statusText = String(text || '').trim();
        statusElement.textContent = statusText;
        statusElement.style.display = statusText ? 'block' : 'none';
        statusElement.classList.toggle('is-error', Boolean(options.isError));
    }

    function resetThinkingPanel() {
        const details = document.getElementById('tc-thinking-details');
        const content = document.getElementById('tc-thinking-content');
        if (details) {
            details.hidden = true;
            details.open = false;
        }
        if (content) {
            content.textContent = '';
        }
    }

    function updateThinkingPanel(thinkingText) {
        const text = String(thinkingText || '');
        const details = document.getElementById('tc-thinking-details');
        const content = document.getElementById('tc-thinking-content');
        if (!details || !content) return;
        if (!text.trim()) {
            details.hidden = true;
            content.textContent = '';
            return;
        }
        details.hidden = false;
        content.textContent = text;
    }

    function initStreamStatusState() {
        currentStreamStatus = {
            startedAt: Date.now(),
            thoughtSeconds: 0,
            firstVisibleTokenAt: 0,
            hasVisibleToken: false
        };
        setStreamStatus('正在思考');
        resetThinkingPanel();
    }

    function markFirstVisibleTokenIfNeeded(text) {
        if (!currentStreamStatus || currentStreamStatus.hasVisibleToken) return;
        const normalized = String(text || '').trim();
        if (!normalized) return;
        currentStreamStatus.firstVisibleTokenAt = Date.now();
        currentStreamStatus.hasVisibleToken = true;
        currentStreamStatus.thoughtSeconds = Math.max(1, Math.ceil((currentStreamStatus.firstVisibleTokenAt - currentStreamStatus.startedAt) / 1000));
        setStreamStatus(`Thought for ${currentStreamStatus.thoughtSeconds} s`);
    }

    function getApiPermissionHelper() {
        return window.NoteHelperApiDomainPermission || null;
    }

    async function ensureApiDomainPermissionForUrl(apiUrl) {
        const helper = getApiPermissionHelper();
        if (!helper || typeof helper.ensureApiDomainPermission !== 'function') {
            return {
                ok: false,
                message: '权限模块未加载，请刷新后重试。'
            };
        }
        return helper.ensureApiDomainPermission(apiUrl, {
            requestIfMissing: true
        });
    }

    async function shouldConfirmOverwriteBeforeSave(text) {
        const store = getProblemDataStore();
        if (!store || typeof store.getProblemRecordByUrl !== 'function') return true;
        const helper = getApiPermissionHelper();

        let overwriteConfirmEnabled = true;
        if (helper && typeof helper.getOverwriteConfirmEnabled === 'function') {
            overwriteConfirmEnabled = await helper.getOverwriteConfirmEnabled(true);
        } else if (window.Storage && typeof window.Storage.get === 'function') {
            overwriteConfirmEnabled = await window.Storage.get('note_helper_overwrite_confirm_enabled', true);
        } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const data = await chrome.storage.local.get(['note_helper_overwrite_confirm_enabled']);
            overwriteConfirmEnabled = typeof data.note_helper_overwrite_confirm_enabled === 'boolean'
                ? data.note_helper_overwrite_confirm_enabled
                : true;
        }

        if (!overwriteConfirmEnabled) return true;

        const existingRecord = await store.getProblemRecordByUrl(window.location.href);
        const existingNote = String(existingRecord && existingRecord.noteContent || '').trim();
        if (!existingNote || existingNote === String(text || '').trim()) {
            return true;
        }

        const confirmed = window.confirm('将覆盖原有记录，是否继续');
        return confirmed;
    }

    async function copyToClipboard(text) {
        const utils = window.NoteHelperUtils;
        if (utils && typeof utils.copyToClipboard === 'function') {
            await utils.copyToClipboard(text);
            return;
        }
        await navigator.clipboard.writeText(text);
    }

    function getProblemDataStore() {
        return window.NoteHelperProblemData || null;
    }

    async function trackCurrentAction(actionType, extra = {}) {
        const store = getProblemDataStore();
        if (!store || typeof store.trackProblemAction !== 'function' || !currentContext) return null;

        try {
            return await store.trackProblemAction({
                url: window.location.href,
                title: currentContext.taskTitle,
                actionType,
                ...extra
            });
        } catch (error) {
            console.warn('[TorchCode] 记录动作失败：', error);
            return null;
        }
    }

    function getErrorMessages() {
        return window.NoteHelperErrorMessages || null;
    }

    function getReadableErrorMessage(error, fallbackMessage = '生成失败，请稍后重试。') {
        const helper = getErrorMessages();
        if (helper && typeof helper.normalizeError === 'function') {
            return helper.normalizeError(error, fallbackMessage).message;
        }
        return String(error && error.message ? error.message : error || fallbackMessage);
    }

    function getGenerationController() {
        if (generationController) return generationController;
        if (!window.NoteHelperGenerationController || typeof window.NoteHelperGenerationController.create !== 'function') {
            console.error('[TorchCode] 共享生成控制器未加载');
            return null;
        }

        generationController = window.NoteHelperGenerationController.create({
            getButton: () => document.getElementById('tc-generate-btn'),
            getPlatform: () => getCurrentAiPlatform(),
            loadingClass: 'btn-loading',
            texts: {
                directStartText: '⚡ 开始生成',
                defaultStartText: '🚀 执行操作',
                loadingText: '⏳ 生成中...',
                progressTextBuilder: (charCount) => `⏳ 已生成 ${charCount} 字...`,
                retryText: '重新生成'
            }
        });
        return generationController;
    }

    function isAbortError(error) {
        const helper = getErrorMessages();
        if (helper && typeof helper.isAbortError === 'function') {
            return helper.isAbortError(error);
        }
        return Boolean(error && (error.name === 'AbortError' || /已取消|aborted|abort/i.test(String(error.message || error))));
    }

    function resetGenerateButtonState() {
        const controller = getGenerationController();
        if (controller) {
            controller.resetButtonState();
            return;
        }
        const generateButton = document.getElementById('tc-generate-btn');
        if (!generateButton) return;
        generateButton.textContent = getCurrentAiPlatform() === 'direct_api' ? '⚡ 开始生成' : '🚀 执行操作';
        generateButton.disabled = false;
        delete generateButton.dataset.originalText;
    }

    function scrollResultToBottom(force = false) {
        const renderElement = document.getElementById('tc-result-render');
        if (!renderElement) return;
        if (force) {
            renderElement.scrollTop = renderElement.scrollHeight;
            return;
        }

        const distanceToBottom = renderElement.scrollHeight - renderElement.clientHeight - renderElement.scrollTop;
        if (distanceToBottom <= 60) {
            renderElement.scrollTop = renderElement.scrollHeight;
        }
    }

    function cancelActiveGeneration(options = {}) {
        const { showHint = false } = options;
        const controller = getGenerationController();
        if (controller) {
            controller.cancelActiveGeneration({
                showHint,
                onHint: () => showToast('已取消本次生成')
            });
            setGeneratingState(false);
            unlockPageScrollForGeneration();
            return;
        }

        if (showHint) {
            showToast('已取消本次生成');
        }
        resetGenerateButtonState();
        setGeneratingState(false);
        unlockPageScrollForGeneration();
    }

    function clearReferenceAnswerState() {
        const referenceElement = document.getElementById('tc-reference-answer');
        if (!referenceElement) return;
        referenceElement.value = '';
    }

    function setReferenceLoadingState() {
        const referenceElement = document.getElementById('tc-reference-answer');
        if (!referenceElement) return;
        referenceElement.value = '正在抓取中...';
    }

    function fillReferenceAnswer(context) {
        const referenceElement = document.getElementById('tc-reference-answer');
        if (!referenceElement) return;

        const merged = [];
        const pushUnique = (text) => {
            const content = String(text || '').trim();
            if (!content) return;
            const key = content.replace(/\s+/g, ' ').trim().toLowerCase();
            const duplicated = merged.some((item) => item.replace(/\s+/g, ' ').trim().toLowerCase() === key);
            if (!duplicated) {
                merged.push(content);
            }
        };

        pushUnique(context.referenceCode);
        if (context.solutionVisible) {
            pushUnique(context.solutionContent);
        }

        referenceElement.value = merged.join('\n\n');
    }

    function renderMarkdown(text) {
        const renderer = window.MarkdownRenderer && window.MarkdownRenderer.renderMarkdown;
        if (typeof renderer !== 'function') {
            return text;
        }
        try {
            return renderer(text || '');
        } catch (error) {
            return text;
        }
    }

    function getCurrentAiPlatform() {
        const platformElement = document.getElementById('tc-ai-platform');
        if (!platformElement) return 'copy_only';
        return platformElement.value || 'copy_only';
    }

    function updateResultContainerVisibility(forceShow = false) {
        const resultContainer = document.getElementById('tc-result-container');
        if (!resultContainer) return;

        const isDirectApi = getCurrentAiPlatform() === 'direct_api';
        if (!isDirectApi) {
            resultContainer.style.display = 'none';
            return;
        }

        const shouldShow = forceShow || Boolean(lastAIResult);
        resultContainer.style.display = shouldShow ? 'block' : 'none';
    }

    function showRenderedResult(text, options = {}) {
        const {
            forceShow = false,
            isError = false,
            renderAsPlainText = false,
            renderMode = ''
        } = options;

        lastAIResult = text || '';
        lastAiResultIsError = Boolean(isError);
        const finalRenderMode = renderMode || (renderAsPlainText ? 'stream' : 'markdown');

        const renderElement = document.getElementById('tc-result-render');
        const rawElement = document.getElementById('tc-result-raw');
        const saveButton = document.getElementById('tc-save-result');
        const copyButton = document.getElementById('tc-copy-result');

        updateResultContainerVisibility(forceShow);

        if (renderElement) {
            const helper = window.NoteHelperMarkdownStreamRender;
            if (helper && typeof helper.renderToElement === 'function') {
                helper.renderToElement(renderElement, lastAIResult || '', {
                    mode: finalRenderMode
                });
            } else {
                if (finalRenderMode === 'stream' || finalRenderMode === 'plain') {
                    renderElement.style.whiteSpace = 'pre-wrap';
                    renderElement.style.wordBreak = 'break-word';
                    renderElement.textContent = lastAIResult || '';
                } else {
                    renderElement.style.whiteSpace = '';
                    renderElement.style.wordBreak = '';
                    renderElement.innerHTML = renderMarkdown(lastAIResult || '');
                }
            }
        }

        if (rawElement) {
            rawElement.value = lastAIResult;
        }

        const disabled = !lastAIResult || lastAiResultIsError;
        if (saveButton) saveButton.disabled = disabled;
        if (copyButton) copyButton.disabled = disabled;
        scrollResultToBottom(forceShow || finalRenderMode === 'stream' || finalRenderMode === 'plain');
    }

    function highlightCopyResultButton() {
        const copyButton = document.getElementById('tc-copy-result');
        if (!copyButton) return;
        copyButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        copyButton.classList.add('tc-btn-highlight');
        setTimeout(() => {
            copyButton.classList.remove('tc-btn-highlight');
        }, 2200);
    }

    function ensureCatCompanion() {
        if (catCompanion) return catCompanion;
        if (!coffeeButton) return null;
        if (!window.NoteHelperCatCompanion || typeof window.NoteHelperCatCompanion.create !== 'function') {
            return null;
        }

        catCompanion = window.NoteHelperCatCompanion.create({
            triggerElement: coffeeButton,
            quotes: CAT_QUOTES,
            meowTexts: CAT_MEOW_TEXTS
        });
        return catCompanion;
    }

    function dismissCat() {
        if (!catCompanion) return;
        catCompanion.hide();
    }

    function summonCat() {
        const companion = ensureCatCompanion();
        if (!companion) {
            showToast('猫猫模块暂不可用，请刷新页面后重试');
            return;
        }
        companion.toggle();
    }

    function setUiVisible(visible) {
        uiVisible = Boolean(visible);

        if (noteButton) {
            noteButton.style.display = uiVisible ? 'flex' : 'none';
        }
        if (coffeeButton) {
            coffeeButton.style.display = uiVisible ? 'flex' : 'none';
        }
        if (catCompanion && typeof catCompanion.setVisible === 'function') {
            catCompanion.setVisible(uiVisible);
        }

        if (!uiVisible) {
            if (modal && modal.classList.contains('show')) {
                closeModal();
            }
            if (toast) {
                toast.classList.remove('show');
            }
            dismissCat();
            return;
        }

        const companion = ensureCatCompanion();
        if (companion && typeof companion.setVisible === 'function') {
            companion.setVisible(true);
        }
    }

    function getViewportBoundPosition(left, top, width, height) {
        const maxLeft = Math.max(0, window.innerWidth - width);
        const maxTop = Math.max(0, window.innerHeight - height);
        return {
            left: Math.min(Math.max(0, left), maxLeft),
            top: Math.min(Math.max(0, top), maxTop)
        };
    }

    function normalizeRatio(value) {
        if (!Number.isFinite(value)) return null;
        return Math.min(Math.max(value, 0), 1);
    }

    function toRelativeButtonPosition(left, top, button) {
        const bounded = getViewportBoundPosition(left, top, button.offsetWidth || 54, button.offsetHeight || 54);
        const maxLeft = Math.max(1, window.innerWidth - (button.offsetWidth || 54));
        const maxTop = Math.max(1, window.innerHeight - (button.offsetHeight || 54));

        return {
            xRatio: Number((bounded.left / maxLeft).toFixed(ICON_RATIO_PRECISION)),
            yRatio: Number((bounded.top / maxTop).toFixed(ICON_RATIO_PRECISION))
        };
    }

    function toAbsoluteButtonPosition(saved, button) {
        if (!saved || typeof saved !== 'object') return null;
        const xRatio = normalizeRatio(Number(saved.xRatio));
        const yRatio = normalizeRatio(Number(saved.yRatio));
        if (xRatio === null || yRatio === null) return null;

        const maxLeft = Math.max(0, window.innerWidth - (button.offsetWidth || 54));
        const maxTop = Math.max(0, window.innerHeight - (button.offsetHeight || 54));
        return {
            left: maxLeft * xRatio,
            top: maxTop * yRatio
        };
    }

    async function restoreButtonPosition(button, storageKey, fallback) {
        const saved = await getStorageValue(storageKey, null);
        if (!saved || typeof saved !== 'object') {
            const fallbackPosition = getViewportBoundPosition(
                fallback.left,
                fallback.top,
                button.offsetWidth || 54,
                button.offsetHeight || 54
            );
            button.style.left = `${fallbackPosition.left}px`;
            button.style.top = `${fallbackPosition.top}px`;
            const relative = toRelativeButtonPosition(fallbackPosition.left, fallbackPosition.top, button);
            buttonRelativePositionCache[storageKey] = relative;
            await setStorageValue(storageKey, relative);
            return;
        }

        const absoluteFromRatio = toAbsoluteButtonPosition(saved, button);
        if (absoluteFromRatio) {
            const bounded = getViewportBoundPosition(
                absoluteFromRatio.left,
                absoluteFromRatio.top,
                button.offsetWidth || 54,
                button.offsetHeight || 54
            );
            button.style.left = `${bounded.left}px`;
            button.style.top = `${bounded.top}px`;
            buttonRelativePositionCache[storageKey] = {
                xRatio: normalizeRatio(Number(saved.xRatio)),
                yRatio: normalizeRatio(Number(saved.yRatio))
            };
            return;
        }

        const left = Number(saved.left);
        const top = Number(saved.top);
        const bounded = getViewportBoundPosition(
            Number.isFinite(left) ? left : fallback.left,
            Number.isFinite(top) ? top : fallback.top,
            button.offsetWidth || 54,
            button.offsetHeight || 54
        );
        button.style.left = `${bounded.left}px`;
        button.style.top = `${bounded.top}px`;

        const relative = toRelativeButtonPosition(bounded.left, bounded.top, button);
        buttonRelativePositionCache[storageKey] = relative;
        await setStorageValue(storageKey, relative);
    }

    async function persistButtonPosition(button, storageKey) {
        const rect = button.getBoundingClientRect();
        const relative = toRelativeButtonPosition(rect.left, rect.top, button);
        buttonRelativePositionCache[storageKey] = relative;
        await setStorageValue(storageKey, relative);
    }

    function enableDraggableButton(button, storageKey, clickHandler) {
        let isPointerDown = false;
        let isDragging = false;
        let longPressTriggered = false;
        let shouldSuppressClick = false;
        let lastMouseupTriggerAt = 0;
        let pressTimer = null;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        function clearPressTimer() {
            if (!pressTimer) return;
            clearTimeout(pressTimer);
            pressTimer = null;
        }

        function clearDraggingState() {
            button.classList.remove('icon-drag-ready');
            button.classList.remove('icon-dragging');
            document.body.classList.remove('note-helper-icon-dragging');
        }

        button.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            isPointerDown = true;
            isDragging = false;
            longPressTriggered = false;
            shouldSuppressClick = false;
            startX = event.clientX;
            startY = event.clientY;
            startLeft = Number.parseFloat(button.style.left || '0');
            startTop = Number.parseFloat(button.style.top || '0');
            clearPressTimer();

            pressTimer = setTimeout(() => {
                if (!isPointerDown) return;
                longPressTriggered = true;
                button.classList.add('icon-drag-ready');
            }, ICON_DRAG_LONG_PRESS_MS);
        });

        document.addEventListener('mousemove', (event) => {
            if (!isPointerDown) return;

            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            const distance = Math.hypot(deltaX, deltaY);

            if (!isDragging) {
                if (!longPressTriggered || distance < ICON_DRAG_MOVE_THRESHOLD_PX) {
                    return;
                }
                isDragging = true;
                shouldSuppressClick = true;
                button.classList.remove('icon-drag-ready');
                button.classList.add('icon-dragging');
                document.body.classList.add('note-helper-icon-dragging');
            }

            event.preventDefault();
            const width = button.offsetWidth || 54;
            const height = button.offsetHeight || 54;
            const position = getViewportBoundPosition(startLeft + deltaX, startTop + deltaY, width, height);
            button.style.left = `${position.left}px`;
            button.style.top = `${position.top}px`;
            button.style.right = 'auto';
            button.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', async () => {
            if (!isPointerDown) return;

            isPointerDown = false;
            clearPressTimer();
            button.classList.remove('icon-drag-ready');

            if (isDragging) {
                isDragging = false;
                clearDraggingState();
                await persistButtonPosition(button, storageKey);
                setTimeout(() => {
                    shouldSuppressClick = false;
                }, 0);
                return;
            }

            if (typeof clickHandler === 'function') {
                lastMouseupTriggerAt = Date.now();
                clickHandler();
            }
        });

        window.addEventListener('blur', () => {
            isPointerDown = false;
            isDragging = false;
            longPressTriggered = false;
            clearPressTimer();
            clearDraggingState();
            lastMouseupTriggerAt = 0;
        });

        button.addEventListener('click', (event) => {
            if (shouldSuppressClick || isDragging) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            if (Date.now() - lastMouseupTriggerAt < 80) {
                return;
            }

            if (typeof clickHandler === 'function') {
                clickHandler();
            }
        });

        window.addEventListener('resize', () => {
            const relative = buttonRelativePositionCache[storageKey];
            const absoluteFromRatio = toAbsoluteButtonPosition(relative, button);
            if (absoluteFromRatio) {
                const bounded = getViewportBoundPosition(
                    absoluteFromRatio.left,
                    absoluteFromRatio.top,
                    button.offsetWidth || 54,
                    button.offsetHeight || 54
                );
                button.style.left = `${bounded.left}px`;
                button.style.top = `${bounded.top}px`;
                return;
            }

            const left = Number.parseFloat(button.style.left || '0');
            const top = Number.parseFloat(button.style.top || '0');
            const position = getViewportBoundPosition(
                left,
                top,
                button.offsetWidth || 54,
                button.offsetHeight || 54
            );
            button.style.left = `${position.left}px`;
            button.style.top = `${position.top}px`;
        });
    }

    async function restoreModalRect() {
        if (!dialog) return;

        const saved = await getStorageValue(STORAGE_KEYS.modalRect, null);
        dialog.style.transform = 'none';
        if (!saved || typeof saved !== 'object') {
            dialog.style.left = `${Math.max(20, (window.innerWidth - dialog.offsetWidth) / 2)}px`;
            dialog.style.top = `${Math.max(20, (window.innerHeight - dialog.offsetHeight) / 2)}px`;
            return;
        }

        const width = Number(saved.width);
        const height = Number(saved.height);
        const left = Number(saved.left);
        const top = Number(saved.top);

        const hasValidSize = Number.isFinite(width) && Number.isFinite(height) && width >= 320 && height >= 240;
        if (!hasValidSize) {
            dialog.style.left = `${Math.max(20, (window.innerWidth - dialog.offsetWidth) / 2)}px`;
            dialog.style.top = `${Math.max(20, (window.innerHeight - dialog.offsetHeight) / 2)}px`;
            return;
        }

        if (Number.isFinite(width) && width > 420) {
            dialog.style.width = `${Math.min(width, window.innerWidth - 24)}px`;
        }
        if (Number.isFinite(height) && height > 320) {
            dialog.style.height = `${Math.min(height, window.innerHeight - 24)}px`;
        }

        const rect = dialog.getBoundingClientRect();
        const position = getViewportBoundPosition(
            Number.isFinite(left) ? left : rect.left,
            Number.isFinite(top) ? top : rect.top,
            rect.width,
            rect.height
        );

        dialog.style.left = `${position.left}px`;
        dialog.style.top = `${position.top}px`;
    }

    async function persistModalRect() {
        if (!dialog) return;
        if (!modal || !modal.classList.contains('show')) return;
        const rect = dialog.getBoundingClientRect();
        if (rect.width < 320 || rect.height < 240) return;
        await setStorageValue(STORAGE_KEYS.modalRect, {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
    }

    function enableModalDragAndResize() {
        if (!dialog) return;

        const dragHandle = document.getElementById('tc-drag-handle');
        if (!dragHandle) return;

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        dragHandle.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
            const rect = dialog.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            document.body.classList.add('tc-dragging');
        });

        document.addEventListener('mousemove', (event) => {
            if (!dragging) return;
            event.preventDefault();

            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            const rect = dialog.getBoundingClientRect();
            const position = getViewportBoundPosition(startLeft + deltaX, startTop + deltaY, rect.width, rect.height);
            dialog.style.left = `${position.left}px`;
            dialog.style.top = `${position.top}px`;
        });

        document.addEventListener('mouseup', async () => {
            if (!dragging) return;
            dragging = false;
            document.body.classList.remove('tc-dragging');
            await persistModalRect();
        });

        let resizeTimer = null;
        const resizeObserver = new ResizeObserver(() => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                persistModalRect();
            }, 150);
        });
        resizeObserver.observe(dialog);
    }

    function buildLinksHtml(links) {
        const items = Object.entries(links || {})
            .filter(([, url]) => String(url || '').trim())
            .map(([label, url]) => `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`);
        return items.join(' · ');
    }

    function buildModalTemplate() {
        return `
            <div class="tc-dialog" id="tc-dialog">
                <h2 id="tc-drag-handle">📝 刷题笔记助手</h2>

                <div class="form-group">
                    <label for="tc-note-title">📌 笔记标题</label>
                    <input id="tc-note-title" type="text" placeholder="例如：数组中的第 K 个最大元素">
                </div>

                <div class="select-row-3">
                    <div class="form-group">
                        <label for="tc-heading-level">标题级别</label>
                        <select id="tc-heading-level">
                            <option value="###" selected>### (默认)</option>
                            <option value="##">## (二级)</option>
                            <option value="#"># (一级)</option>
                            <option value="####">#### (四级)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="tc-user-level">代码水平</label>
                        <select id="tc-user-level">
                            <option value="小白" selected>小白</option>
                            <option value="进阶选手">进阶选手</option>
                            <option value="熟练选手">熟练选手</option>
                            <option value="专家">专家</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="tc-ai-platform">生成prompt后操作</label>
                        <select id="tc-ai-platform">
                            <option value="copy_only">仅复制</option>
                            <option value="direct_api">⭐ 直接调用 API</option>
                            <option value="deepseek">跳转 DeepSeek</option>
                            <option value="claude">跳转 Claude</option>
                            <option value="chatgpt">跳转 ChatGPT</option>
                            <option value="gemini">跳转 Gemini</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label for="tc-note-mode">笔记模式</label>
                    <select id="tc-note-mode">
                        <option value="full_note">生成完整笔记</option>
                        <option value="qa_only">仅答疑</option>
                    </select>
                    <div style="font-size:12px;color:#666;margin-top:4px">💡 仅答疑会精简输出结构，优先快速回应你的问题</div>
                </div>

                <div class="form-group">
                    <label for="tc-manual-add-btn">添加题目</label>
                    <button class="btn btn-secondary" id="tc-manual-add-btn" type="button" style="width:100%;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,0.04)">➕ 添加题目</button>
                    <div style="font-size:12px;color:#666;margin-top:4px">将当前题目快速加入插件记录，无需先执行生成操作</div>
                </div>

                <div id="tc-api-settings" class="api-settings">
                    <div class="form-group">
                        <label for="tc-api-url">API Base URL (例如: https://api.openai.com/v1)</label>
                        <input id="tc-api-url" type="text" placeholder="https://api.openai.com/v1">
                        <div style="font-size:12px;color:#666;margin-top:4px">⚠️ 首次使用请确保API地址可访问</div>
                    </div>
                    <div class="select-row">
                        <div class="form-group" style="flex:2">
                            <label for="tc-api-key">API Key (sk-...)</label>
                            <input id="tc-api-key" type="password" placeholder="sk-...">
                        </div>
                        <div class="form-group" style="flex:1">
                            <label for="tc-api-model">Model Name</label>
                            <input id="tc-api-model" type="text" placeholder="gpt-4o">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="tc-reference-answer">参考答案（可选）</label>
                    <textarea id="tc-reference-answer" rows="6" placeholder="会自动填充页面可提取的参考实现，你也可以手动补充"></textarea>
                </div>

                <div class="form-group">
                    <label for="tc-notes">疑问 / 体会 (可选)</label>
                    <textarea id="tc-notes" rows="4" placeholder="写下你的疑惑，例如：梯度为什么会在这里衰减？"></textarea>
                </div>

                <div id="tc-result-container">
                    <div class="tc-result-header-inline">
                        <label style="font-weight:600;display:block;margin-bottom:8px">🤖 AI 生成结果</label>
                        <button class="btn btn-secondary" id="tc-stop-generate" type="button" style="display:none" disabled>停止生成</button>
                    </div>
                    <div id="tc-stream-status" class="tc-stream-status" style="display:none"></div>
                    <details id="tc-thinking-details" class="tc-thinking-details" hidden>
                        <summary>查看思考内容（实验性）</summary>
                        <pre id="tc-thinking-content"></pre>
                    </details>
                    <div id="tc-result-render"></div>
                    <textarea id="tc-result-raw" readonly style="display:none"></textarea>
                    <button class="btn btn-secondary" id="tc-copy-result" type="button" style="width:100%" disabled>复制结果</button>
                    <button class="btn btn-secondary" id="tc-save-result" type="button" style="width:100%;margin-top:8px" disabled>保存到本地记录</button>
                </div>

                <div style="display:none" aria-hidden="true">
                    <div id="tc-subtitle"></div>
                    <div id="tc-task-title"></div>
                    <div id="tc-task-meta"></div>
                    <div id="tc-task-links"></div>
                </div>

                <div class="btn-group">
                    <button class="btn btn-secondary" id="tc-close-footer" type="button">关闭</button>
                    <button class="btn btn-primary" id="tc-generate-btn" type="button">🚀 执行操作</button>
                </div>
            </div>
        `;
    }

    async function closeModal() {
        if (!modal) return;
        activeOpenRequestId += 1;
        cancelActiveGeneration({ showHint: false });
        await persistModalRect();
        modal.classList.remove('show');
        currentContext = null;
        setGeneratingState(false);
        setStreamStatus('');
        resetThinkingPanel();
        clearReferenceAnswerState();
        const notesElement = document.getElementById('tc-notes');
        if (notesElement) {
            notesElement.value = '';
        }
        showRenderedResult('', { forceShow: false, isError: false });
    }

    async function loadApiSettings() {
        const [apiUrl, apiKey, apiModel] = await Promise.all([
            getStorageValue(STORAGE_KEYS.apiUrl, 'https://api.openai.com/v1'),
            getStorageValue(STORAGE_KEYS.apiKey, ''),
            getStorageValue(STORAGE_KEYS.apiModel, 'gpt-4o')
        ]);

        const urlElement = document.getElementById('tc-api-url');
        const keyElement = document.getElementById('tc-api-key');
        const modelElement = document.getElementById('tc-api-model');
        const platformElement = document.getElementById('tc-ai-platform');

        if (urlElement) urlElement.value = apiUrl || 'https://api.openai.com/v1';
        if (keyElement) keyElement.value = apiKey || '';
        if (modelElement) modelElement.value = apiModel || 'gpt-4o';
        if (platformElement) {
            platformElement.value = 'copy_only';
        }

        updateApiSettingsVisibility();
    }
    function updateApiSettingsVisibility() {
        const platformElement = document.getElementById('tc-ai-platform');
        const apiSettingsElement = document.getElementById('tc-api-settings');
        if (!platformElement || !apiSettingsElement) return;
        const show = platformElement.value === 'direct_api';
        if (!show && isGenerating) {
            cancelActiveGeneration({ showHint: false });
        }
        apiSettingsElement.classList.toggle('show', show);
        if (!show) {
            setStreamStatus('');
            resetThinkingPanel();
            setGeneratingState(false);
        }
        syncStopGenerateButtonVisibility();
        const controller = getGenerationController();
        if (controller) {
            controller.syncButtonForPlatformChange();
        }
        updateResultContainerVisibility(false);
    }

    function renderContext(context) {
        currentContext = context;

        const taskTitleElement = document.getElementById('tc-task-title');
        const taskMetaElement = document.getElementById('tc-task-meta');
        const subtitleElement = document.getElementById('tc-subtitle');
        const linksElement = document.getElementById('tc-task-links');
        const noteTitleElement = document.getElementById('tc-note-title');
        const referenceElement = document.getElementById('tc-reference-answer');
        const notesElement = document.getElementById('tc-notes');
        const userLevelElement = document.getElementById('tc-user-level');
        const noteModeElement = document.getElementById('tc-note-mode');

        if (taskTitleElement) {
            taskTitleElement.textContent = context.taskTitle || '未识别练习';
        }

        if (taskMetaElement) {
            taskMetaElement.textContent = [
                context.difficulty || '未标注难度',
                context.sourceLabel || 'TorchCode'
            ].filter(Boolean).join(' · ');
        }

        if (subtitleElement) {
            subtitleElement.textContent = '已读取当前练习内容，可直接生成复盘笔记。';
        }

        if (linksElement) {
            linksElement.innerHTML = buildLinksHtml(context.links || {});
        }

        if (noteTitleElement) {
            noteTitleElement.value = `${context.taskTitle || 'TorchCode'} 深度学习笔记`;
        }

        if (userLevelElement) {
            userLevelElement.value = '小白';
        }

        if (noteModeElement) {
            noteModeElement.value = 'full_note';
        }

        fillReferenceAnswer(context);

        if (notesElement) {
            notesElement.value = '';
        }

        if (context.sourceType === 'deep-ml') {
            const snippetCount = Number(context.solutionSnippetCount || 0);

            if (context.solutionVisible && snippetCount > 0) {
                const message = context.solutionAutoSwitched
                    ? `已自动切换到 Solution 并抓取到 ${snippetCount} 个题解，可直接生成笔记。`
                    : `已抓取到 ${snippetCount} 个题解，可直接生成笔记。`;
                if (subtitleElement) {
                    subtitleElement.textContent = message;
                }
                showToast(`已抓取到 ${snippetCount} 个题解`, 2800);
            } else if (context.solutionStatus === 'need_solution_tab') {
                const message = '请先点击「Solution」按钮进入参考题解页面，并确认题解完整显示后再重新打开笔记助手。';
                if (subtitleElement) {
                    subtitleElement.textContent = message;
                }
                if (referenceElement) {
                    referenceElement.value = '未抓取到题解。请先点击「Solution」按钮进入参考题解页面，并确认题解已完整显示后再重新打开笔记助手。';
                }
                showToast(message, 4200);
            } else if (context.solutionStatus === 'gate_closed') {
                const message = '还没显示题解，请先点击「Solution」按钮进入参考题解页面，再点击「View solution」并确认弹窗。';
                if (subtitleElement) {
                    subtitleElement.textContent = message;
                }
                if (referenceElement) {
                    referenceElement.value = '未抓取到题解。请先点击「Solution」按钮进入参考题解页面，再点击「View solution」并确认弹窗，让题解完整显示后再重试。';
                }
                showToast(message, 4200);
            } else {
                const message = '未抓取到题解，请确认题解区域已完整展开后再重试。';
                if (subtitleElement) {
                    subtitleElement.textContent = message;
                }
                if (referenceElement && !referenceElement.value.trim()) {
                    referenceElement.value = '未抓取到题解。请确认题解已完整显示后再重新打开笔记助手。';
                }
                showToast(message, 3600);
            }
        }

        showRenderedResult('', { forceShow: false, isError: false });
    }

    async function openModal() {
        const router = window.TorchCodeSiteRouter;
        if (!router || typeof router.getCurrentAdapter !== 'function') {
            showToast('页面尚未准备好，请刷新后重试');
            return;
        }

        const adapter = router.getCurrentAdapter();
        if (!adapter || typeof adapter.collectPageData !== 'function') {
            showToast('当前页面暂不支持深度学习笔记');
            return;
        }

        if (!window.TorchCodeNotebookUtils || typeof window.TorchCodeNotebookUtils.buildPromptContext !== 'function') {
            showToast('页面内容读取能力暂不可用，请刷新后重试');
            return;
        }

        if (!modal) {
            createModal();
        }

        const requestId = ++activeOpenRequestId;
        cancelActiveGeneration({ showHint: false });
        modal.classList.add('show');
        await restoreModalRect();

        document.getElementById('tc-subtitle').textContent = '正在读取页面内容...';
        document.getElementById('tc-task-title').textContent = '读取中...';
        document.getElementById('tc-task-meta').textContent = '-';
        document.getElementById('tc-task-links').innerHTML = '';
        currentContext = null;
        setReferenceLoadingState();
        resetGenerateButtonState();
        setGeneratingState(false);
        setStreamStatus('');
        resetThinkingPanel();
        showRenderedResult('', { forceShow: false, isError: false });

        try {
            await loadApiSettings();
            if (requestId !== activeOpenRequestId || !modal.classList.contains('show')) return;
            const pageData = await adapter.collectPageData();
            if (requestId !== activeOpenRequestId || !modal.classList.contains('show')) return;
            const context = window.TorchCodeNotebookUtils.buildPromptContext(pageData);
            renderContext(context);
        } catch (error) {
            if (requestId !== activeOpenRequestId || !modal.classList.contains('show')) return;
            console.error('[TorchCode] 打开弹窗失败：', error);
            document.getElementById('tc-subtitle').textContent = error.message || '读取失败';
            document.getElementById('tc-task-title').textContent = '读取失败';
            const referenceElement = document.getElementById('tc-reference-answer');
            if (referenceElement) {
                referenceElement.value = '抓取失败，请刷新页面后重试。';
            }
            showToast(error.message || '读取失败，请刷新页面后重试', 3200);
        }
    }

    async function jumpToPlatform(platformUrl) {
        if (window.Messaging && typeof window.Messaging.openTab === 'function') {
            await window.Messaging.openTab(platformUrl, true);
            return;
        }
        window.open(platformUrl, '_blank', 'noopener,noreferrer');
    }

    async function callAIWithOptimizedStreaming(apiUrl, apiKey, apiModel, prompt, onProgress, options = {}) {
        if (!window.ApiClient || typeof window.ApiClient.callAI !== 'function') {
            throw new Error('AI 生成功能暂不可用，请刷新页面后重试');
        }

        const externalSignal = options && options.signal;
        if (externalSignal && externalSignal.aborted) {
            const abortError = new Error('API 调用已取消');
            abortError.name = 'AbortError';
            throw abortError;
        }

        let latestPartial = '';
        let lastRendered = '';
        let lastFlushTime = Date.now();
        let flushTimer = null;
        const onThinkingProgress = typeof options.onThinkingProgress === 'function'
            ? options.onThinkingProgress
            : null;

        const flush = (force = false) => {
            if (typeof onProgress !== 'function') return;
            if (!latestPartial) return;
            if (!force) {
                const chunkSize = latestPartial.length - lastRendered.length;
                const elapsed = Date.now() - lastFlushTime;
                const isFirstChunk = !lastRendered && latestPartial.length > 0;
                if (!isFirstChunk && chunkSize < STREAM_FLUSH_MIN_CHUNK && elapsed < STREAM_FLUSH_MAX_WAIT_MS) {
                    return;
                }
            }
            if (latestPartial === lastRendered) return;
            lastRendered = latestPartial;
            lastFlushTime = Date.now();
            onProgress(latestPartial);
        };

        const scheduleFlush = () => {
            if (flushTimer) return;
            flushTimer = setTimeout(() => {
                flushTimer = null;
                flush(false);
            }, STREAM_FLUSH_INTERVAL_MS);
        };

        const requestPromise = window.ApiClient.callAI(apiUrl, apiKey, apiModel, prompt, (partial) => {
            latestPartial = String(partial || '');
            scheduleFlush();
        }, {
            signal: externalSignal,
            onThinkingProgress
        });

        try {
            const result = await requestPromise;
            latestPartial = String(result || latestPartial || '');
            flush(true);
            return latestPartial;
        } finally {
            if (flushTimer) {
                clearTimeout(flushTimer);
                flushTimer = null;
            }
        }
    }

    async function handleGenerate() {
        const noteTitle = document.getElementById('tc-note-title').value.trim();
        const headingLevel = document.getElementById('tc-heading-level').value;
        const userLevel = document.getElementById('tc-user-level').value;
        const noteMode = document.getElementById('tc-note-mode').value;
        const aiPlatform = document.getElementById('tc-ai-platform').value;
        const referenceAnswer = document.getElementById('tc-reference-answer').value.trim();
        const notes = document.getElementById('tc-notes').value.trim();
        const apiUrl = document.getElementById('tc-api-url').value.trim();
        const apiKey = document.getElementById('tc-api-key').value.trim();
        const apiModel = document.getElementById('tc-api-model').value.trim() || 'gpt-4o';

        if (!currentContext) {
            showToast('当前还没有读取到页面内容');
            return;
        }

        if (!noteTitle) {
            showToast('请先填写笔记标题');
            document.getElementById('tc-note-title').focus();
            return;
        }

        if (!window.TorchCodePromptGenerator || typeof window.TorchCodePromptGenerator.generatePrompt !== 'function') {
            showToast('笔记生成功能尚未就绪，请刷新后重试');
            return;
        }

        const prompt = window.TorchCodePromptGenerator.generatePrompt({
            ...currentContext,
            noteTitle,
            headingLevel,
            userLevel,
            noteMode,
            referenceCode: referenceAnswer || currentContext.referenceCode || '',
            notes
        });

        try {
            await copyToClipboard(prompt);
            await trackCurrentAction('prompt_copied');
        } catch (error) {
            console.error('[TorchCode] 复制提示词失败：', error);
            showToast('复制提示词失败，请稍后重试');
            return;
        }

        if (aiPlatform !== 'direct_api') {
            showRenderedResult('', { forceShow: false, isError: false });
            const platform = AI_PLATFORMS[aiPlatform];
            if (platform && platform.url) {
                showToast('提示词已复制，正在打开目标页面...');
                await jumpToPlatform(platform.url);
                await closeModal();
                return;
            }
            showToast('提示词已复制');
            await closeModal();
            return;
        }

        if (!apiUrl || !apiKey) {
            showToast('请先填写接口地址和密钥');
            if (!apiUrl) {
                const input = document.getElementById('tc-api-url');
                if (input) input.focus();
            } else {
                const input = document.getElementById('tc-api-key');
                if (input) input.focus();
            }
            return;
        }

        const permissionResult = await ensureApiDomainPermissionForUrl(apiUrl);
        if (!permissionResult.ok) {
            showToast(permissionResult.message || '未授予该 API 域名的网络访问权限，无法使用该接口。', 3600);
            return;
        }

        if (!window.ApiClient || typeof window.ApiClient.callAI !== 'function') {
            showToast('AI 生成功能暂不可用，请刷新后重试');
            return;
        }

        await setStorageValues({
            [STORAGE_KEYS.apiUrl]: apiUrl,
            [STORAGE_KEYS.apiKey]: apiKey,
            [STORAGE_KEYS.apiModel]: apiModel
        });

        const generateCtrl = getGenerationController();
        if (!generateCtrl) {
            showToast('插件加载异常，请刷新页面后重试');
            return;
        }

        const generationState = generateCtrl.startGeneration();
        const requestId = generationState.requestId;
        let finalState = 'reset';
        setGeneratingState(true);
        lockPageScrollForGeneration();
        initStreamStatusState();

        showRenderedResult('', {
            forceShow: true,
            isError: false,
            renderMode: 'stream'
        });

        try {
            const result = await callAIWithOptimizedStreaming(apiUrl, apiKey, apiModel, prompt, (partial) => {
                if (!generateCtrl.isCurrentRequest(requestId)) return;
                const partialText = String(partial || '');
                generateCtrl.updateProgress(requestId, {
                    charCount: partialText.length
                });
                markFirstVisibleTokenIfNeeded(partialText);
                showRenderedResult(partialText, {
                    forceShow: true,
                    isError: false,
                    renderMode: 'stream'
                });
            }, {
                signal: generationState.signal,
                onThinkingProgress: (thinkingText) => {
                    if (!generateCtrl.isCurrentRequest(requestId)) return;
                    updateThinkingPanel(thinkingText);
                }
            });
            if (!generateCtrl.isCurrentRequest(requestId)) return;
            markFirstVisibleTokenIfNeeded(result);
            showRenderedResult(result, {
                forceShow: true,
                isError: false,
                renderMode: 'markdown'
            });
            await trackCurrentAction('note_generated');
            setTimeout(() => highlightCopyResultButton(), 120);
            showToast('笔记已生成，可以复制或保存');
            finalState = 'retry';
        } catch (error) {
            if (!generateCtrl.isCurrentRequest(requestId)) return;
            if (isAbortError(error)) {
                setStreamStatus('已停止生成');
                if (!currentStreamStatus || !currentStreamStatus.hasVisibleToken) {
                    showRenderedResult('', {
                        forceShow: false,
                        isError: false,
                        renderMode: 'plain'
                    });
                }
                finalState = currentStreamStatus && currentStreamStatus.hasVisibleToken ? 'retry' : 'reset';
            } else {
                const errorMessage = getReadableErrorMessage(error, '生成失败，请稍后重试。');
                console.error('[TorchCode] 生成失败：', error);
                setStreamStatus('生成失败', { isError: true });
                showRenderedResult(`生成失败：${errorMessage}`, {
                    forceShow: true,
                    isError: true,
                    renderMode: 'plain'
                });
                showToast(`生成失败：${errorMessage}`, 4200);
                finalState = 'retry';
            }
        } finally {
            generateCtrl.finishRequest(requestId, {
                state: finalState,
                retryText: '重新生成'
            });
            setGeneratingState(false);
            unlockPageScrollForGeneration();
            currentStreamStatus = null;
        }
    }

    async function handleSaveResult() {
        if (!lastAIResult) {
            showToast('当前没有可保存内容');
            return;
        }

        const store = getProblemDataStore();
        if (!store || typeof store.saveProblemNote !== 'function' || !currentContext) {
            showToast('本地记录暂不可用，请稍后再试');
            return;
        }

        try {
            const allowOverwrite = await shouldConfirmOverwriteBeforeSave(lastAIResult);
            if (!allowOverwrite) {
                showToast('已取消保存');
                return;
            }
            await store.saveProblemNote({
                url: window.location.href,
                title: currentContext.taskTitle,
                noteContent: lastAIResult
            });
            showToast('已保存到本地记录');
        } catch (error) {
            console.error('[TorchCode] 保存失败：', error);
            showToast('保存失败，请稍后重试');
        }
    }

    async function handleCopyResult() {
        if (!lastAIResult) return;
        try {
            await copyToClipboard(lastAIResult);
            await trackCurrentAction('result_copied');
            showToast('结果已复制');
        } catch (error) {
            console.error('[TorchCode] 复制结果失败：', error);
            showToast('复制失败，请稍后重试');
        }
    }

    async function handleManualAdd() {
        if (!currentContext) {
            showToast('当前还没有读取到页面内容');
            return;
        }
        const actionResult = await trackCurrentAction('manual_added');
        if (actionResult) {
            showToast('✅ 当前题目已加入记录', 2600);
        } else {
            showToast('⚠️ 当前页面暂不支持添加题目记录', 2800);
        }
    }

    function createModal() {
        modal = document.createElement('div');
        modal.id = 'torchcode-note-helper-modal';
        modal.className = 'tc-modal';
        modal.innerHTML = buildModalTemplate();
        document.body.appendChild(modal);

        dialog = document.getElementById('tc-dialog');
        enableModalDragAndResize();

        document.getElementById('tc-close-footer').addEventListener('click', closeModal);
        document.getElementById('tc-generate-btn').addEventListener('click', handleGenerate);
        document.getElementById('tc-copy-result').addEventListener('click', handleCopyResult);
        document.getElementById('tc-save-result').addEventListener('click', handleSaveResult);
        document.getElementById('tc-manual-add-btn').addEventListener('click', handleManualAdd);
        const stopButton = document.getElementById('tc-stop-generate');
        if (stopButton) {
            stopButton.addEventListener('click', () => {
                const hasVisibleToken = Boolean(currentStreamStatus && currentStreamStatus.hasVisibleToken);
                cancelActiveGeneration({ showHint: true });
                if (hasVisibleToken) {
                    const generateButton = document.getElementById('tc-generate-btn');
                    if (generateButton) {
                        generateButton.textContent = '重新生成';
                        generateButton.disabled = false;
                        generateButton.classList.remove('btn-loading');
                    }
                }
                setStreamStatus('已停止生成');
                requestAnimationFrame(() => scrollDialogToBottomAfterStop());
            });
        }
        document.getElementById('tc-ai-platform').addEventListener('change', () => {
            updateApiSettingsVisibility();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal && modal.classList.contains('show')) {
                closeModal();
            }
        });
    }

    function createToast() {
        toast = document.createElement('div');
        toast.id = 'torchcode-note-helper-toast';
        toast.className = 'tc-toast';
        document.body.appendChild(toast);
    }

    async function createFloatingButtons() {
        noteButton = document.createElement('button');
        noteButton.id = 'torchcode-note-helper-btn';
        noteButton.className = 'tc-floating-btn';
        noteButton.type = 'button';
        noteButton.textContent = '📝';
        noteButton.title = '点击生成深度学习笔记';

        document.body.appendChild(noteButton);

        await restoreButtonPosition(noteButton, STORAGE_KEYS.noteButton, {
            left: Math.max(16, window.innerWidth - 84),
            top: Math.max(16, window.innerHeight - 92)
        });

        enableDraggableButton(noteButton, STORAGE_KEYS.noteButton, openModal);

        if (shouldEnableCoffeeButton()) {
            coffeeButton = document.createElement('button');
            coffeeButton.id = 'torchcode-note-helper-coffee-btn';
            coffeeButton.className = 'tc-floating-btn tc-coffee-btn';
            coffeeButton.type = 'button';
            coffeeButton.textContent = '☕';
            coffeeButton.title = '累了？喝杯咖啡再继续';
            document.body.appendChild(coffeeButton);

            await restoreButtonPosition(coffeeButton, STORAGE_KEYS.coffeeButton, {
                left: Math.max(16, window.innerWidth - 84),
                top: Math.max(16, window.innerHeight - 156)
            });

            enableDraggableButton(coffeeButton, STORAGE_KEYS.coffeeButton, () => summonCat());
            ensureCatCompanion();
        } else {
            coffeeButton = null;
        }
    }

    async function init() {
        const existingNoteButton = document.getElementById('torchcode-note-helper-btn');
        if (existingNoteButton) {
            noteButton = existingNoteButton;
            coffeeButton = document.getElementById('torchcode-note-helper-coffee-btn');
            if (!shouldEnableCoffeeButton() && coffeeButton) {
                coffeeButton.remove();
                coffeeButton = null;
                if (catCompanion && typeof catCompanion.hide === 'function') {
                    catCompanion.hide();
                }
            }
            toast = document.getElementById('torchcode-note-helper-toast');
            ensureCatCompanion();
            setUiVisible(true);
            return;
        }

        createToast();
        await createFloatingButtons();
        setUiVisible(true);
    }

    window.TorchCodeUI = {
        init,
        setVisible: setUiVisible
    };
})();


