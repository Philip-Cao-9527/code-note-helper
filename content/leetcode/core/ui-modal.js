/**
 * LeetCode 笔记助手 UI 模块
 * 版本：1.0.80
 */

(function () {
    'use strict';

    // AI 平台配置 - 精简版（6个选项）
    const AI_PLATFORMS = {
        'copy_only': { name: '仅复制 Prompt', url: null },
        'direct_api': { name: '⭐ 直接调用 API 生成', url: 'api' },
        // 国际平台
        'claude': { name: '跳转 Claude', url: 'https://claude.ai/new' },
        'chatgpt': { name: '跳转 ChatGPT', url: 'https://chatgpt.com/' },
        'gemini': { name: '跳转 Gemini', url: 'https://gemini.google.com/app' },
        // DeepSeek
        'deepseek': { name: '跳转 DeepSeek', url: 'https://chat.deepseek.com/' }
    };

    let btn = null;
    let toast = null;
    let modal = null;
    let achievementOverlay = null;
    let lastAIResult = "";
    let lastAiResultIsError = false;
    let generationController = null;
    let hasWarnedMissingRecommendationHelper = false;
    let hasWarnedStorageUnavailable = false;
    let hasWarnedProblemDataUnavailable = false;
    let submissionObserver = null;
    let submissionRouteHooked = false;
    let submitIntentCaptureBound = false;
    const trackedSubmissionCache = new Set();
    const trackingSubmissionInFlight = new Set();
    const submitIntentMemoryCache = new Map();

    const ICON_DRAG_LONG_PRESS_MS = 500;
    const ICON_DRAG_MOVE_THRESHOLD_PX = 12;
    const ICON_POSITION_KEY_PREFIX = 'note_helper_icon_pos_';
    const ICON_RATIO_PRECISION = 6;
    const iconRelativePositionCache = Object.create(null);

    // === 辅助函数 ===
    function showToast(msg, duration = 3000) {
        if (!toast) return;
        toast.innerText = msg;
        toast.style.display = 'block';
        if (duration > 0) {
            setTimeout(() => toast.style.display = 'none', duration);
        }
    }

    function hideAchievementOverlay() {
        if (!achievementOverlay) return;
        achievementOverlay.classList.remove('show');
        achievementOverlay.setAttribute('aria-hidden', 'true');
    }

    function triggerFireworkBurst() {
        if (!achievementOverlay) return;
        const fireworks = achievementOverlay.querySelectorAll('.nh-firework');
        fireworks.forEach((firework) => {
            firework.classList.remove('burst');
            // 通过强制回流重启动画，保证每次庆祝都只触发一次且可见。
            void firework.offsetWidth;
            firework.classList.add('burst');
        });
    }

    function ensureAchievementOverlay() {
        if (achievementOverlay) return achievementOverlay;
        achievementOverlay = document.createElement('div');
        achievementOverlay.id = 'note-helper-achievement-overlay';
        achievementOverlay.setAttribute('aria-hidden', 'true');
        achievementOverlay.innerHTML = `
            <div class="nh-achievement-dialog" role="dialog" aria-modal="true" aria-labelledby="nh-achievement-title">
                <button class="nh-achievement-close" type="button" id="nh-achievement-close">关闭</button>
                <div class="nh-achievement-fireworks" aria-hidden="true">
                    <span class="nh-firework fw-1"></span>
                    <span class="nh-firework fw-2"></span>
                    <span class="nh-firework fw-3"></span>
                    <span class="nh-firework fw-4"></span>
                </div>
                <div class="nh-achievement-headline">题单完成成就</div>
                <h3 id="nh-achievement-title" class="nh-achievement-title">恭喜你完成了新的题单</h3>
                <div class="nh-achievement-subtitle">本次完成题单</div>
                <ul class="nh-achievement-list" id="nh-achievement-list"></ul>
            </div>
        `;
        document.body.appendChild(achievementOverlay);

        const closeButton = achievementOverlay.querySelector('#nh-achievement-close');
        if (closeButton) {
            closeButton.addEventListener('click', hideAchievementOverlay);
        }
        achievementOverlay.addEventListener('click', (event) => {
            if (event.target === achievementOverlay) {
                hideAchievementOverlay();
            }
        });
        return achievementOverlay;
    }

    function showListCompletionCelebration(completedLists) {
        if (!Array.isArray(completedLists) || !completedLists.length) return;
        const overlay = ensureAchievementOverlay();
        const listElement = overlay.querySelector('#nh-achievement-list');
        const titleElement = overlay.querySelector('#nh-achievement-title');
        const closeButton = overlay.querySelector('#nh-achievement-close');
        if (!listElement || !titleElement) return;

        const count = completedLists.length;
        titleElement.textContent = count > 1
            ? `一次点亮 ${count} 份题单，继续保持这个节奏。`
            : '你刚刚完成了 1 份题单，做得很稳。';

        listElement.innerHTML = '';
        completedLists.forEach((item) => {
            const title = String(item && item.title || '').trim() || '未命名题单';
            const progress = Number(item && item.completed || 0);
            const total = Number(item && item.total || 0);
            const listItem = document.createElement('li');
            const titleNode = document.createElement('span');
            const progressNode = document.createElement('span');

            titleNode.className = 'list-name';
            titleNode.textContent = title;
            progressNode.className = 'list-progress';
            progressNode.textContent = `${progress}/${total}`;

            listItem.appendChild(titleNode);
            listItem.appendChild(progressNode);
            listElement.appendChild(listItem);
        });

        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        if (closeButton) {
            closeButton.focus();
        }
        triggerFireworkBurst();
    }

    function maybeCelebrateFromActionResult(actionResult) {
        const payload = actionResult && actionResult.celebration;
        const completedLists = payload && Array.isArray(payload.completedLists) ? payload.completedLists : [];
        if (!payload || payload.triggered !== true || !completedLists.length) return;
        showListCompletionCelebration(completedLists);
    }

    function getSiteRouter() {
        if (!window.NoteHelperSiteRouter) {
            console.error('[Note Helper] 错误: SiteRouter 模块未加载');
            return null;
        }
        return window.NoteHelperSiteRouter;
    }

    function getRecommendationHelper() {
        const helper = window.NoteHelperRecommendation;
        if (!helper && !hasWarnedMissingRecommendationHelper) {
            console.warn('[Note Helper] Recommendation 模块未加载，将沿用原有题解顺序');
            hasWarnedMissingRecommendationHelper = true;
        }
        return helper;
    }



    function getStorageApi() {
        const storageApi = window.Storage;
        const available = storageApi &&
            typeof storageApi.get === 'function' &&
            typeof storageApi.set === 'function';

        if (!available && !hasWarnedStorageUnavailable) {
            console.warn('[Note Helper] Storage 模块不可用，图标位置将仅在当前页面生效');
            hasWarnedStorageUnavailable = true;
        }
        return available ? storageApi : null;
    }

    function getProblemDataStore() {
        const store = window.NoteHelperProblemData;
        const available = store &&
            typeof store.trackProblemAction === 'function' &&
            typeof store.saveProblemNote === 'function';

        if (!available && !hasWarnedProblemDataUnavailable) {
            console.warn('[Note Helper] ProblemData 模块不可用，题目行为记录将降级');
            hasWarnedProblemDataUnavailable = true;
        }
        return available ? store : null;
    }

    function getCurrentProblemRecordTitle() {
        if (!modal) return '';
        return modal.dataset.problemTitle ||
            document.getElementById('p-note-title')?.value.trim() ||
            '';
    }

    async function trackCurrentProblemAction(actionType, extraData = {}) {
        const store = getProblemDataStore();
        if (!store) return null;

        try {
            const actionResult = await store.trackProblemAction({
                url: window.location.href,
                title: getCurrentProblemRecordTitle(),
                actionType,
                ...extraData
            });
            maybeCelebrateFromActionResult(actionResult);
            return actionResult;
        } catch (e) {
            console.warn('[Note Helper] 记录题目行为失败:', actionType, e);
            return null;
        }
    }

    function getSubmissionIdentity() {
        const identity = getProblemIdentity(window.location.pathname);
        if (!identity || !identity.submissionId) return null;
        return identity;
    }

    function getProblemIdentity(pathname = window.location.pathname) {
        const host = String(window.location.hostname || '').toLowerCase();
        if (!host.includes('leetcode.cn') && !host.includes('leetcode.com')) return null;
        const normalizedPath = String(pathname || '');
        const match = normalizedPath.match(/\/problems\/([^\/?#]+)(?:\/submissions\/(\d+))?/i);
        if (!match) return null;
        return {
            host,
            slug: match[1],
            submissionId: match[2] || ''
        };
    }

    function buildSubmissionTrackKey(identity) {
        if (!identity) return '';
        return `${identity.host}:${identity.slug}:${identity.submissionId}`;
    }

    function buildSubmitIntentKey(identity) {
        if (!identity) return '';
        return `${identity.host}:${identity.slug}`;
    }

    function readSubmitIntent(intentKey) {
        if (!intentKey) return null;
        const cached = submitIntentMemoryCache.get(intentKey);
        if (cached) return { ...cached };
        try {
            const raw = sessionStorage.getItem(`note_helper_submit_intent_${intentKey}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            submitIntentMemoryCache.set(intentKey, parsed);
            return { ...parsed };
        } catch (error) {
            return null;
        }
    }

    function writeSubmitIntent(intentKey, payload) {
        if (!intentKey || !payload || typeof payload !== 'object') return;
        submitIntentMemoryCache.set(intentKey, { ...payload });
        try {
            sessionStorage.setItem(`note_helper_submit_intent_${intentKey}`, JSON.stringify(payload));
        } catch (error) {
            // sessionStorage 在隐私模式下可能不可写，降级为内存缓存。
        }
    }

    function clearSubmitIntent(intentKey) {
        if (!intentKey) return;
        submitIntentMemoryCache.delete(intentKey);
        try {
            sessionStorage.removeItem(`note_helper_submit_intent_${intentKey}`);
        } catch (error) {
            // 忽略会话存储删除失败，仅保留内存删除结果。
        }
    }

    function isSubmitButtonElement(target) {
        if (!target || typeof target.closest !== 'function') return false;
        const button = target.closest('button,[role="button"]');
        if (!button) return false;
        const text = String(button.textContent || '').replace(/\s+/g, '').trim();
        const ariaLabel = String(button.getAttribute('aria-label') || '').replace(/\s+/g, '').trim();
        const title = String(button.getAttribute('title') || '').replace(/\s+/g, '').trim();
        const locator = String(button.getAttribute('data-e2e-locator') || '').toLowerCase();
        if (/^(提交|submit)$/i.test(text) || /^(提交|submit)$/i.test(ariaLabel) || /^(提交|submit)$/i.test(title)) {
            return true;
        }
        if (locator === 'console-submit-button') {
            return true;
        }
        return false;
    }

    function markSubmitIntent(trigger = 'submit_click') {
        const identity = getProblemIdentity(window.location.pathname);
        if (!identity || identity.submissionId) return;
        const intentKey = buildSubmitIntentKey(identity);
        if (!intentKey) return;
        writeSubmitIntent(intentKey, {
            host: identity.host,
            slug: identity.slug,
            submissionId: '',
            sourceUrl: window.location.href,
            trigger,
            createdAt: Date.now()
        });
    }

    function resolveSubmitIntentForSubmission(identity) {
        const intentKey = buildSubmitIntentKey(identity);
        if (!intentKey) return { allowed: false, intentKey: '', justBound: false };
        const intent = readSubmitIntent(intentKey);
        if (!intent) return { allowed: false, intentKey, justBound: false };
        if (intent.submissionId && String(intent.submissionId) !== String(identity.submissionId)) {
            return { allowed: false, intentKey, justBound: false };
        }
        let justBound = false;
        if (!intent.submissionId) {
            intent.submissionId = identity.submissionId;
            writeSubmitIntent(intentKey, intent);
            justBound = true;
        }
        return { allowed: true, intentKey, justBound };
    }

    function hasTrackedSubmission(trackKey) {
        if (!trackKey) return false;
        if (trackedSubmissionCache.has(trackKey)) return true;
        try {
            return sessionStorage.getItem(`note_helper_submission_passed_${trackKey}`) === '1';
        } catch (error) {
            return false;
        }
    }

    function markSubmissionTracked(trackKey) {
        if (!trackKey) return;
        trackedSubmissionCache.add(trackKey);
        try {
            sessionStorage.setItem(`note_helper_submission_passed_${trackKey}`, '1');
        } catch (error) {
            // sessionStorage 在隐私模式下可能不可写，降级为内存去重。
        }
    }

    function extractSubmissionProblemTitle(slug) {
        const selectors = [
            'div.text-title-large a',
            '.text-title-large',
            '[data-cy="question-title"]',
            'div[data-track-load="title"] a'
        ];
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (!element) continue;
            const title = String(element.textContent || '').trim().replace(/^\d+\.\s*/, '');
            if (title) return title;
        }
        const rawTitle = String(document.title || '').trim();
        if (rawTitle) {
            const normalized = rawTitle
                .replace(/\s*[-|｜]\s*LeetCode.*$/i, '')
                .replace(/^\d+\.\s*/, '')
                .trim();
            if (normalized) return normalized;
        }
        return String(slug || '').trim();
    }

    function getSubmissionResultText() {
        const candidates = [
            '[data-e2e-locator="submission-result"]',
            '[data-testid="submission-result"]',
            '.text-green-s'
        ];
        for (const selector of candidates) {
            const node = document.querySelector(selector);
            if (!node) continue;
            const text = String(node.textContent || '').trim();
            if (text) return text;
        }
        return '';
    }

    function isSubmissionPassedResultVisible() {
        const resultText = getSubmissionResultText();
        if (/^(通过|Accepted)$/i.test(resultText)) {
            return true;
        }
        return false;
    }

    async function tryTrackPassedSubmission(trigger = 'observer') {
        const identity = getSubmissionIdentity();
        if (!identity) return false;
        const intentState = resolveSubmitIntentForSubmission(identity);
        if (!intentState.allowed) return false;
        if (intentState.justBound && trigger === 'route') return false;

        const trackKey = buildSubmissionTrackKey(identity);
        if (!trackKey || hasTrackedSubmission(trackKey)) {
            clearSubmitIntent(intentState.intentKey);
            return false;
        }
        if (trackingSubmissionInFlight.has(trackKey)) return false;
        if (!isSubmissionPassedResultVisible()) {
            const resultText = getSubmissionResultText();
            if (resultText && !/^(通过|Accepted)$/i.test(resultText)) {
                clearSubmitIntent(intentState.intentKey);
            }
            return false;
        }

        trackingSubmissionInFlight.add(trackKey);
        try {
            const actionResult = await trackCurrentProblemAction('submission_passed', {
                title: extractSubmissionProblemTitle(identity.slug),
                submissionId: identity.submissionId,
                trigger
            });

            if (!actionResult) return false;
            markSubmissionTracked(trackKey);
            clearSubmitIntent(intentState.intentKey);
            showToast('✅ 检测到提交通过，已自动加入题目记录', 3200);
            return true;
        } finally {
            trackingSubmissionInFlight.delete(trackKey);
        }
    }

    function bindSubmitIntentCapture() {
        if (submitIntentCaptureBound) return;
        submitIntentCaptureBound = true;
        document.addEventListener('click', (event) => {
            if (!isSubmitButtonElement(event.target)) return;
            markSubmitIntent('submit_click');
        }, true);
    }

    function ensureSubmissionPassedAutoTrack() {
        const host = String(window.location.hostname || '').toLowerCase();
        if (!host.includes('leetcode.cn') && !host.includes('leetcode.com')) return;
        bindSubmitIntentCapture();

        if (!submissionObserver) {
            submissionObserver = new MutationObserver(() => {
                void tryTrackPassedSubmission('mutation');
            });
            const observeTarget = document.body || document.documentElement;
            if (observeTarget) {
                submissionObserver.observe(observeTarget, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }
        }

        if (!submissionRouteHooked) {
            submissionRouteHooked = true;
            const scheduleCheck = () => {
                void tryTrackPassedSubmission('route');
            };
            window.addEventListener('popstate', scheduleCheck);
            const originalPushState = history.pushState;
            history.pushState = function patchedPushState(...args) {
                const result = originalPushState.apply(this, args);
                scheduleCheck();
                return result;
            };
            const originalReplaceState = history.replaceState;
            history.replaceState = function patchedReplaceState(...args) {
                const result = originalReplaceState.apply(this, args);
                scheduleCheck();
                return result;
            };
        }

        void tryTrackPassedSubmission('init');
    }

    function toggleSaveResultButton(disabled) {
        const button = document.getElementById('btn-save-result');
        if (!button) return;
        button.disabled = Boolean(disabled);
    }

    function getErrorMessages() {
        return window.NoteHelperErrorMessages || null;
    }

    function getReadableErrorMessage(error, fallbackMessage = '生成失败，请稍后重试。') {
        const helper = getErrorMessages();
        if (helper && typeof helper.normalizeError === 'function') {
            return helper.normalizeError(error, fallbackMessage).message;
        }
        if (error && error.message) {
            return String(error.message);
        }
        return fallbackMessage;
    }

    function getGenerationController() {
        if (generationController) return generationController;
        if (!window.NoteHelperGenerationController || typeof window.NoteHelperGenerationController.create !== 'function') {
            console.error('[Note Helper] 错误: 共享生成控制器未加载');
            return null;
        }

        generationController = window.NoteHelperGenerationController.create({
            getButton: () => document.getElementById('btn-generate'),
            getPlatform: () => document.getElementById('p-ai-platform')?.value || 'copy_only',
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
        const generateButton = document.getElementById('btn-generate');
        if (!generateButton) return;
        generateButton.innerText = document.getElementById('p-ai-platform')?.value === 'direct_api' ? '⚡ 开始生成' : '🚀 执行操作';
        generateButton.disabled = false;
        generateButton.classList.remove('btn-loading');
    }

    function syncGenerateButtonForPlatformChange() {
        const controller = getGenerationController();
        if (controller) {
            controller.syncButtonForPlatformChange();
            return;
        }
        resetGenerateButtonState();
    }

    function cancelActiveGeneration(options = {}) {
        const showHint = Boolean(options.showHint);
        const controller = getGenerationController();
        if (controller) {
            controller.cancelActiveGeneration({
                showHint,
                onHint: () => {
                    if (modal && modal.style.display === 'block') {
                        showToast('已取消本次生成');
                    }
                }
            });
            return;
        }

        if (showHint && modal && modal.style.display === 'block') {
            showToast("已取消本次生成");
        }
        resetGenerateButtonState();
    }

    function closeModalAndReset() {
        cancelActiveGeneration({ showHint: false });
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function getIconPositionKey(iconType) {
        return `${ICON_POSITION_KEY_PREFIX}${window.location.hostname}_${iconType}`;
    }

    function clampIconPosition(left, top, element) {
        const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - element.offsetHeight);
        return {
            left: Math.min(Math.max(0, left), maxLeft),
            top: Math.min(Math.max(0, top), maxTop)
        };
    }

    function normalizeRatio(value) {
        if (!Number.isFinite(value)) return null;
        return Math.min(Math.max(value, 0), 1);
    }

    function toRelativeIconPosition(left, top, element) {
        const clamped = clampIconPosition(left, top, element);
        const maxLeft = Math.max(1, window.innerWidth - element.offsetWidth);
        const maxTop = Math.max(1, window.innerHeight - element.offsetHeight);
        return {
            xRatio: Number((clamped.left / maxLeft).toFixed(ICON_RATIO_PRECISION)),
            yRatio: Number((clamped.top / maxTop).toFixed(ICON_RATIO_PRECISION))
        };
    }

    function toAbsoluteIconPosition(relative, element) {
        if (!relative || typeof relative !== 'object') return null;
        const xRatio = normalizeRatio(Number(relative.xRatio));
        const yRatio = normalizeRatio(Number(relative.yRatio));
        if (xRatio === null || yRatio === null) return null;

        const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - element.offsetHeight);
        return {
            left: maxLeft * xRatio,
            top: maxTop * yRatio
        };
    }

    function applyIconPosition(element, position) {
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.left = `${position.left}px`;
        element.style.top = `${position.top}px`;
    }

    async function loadSavedIconPosition(element, iconType) {
        const storageApi = getStorageApi();
        if (!storageApi) return;

        try {
            const saved = await storageApi.get(getIconPositionKey(iconType), null);
            if (!saved || typeof saved !== 'object') return;
            let relativePosition = null;
            let shouldRewrite = false;

            // v1.0.39 起优先使用相对位置
            const absoluteFromRatio = toAbsoluteIconPosition(saved, element);
            if (absoluteFromRatio) {
                relativePosition = {
                    xRatio: normalizeRatio(Number(saved.xRatio)),
                    yRatio: normalizeRatio(Number(saved.yRatio))
                };
                applyIconPosition(element, clampIconPosition(absoluteFromRatio.left, absoluteFromRatio.top, element));
            } else {
                // 兼容旧版本绝对像素位置，读取后自动迁移为相对位置
                const left = Number(saved.left);
                const top = Number(saved.top);
                if (!Number.isFinite(left) || !Number.isFinite(top)) return;
                const clamped = clampIconPosition(left, top, element);
                applyIconPosition(element, clamped);
                relativePosition = toRelativeIconPosition(clamped.left, clamped.top, element);
                shouldRewrite = true;
            }

            iconRelativePositionCache[iconType] = relativePosition;

            if (shouldRewrite && relativePosition) {
                await storageApi.set(getIconPositionKey(iconType), relativePosition);
            }
        } catch (e) {
            console.warn('[Note Helper] 读取图标位置失败:', iconType, e);
        }
    }

    async function saveIconPosition(element, iconType) {
        const rect = element.getBoundingClientRect();
        const relativePosition = toRelativeIconPosition(rect.left, rect.top, element);
        iconRelativePositionCache[iconType] = relativePosition;

        const storageApi = getStorageApi();
        if (!storageApi) return;

        try {
            await storageApi.set(getIconPositionKey(iconType), relativePosition);
        } catch (e) {
            console.warn('[Note Helper] 保存图标位置失败:', iconType, e);
        }
    }

    async function keepIconInViewportOnResize(element, iconType) {
        const relativePosition = iconRelativePositionCache[iconType];
        const absolutePosition = toAbsoluteIconPosition(relativePosition, element);

        if (absolutePosition) {
            applyIconPosition(element, clampIconPosition(absolutePosition.left, absolutePosition.top, element));
            return;
        }

        // 兜底：若缓存缺失但已有绝对位置，仍做边界修正
        if (!element.style.left || !element.style.top) return;
        const left = Number.parseFloat(element.style.left);
        const top = Number.parseFloat(element.style.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;
        applyIconPosition(element, clampIconPosition(left, top, element));
        await saveIconPosition(element, iconType);
    }

    function enableLongPressDrag(element, iconType, onClick) {
        if (!element || typeof onClick !== 'function') return;

        let isPointerDown = false;
        let isDragging = false;
        let longPressTriggered = false;
        let shouldSuppressClick = false;
        let pressTimer = null;
        let startX = 0;
        let startY = 0;
        let startRect = null;

        const clearPressTimer = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        const clearDraggingState = () => {
            element.classList.remove('icon-drag-ready');
            element.classList.remove('icon-dragging');
            document.body.classList.remove('note-helper-icon-dragging');
        };

        element.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isPointerDown = true;
            isDragging = false;
            longPressTriggered = false;
            shouldSuppressClick = false;
            startX = e.clientX;
            startY = e.clientY;
            startRect = element.getBoundingClientRect();
            clearPressTimer();

            pressTimer = setTimeout(() => {
                if (isPointerDown) {
                    longPressTriggered = true;
                    element.classList.add('icon-drag-ready');
                }
            }, ICON_DRAG_LONG_PRESS_MS);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPointerDown) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const moveDistance = Math.hypot(deltaX, deltaY);

            if (!isDragging) {
                if (!longPressTriggered || moveDistance < ICON_DRAG_MOVE_THRESHOLD_PX) {
                    return;
                }
                isDragging = true;
                shouldSuppressClick = true;
                element.classList.remove('icon-drag-ready');
                element.classList.add('icon-dragging');
                document.body.classList.add('note-helper-icon-dragging');
                applyIconPosition(element, { left: startRect.left, top: startRect.top });
            }

            e.preventDefault();
            const clamped = clampIconPosition(startRect.left + deltaX, startRect.top + deltaY, element);
            applyIconPosition(element, clamped);
        });

        document.addEventListener('mouseup', async () => {
            if (!isPointerDown) return;

            isPointerDown = false;
            clearPressTimer();
            element.classList.remove('icon-drag-ready');

            if (isDragging) {
                isDragging = false;
                clearDraggingState();
                await saveIconPosition(element, iconType);
                setTimeout(() => {
                    shouldSuppressClick = false;
                }, 0);
            }
        });

        window.addEventListener('blur', () => {
            isPointerDown = false;
            isDragging = false;
            longPressTriggered = false;
            clearPressTimer();
            clearDraggingState();
        });

        element.addEventListener('click', (e) => {
            if (shouldSuppressClick || isDragging) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            onClick(e);
        });
    }

    function extractMarkdown(el) {
        if (!el) return "";
        let html = el.innerHTML;
        html = html.replace(/<div[^>]*>/gi, '\n').replace(/<\/div>/gi, '');
        let text = html
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n### $1\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n#### $1\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n##### $1\n')
            .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n###### $1\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
            .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
            .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<ul[^>]*>/gi, '\n').replace(/<\/ul>/gi, '\n')
            .replace(/<ol[^>]*>/gi, '\n').replace(/<\/ol>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');
        return text.split('\n').map(line => line.trim()).filter(line => line).join('\n');
    }

    function showRenderedResult(text, options = {}) {
        const {
            isError = false,
            renderMode = 'markdown'
        } = options;

        lastAIResult = text || '';
        lastAiResultIsError = Boolean(isError);
        const renderEl = document.getElementById('api-output-render');
        const rawEl = document.getElementById('api-output');
        const canSaveResult = lastAIResult &&
            lastAIResult !== '正在连接 AI...' &&
            !lastAiResultIsError;

        if (renderEl) {
            const helper = window.NoteHelperMarkdownStreamRender;
            if (helper && typeof helper.renderToElement === 'function') {
                helper.renderToElement(renderEl, text || '', {
                    mode: renderMode
                });
            } else {
                const renderer = window.MarkdownRenderer && window.MarkdownRenderer.renderMarkdown;
                if (renderMode === 'stream' || renderMode === 'plain') {
                    renderEl.style.whiteSpace = 'pre-wrap';
                    renderEl.style.wordBreak = 'break-word';
                    renderEl.textContent = text || '';
                } else if (typeof renderer === 'function') {
                    try {
                        renderEl.style.whiteSpace = '';
                        renderEl.style.wordBreak = '';
                        renderEl.innerHTML = renderer(text || '');
                    } catch (e) {
                        console.warn('Markdown 渲染失败:', e);
                        renderEl.textContent = text || '';
                    }
                } else {
                    renderEl.style.whiteSpace = '';
                    renderEl.style.wordBreak = '';
                    renderEl.textContent = text || '';
                }
            }
        }
        if (rawEl) rawEl.value = text || '';
        toggleSaveResultButton(!canSaveResult);
    }

    // === 猫猫彩蛋语料（23条，防止连续重复） ===
    const CAT_QUOTES = [
        "休息一下喵～灵感会自己跳出来",
        "休息一下吧，CPU 都降频了，你也要歇歇。",
        "喝口水，你的大脑需要液冷散热~ 💧",
        "先别急喵～慢慢来，猫猫陪你",
        "猫猫建议：休息一下喵，效率会更高喵！",
        "你是最棒的工程师，不仅能修 Bug，还能照顾自己。",
        "暂存一下心情，git commit -m '休息一会'",
        "即使是猫猫此时此刻也在想：这个人类真努力呀~",
        "先休息喵～等电量满格再开刷！ ⚡️",
        "即使报错 99 次，第 100 次就是胜利喵！",
        "脑袋冒烟了？先冷却 5 分钟喵",
        "复杂度？先跑起来再说，优化是以后的事~",
        "别急，连 Linux 内核都有 Bug，你不孤单。",
        "今天的 WA 是明天 AC 的垫脚石",
        "先放过自己喵～等心情好点再刷喵！",
        "你已经很棒了，给自己一个 star ⭐",
        "猫猫看出来你累了喵，先休息一下喵！",
        "不想动脑喵？猫猫允许你先休息一下喵！",
        "每一行代码都是对未来的投资 📈",
        "算法虐我千百遍，我待算法如初恋 💕",
        "不想刷题喵？那就先摸摸猫猫，心情回满再继续喵~ 🐾",
        "Bug 修不完没关系，头发还在就是胜利 🎉"
    ];
    function init() {
        ensureSubmissionPassedAutoTrack();
        if (document.getElementById('note-helper-btn')) return;

        // 创建按钮
        btn = document.createElement('div');
        btn.id = 'note-helper-btn';
        btn.innerText = '📝';
        btn.title = "点击生成刷题笔记 Prompt";
        document.body.appendChild(btn);

        // 创建 Toast
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);

        // === 猫猫彩蛋（共享组件） ===
        const catBtn = document.createElement('div');
        catBtn.id = 'cat-summon-btn';
        catBtn.innerText = '☕';
        catBtn.title = '累了？召唤猫猫陪你~';
        document.body.appendChild(catBtn);

        loadSavedIconPosition(btn, 'note');
        loadSavedIconPosition(catBtn, 'cat');

        window.addEventListener('resize', () => {
            keepIconInViewportOnResize(btn, 'note');
            keepIconInViewportOnResize(catBtn, 'cat');
        });

        const sharedCatCompanion = window.NoteHelperCatCompanion &&
            typeof window.NoteHelperCatCompanion.create === 'function'
            ? window.NoteHelperCatCompanion.create({
                triggerElement: catBtn,
                quotes: CAT_QUOTES
            })
            : null;

        const summonCat = () => {
            if (!sharedCatCompanion) {
                showToast('猫猫模块暂不可用，请刷新页面后重试');
                return;
            }
            sharedCatCompanion.toggle();
        };

        // === 创建弹窗 ===
        modal = document.createElement('div');
        modal.id = 'note-helper-modal';

        modal.innerHTML = `
        <h2>📝 刷题笔记助手</h2>
        <div class="form-group">
            <label for="p-note-title">📌 笔记标题</label>
            <input type="text" id="p-note-title" placeholder="例如：两数之和 - 哈希表解法">
        </div>
        
        <div class="select-row-3">
            <div class="form-group">
                <label for="p-level">标题级别</label>
                <select id="p-level">
                    <option value="###">### (默认)</option>
                    <option value="##">## (二级)</option>
                    <option value="#"># (一级)</option>
                    <option value="####">#### (四级)</option>
                </select>
            </div>
            <div class="form-group">
                <label for="p-user-level">代码水平</label>
                <select id="p-user-level">
                    <option value="小白">小白</option>
                    <option value="进阶选手">进阶选手</option>
                    <option value="熟练选手">熟练选手</option>
                    <option value="专家">专家</option>
                </select>
            </div>
            <div class="form-group">
                <label for="p-ai-platform">生成prompt后操作</label>
                <select id="p-ai-platform">
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
            <label for="p-note-mode">笔记模式</label>
            <select id="p-note-mode">
                <option value="full_note">生成完整笔记</option>
                <option value="qa_only">仅答疑</option>
            </select>
            <div style="font-size:12px;color:#666;margin-top:4px">💡 仅答疑会精简输出结构，优先快速回应你的问题</div>
        </div>

        <div class="form-group">
            <label for="btn-manual-add">添加题目</label>
            <button class="btn btn-secondary" id="btn-manual-add" type="button" style="width:100%;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,0.04)">➕ 添加题目</button>
            <div style="font-size:12px;color:#666;margin-top:4px">将当前题目快速加入插件记录，无需先执行生成操作</div>
        </div>

        <div id="api-settings-panel" class="api-settings">
            <div class="form-group">
                <label for="api-url">API Base URL (例如: https://api.openai.com/v1)</label>
                <input type="text" id="api-url" placeholder="https://api.openai.com/v1">
                <div style="font-size:12px;color:#666;margin-top:4px">⚠️ 首次使用请确保API地址可访问</div>
            </div>
            <div class="select-row">
                <div class="form-group" style="flex:2">
                    <label for="api-key">API Key (sk-...)</label>
                    <input type="password" id="api-key" placeholder="sk-...">
                </div>
                <div class="form-group" style="flex:1">
                    <label for="api-model">Model Name</label>
                    <input type="text" id="api-model" placeholder="gpt-4o" value="gpt-4o">
                </div>
            </div>
        </div>

        <div class="form-group">
            <label>🔗 自定义题解URL (可选，最多2个)</label>
            <div style="display:flex;gap:8px;margin-bottom:6px;">
                <span style="min-width:50px;line-height:32px;color:#666;font-size:13px;">URL 1:</span>
                <input type="text" id="p-custom-url-1" placeholder="粘贴 LeetCode 题解链接" style="flex:1">
            </div>
            <div style="display:flex;gap:8px;margin-bottom:6px;">
                <span style="min-width:50px;line-height:32px;color:#666;font-size:13px;">URL 2:</span>
                <input type="text" id="p-custom-url-2" placeholder="粘贴第二个题解链接 (可选)" style="flex:1">
            </div>
            <div style="display:flex;justify-content:flex-end;">
                <button class="btn btn-secondary" id="btn-fetch-custom" style="white-space:nowrap;">📥 抓取自定义题解</button>
            </div>
            <div style="font-size:12px;color:#666;margin-top:4px">💡 支持力扣中国站和美国站的题解链接，抓取后会追加到下方参考答案中</div>
        </div>

        <div class="form-group">
            <label for="p-official">参考答案（可选）</label>
            <textarea id="p-official" rows="4" placeholder="如果留空，AI 会基于你的原题解生成优化方案。"></textarea>
        </div>
        <div class="form-group">
            <label for="p-feeling">疑问 / 体会 (可选)</label>
            <textarea id="p-feeling" rows="2" placeholder="写下你的疑惑..."></textarea>
        </div>

        <div id="api-result-container">
            <label style="font-weight:600;display:block;margin-bottom:8px">🤖 AI 生成结果</label>
            <div id="api-output-render"></div>
            <textarea id="api-output" readonly></textarea>
            <button class="btn btn-secondary" id="btn-copy-result" style="width:100%">复制结果</button>
            <button class="btn btn-secondary" id="btn-save-result" style="width:100%;margin-top:8px" disabled>保存到本地记录</button>
        </div>

        <div class="btn-group">
            <button class="btn btn-secondary" id="btn-close">关闭</button>
            <button class="btn btn-primary" id="btn-generate">🚀 执行操作</button>
        </div>
    `;
        document.body.appendChild(modal);

        // === 拖拽功能 ===
        (function enableDrag() {
            const header = modal.querySelector('h2');
            let isDragging = false, offsetX = 0, offsetY = 0;

            header.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
                isDragging = true;
                modal.classList.add('dragging');
                const rect = modal.getBoundingClientRect();
                modal.style.transform = 'none';
                modal.style.left = rect.left + 'px';
                modal.style.top = rect.top + 'px';
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                let newLeft = e.clientX - offsetX;
                let newTop = e.clientY - offsetY;
                newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - modal.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, window.innerHeight - modal.offsetHeight));
                modal.style.left = newLeft + 'px';
                modal.style.top = newTop + 'px';
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
                modal.classList.remove('dragging');
            });
        })();

        // Escape 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (achievementOverlay && achievementOverlay.classList.contains('show')) {
                e.preventDefault();
                hideAchievementOverlay();
                return;
            }
            if (modal.style.display === 'block') {
                closeModalAndReset();
            }
        });

        // === 事件绑定 ===
        const toggleApiSettings = () => {
            const platform = document.getElementById('p-ai-platform').value;
            const panel = document.getElementById('api-settings-panel');
            if (platform === 'direct_api') {
                panel.classList.add('show');
            } else {
                panel.classList.remove('show');
            }
            syncGenerateButtonForPlatformChange();
        };

        document.getElementById('p-ai-platform').onchange = toggleApiSettings;

        const openModal = async () => {
            cancelActiveGeneration({ showHint: false });
            const router = getSiteRouter();
            if (!router) {
                alert('插件加载异常，请刷新页面重试');
                return;
            }
            const adapter = router.getCurrentAdapter();
            if (!adapter || !adapter.config) return alert("当前网站暂不支持。");
            const conf = adapter.config;

            modal.style.display = 'block';
            document.getElementById('p-official').value = "⏳ 正在获取参考题解...";

            let contentText = "";
            try {
                // 优先使用站点 adapter 的专用提取方法（如 CodeFun2000）
                if (typeof adapter.getProblemContent === 'function') {
                    contentText = adapter.getProblemContent();
                } else {
                    const contentEl = document.querySelector(conf.content);
                    if (contentEl) contentText = extractMarkdown(contentEl);
                }
            } catch (e) {
                console.warn('提取题目内容失败:', e);
            }

            let userCode = "";
            try {
                // 通过 Messaging 获取 Monaco 代码
                const result = await Messaging.getMonacoCode();
                if (result && result.success && result.code) {
                    userCode = result.code;
                }
            } catch (e) {
                console.warn('获取 Monaco 代码失败:', e);
            }

            // 自动获取页面标题
            let autoTitle = '';
            if (typeof adapter.getProblemTitle === 'function') {
                autoTitle = adapter.getProblemTitle();
                console.log('[CodeNote Helper] 自动获取标题:', autoTitle);
            }
            document.getElementById('p-note-title').value = autoTitle;
            modal.dataset.problemTitle = autoTitle || '';
            document.getElementById('p-note-mode').value = 'full_note';
            document.getElementById('p-feeling').value = "";
            document.getElementById('api-result-container').style.display = 'none';
            showRenderedResult("");

            // 加载 API 设置
            const apiSettings = await Storage.getMultiple(['api_url', 'api_key', 'api_model']);
            document.getElementById('api-url').value = apiSettings.api_url || 'https://api.openai.com/v1';
            document.getElementById('api-key').value = apiSettings.api_key || '';
            document.getElementById('api-model').value = apiSettings.api_model || 'gpt-4o';

            modal.dataset.rawProblem = contentText;
            modal.dataset.rawCode = userCode;

            try {
                let officialText = "";

                if (typeof adapter.fetchOfficialSolutions === 'function') {
                    const solutions = await adapter.fetchOfficialSolutions();
                    if (solutions && solutions.length > 0) {
                        if (!window.PromptGenerator ||
                            typeof window.PromptGenerator.detectCodeLanguage !== 'function' ||
                            typeof window.PromptGenerator.formatSolutionsForPrompt !== 'function') {
                            console.error('[Note Helper] 错误: PromptGenerator 模块未加载或接口缺失');
                            showToast('插件加载异常，请刷新页面重试');
                            return;
                        }
                        const userLanguage = window.PromptGenerator.detectCodeLanguage(userCode);
                        console.log('[CodeNote Helper] 检测到用户代码语言:', userLanguage || '未知');

                        let orderedSolutions = solutions;
                        const recommendationHelper = getRecommendationHelper();
                        if (recommendationHelper && typeof recommendationHelper.sortSolutionsForRecommendation === 'function') {
                            orderedSolutions = recommendationHelper.sortSolutionsForRecommendation(solutions);
                            if (typeof recommendationHelper.hasLingShenSolutionInList === 'function' &&
                                recommendationHelper.hasLingShenSolutionInList(orderedSolutions)) {
                                console.log('[CodeNote Helper] 命中灵神题解，已置顶用于推荐');
                            }
                        } else if (recommendationHelper) {
                            console.warn('[Note Helper] Recommendation.sortSolutionsForRecommendation 不可用，保持原题解顺序');
                        }

                        officialText = window.PromptGenerator.formatSolutionsForPrompt(orderedSolutions, userLanguage);
                        showToast(`✅ 成功获取 ${orderedSolutions.length} 个题解`, 2000);
                    } else {
                        officialText = "";
                        showToast("⚠️ 未获取到参考题解，AI 将自动生成优化方案", 3000);
                    }
                } else if (typeof adapter.getOfficialSolution === 'function') {
                    // 优先使用站点 adapter 的专用提取方法（如 CodeFun2000）
                    try {
                        officialText = adapter.getOfficialSolution();
                    } catch (e) {
                        console.warn('提取页面题解失败:', e);
                    }
                } else if (conf.official) {
                    try {
                        const offEl = document.querySelector(conf.official);
                        if (offEl) officialText = extractMarkdown(offEl);
                    } catch (e) {
                        console.warn('提取页面题解失败:', e);
                    }
                }

                document.getElementById('p-official').value = officialText;
            } catch (e) {
                console.error('获取题解失败:', e);
                document.getElementById('p-official').value = "";
                showToast("⚠️ 获取题解失败: " + e.message, 3000);
            }

            setTimeout(() => document.getElementById('p-note-title').focus(), 100);
        };

        enableLongPressDrag(btn, 'note', openModal);
        enableLongPressDrag(catBtn, 'cat', summonCat);

        document.getElementById('btn-close').onclick = () => {
            closeModalAndReset();
        };

        document.getElementById('btn-manual-add').onclick = async () => {
            const actionResult = await trackCurrentProblemAction('manual_added', {
                title: getCurrentProblemRecordTitle()
            });
            if (actionResult) {
                showToast('✅ 当前题目已加入记录', 2600);
            } else {
                showToast('⚠️ 当前页面暂不支持添加题目记录', 2800);
            }
        };

        document.getElementById('btn-copy-result').onclick = async () => {
            const text = lastAIResult || document.getElementById('api-output').value;
            if (text) {
                const utils = window.NoteHelperUtils;
                if (!utils || typeof utils.copyToClipboard !== 'function') {
                    console.error('[Note Helper] 错误: Utils.copyToClipboard 不可用');
                    alert('插件加载异常，请刷新页面重试');
                    return;
                }
                await utils.copyToClipboard(text);
                await trackCurrentProblemAction('result_copied');
                showToast("结果已复制！");
            }
        };

        document.getElementById('btn-save-result').onclick = async () => {
            const text = lastAIResult || document.getElementById('api-output').value;
            if (!text) {
                showToast("⚠️ 当前没有可保存的生成结果");
                return;
            }

            const store = getProblemDataStore();
            if (!store) {
                showToast("⚠️ 本地记录模块未加载");
                return;
            }

            try {
                const saveResult = await store.saveProblemNote({
                    url: window.location.href,
                    title: getCurrentProblemRecordTitle(),
                    noteContent: text
                });
                maybeCelebrateFromActionResult(saveResult);
                showToast("✅ 已保存到本地记录");
            } catch (e) {
                console.warn('[Note Helper] 保存本地记录失败:', e);
                showToast("⚠️ 保存本地记录失败");
            }
        };

        // 自定义URL抓取
        document.getElementById('btn-fetch-custom').onclick = async () => {
            const customUrl1 = document.getElementById('p-custom-url-1').value.trim();
            const customUrl2 = document.getElementById('p-custom-url-2').value.trim();

            const urlsToFetch = [];
            if (customUrl1) {
                if (customUrl1.includes('leetcode.cn/problems/') || customUrl1.includes('leetcode.com/problems/')) {
                    urlsToFetch.push({ url: customUrl1, index: 1 });
                } else {
                    showToast("⚠️ URL 1 格式无效，请输入有效的 LeetCode 题解链接");
                    return;
                }
            }
            if (customUrl2) {
                if (customUrl2.includes('leetcode.cn/problems/') || customUrl2.includes('leetcode.com/problems/')) {
                    urlsToFetch.push({ url: customUrl2, index: 2 });
                } else {
                    showToast("⚠️ URL 2 格式无效，请输入有效的 LeetCode 题解链接");
                    return;
                }
            }

            if (urlsToFetch.length === 0) {
                showToast("⚠️ 请至少输入一个题解URL");
                return;
            }

            const router = getSiteRouter();
            if (!router || typeof router.fetchSolutionFromUrl !== 'function') {
                console.error('[Note Helper] 错误: SiteRouter.fetchSolutionFromUrl 不可用');
                showToast('插件加载异常，请刷新页面重试');
                return;
            }

            const fetchBtn = document.getElementById('btn-fetch-custom');
            const originalText = fetchBtn.innerText;
            fetchBtn.innerText = "⏳ 抓取中...";
            fetchBtn.disabled = true;

            try {
                const userCode = modal.dataset.rawCode || '';
                if (!window.PromptGenerator ||
                    typeof window.PromptGenerator.detectCodeLanguage !== 'function' ||
                    typeof window.PromptGenerator.filterSolutionByLanguage !== 'function') {
                    console.error('[Note Helper] 错误: PromptGenerator 模块未加载或接口缺失');
                    showToast('插件加载异常，请刷新页面重试');
                    return;
                }
                const userLanguage = window.PromptGenerator.detectCodeLanguage(userCode);

                const officialTextarea = document.getElementById('p-official');
                let successCount = 0;
                let allFormattedSolutions = [];

                for (const item of urlsToFetch) {
                    try {
                        fetchBtn.innerText = `⏳ 抓取 URL ${item.index}...`;
                        const solution = await router.fetchSolutionFromUrl(item.url);
                        if (solution) {
                            solution._customIndex = item.index;
                            allFormattedSolutions.push(solution);
                            successCount++;
                        }
                    } catch (e) {
                        console.warn(`抓取 URL ${item.index} 失败:`, e);
                    }
                }

                if (allFormattedSolutions.length > 0) {
                    let orderedSolutions = allFormattedSolutions;
                    const recommendationHelper = getRecommendationHelper();
                    if (recommendationHelper && typeof recommendationHelper.sortSolutionsForRecommendation === 'function') {
                        orderedSolutions = recommendationHelper.sortSolutionsForRecommendation(allFormattedSolutions);
                        if (typeof recommendationHelper.hasLingShenSolutionInList === 'function' &&
                            recommendationHelper.hasLingShenSolutionInList(orderedSolutions)) {
                            console.log('[CodeNote Helper] 自定义题解命中灵神，已置顶用于推荐');
                        }
                    } else if (recommendationHelper) {
                        console.warn('[Note Helper] Recommendation.sortSolutionsForRecommendation 不可用，保持原题解顺序');
                    }

                    const formattedContent = orderedSolutions.map(sol => {
                        const upvoteInfo = sol.upvoteCount ? ` | 👍 ${sol.upvoteCount} 赞` : '';
                        let authorTag = sol.author || '未知作者';
                        if (authorTag.toLowerCase() === 'endlesscheng') {
                            authorTag = '灵茶山艾府(灵神)';
                        }

                        let content = sol.content;
                        if (userLanguage) {
                            content = window.PromptGenerator.filterSolutionByLanguage(content, userLanguage);
                        }

                        return `
═══════════════════════════════════════════════════════════════
📝 【自定义题解 ${sol._customIndex}】 ${sol.title}
👤 作者：@${authorTag}${upvoteInfo}
═══════════════════════════════════════════════════════════════

${content}`;
                    }).join('\n\n');

                    const currentContent = officialTextarea.value || '';
                    if (currentContent.trim()) {
                        officialTextarea.value = currentContent + '\n\n' + formattedContent;
                    } else {
                        officialTextarea.value = formattedContent;
                    }

                    showToast(`✅ 成功抓取 ${successCount} 个题解`);
                    document.getElementById('p-custom-url-1').value = '';
                    document.getElementById('p-custom-url-2').value = '';
                } else {
                    showToast("⚠️ 抓取失败，请检查URL是否正确");
                }
            } catch (e) {
                console.error('抓取自定义题解失败:', e);
                showToast("⚠️ 抓取失败: " + e.message);
            } finally {
                fetchBtn.innerText = originalText;
                fetchBtn.disabled = false;
            }
        };

        // 执行按钮
        document.getElementById('btn-generate').onclick = async () => {
            const noteTitle = document.getElementById('p-note-title').value.trim();
            const headingLevel = document.getElementById('p-level').value;
            const userLevel = document.getElementById('p-user-level').value;
            const noteMode = document.getElementById('p-note-mode').value;
            const aiPlatform = document.getElementById('p-ai-platform').value;
            const official = document.getElementById('p-official').value;
            const notes = document.getElementById('p-feeling').value;

            const apiUrl = document.getElementById('api-url').value.trim();
            const apiKey = document.getElementById('api-key').value.trim();
            const apiModel = document.getElementById('api-model').value.trim();

            if (!noteTitle) {
                showToast("⚠️ 请输入笔记标题！");
                document.getElementById('p-note-title').focus();
                return;
            }

            console.log('[Note Helper] 开始生成 Prompt...');
            console.log('[Note Helper] PromptGenerator 是否存在:', typeof window.PromptGenerator);

            if (!window.PromptGenerator || typeof window.PromptGenerator.generatePrompt !== 'function') {
                console.error('[Note Helper] 错误: PromptGenerator 模块未加载！');
                alert('插件加载异常，请刷新页面重试');
                return;
            }

            const prompt = window.PromptGenerator.generatePrompt({
                noteTitle,
                problem: modal.dataset.rawProblem || "",
                myCode: modal.dataset.rawCode || "",
                officialSolution: official,
                headingLevel,
                userLevel,
                noteMode,
                notes,
                url: window.location.href
            });

            console.log('[Note Helper] Prompt 生成完成, 长度:', prompt?.length);

            // 保存 API 配置
            if (aiPlatform === 'direct_api') {
                await Storage.setMultiple({
                    api_url: apiUrl,
                    api_key: apiKey,
                    api_model: apiModel
                });

                if (!apiUrl || !apiKey) {
                    return alert("请填写 API URL 和 Key！");
                }
            }

            const utils = window.NoteHelperUtils;
            if (!utils || typeof utils.copyToClipboard !== 'function') {
                console.error('[Note Helper] 错误: Utils.copyToClipboard 不可用');
                alert('插件加载异常，请刷新页面重试');
                return;
            }

            await utils.copyToClipboard(prompt);
            await trackCurrentProblemAction('prompt_copied');

            if (aiPlatform === 'direct_api') {
                const generateCtrl = getGenerationController();
                if (!generateCtrl) {
                    showToast('插件加载异常，请刷新页面后重试');
                    return;
                }

                const resultContainer = document.getElementById('api-result-container');
                const generationState = generateCtrl.startGeneration({
                    loadingText: '⏳ 生成中...'
                });
                const requestId = generationState.requestId;
                let finalState = 'reset';

                // 先显示 Prompt 已复制的提示
                showToast("📋 Prompt 已复制到剪贴板，正在调用 AI...", 3000);

                resultContainer.style.display = 'block';
                showRenderedResult('正在连接 AI...', {
                    isError: false,
                    renderMode: 'stream'
                });

                try {
                    if (!window.ApiClient || typeof window.ApiClient.callAI !== 'function') {
                        throw new Error('API 客户端未加载，请刷新页面后重试。');
                    }
                    const result = await window.ApiClient.callAI(apiUrl, apiKey, apiModel, prompt, (partialContent) => {
                        if (!generateCtrl.isCurrentRequest(requestId)) return;
                        const partialText = String(partialContent || '');
                        showRenderedResult(partialText, {
                            isError: false,
                            renderMode: 'stream'
                        });
                        generateCtrl.updateProgress(requestId, {
                            charCount: partialText.length
                        });
                    }, {
                        signal: generationState.signal
                    });
                    if (!generateCtrl.isCurrentRequest(requestId)) return;
                    showRenderedResult(result, {
                        isError: false,
                        renderMode: 'markdown'
                    });
                    await trackCurrentProblemAction('note_generated');
                    showToast("✅ 生成完成！点击下方《复制结果》按钮复制笔记", 5000);
                    finalState = 'retry';
                    setTimeout(() => {
                        const copyBtn = document.getElementById('btn-copy-result');
                        if (copyBtn) {
                            copyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // 给复制按钮添加闪烁效果吸引注意
                            copyBtn.classList.add('btn-highlight');
                            setTimeout(() => copyBtn.classList.remove('btn-highlight'), 2000);
                        }
                    }, 100);
                } catch (err) {
                    if (!generateCtrl.isCurrentRequest(requestId)) return;
                    if (isAbortError(err)) {
                        showRenderedResult('', {
                            isError: false,
                            renderMode: 'plain'
                        });
                        finalState = 'reset';
                    } else {
                        const errorMessage = getReadableErrorMessage(err, '生成失败，请稍后重试。');
                        showRenderedResult(`生成失败：${errorMessage}`, {
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
                }
            } else {
                const platform = AI_PLATFORMS[aiPlatform];
                if (platform && platform.url && platform.url !== 'api') {
                    showToast(`Prompt 已复制！正在跳转...`);
                    setTimeout(async () => {
                        const proto = platform.url;
                        if (proto.startsWith('http')) {
                            await Messaging.openTab(proto, true);
                        } else {
                            window.location.href = proto;
                        }
                    }, 500);
                    closeModalAndReset();
                } else {
                    showToast("Prompt 已复制！🚀");
                    closeModalAndReset();
                }
            }
        };
    }

    window.NoteHelperUI = { init };
})();

