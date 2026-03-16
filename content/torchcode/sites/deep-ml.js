/**
 * TorchCode 站点适配 - deep-ml
 * 版本：1.0.51
 */

(function () {
    'use strict';

    function normalizeText(text) {
        return String(text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeCodeText(text) {
        return String(text || '')
            .replace(/\r\n/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/\u200b/g, '')
            .replace(/\t/g, '    ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function normalizeMultilineText(text) {
        return String(text || '')
            .replace(/\r\n/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/\u200b/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n')
            .trim();
    }

    function isLikelyBase64Text(text) {
        const compact = String(text || '').replace(/\s+/g, '');
        if (!compact || compact.length < 64) return false;
        if (compact.length % 4 !== 0) return false;
        if (!/^[A-Za-z0-9+/=]+$/.test(compact)) return false;
        return !/[^\x00-\x7F]/.test(compact);
    }

    function isNoiseText(text) {
        const normalized = normalizeText(text);
        if (!normalized) return true;
        if (/^\[object Object\]$/i.test(normalized)) return true;
        if (/earn flames again/i.test(normalized)) return true;
        if (/deep-0 won't give code or final solutions/i.test(normalized)) return true;
        if (/ask about strategies,\s*debugging ideas/i.test(normalized)) return true;
        if (/^how can i help you\??$/i.test(normalized)) return true;
        if (/^No contributors?/i.test(normalized)) return true;
        return false;
    }

    function decodeBase64Utf8(text) {
        const compact = String(text || '').replace(/\s+/g, '');
        if (!isLikelyBase64Text(compact)) return '';
        if (typeof atob !== 'function' || typeof TextDecoder !== 'function') return '';
        try {
            const binary = atob(compact);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes).trim();
        } catch (error) {
            return '';
        }
    }

    function stripMarkdownSyntax(text) {
        return String(text || '')
            .replace(/\r\n/g, '\n')
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/^>\s*/gm, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/^\s*[-+*]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .trim();
    }

    function normalizeApiMarkdownText(value) {
        if (value == null) return '';
        const raw = String(value || '').trim();
        if (!raw) return '';

        const decoded = decodeBase64Utf8(raw);
        const source = decoded || (isLikelyBase64Text(raw) ? '' : raw);
        const normalized = normalizeMultilineText(stripMarkdownSyntax(source));

        if (!normalized || isNoiseText(normalized) || isLikelyBase64Text(normalized)) return '';
        return normalized;
    }

    function normalizeApiText(value) {
        if (value == null) return '';

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            const normalized = normalizeText(value);
            if (!normalized || isNoiseText(normalized) || isLikelyBase64Text(normalized)) return '';
            return normalized;
        }

        if (Array.isArray(value)) {
            return value
                .map((item) => normalizeApiText(item))
                .filter(Boolean)
                .join('\n');
        }

        if (typeof value === 'object') {
            return Object.entries(value)
                .map(([key, item]) => {
                    const normalized = normalizeApiText(item);
                    if (!normalized) return '';
                    return `${key}: ${normalized}`;
                })
                .filter(Boolean)
                .join('\n');
        }

        return '';
    }

    function getProblemIdFromUrl(url) {
        try {
            const match = new URL(url || window.location.href).pathname.match(/\/problems\/([^/?#]+)/i);
            return match && match[1] ? String(match[1]).trim() : '';
        } catch (error) {
            return '';
        }
    }

    async function waitForProblemReady() {
        const maxLoops = 24;
        for (let index = 0; index < maxLoops; index += 1) {
            const title = document.querySelector('h1');
            if (title && normalizeText(title.textContent)) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    function collectDifficulty() {
        const candidates = Array.from(document.querySelectorAll('span,div,p'));
        const hit = candidates
            .map((element) => normalizeText(element.textContent))
            .find((text) => /^(Easy|Medium|Hard)$/i.test(text));
        return hit || '';
    }

    function collectDescription() {
        const sectionDescription = collectDescriptionFromProblemSection();
        if (sectionDescription) {
            return sectionDescription;
        }

        const heading = document.querySelector('h1');
        const scope = heading ? (heading.closest('section,article,div') || document) : document;

        const paragraphs = Array.from(scope.querySelectorAll('p'))
            .map((element) => normalizeText(element.textContent))
            .filter((text) => text.length > 20)
            .filter((text) => !isNoiseText(text));

        if (paragraphs.length > 0) {
            return paragraphs[0];
        }

        const fallback = Array.from(document.querySelectorAll('main p'))
            .map((element) => normalizeText(element.textContent))
            .filter((text) => text.length > 20)
            .filter((text) => !isNoiseText(text));

        return fallback[0] || '';
    }

    function isDescriptionBoundaryHeading(text) {
        return /^(example|input|output|reasoning|contributors?)[:：]?$/i.test(normalizeText(text));
    }

    function collectDescriptionFromProblemSection() {
        const title = normalizeText(document.querySelector('h1')?.textContent || '');
        if (!title) return '';

        const anchor = Array.from(document.querySelectorAll('h2'))
            .find((node) => normalizeText(node.textContent) === title);
        if (!anchor) return '';

        const blocks = [];
        let current = anchor.nextElementSibling;
        while (current) {
            if (/^H[1-3]$/i.test(current.tagName || '')) {
                const headingText = normalizeText(current.textContent);
                if (isDescriptionBoundaryHeading(headingText)) break;
            }

            const text = normalizeMultilineText(current.innerText || current.textContent || '');
            if (text && !isNoiseText(text) && !isLikelyBase64Text(text)) {
                blocks.push(text);
            }

            current = current.nextElementSibling;
            if (blocks.length >= 12) break;
        }

        const merged = normalizeMultilineText(blocks.join('\n\n'));
        return merged.length >= 80 ? merged : '';
    }

    function collectExampleText() {
        const heading = Array.from(document.querySelectorAll('h2, h3')).find((element) => {
            return /example/i.test(normalizeText(element.textContent));
        });

        if (!heading) return '';

        const chunks = [];
        let current = heading.nextElementSibling;
        while (current) {
            const tag = current.tagName || '';
            if (/^H[1-3]$/.test(tag)) break;
            const text = normalizeText(current.textContent);
            if (text && !isNoiseText(text) && !isLikelyBase64Text(text)) chunks.push(text);
            current = current.nextElementSibling;
        }

        return chunks.join('\n');
    }

    function collectContextSections() {
        const sections = [];
        const headings = Array.from(document.querySelectorAll('h2, h3, h4'));

        headings.forEach((heading) => {
            const title = normalizeText(heading.textContent);
            if (!/(example|debug|test|hint|note|constraint|限制|样例|调试|测试)/i.test(title)) {
                return;
            }

            const lines = [];
            let current = heading.nextElementSibling;
            while (current) {
                const tag = current.tagName || '';
                if (/^H[1-4]$/.test(tag)) break;
                const text = normalizeText(current.textContent);
                if (text) lines.push(text);
                current = current.nextElementSibling;
                if (lines.length >= 6) break;
            }

            if (!lines.length) return;
            sections.push(`${title}\n${lines.join('\n')}`);
        });

        return sections.slice(0, 4);
    }

    function collectPageCodeSnippets() {
        return Array.from(document.querySelectorAll('pre code, pre, code'))
            .map((element) => normalizeCodeText(element.textContent))
            .filter((text) => text.length >= 30)
            .filter((text) => !/^(view solution|run code)$/i.test(normalizeText(text)))
            .slice(0, 6);
    }

    function collectMonacoCode() {
        try {
            if (!(window.monaco && window.monaco.editor && typeof window.monaco.editor.getModels === 'function')) {
                return '';
            }
            const models = window.monaco.editor.getModels() || [];
            const values = models
                .map((model) => (typeof model.getValue === 'function' ? model.getValue() : ''))
                .map((text) => String(text || '').trim())
                .filter(Boolean);

            if (!values.length) return '';
            values.sort((left, right) => right.length - left.length);
            return values[0];
        } catch (error) {
            return '';
        }
    }

    function dedupeSnippets(snippets) {
        const unique = [];
        const seen = new Set();
        snippets.forEach((snippet) => {
            const cleaned = normalizeCodeText(snippet);
            if (!cleaned) return;
            const key = normalizeText(cleaned).toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            unique.push(cleaned);
        });
        return unique;
    }

    function collectCodeSnippetsWithin(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return [];
        return Array.from(root.querySelectorAll('pre code, pre, code'))
            .map((element) => normalizeCodeText(element.textContent))
            .filter((text) => text.length > 40);
    }

    function collectSolutionSnippetsAroundUnlockBanner() {
        const marker = Array.from(document.querySelectorAll('p, div, span')).find((element) => {
            const text = normalizeText(element.textContent);
            return /earn flames again/i.test(text) && text.length < 220;
        });
        if (!marker) return [];

        const snippets = [];
        let current = marker;
        for (let depth = 0; depth < 6 && current; depth += 1) {
            snippets.push(...collectCodeSnippetsWithin(current));
            current = current.parentElement;
        }
        return dedupeSnippets(snippets);
    }

    function collectSolutionSnippetsAroundSolutionHeading() {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, button, [role="heading"]'))
            .filter((element) => {
                const text = normalizeText(element.textContent);
                if (!text || text.length > 80) return false;
                if (/view solution/i.test(text)) return false;
                if (/example/i.test(text)) return false;
                return /(^solution\b|^official solution\b|题解|参考答案)/i.test(text);
            })
            .slice(0, 6);

        if (!headings.length) return [];

        const snippets = [];
        headings.forEach((heading) => {
            const container = heading.closest('section, article, div') || heading.parentElement;
            if (!container) return;
            snippets.push(...collectCodeSnippetsWithin(container));
            if (heading.nextElementSibling) {
                snippets.push(...collectCodeSnippetsWithin(heading.nextElementSibling));
            }
        });

        return dedupeSnippets(snippets);
    }

    function isInsideNoteHelperUi(element) {
        if (!element || typeof element.closest !== 'function') return false;
        return Boolean(element.closest('#torchcode-note-helper-modal, #torchcode-note-helper-toast, #code-note-helper-modal, #code-note-helper-toast'));
    }

    function hasViewSolutionGate() {
        const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        return candidates.some((element) => {
            if (isInsideNoteHelperUi(element)) return false;

            const text = normalizeText(element.textContent);
            if (!/view solution/i.test(text)) return false;
            if (text.length > 80) return false;

            const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
            if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;

            const rect = typeof element.getBoundingClientRect === 'function'
                ? element.getBoundingClientRect()
                : { width: 1, height: 1 };
            return rect.width > 0 && rect.height > 0;
        });
    }

    function isElementVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        if (typeof element.getBoundingClientRect !== 'function') return true;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function isTabActive(element) {
        if (!element) return false;

        const ariaSelected = normalizeText(
            typeof element.getAttribute === 'function' ? element.getAttribute('aria-selected') : ''
        ).toLowerCase();
        if (ariaSelected === 'true') return true;
        if (ariaSelected === 'false') return false;

        const state = normalizeText(element?.dataset?.state || '').toLowerCase();
        if (state === 'active' || state === 'selected' || state === 'open') return true;
        if (state === 'inactive' || state === 'closed') return false;

        const className = String(element.className || '').toLowerCase();
        if (/\binactive\b/.test(className)) return false;
        return /\b(active|selected|current)\b/.test(className);
    }

    function findTabButton(textPattern) {
        const candidates = Array.from(document.querySelectorAll('button, [role="tab"], a'));
        return candidates.find((element) => {
            const text = normalizeText(element.textContent);
            if (!text || text.length > 40) return false;
            if (!textPattern.test(text)) return false;
            return isElementVisible(element);
        }) || null;
    }

    function getSolutionTabState() {
        const descriptionTab = findTabButton(/^problem description$/i);
        const solutionTab = findTabButton(/^solution$/i);
        return {
            descriptionTab,
            solutionTab,
            isDescriptionActive: isTabActive(descriptionTab),
            isSolutionActive: isTabActive(solutionTab)
        };
    }

    async function switchToSolutionTabIfNeeded() {
        const state = getSolutionTabState();
        if (!state.solutionTab) {
            return { attempted: false, clicked: false, state };
        }
        if (state.isSolutionActive) {
            return { attempted: false, clicked: false, state };
        }

        try {
            state.solutionTab.click();
        } catch (error) {
            return { attempted: true, clicked: false, state };
        }
        return { attempted: true, clicked: true, state: getSolutionTabState() };
    }

    function collectVisibleSolutionContent() {
        const solutionHeadingSnippets = collectSolutionSnippetsAroundSolutionHeading();
        if (solutionHeadingSnippets.length) {
            return {
                solutionVisible: true,
                solutionContent: solutionHeadingSnippets.join('\n\n'),
                solutionSnippetCount: solutionHeadingSnippets.length,
                solutionStatus: 'ok'
            };
        }

        const gateVisible = hasViewSolutionGate();
        if (gateVisible) {
            return {
                solutionVisible: false,
                solutionContent: '',
                solutionSnippetCount: 0,
                solutionStatus: 'gate_closed'
            };
        }

        const unlockedSnippets = collectSolutionSnippetsAroundUnlockBanner();
        if (unlockedSnippets.length) {
            return {
                solutionVisible: true,
                solutionContent: unlockedSnippets.join('\n\n'),
                solutionSnippetCount: unlockedSnippets.length,
                solutionStatus: 'ok'
            };
        }

        return {
            solutionVisible: false,
            solutionContent: '',
            solutionSnippetCount: 0,
            solutionStatus: 'not_detected'
        };
    }

    async function collectVisibleSolutionContentWithFallback() {
        let solutionState = collectVisibleSolutionContent();
        if (solutionState.solutionVisible || solutionState.solutionStatus === 'gate_closed') {
            return {
                ...solutionState,
                solutionAutoSwitched: false
            };
        }

        const switchResult = await switchToSolutionTabIfNeeded();
        if (!switchResult.attempted) {
            if (switchResult.state.solutionTab && switchResult.state.isDescriptionActive) {
                return {
                    ...solutionState,
                    solutionStatus: 'need_solution_tab',
                    solutionAutoSwitched: false
                };
            }
            return {
                ...solutionState,
                solutionAutoSwitched: false
            };
        }

        if (!switchResult.clicked) {
            return {
                ...solutionState,
                solutionStatus: 'need_solution_tab',
                solutionAutoSwitched: false
            };
        }

        for (let index = 0; index < 14; index += 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            solutionState = collectVisibleSolutionContent();
            if (solutionState.solutionVisible || solutionState.solutionStatus === 'gate_closed') {
                break;
            }
        }

        return {
            ...solutionState,
            solutionAutoSwitched: true
        };
    }

    async function collectProblemApiData(problemId) {
        if (!problemId) return null;

        try {
            const response = await fetch(`https://api.deep-ml.com/fetch-problem?problem_id=${encodeURIComponent(problemId)}`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) return null;
            const payload = await response.json();
            return payload && typeof payload === 'object' ? payload : null;
        } catch (error) {
            return null;
        }
    }

    async function collectPageData() {
        await waitForProblemReady();

        const problemId = getProblemIdFromUrl(window.location.href);
        const apiData = await collectProblemApiData(problemId);
        const heading = normalizeText(document.querySelector('h1')?.textContent || '');

        const difficulty = collectDifficulty() || normalizeText(apiData && (apiData.difficulty || apiData.level));
        const apiDescription = normalizeApiMarkdownText(apiData && (apiData.description || apiData.problem_description));
        const description = apiDescription || collectDescription();
        const example = collectExampleText() || normalizeApiText(apiData && apiData.example);
        const learnContent = normalizeApiMarkdownText(apiData && (apiData.learn_section || apiData.learn || ''))
            || normalizeApiText(apiData && (apiData.learn_section || apiData.learn || ''));
        const starterCode = String((apiData && (apiData.starter_code || apiData.starterCode)) || '').trim();
        const currentCode = collectMonacoCode() || starterCode;
        const contextSections = collectContextSections();
        const pageCodeSnippets = collectPageCodeSnippets();

        const solutionState = await collectVisibleSolutionContentWithFallback();

        return {
            sourceType: 'deep-ml',
            sourceLabel: 'Deep-ML 题库',
            sourceUrl: window.location.href,
            problemId,
            slug: problemId ? `deepml-${problemId}` : 'deepml-problem',
            taskTitle: heading || (apiData && apiData.title) || (problemId ? `Deep-ML #${problemId}` : 'Deep-ML 题目'),
            difficulty,
            summary: description,
            description,
            example,
            rules: normalizeApiText(apiData && apiData.constraints),
            starterCode,
            currentCode,
            learnContent,
            referenceCode: solutionState.solutionVisible ? solutionState.solutionContent : '',
            solutionVisible: solutionState.solutionVisible,
            solutionContent: solutionState.solutionContent,
            solutionSnippetCount: solutionState.solutionSnippetCount || 0,
            solutionStatus: solutionState.solutionStatus || '',
            solutionAutoSwitched: Boolean(solutionState.solutionAutoSwitched),
            pageContextTexts: contextSections,
            pageCodeSnippets,
            links: {
                problem: window.location.href
            }
        };
    }

    window.TorchCodeSites = window.TorchCodeSites || {};
    window.TorchCodeSites.deepML = {
        name: 'TorchCode Deep-ML',
        matches(host) {
            const normalizedHost = String(host || '').toLowerCase();
            if (normalizedHost !== 'www.deep-ml.com' && normalizedHost !== 'deep-ml.com') {
                return false;
            }
            return /^\/problems\/[^/?#]+\/?$/i.test(window.location.pathname || '');
        },
        collectPageData
    };
})();
