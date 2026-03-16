/**
 * 共享猫猫组件
 * 版本：1.0.69
 */

(function () {
    'use strict';

    const STYLE_ID = 'note-helper-cat-companion-style';
    const CONTAINER_ID = 'note-helper-cat-companion';
    const WALK_IN_CLASS = 'nh-cat-walking';
    const LEAVING_CLASS = 'nh-cat-leaving';
    const HIDDEN_CLASS = 'nh-cat-hidden';
    const ACTIVE_CLASS = 'active';
    const TAP_CLASS = 'nh-cat-tap';
    const CAT_IMAGE_PATH = 'assets/cat-v2-companion.png';
    const DEFAULT_MEOWS = ['喵！', '喵呜~', '(=^･ω･^=)', '呼噜呼噜', '喵喵'];
    const WALK_IN_DURATION_MS = 2400;
    const WALK_OUT_DURATION_MS = 1800;
    const BUBBLE_DURATION_MS = 4800;
    const MEOW_DURATION_MS = 1100;
    const TAP_DURATION_MS = 220;

    function injectStyleOnce() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
#${CONTAINER_ID} {
  position: fixed;
  bottom: 14px;
  left: -156px;
  z-index: 9998;
  pointer-events: none;
}
#${CONTAINER_ID}.${WALK_IN_CLASS} {
  animation: nh-cat-walk-in ${WALK_IN_DURATION_MS}ms ease-out forwards;
}
#${CONTAINER_ID}.${LEAVING_CLASS} {
  animation: nh-cat-walk-out ${WALK_OUT_DURATION_MS}ms ease-in forwards;
}
#${CONTAINER_ID}.${HIDDEN_CLASS} {
  display: none !important;
}
@keyframes nh-cat-walk-in {
  0% { left: -156px; }
  100% { left: calc(50% - 61px); }
}
@keyframes nh-cat-walk-out {
  0% { left: calc(50% - 61px); }
  100% { left: 110%; }
}
#${CONTAINER_ID} .nh-cat-bubble {
  position: absolute;
  bottom: 128px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  min-width: min(172px, calc(100vw - 24px));
  max-width: min(320px, calc(100vw - 24px));
  padding: 10px 14px;
  border-radius: 16px;
  border: 1px solid rgba(124, 58, 237, 0.24);
  background: linear-gradient(165deg, #ffffff 0%, #f8f5ff 100%);
  color: #433e53;
  font-size: 13px;
  line-height: 1.55;
  text-align: center;
  white-space: normal;
  word-break: normal;
  overflow-wrap: break-word;
  box-shadow: 0 10px 24px rgba(59, 36, 101, 0.2);
  animation: nh-bubble-pop 240ms ease-out;
  z-index: 9999;
}
#${CONTAINER_ID} .nh-cat-bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -8px;
  transform: translateX(-50%) rotate(45deg);
  width: 14px;
  height: 14px;
  background: #fdfaff;
  border-right: 1px solid rgba(124, 58, 237, 0.2);
  border-bottom: 1px solid rgba(124, 58, 237, 0.2);
}
@keyframes nh-bubble-pop {
  0% { transform: translateX(-50%) scale(0.9); opacity: 0; }
  100% { transform: translateX(-50%) scale(1); opacity: 1; }
}
#${CONTAINER_ID} .nh-cat-avatar {
  width: 122px;
  height: 122px;
  pointer-events: auto;
  cursor: pointer;
  transform-origin: 50% 88%;
  animation: nh-cat-idle 4.6s ease-in-out infinite;
}
#${CONTAINER_ID}.${WALK_IN_CLASS} .nh-cat-avatar {
  animation: nh-cat-step 360ms ease-in-out infinite;
}
#${CONTAINER_ID} .nh-cat-avatar.${TAP_CLASS} {
  transform: translateY(-1px) scale(0.96, 1.03);
}
#${CONTAINER_ID} .nh-cat-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}
@keyframes nh-cat-idle {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-2px) scale(1.014); }
}
@keyframes nh-cat-step {
  0%, 100% { transform: translateY(0) rotate(-0.7deg); }
  50% { transform: translateY(-1px) rotate(0.7deg); }
}
#${CONTAINER_ID} .nh-cat-meow {
  position: absolute;
  bottom: 98px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  min-width: 56px;
  max-width: min(240px, calc(100vw - 24px));
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid #f3cc79;
  background: #fff8d8;
  color: #8b5e0b;
  font-size: 13px;
  line-height: 1.35;
  white-space: nowrap;
  text-align: center;
  box-shadow: 0 8px 16px rgba(150, 110, 25, 0.2);
  animation: nh-meow-float ${MEOW_DURATION_MS}ms ease-out forwards;
  z-index: 10000;
}
@keyframes nh-meow-float {
  0% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-26px); }
}
@media (prefers-reduced-motion: reduce) {
  #${CONTAINER_ID},
  #${CONTAINER_ID} * {
    animation: none !important;
    transition: none !important;
  }
  #${CONTAINER_ID}.${WALK_IN_CLASS} { left: calc(50% - 61px); }
  #${CONTAINER_ID}.${LEAVING_CLASS} { left: 110%; }
}
        `;
        document.head.appendChild(style);
    }

    function createContainer() {
        const existed = document.getElementById(CONTAINER_ID);
        if (existed) return existed;

        const container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.innerHTML = `
            <div class="nh-cat-bubble" style="display:none;"></div>
            <div class="nh-cat-avatar" role="button" aria-label="猫猫助手">
                <img class="nh-cat-image" src="${chrome.runtime.getURL(CAT_IMAGE_PATH)}" alt="猫猫助手">
            </div>
        `;
        document.body.appendChild(container);
        return container;
    }

    function create(options = {}) {
        const triggerElement = options.triggerElement;
        if (!triggerElement) return null;

        injectStyleOnce();
        const container = createContainer();
        const catAvatar = container.querySelector('.nh-cat-avatar');
        const bubble = container.querySelector('.nh-cat-bubble');
        const quotes = Array.isArray(options.quotes) && options.quotes.length
            ? options.quotes.slice()
            : ['喝口水再继续，猫猫在这里陪你。'];
        const meowTexts = Array.isArray(options.meowTexts) && options.meowTexts.length
            ? options.meowTexts.slice()
            : DEFAULT_MEOWS.slice();

        let visible = false;
        let mounted = true;
        let bubbleShowTimer = null;
        let bubbleHideTimer = null;
        let resetPositionTimer = null;
        let tapResetTimer = null;
        let meowHideTimer = null;
        let lastQuoteIndex = -1;

        function clearTimers() {
            if (bubbleShowTimer) {
                clearTimeout(bubbleShowTimer);
                bubbleShowTimer = null;
            }
            if (bubbleHideTimer) {
                clearTimeout(bubbleHideTimer);
                bubbleHideTimer = null;
            }
            if (resetPositionTimer) {
                clearTimeout(resetPositionTimer);
                resetPositionTimer = null;
            }
            if (tapResetTimer) {
                clearTimeout(tapResetTimer);
                tapResetTimer = null;
            }
            if (meowHideTimer) {
                clearTimeout(meowHideTimer);
                meowHideTimer = null;
            }
        }

        function hideBubble() {
            if (!bubble) return;
            bubble.style.display = 'none';
            bubble.textContent = '';
        }

        function showMeowBubble() {
            if (!mounted) return;
            const existing = container.querySelector('.nh-cat-meow');
            if (existing) existing.remove();

            const meow = document.createElement('div');
            meow.className = 'nh-cat-meow';
            meow.textContent = meowTexts[Math.floor(Math.random() * meowTexts.length)];
            container.appendChild(meow);
            meowHideTimer = setTimeout(() => meow.remove(), MEOW_DURATION_MS);
        }

        function hide() {
            if (!mounted) return;
            clearTimers();
            visible = false;
            triggerElement.classList.remove(ACTIVE_CLASS);
            container.classList.remove(WALK_IN_CLASS);
            container.classList.add(LEAVING_CLASS);
            hideBubble();
            resetPositionTimer = setTimeout(() => {
                if (!mounted) return;
                container.classList.remove(LEAVING_CLASS);
                container.style.left = '-156px';
            }, WALK_OUT_DURATION_MS);
        }

        function toggle() {
            if (!mounted) return;
            clearTimers();

            if (visible) {
                hide();
                return;
            }

            visible = true;
            triggerElement.classList.add(ACTIVE_CLASS);
            container.classList.remove(LEAVING_CLASS);
            container.classList.add(WALK_IN_CLASS);

            bubbleShowTimer = setTimeout(() => {
                if (!mounted || !bubble) return;

                let quoteIndex;
                do {
                    quoteIndex = Math.floor(Math.random() * quotes.length);
                } while (quoteIndex === lastQuoteIndex && quotes.length > 1);

                lastQuoteIndex = quoteIndex;
                bubble.textContent = quotes[quoteIndex];
                bubble.style.display = 'block';

                bubbleHideTimer = setTimeout(() => {
                    hideBubble();
                }, BUBBLE_DURATION_MS);
            }, WALK_IN_DURATION_MS - 180);
        }

        function setVisible(shouldShow) {
            if (!mounted) return;
            const value = Boolean(shouldShow);
            container.classList.toggle(HIDDEN_CLASS, !value);
            if (!value && visible) hide();
        }

        function destroy() {
            mounted = false;
            clearTimers();
            if (catAvatar) catAvatar.removeEventListener('click', onCatClick);
            triggerElement.classList.remove(ACTIVE_CLASS);
        }

        function onCatClick(event) {
            event.stopPropagation();
            showMeowBubble();
            if (!catAvatar) return;
            catAvatar.classList.add(TAP_CLASS);
            tapResetTimer = setTimeout(() => {
                if (catAvatar) catAvatar.classList.remove(TAP_CLASS);
            }, TAP_DURATION_MS);
        }

        if (catAvatar) {
            catAvatar.addEventListener('click', onCatClick);
        }

        return {
            toggle,
            hide,
            setVisible,
            destroy
        };
    }

    window.NoteHelperCatCompanion = { create };
})();
