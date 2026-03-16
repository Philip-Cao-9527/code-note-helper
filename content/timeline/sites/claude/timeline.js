/**
 * AI 对话时间轴 内容脚本 - claude.ai
 * 版本：1.0.32
 * 基线：current（v1.0.31）行为
 */

(function () {
    'use strict';

    // 防止重复注入
    if (window.__AI_TIMELINE_INJECTED__) return;
    window.__AI_TIMELINE_INJECTED__ = true;

    console.log('[AI Timeline] Content script loaded (v1.0.32)');

    // === 配置 ===
    const CONFIG = {
        LONG_PRESS_DURATION: 600,
        HOVER_PREVIEW_DELAY: 400,
        TOOLTIP_HIDE_DELAY: 400,  // v1.0.24: 增加延迟，便于鼠标移动到 tooltip
        DEBOUNCE_DELAY: 150,
        INIT_DELAY: 1000,
        SCROLL_BEHAVIOR: 'smooth',
        STORAGE_PREFIX: 'ai_timeline_marks_',
        PREVIEW_TEXT_LENGTH: 150,
        LONG_CONVERSATION_THRESHOLD: 8,
        TRACK_PADDING: 16,
        MIN_GAP: 24,
        VIRTUAL_WINDOW_SIZE: 5,
        VIRTUAL_BUFFER: 2,
        POSITION_REFRESH_INTERVAL: 500
    };

    const ADAPTER = {
        name: 'Claude',
        matches: (url) => url.includes('claude.ai'),
        // 只在有实际对话ID的页面初始化，排除/new和主页
        isConversationPage: (path) => path.includes('/chat/') && path.match(/\/chat\/[A-Za-z0-9-]+/),
        userMessageSelector: '[data-testid="user-message"], [data-testid="user-human-turn"], .font-user-message, [class*="human-turn"] .font-claude-message, div[class*="grid"] > div:first-child',
        aiMessageSelector: '[data-testid="assistant-message"], [data-testid="assistant-turn"]',
        getMessages: () => {
            let messages = document.querySelectorAll('[data-testid="user-message"]');
            if (messages.length > 0) return messages;

            const allButtons = document.querySelectorAll('button.bg-bg-000, button[class*="bg-bg-"]');
            const pastedContainers = new Set();
            allButtons.forEach(btn => {
                let parent = btn;
                for (let i = 0; i < 8 && parent; i++) {
                    if (parent.classList && (parent.classList.contains('grid') || parent.className.includes('turn'))) {
                        pastedContainers.add(parent);
                        break;
                    }
                    parent = parent.parentElement;
                }
            });
            if (pastedContainers.size > 0) return Array.from(pastedContainers);

            const turnContainers = document.querySelectorAll('[class*="grid"][class*="grid-cols"]');
            return turnContainers.length > 0 ? turnContainers : [];
        },
        extractUserText: (el) => {
            const pastedBtn = el.querySelector('button');
            if (pastedBtn && pastedBtn.textContent.toLowerCase().includes('pasted')) {
                return '[PASTED] ' + (el.textContent || '').replace(/pasted/gi, '').replace(/\s+/g, ' ').trim().substring(0, 100);
            }
            return (el.textContent || '').replace(/\s+/g, ' ').trim();
        },
        extractAIText: (el) => {
            return (el.textContent || '').replace(/\s+/g, ' ').trim();
        },
        getConversationId: () => {
            const match = location.pathname.match(/\/chat\/([A-Za-z0-9-]+)/);
            return match ? match[1] : null;
        },
        timelinePosition: { top: '80px', right: '48px', bottom: '100px' },
        scrollContainerSelector: '.overflow-y-scroll.overflow-x-hidden, [class*="overflow-y-scroll"]',
        disableHoverPreview: true
    };

    // === 工具函数 ===

    // 【v1.0.22】动态检测深色模式（通过计算背景色亮度）
    function isDarkMode() {
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        // 解析 rgb(r, g, b) 格式
        const match = bodyBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const [_, r, g, b] = match.map(Number);
            // 计算亮度 (0-255)
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
            return luminance < 128; // 亮度低于128认为是深色模式
        }
        // rgba 格式
        const rgbaMatch = bodyBg.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbaMatch) {
            const [_, r, g, b] = rgbaMatch.map(Number);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
            return luminance < 128;
        }
        return false;
    }
    function throttle(fn, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    function debounce(fn, delay) {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    function simpleHash(str) {
        if (!str || str.length === 0) return '0';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    }

    async function copyToClipboard(text, btn) {
        try {
            await navigator.clipboard.writeText(text);
            btn.classList.add('copied');
            btn.querySelector('span').textContent = '已复制!';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.querySelector('span').textContent = '复制提问';
            }, 1500);
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = 'position:fixed;opacity:0;';
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); } catch (e) { }
            document.body.removeChild(textarea);
        }
    }

    // === 时间轴控制器 ===
    class TimelineController {
        constructor(adapter) {
            this.adapter = adapter;
            this.container = null;
            this.scrollContainer = null;
            this.messageMap = new Map();
            this.sortedMessages = [];
            this.renderedNodes = new Map();
            this.activeNodeId = null;
            this.ui = { bar: null, track: null, trackContent: null, tooltip: null, hitZone: null };
            this.windowState = { startIndex: 0, endIndex: 0, centerIndex: 0 };
            this.isCompactMode = false;
            this.lastScrollHeight = 0;
            this.lastPositionRefresh = 0;
            this.longPressTimer = null;
            this.longPressTarget = null;
            this.isLongPressed = false;
            this.hoverTimer = null;
            this.tooltipHideTimer = null;
            this.currentHoverNode = null;
            this.isMouseOverTooltip = false;
            this.isMouseOverHitZone = false;
            this.mutationObserver = null;
            this.scrollSyncRAF = null;
            this.pollIntervalId = null;
            this.isInitialized = false; // 【修复】防止重复初始化
            this.lastBottomLogTime = 0; // 【修复】底部日志节流

            this.debouncedFullRebuild = debounce(this.fullRebuild.bind(this), CONFIG.DEBOUNCE_DELAY);
            this.throttledRender = throttle(this.renderWindow.bind(this), 50);
            this.throttledPositionRefresh = throttle(this.refreshPositions.bind(this), CONFIG.POSITION_REFRESH_INTERVAL);

            this.markedIds = this.loadMarks();
        }

        generateStableId(el, index) {
            const nativeId = el.getAttribute('data-message-id') || el.getAttribute('data-id');
            if (nativeId) return `native-${nativeId}`;
            const parentId = el.parentElement?.getAttribute('data-message-id');
            if (parentId) return `parent-${parentId}`;
            const text = (this.adapter.extractUserText(el) || '').substring(0, 150);
            const hash = simpleHash(text);
            const textLen = (this.adapter.extractUserText(el) || '').length;
            return `hash-${hash}-len${textLen}`;
        }

        async init() {
            // 【修复】防止重复初始化
            if (this.isInitialized) {
                console.log('[AI Timeline] 已初始化，跳过重复调用');
                return;
            }
            console.log(`[AI Timeline] Waiting for ${this.adapter.name} page load...`);

            const el = await this.waitForElement(this.adapter.userMessageSelector);
            if (!el) {
                console.warn('[AI Timeline] 未找到消息元素');
                setTimeout(() => this.init(), 2000);
                return;
            }

            if (!this.findContainers()) {
                console.warn('[AI Timeline] 未找到对话容器');
                return;
            }

            this.createUI();
            this.fullRebuild();
            this.setupEventListeners();
            this.setupObservers();
            this.isInitialized = true; // 【修复】标记已初始化

            // 【v1.0.20修复】历史对话进入时确保正确激活底部节点
            // 延迟执行以等待页面滚动稳定
            setTimeout(() => {
                this.updateActiveFromScroll();
                // 二次检测：如果仍在底部则强制激活最后节点
                const scrollTop = this.scrollContainer.scrollTop;
                const clientHeight = this.scrollContainer.clientHeight;
                const scrollHeight = this.scrollContainer.scrollHeight;
                const scrollableDistance = scrollHeight - clientHeight;
                const scrollRatio = scrollableDistance > 0 ? scrollTop / scrollableDistance : 0;
                if (scrollRatio > 0.9 && this.sortedMessages.length > 0) {
                    this.activeNodeId = this.sortedMessages[this.sortedMessages.length - 1].stableId;
                    this.refreshActiveVisual();
                    console.log('[AI Timeline] 历史对话检测：强制激活底部节点');
                }
            }, 500);

            console.log(`[AI Timeline] Init done, found ${this.messageMap.size} messages`);
        }

        waitForElement(selector, timeout = 15000) {
            return new Promise((resolve) => {
                const check = () => document.querySelector(selector);
                if (check()) return resolve(check());

                const observer = new MutationObserver(() => {
                    const el = check();
                    if (el) { observer.disconnect(); resolve(el); }
                });

                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); resolve(check()); }, timeout);
            });
        }

        findContainers() {
            // 检测元素是否具有滚动能力（放宽条件：只检查 overflow 属性）
            const hasScrollCapability = (el) => {
                if (!el) return false;
                const style = window.getComputedStyle(el);
                const hasOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll';
                return hasOverflow;
            };

            // 更严格的检测（要求当前有可滚动内容）
            const hasActualScroll = (el) => {
                if (!el) return false;
                return el.scrollHeight > el.clientHeight + 10;
            };

            // 1. 优先使用适配器指定的选择器
            if (this.adapter.scrollContainerSelector) {
                const candidates = document.querySelectorAll(this.adapter.scrollContainerSelector);
                console.log(`[AI Timeline] 候选滚动容器数量: ${candidates.length}`);

                // 第一轮：找有实际滚动内容的容器
                for (const candidate of candidates) {
                    if (hasScrollCapability(candidate) && hasActualScroll(candidate)) {
                        this.scrollContainer = candidate;
                        const firstMessage = candidate.querySelector(this.adapter.userMessageSelector);
                        this.container = firstMessage ? firstMessage.parentElement : candidate;
                        console.log('[AI Timeline] 使用指定容器(有滚动):', candidate.tagName, candidate.className?.substring(0, 60));
                        return true;
                    }
                }

                // 第二轮：找有 overflow 属性的容器（即使当前没有滚动内容）
                for (const candidate of candidates) {
                    if (hasScrollCapability(candidate)) {
                        this.scrollContainer = candidate;
                        const firstMessage = candidate.querySelector(this.adapter.userMessageSelector);
                        this.container = firstMessage ? firstMessage.parentElement : candidate;
                        console.log('[AI Timeline] 使用指定容器(overflow):', candidate.tagName, candidate.className?.substring(0, 60));
                        return true;
                    }
                }
            }

            // 2. 从消息元素向上查找
            const firstMessage = document.querySelector(this.adapter.userMessageSelector);
            if (!firstMessage) {
                console.warn('[AI Timeline] 未找到消息元素');
                return false;
            }

            let parent = firstMessage.parentElement;
            while (parent && parent !== document.body) {
                if (parent.querySelectorAll(this.adapter.userMessageSelector).length > 0) this.container = parent;
                parent = parent.parentElement;
            }
            if (!this.container) this.container = firstMessage.parentElement;

            // 3. 递归查找具有滚动能力的容器
            parent = this.container;
            while (parent && parent !== document.body) {
                if (hasScrollCapability(parent)) {
                    this.scrollContainer = parent;
                    console.log('[AI Timeline] 发现滚动容器:', parent.tagName, parent.className?.substring(0, 60));
                    break;
                }
                parent = parent.parentElement;
            }

            // 4. 降级方案
            if (!this.scrollContainer) {
                this.scrollContainer = document.scrollingElement || document.documentElement;
                console.log('[AI Timeline] 使用降级滚动容器');
            }
            return true;
        }

        destroy() {
            // 清理 UI
            if (this.ui.bar) this.ui.bar.remove();
            if (this.ui.tooltip) this.ui.tooltip.remove();
            if (this.ui.hitZone) this.ui.hitZone.remove();

            // 清理定时器
            this.clearAllTimers();
            if (this.pollIntervalId) clearInterval(this.pollIntervalId);
            if (this.scrollSyncRAF) cancelAnimationFrame(this.scrollSyncRAF);

            // 断开观察器
            if (this.mutationObserver) this.mutationObserver.disconnect();

            // 移除事件监听
            if (this.handleScroll) {
                (this.scrollContainer || window).removeEventListener('scroll', this.handleScroll);
                document.removeEventListener('scroll', this.handleScroll, { capture: true });
            }
            if (this.handleResize) {
                window.removeEventListener('resize', this.handleResize);
            }

            // 【修复】重置初始化标志
            this.isInitialized = false;
            console.log('[AI Timeline] 已销毁');
        }

        createUI() {
            // 先清理旧的
            document.querySelectorAll('.ai-timeline-bar, .ai-timeline-tooltip, .ai-timeline-hit-zone').forEach(el => el.remove());

            const bar = document.createElement('div');
            bar.className = 'ai-timeline-bar';
            const pos = this.adapter.timelinePosition;
            bar.style.top = pos.top;
            bar.style.right = pos.right;
            bar.style.height = `calc(100vh - ${pos.top} - ${pos.bottom})`;

            const track = document.createElement('div');
            track.className = 'ai-timeline-track';

            const trackContent = document.createElement('div');
            trackContent.className = 'ai-timeline-track-content';
            track.appendChild(trackContent);
            bar.appendChild(track);
            document.body.appendChild(bar);

            this.ui.bar = bar;

            // 【v1.0.22】动态检测深色模式并设置样式
            if (isDarkMode()) {
                bar.classList.add('dark-mode-detected');
                // 直接在 bar 上设置深色模式 CSS 变量
                bar.style.setProperty('--tl-dot-color', '#E5E7EB');
                bar.style.setProperty('--tl-bar-bg', 'rgba(80, 80, 85, 0.9)');
                bar.style.backgroundColor = 'rgba(80, 80, 85, 0.9)';
                console.log('[AI Timeline] 检测到深色模式，应用深色样式');
            }
            this.ui.track = track;
            this.ui.trackContent = trackContent;

            const tooltip = document.createElement('div');
            tooltip.className = 'ai-timeline-tooltip';
            document.body.appendChild(tooltip);
            this.ui.tooltip = tooltip;

            const hitZone = document.createElement('div');
            hitZone.className = 'ai-timeline-hit-zone';
            // v1.0.27: 降低 z-index 确保时间轴节点优先接收事件
            hitZone.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:auto;opacity:0;display:none;';
            document.body.appendChild(hitZone);
            this.ui.hitZone = hitZone;
        }

        fullRebuild() {
            if (!this.container) return;

            this.clearAllTimers();
            this.hideTooltip();

            // 【v1.0.22】优先使用适配器的 getMessages 方法
            let userMessages;
            if (this.adapter.getMessages) {
                userMessages = Array.from(this.adapter.getMessages());
                console.log('[AI Timeline] 使用 getMessages 方法查找消息:', userMessages.length);
            } else {
                userMessages = Array.from(document.querySelectorAll(this.adapter.userMessageSelector));
            }
            if (userMessages.length === 0) return;

            const scrollTop = this.scrollContainer.scrollTop;
            const containerRect = this.scrollContainer.getBoundingClientRect();

            const newMessageMap = new Map();
            userMessages.forEach((el, index) => {
                const stableId = this.generateStableId(el, index);
                const rect = el.getBoundingClientRect();
                const absTop = scrollTop + rect.top - containerRect.top;
                const existing = this.messageMap.get(stableId);
                newMessageMap.set(stableId, { el, absTop, text: existing?.text || null, stableId });
            });

            this.messageMap = newMessageMap;
            this.sortedMessages = Array.from(this.messageMap.values());
            this.sortedMessages.sort((a, b) => a.absTop - b.absTop);
            this.sortedMessages.forEach((msg, i) => msg.index = i);

            this.isCompactMode = this.sortedMessages.length > CONFIG.LONG_CONVERSATION_THRESHOLD;
            this.ui.trackContent.classList.toggle('compact', this.isCompactMode);
            this.lastScrollHeight = this.scrollContainer.scrollHeight;

            this.renderWindow();
            requestAnimationFrame(() => this.updateActiveFromScroll());
        }

        refreshPositions() {
            if (!this.scrollContainer || this.sortedMessages.length === 0) return;
            const now = Date.now();
            if (now - this.lastPositionRefresh < CONFIG.POSITION_REFRESH_INTERVAL / 2) return;
            this.lastPositionRefresh = now;

            const scrollTop = this.scrollContainer.scrollTop;
            const containerRect = this.scrollContainer.getBoundingClientRect();

            this.sortedMessages.forEach(msg => {
                if (!msg.el || !msg.el.isConnected) return;
                const rect = msg.el.getBoundingClientRect();
                msg.absTop = scrollTop + rect.top - containerRect.top;
            });

            this.sortedMessages.sort((a, b) => a.absTop - b.absTop);
            this.sortedMessages.forEach((msg, i) => msg.index = i);
        }

        renderWindow() {
            if (this.sortedMessages.length === 0 || !this.ui.trackContent) return;

            let targetCenterIndex = 0;
            if (this.activeNodeId && this.messageMap.has(this.activeNodeId)) {
                targetCenterIndex = this.messageMap.get(this.activeNodeId).index ?? 0;
            } else {
                const scrollTop = this.scrollContainer.scrollTop;
                const scrollHeight = this.scrollContainer.scrollHeight;
                const ratio = scrollHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollHeight)) : 0;
                targetCenterIndex = Math.floor(ratio * this.sortedMessages.length);
            }

            const halfWindow = CONFIG.VIRTUAL_WINDOW_SIZE;
            let startIndex = Math.max(0, targetCenterIndex - halfWindow);
            let endIndex = Math.min(this.sortedMessages.length - 1, targetCenterIndex + halfWindow);

            this.windowState = { startIndex, endIndex, centerIndex: targetCenterIndex };

            const renderList = this.sortedMessages.slice(startIndex, endIndex + 1);
            const newIds = new Set(renderList.map(m => m.stableId));

            const toRemove = [];
            this.renderedNodes.forEach((data, id) => {
                if (!newIds.has(id)) { data.node.remove(); toRemove.push(id); }
            });
            toRemove.forEach(id => this.renderedNodes.delete(id));

            this.ui.trackContent.querySelectorAll('.ai-timeline-indicator').forEach(el => el.remove());

            const trackHeight = this.ui.track.clientHeight || 500;
            const padding = CONFIG.TRACK_PADDING;
            const usableHeight = trackHeight - 2 * padding;

            const hasTopMore = startIndex > 0;
            const hasBottomMore = endIndex < this.sortedMessages.length - 1;
            const indicatorCount = (hasTopMore ? 1 : 0) + (hasBottomMore ? 1 : 0);
            const gap = usableHeight / (renderList.length + indicatorCount + 1);

            let currentTop = padding;
            if (hasTopMore) { this.createIndicator(currentTop, 'up'); currentTop += gap; }

            renderList.forEach(msg => {
                if (!msg.text) msg.text = this.adapter.extractUserText(msg.el);

                if (this.renderedNodes.has(msg.stableId)) {
                    this.renderedNodes.get(msg.stableId).node.style.top = `${currentTop}px`;
                } else {
                    const node = this.createNode(msg, currentTop);
                    this.ui.trackContent.appendChild(node);
                    this.renderedNodes.set(msg.stableId, {
                        node,
                        text: (msg.text || '').substring(0, CONFIG.PREVIEW_TEXT_LENGTH) + ((msg.text || '').length > CONFIG.PREVIEW_TEXT_LENGTH ? '...' : '')
                    });
                }
                currentTop += gap;
            });

            if (hasBottomMore) this.createIndicator(currentTop, 'down');

            this.refreshActiveVisual();
            this.ui.track.scrollTop = 0;
        }

        createNode(msg, top) {
            const node = document.createElement('button');
            node.className = 'ai-timeline-node';
            node.dataset.id = msg.stableId;
            node.style.top = `${top}px`;

            if (this.markedIds.has(msg.stableId)) node.classList.add('marked');
            if (msg.stableId === this.activeNodeId) node.classList.add('active');

            if (!this.adapter.disableHoverPreview) {
                node.addEventListener('mouseenter', () => {
                    if (this.hoverTimer) clearTimeout(this.hoverTimer);
                    if (this.tooltipHideTimer) clearTimeout(this.tooltipHideTimer);
                    this.currentHoverNode = node;
                    this.hoverTimer = setTimeout(() => {
                        if (this.currentHoverNode === node) this.showTooltip(node);
                    }, CONFIG.HOVER_PREVIEW_DELAY);
                });

                node.addEventListener('mouseleave', (e) => {
                    if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }
                    const relatedTarget = e.relatedTarget;
                    // v1.0.27: 增强检查 - 包括 relatedTarget 本身是 tooltip/hitZone 的情况
                    if (relatedTarget && (
                        this.ui.tooltip?.contains(relatedTarget) ||
                        this.ui.hitZone?.contains(relatedTarget) ||
                        relatedTarget === this.ui.tooltip ||
                        relatedTarget === this.ui.hitZone
                    )) return;
                    if (this.currentHoverNode === node) this.currentHoverNode = null;
                    this.scheduleTooltipHide();
                });
            }

            return node;
        }

        createIndicator(top, type) {
            const ind = document.createElement('div');
            ind.className = `ai-timeline-indicator ${type}`;
            ind.style.top = `${top}px`;
            this.ui.trackContent.appendChild(ind);
        }

        refreshActiveVisual() {
            this.renderedNodes.forEach(({ node }) => node.classList.remove('active'));
            if (this.activeNodeId && this.renderedNodes.has(this.activeNodeId)) {
                this.renderedNodes.get(this.activeNodeId).node.classList.add('active');
            }
        }

        updateActiveFromScroll() {
            if (this.sortedMessages.length === 0) return;

            // 调试日志（只输出前几次）
            if (!this.updateScrollCallCount) this.updateScrollCallCount = 0;
            this.updateScrollCallCount++;
            if (this.updateScrollCallCount <= 3) {
                console.log(`[AI Timeline] updateActiveFromScroll 调用 #${this.updateScrollCallCount}`);
            }

            const currentScrollHeight = this.scrollContainer.scrollHeight;
            if (this.lastScrollHeight && Math.abs(this.lastScrollHeight - currentScrollHeight) > 100) {
                this.lastScrollHeight = currentScrollHeight;
                const currentMsgCount = document.querySelectorAll(this.adapter.userMessageSelector).length;
                if (currentMsgCount !== this.messageMap.size) {
                    this.debouncedFullRebuild();
                    return;
                }
                this.refreshPositions();
            }
            this.lastScrollHeight = currentScrollHeight;

            // 【修复】检测是否已滚动到底部
            // 使用更严格的检测逻辑避免误判
            const scrollTop = this.scrollContainer.scrollTop;
            const clientHeight = this.scrollContainer.clientHeight;
            const scrollableDistance = currentScrollHeight - clientHeight;

            // 只有当滚动位置超过可滚动距离的 95% 时才认为在底部
            // 这可以避免固定输入区域导致的误判
            const scrollRatio = scrollableDistance > 0 ? scrollTop / scrollableDistance : 0;
            const isAtBottom = scrollRatio > 0.95 && scrollableDistance > 100;

            let closestMsg = null;

            if (isAtBottom && this.sortedMessages.length > 0) {
                // 滚动到底部时，强制激活最后一个节点
                closestMsg = this.sortedMessages[this.sortedMessages.length - 1];
                // 【修复】日志节流，每 2 秒最多输出一次
                const now = Date.now();
                if (now - this.lastBottomLogTime > 2000) {
                    console.log('[AI Timeline] 检测到已滚动到底部，强制激活最后节点');
                    this.lastBottomLogTime = now;
                }
            } else {
                // 正常的 35% 判定线逻辑
                const containerRect = this.scrollContainer.getBoundingClientRect();
                const viewportCenter = containerRect.top + containerRect.height * 0.35;

                let closestDistance = Infinity;
                for (const msg of this.sortedMessages) {
                    if (!msg.el || !msg.el.isConnected) continue;
                    const rect = msg.el.getBoundingClientRect();
                    const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
                    if (distance < closestDistance) { closestDistance = distance; closestMsg = msg; }
                }
            }

            if (closestMsg && closestMsg.stableId !== this.activeNodeId) {
                this.activeNodeId = closestMsg.stableId;
                const { startIndex, endIndex } = this.windowState;
                if (closestMsg.index < startIndex + CONFIG.VIRTUAL_BUFFER || closestMsg.index > endIndex - CONFIG.VIRTUAL_BUFFER) {
                    this.throttledRender();
                } else {
                    this.refreshActiveVisual();
                }
            }
        }

        showTooltip(node) {
            const data = this.renderedNodes.get(node.dataset.id);
            if (!data || !this.ui.tooltip) return;

            const fullText = this.getFullMessageText(node.dataset.id) || data.text || '';
            const previewText = fullText.substring(0, CONFIG.PREVIEW_TEXT_LENGTH);

            while (this.ui.tooltip.firstChild) this.ui.tooltip.removeChild(this.ui.tooltip.firstChild);

            const labelDiv = document.createElement('div');
            labelDiv.className = 'ai-timeline-tooltip-label';
            labelDiv.textContent = '提问';

            const textDiv = document.createElement('div');
            textDiv.className = 'ai-timeline-tooltip-text';
            textDiv.textContent = previewText + (fullText.length > CONFIG.PREVIEW_TEXT_LENGTH ? '...' : '') || '(无内容)';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'ai-timeline-tooltip-copy';

            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z');
            svg.appendChild(path);

            const span = document.createElement('span');
            span.textContent = '复制提问';

            copyBtn.appendChild(svg);
            copyBtn.appendChild(span);
            copyBtn.onclick = (e) => { e.stopPropagation(); copyToClipboard(fullText, copyBtn); };

            this.ui.tooltip.appendChild(labelDiv);
            this.ui.tooltip.appendChild(textDiv);
            this.ui.tooltip.appendChild(copyBtn);

            const nodeRect = node.getBoundingClientRect();
            const barRect = this.ui.bar.getBoundingClientRect();

            this.ui.tooltip.style.right = `${window.innerWidth - barRect.left + 12}px`;
            this.ui.tooltip.style.top = `${nodeRect.top + nodeRect.height / 2}px`;
            this.ui.tooltip.style.transform = 'translateY(-50%)';
            this.ui.tooltip.classList.add('visible');

            if (this.ui.hitZone) {
                requestAnimationFrame(() => {
                    const tooltipRect = this.ui.tooltip.getBoundingClientRect();
                    // v1.0.27: 固定 hitZone 高度为 60px，垂直居中于节点
                    // 避免 hitZone 高度随 tooltip 扩张而遮蔽其他节点，导致点击跳转失效
                    const fixedHeight = 60;
                    const centerY = nodeRect.top + nodeRect.height / 2;
                    this.ui.hitZone.style.left = `${tooltipRect.right - 10}px`;
                    this.ui.hitZone.style.top = `${centerY - fixedHeight / 2}px`;
                    this.ui.hitZone.style.width = `${barRect.left - tooltipRect.right + 15}px`;
                    this.ui.hitZone.style.height = `${fixedHeight}px`;
                    this.ui.hitZone.style.display = 'block';
                });
            }
        }

        getFullMessageText(id) {
            const msg = this.messageMap.get(id);
            return msg?.el ? this.adapter.extractUserText(msg.el) : '';
        }

        hideTooltip() {
            if (this.ui.tooltip) this.ui.tooltip.classList.remove('visible');
            if (this.ui.hitZone) this.ui.hitZone.style.display = 'none';
        }

        scheduleTooltipHide() {
            if (this.tooltipHideTimer) clearTimeout(this.tooltipHideTimer);
            this.tooltipHideTimer = setTimeout(() => {
                if (!this.isMouseOverTooltip && !this.isMouseOverHitZone) this.hideTooltip();
            }, CONFIG.TOOLTIP_HIDE_DELAY);
        }

        clearAllTimers() {
            [this.hoverTimer, this.tooltipHideTimer, this.longPressTimer].forEach(t => t && clearTimeout(t));
            this.hoverTimer = this.tooltipHideTimer = this.longPressTimer = null;
        }

        scrollToMarker(id) {
            const msg = this.messageMap.get(id);
            if (!msg) return;
            let targetEl = msg.el;
            if (!targetEl || !targetEl.isConnected) {
                const userMessages = document.querySelectorAll(this.adapter.userMessageSelector);
                for (let i = 0; i < userMessages.length; i++) {
                    if (this.generateStableId(userMessages[i], i) === id) { targetEl = userMessages[i]; msg.el = targetEl; break; }
                }
            }
            if (targetEl?.isConnected) {
                targetEl.scrollIntoView({ behavior: CONFIG.SCROLL_BEHAVIOR, block: 'start' });
                this.activeNodeId = id;
                this.renderWindow();
            } else {
                this.fullRebuild();
            }
        }

        toggleMark(id) {
            if (this.markedIds.has(id)) this.markedIds.delete(id);
            else this.markedIds.add(id);
            this.saveMarks();
            if (this.renderedNodes.has(id)) {
                this.renderedNodes.get(id).node.classList.toggle('marked', this.markedIds.has(id));
            }
        }

        setupEventListeners() {
            const trackContent = this.ui.trackContent;

            trackContent.addEventListener('mousedown', this.handleMouseDown.bind(this));
            trackContent.addEventListener('mouseup', this.handleMouseUp.bind(this));

            this.ui.bar.addEventListener('mouseleave', (e) => {
                this.clearAllTimers();
                this.currentHoverNode = null;
                // v1.0.24: 改进检查逻辑，支持鼠标移动到 tooltip
                if (e.relatedTarget) {
                    if (this.ui.tooltip?.contains(e.relatedTarget) ||
                        this.ui.hitZone?.contains(e.relatedTarget) ||
                        e.relatedTarget === this.ui.tooltip ||
                        e.relatedTarget === this.ui.hitZone) {
                        return; // 鼠标移到了 tooltip 或 hitZone，不隐藏
                    }
                }
                this.scheduleTooltipHide();
            });

            this.ui.tooltip.addEventListener('mouseenter', () => {
                this.isMouseOverTooltip = true;
                if (this.tooltipHideTimer) { clearTimeout(this.tooltipHideTimer); this.tooltipHideTimer = null; }
            });

            this.ui.tooltip.addEventListener('mouseleave', (e) => {
                this.isMouseOverTooltip = false;
                if (e.relatedTarget?.closest?.('.ai-timeline-node') || this.ui.hitZone?.contains(e.relatedTarget)) return;
                this.scheduleTooltipHide();
            });

            if (this.ui.hitZone) {
                this.ui.hitZone.addEventListener('mouseenter', () => {
                    this.isMouseOverHitZone = true;
                    if (this.tooltipHideTimer) { clearTimeout(this.tooltipHideTimer); this.tooltipHideTimer = null; }
                });

                this.ui.hitZone.addEventListener('mouseleave', (e) => {
                    this.isMouseOverHitZone = false;
                    if (e.relatedTarget?.closest?.('.ai-timeline-node') || this.ui.tooltip?.contains(e.relatedTarget)) return;
                    this.scheduleTooltipHide();
                });
            }

            // 滚动同步：监听 scrollContainer
            this.scrollEventCount = 0; // 调试计数器
            this.handleScroll = () => {
                this.scrollEventCount++;
                if (this.scrollEventCount <= 3) {
                    console.log(`[AI Timeline] 捕获到滚动事件 #${this.scrollEventCount}`);
                }
                if (this.scrollSyncRAF) return;
                this.scrollSyncRAF = requestAnimationFrame(() => {
                    this.updateActiveFromScroll();
                    // v1.0.26: 只有在没有hover tooltip/hitZone时才隐藏
                    if (!this.isMouseOverTooltip && !this.isMouseOverHitZone) {
                        this.hideTooltip();
                    }
                    this.scrollSyncRAF = null;
                });
            };

            this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
            console.log('[AI Timeline] 已绑定滚动监听到:', this.scrollContainer.tagName, this.scrollContainer.className?.substring(0, 40));

        }

        handleMouseDown(e) {
            const node = e.target.closest('.ai-timeline-node');
            if (!node) return;
            e.preventDefault();
            this.hideTooltip();
            if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }
            if (this.longPressTimer) clearTimeout(this.longPressTimer);

            this.longPressTarget = node;
            this.isLongPressed = false;
            node.classList.add('pressing');

            this.longPressTimer = setTimeout(() => {
                this.isLongPressed = true;
                node.classList.remove('pressing');
                this.toggleMark(node.dataset.id);
                if (navigator.vibrate) navigator.vibrate(50);
            }, CONFIG.LONG_PRESS_DURATION);
        }

        handleMouseUp() {
            const node = this.longPressTarget;
            if (!node) return;
            node.classList.remove('pressing');
            if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
            if (!this.isLongPressed && node.dataset.id) this.scrollToMarker(node.dataset.id);
            this.longPressTarget = null;
        }

        setupObservers() {
            this.mutationObserver = new MutationObserver((mutations) => {
                if (mutations.some(m => m.type === 'childList')) this.debouncedFullRebuild();
            });
            this.mutationObserver.observe(this.container, { childList: true, subtree: true });

            this.pollIntervalId = setInterval(() => {
                const currentMsgCount = document.querySelectorAll(this.adapter.userMessageSelector).length;
                if (currentMsgCount !== this.messageMap.size && currentMsgCount > 0) this.fullRebuild();
            }, 1500);

            window.addEventListener('resize', () => this.renderWindow());
        }

        loadMarks() {
            const convId = this.adapter.getConversationId();
            if (!convId) return new Set();
            try {
                const data = localStorage.getItem(CONFIG.STORAGE_PREFIX + convId);
                return data ? new Set(JSON.parse(data)) : new Set();
            } catch (e) { return new Set(); }
        }

        saveMarks() {
            const convId = this.adapter.getConversationId();
            if (!convId) return;
            try {
                localStorage.setItem(CONFIG.STORAGE_PREFIX + convId, JSON.stringify([...this.markedIds]));
            } catch (e) { }
        }

        destroy() {
            this.mutationObserver?.disconnect();
            this.clearAllTimers();
            if (this.scrollSyncRAF) cancelAnimationFrame(this.scrollSyncRAF);
            if (this.pollIntervalId) clearInterval(this.pollIntervalId);
            this.ui.bar?.remove();
            this.ui.tooltip?.remove();
            this.ui.hitZone?.remove();
        }
    }

    // === URL 监听器 (Local SPA Monitor) ===
    class UrlMonitor {
        constructor() {
            this.callbacks = new Set();
            this.lastHref = location.href;
            this.timer = null;
        }

        start() {
            // 1. Monkey patch history API
            const pushState = history.pushState;
            history.pushState = (...args) => {
                const ret = pushState.apply(history, args);
                this.checkUrl();
                return ret;
            };

            const replaceState = history.replaceState;
            history.replaceState = (...args) => {
                const ret = replaceState.apply(history, args);
                this.checkUrl();
                return ret;
            };

            // 2. Listen to popstate
            window.addEventListener('popstate', () => this.checkUrl());

            // 3. Polling backup (for edge cases)
            this.timer = setInterval(() => this.checkUrl(), 1000);
        }

        checkUrl() {
            if (location.href !== this.lastHref) {
                this.lastHref = location.href;
                this.notify();
            }
        }

        onChange(callback) {
            this.callbacks.add(callback);
        }

        notify() {
            this.callbacks.forEach(cb => cb());
        }
    }

    // === 主程序执行 ===

    let currentController = null;
    const urlMonitor = new UrlMonitor();

    // 路由变更处理
    const handleRouteChange = async () => {
        // 检查是否启用
        try {
            const result = await chrome.storage.local.get('timeline_enabled');
            if (result.timeline_enabled === false) return;
        } catch (e) { }

        // 查找适配器
        const adapter = ADAPTER;

        // 无论是否是对话页，先销毁旧的时间轴 (防止主页残留)
        if (currentController) {
            currentController.destroy();
            currentController = null;
        }

        // 只有在明确的对话页面才初始化
        if (adapter.isConversationPage(location.pathname)) {
            console.log(`[AI Timeline] 进入对话页: ${location.pathname}`);
            currentController = new TimelineController(adapter);
            await currentController.init();
        } else {
            console.log(`[AI Timeline] 非对话页，保持静默`);
        }
    };

    // 启动监听
    urlMonitor.onChange(() => {
        console.log('[AI Timeline] 路由变更检测');
        handleRouteChange();
    });
    urlMonitor.start();

    // 监听 Service Worker 的重置请求 (Backup)
    window.addEventListener('ai-timeline-reinit', () => {
        console.log('[AI Timeline] 收到外部重置请求');
        handleRouteChange();
    });

    // 首次执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleRouteChange);
    } else {
        handleRouteChange();
    }

})();


