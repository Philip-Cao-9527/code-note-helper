/**
 * 笔记网页逻辑
 * 版本：1.1.1
 */

(function () {
    'use strict';

    const elements = {
        notebookTitle: document.getElementById('notebook-title'),
        notebookMeta: document.getElementById('notebook-meta'),
        notebookSearchInput: document.getElementById('notebook-search'),
        notebookStatusFilter: document.getElementById('notebook-status-filter'),
        notebookSortMode: document.getElementById('notebook-sort-mode'),
        notebookList: document.getElementById('notebook-list'),
        noteTitle: document.getElementById('note-title'),
        noteSubtitle: document.getElementById('note-subtitle'),
        noteEditor: document.getElementById('note-editor'),
        notePreview: document.getElementById('note-preview'),
        previewToc: document.getElementById('preview-toc'),
        saveStatus: document.getElementById('save-status'),
        saveToast: document.getElementById('save-toast'),
        saveNoteBtn: document.getElementById('save-note-btn'),
        openProblemBtn: document.getElementById('open-problem-btn'),
        exportNotesBtn: document.getElementById('export-notes-btn'),
        toggleLayoutBtn: document.getElementById('toggle-layout-btn')
    };

    const state = {
        store: null,
        source: 'problems',
        listId: '',
        initialUrl: '',
        initialTitle: '',
        initialSite: '',
        initialProblemKey: '',
        initialCanonicalId: '',
        initialTitleSlug: '',
        layoutMode: 'split',
        dirty: false,
        notebookTitle: '题目笔记本',
        notebookEntries: [],
        activeKey: '',
        previewTocEntries: [],
        activeTocTarget: '',
        query: '',
        statusFilter: 'all',
        sortMode: 'updated_desc'
    };

    const layoutModes = ['split', 'preview-only', 'editor-only'];
    let previewTimer = null;
    let saveToastTimer = null;
    let hasBeforeUnloadGuardBound = false;
    let themeRemoveListener = null;

    function getDefaultViewState() {
        return {
            query: '',
            statusFilter: 'all',
            sortMode: 'updated_desc'
        };
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

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function hasSavedNote(noteContent) {
        return String(noteContent || '').trim().length > 0;
    }

    function normalizeSearchText(text) {
        return String(text || '').trim().toLowerCase();
    }

    function normalizeMarkdownText(text) {
        return String(text || '').replace(/\r\n/g, '\n').trim();
    }

    function normalizeDisplayMathForPreview(markdown) {
        const source = String(markdown || '').replace(/\r\n/g, '\n');
        const codeBlocks = [];
        const protectedText = source.replace(/```[\s\S]*?```/g, (block) => {
            const token = `__NOTES_CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(block);
            return token;
        });

        let normalizedText = protectedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, formulaBody) => {
            const compactFormula = String(formulaBody || '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .join(' ');

            if (!compactFormula) return match;
            return `\\[${compactFormula}\\]`;
        });

        normalizedText = normalizedText.replace(/__NOTES_CODE_BLOCK_(\d+)__/g, (_, index) => {
            const blockIndex = Number(index);
            return codeBlocks[blockIndex] || '';
        });

        return normalizedText;
    }

    function shouldBlockNavigationByDirty(isDirty) {
        return Boolean(isDirty);
    }

    function sanitizeFileName(text) {
        return String(text || '')
            .replace(/[\\/:*?"<>|]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
    }

    function buildTocAnchorSlug(text, index) {
        const normalized = String(text || '')
            .trim()
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (normalized) return normalized;
        return `section-${index + 1}`;
    }

    function collectPreviewTocEntries(previewElement) {
        if (!previewElement || typeof previewElement.querySelectorAll !== 'function') {
            return [];
        }

        const headings = Array.from(previewElement.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        if (!headings.length) return [];

        const slugCounter = new Map();
        return headings.reduce((entries, heading, index) => {
            const level = Number(String(heading.tagName || '').replace(/[^\d]/g, '')) || 1;
            const text = String(heading.textContent || '').trim();
            if (!text) return entries;

            const slugBase = buildTocAnchorSlug(text, index);
            const slugCount = (slugCounter.get(slugBase) || 0) + 1;
            slugCounter.set(slugBase, slugCount);
            const slug = slugCount > 1 ? `${slugBase}-${slugCount}` : slugBase;
            const targetId = `note-heading-${slug}`;
            heading.id = targetId;

            entries.push({
                targetId,
                level: Math.min(Math.max(level, 1), 6),
                text
            });
            return entries;
        }, []);
    }

    function formatExportStamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        return `${year}${month}${day}-${hour}${minute}`;
    }

    function setStatus(text, isError) {
        if (!elements.saveStatus) return;
        elements.saveStatus.textContent = text || '';
        const footer = elements.saveStatus.closest('.workspace-footer');
        if (!footer) return;
        footer.classList.toggle('error', Boolean(isError));
    }

    function showSaveToast(text, isError) {
        if (!elements.saveToast) return;
        if (saveToastTimer) {
            clearTimeout(saveToastTimer);
            saveToastTimer = null;
        }

        elements.saveToast.textContent = text || '';
        elements.saveToast.classList.toggle('error', Boolean(isError));
        elements.saveToast.classList.add('show');

        saveToastTimer = setTimeout(() => {
            if (!elements.saveToast) return;
            elements.saveToast.classList.remove('show');
            elements.saveToast.classList.remove('error');
        }, 2200);
    }

    function downloadMarkdownFile(markdownContent, fileName) {
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    }

    function collectSavedEntries() {
        return state.notebookEntries.filter((entry) => hasSavedNote(entry.noteContent));
    }

    function buildExportMarkdown(savedEntries) {
        const scopeLabel = state.source === 'lists' ? '当前题单笔记清单' : '题目笔记清单';
        const title = state.source === 'lists'
            ? state.notebookTitle.replace(/笔记本/g, '') || '题单'
            : '题目笔记本';

        const lines = [
            `# ${title} - 笔记导出`,
            '',
            `- 导出范围：${scopeLabel}`,
            `- 导出时间：${formatDateTime(new Date().toISOString())}`,
            `- 笔记数量：${savedEntries.length}`,
            ''
        ];

        savedEntries.forEach((entry, index) => {
            const content = normalizeMarkdownText(entry.noteContent);
            if (!content) return;

            lines.push('---');
            lines.push('');
            lines.push(`## ${index + 1}. ${entry.title || '未命名题目'}`);
            if (entry.url) {
                lines.push(`- 题目链接：${entry.url}`);
            }
            lines.push(`- 最近更新：${formatDateTime(entry.updatedAt)}`);
            lines.push('');
            lines.push(content);
            lines.push('');
        });

        return `${lines.join('\n').trim()}\n`;
    }

    async function handleExportNotes() {
        const savedEntries = collectSavedEntries();
        if (!savedEntries.length) {
            setStatus('当前清单没有可导出的笔记内容', true);
            return;
        }

        try {
            const scopeName = state.source === 'lists'
                ? state.notebookTitle.replace(/笔记本/g, '') || 'list-notes'
                : 'problem-notes';
            const fileName = `${sanitizeFileName(scopeName) || 'notes'}-${formatExportStamp()}.md`;
            const markdown = buildExportMarkdown(savedEntries);
            downloadMarkdownFile(markdown, fileName);
            setStatus(`导出成功：共导出 ${savedEntries.length} 篇笔记`);
        } catch (error) {
            console.error('[Notes] 导出失败：', error);
            setStatus('导出失败，请稍后重试', true);
        }
    }

    function getActiveEntry() {
        return state.notebookEntries.find((entry) => entry.key === state.activeKey) || null;
    }

    function getLayoutButtonLabel(layoutMode) {
        if (layoutMode === 'split') return '仅预览';
        if (layoutMode === 'preview-only') return '仅源码';
        return '双栏';
    }

    function applyLayoutMode(layoutMode) {
        state.layoutMode = layoutMode;
        document.body.classList.remove('layout-split', 'layout-preview-only', 'layout-editor-only');
        if (layoutMode === 'preview-only') {
            document.body.classList.add('layout-preview-only');
        } else if (layoutMode === 'editor-only') {
            document.body.classList.add('layout-editor-only');
        } else {
            document.body.classList.add('layout-split');
        }
        if (elements.toggleLayoutBtn) {
            elements.toggleLayoutBtn.textContent = getLayoutButtonLabel(layoutMode);
        }
        applyPreviewTocVisibility();
    }

    function cycleLayoutMode() {
        const index = layoutModes.indexOf(state.layoutMode);
        const next = layoutModes[(index + 1 + layoutModes.length) % layoutModes.length];
        applyLayoutMode(next);
    }

    function renderMath() {
        if (!elements.notePreview || typeof window.renderMathInElement !== 'function') return;
        try {
            window.renderMathInElement(elements.notePreview, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false,
                ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            });
        } catch (error) {
            console.warn('[Notes] 公式渲染失败：', error);
        }
    }

    function applyPreviewTocVisibility() {
        const canShow = state.layoutMode === 'preview-only' && state.previewTocEntries.length > 0;
        if (typeof document !== 'undefined' && document && document.body && document.body.classList) {
            document.body.classList.toggle('show-preview-toc', canShow);
        }
        if (elements.previewToc) {
            elements.previewToc.hidden = !canShow;
        }
    }

    function setActiveTocTarget(targetId) {
        state.activeTocTarget = String(targetId || '').trim();
        if (!elements.previewToc || typeof elements.previewToc.querySelectorAll !== 'function') return;
        const buttons = Array.from(elements.previewToc.querySelectorAll('[data-toc-target]'));
        buttons.forEach((button) => {
            const currentTarget = String(button.getAttribute('data-toc-target') || '').trim();
            button.classList.toggle('active', Boolean(state.activeTocTarget) && currentTarget === state.activeTocTarget);
        });
    }

    function renderPreviewToc() {
        if (!elements.previewToc) return;

        const entries = collectPreviewTocEntries(elements.notePreview);
        state.previewTocEntries = entries;
        if (!entries.length) {
            elements.previewToc.innerHTML = '';
            state.activeTocTarget = '';
            applyPreviewTocVisibility();
            return;
        }

        elements.previewToc.innerHTML = `
          <div class="preview-toc-title">目录</div>
          <div class="preview-toc-list">
            ${entries.map((entry) => `
              <button
                type="button"
                class="preview-toc-item level-${entry.level}"
                data-toc-target="${escapeHtml(entry.targetId)}"
                title="${escapeHtml(entry.text)}">
                <span class="preview-toc-text">${escapeHtml(entry.text)}</span>
              </button>
            `).join('')}
          </div>
        `;
        setActiveTocTarget(entries[0].targetId);
        applyPreviewTocVisibility();
    }

    function renderPreview() {
        const markdown = elements.noteEditor ? elements.noteEditor.value : '';
        const previewMarkdown = normalizeDisplayMathForPreview(markdown);
        const renderer = window.MarkdownRenderer && window.MarkdownRenderer.renderMarkdown;
        try {
            if (typeof renderer === 'function') {
                elements.notePreview.innerHTML = renderer(previewMarkdown);
            } else {
                elements.notePreview.innerHTML = `<pre>${escapeHtml(previewMarkdown)}</pre>`;
            }
        } catch (error) {
            console.warn('[Notes] Markdown 渲染失败，回退纯文本：', error);
            elements.notePreview.innerHTML = `<pre>${escapeHtml(previewMarkdown)}</pre>`;
        }
        renderMath();
        renderPreviewToc();
    }

    function bindBeforeUnloadGuard() {
        if (hasBeforeUnloadGuardBound) return;
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
        hasBeforeUnloadGuardBound = true;

        window.addEventListener('beforeunload', (event) => {
            if (!shouldBlockNavigationByDirty(state.dirty)) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    function normalizeCanonicalByUrl(url) {
        const normalizedUrl = String(url || '').trim();
        if (!normalizedUrl) return '';
        if (!state.store || typeof state.store.extractProblemIdentity !== 'function') {
            return normalizedUrl;
        }
        const identity = state.store.extractProblemIdentity(normalizedUrl);
        if (identity && identity.supported && identity.canonicalId) {
            return identity.canonicalId;
        }
        return normalizedUrl;
    }

    function normalizeCanonicalByStableFields(siteInput, problemKeyInput, titleSlugInput) {
        const site = String(siteInput || '').trim().toLowerCase();
        const problemKey = String(problemKeyInput || titleSlugInput || '').trim();
        if (!site || !problemKey) return '';

        if (state.store && typeof state.store.createIdentityFromSiteAndProblemKey === 'function') {
            const identity = state.store.createIdentityFromSiteAndProblemKey(site, problemKey);
            if (identity && identity.supported && identity.canonicalId) {
                return identity.canonicalId;
            }
        }

        if (site === 'leetcode.cn' || site === 'leetcode.com') return `leet:${problemKey}`;
        if (site === 'codefun2000.com') return `codefun:${problemKey}`;
        if (site === 'deep-ml.com') return `deepml:${problemKey}`;
        if (site === 'duoan-torchcode.hf.space') return `torchcode:${problemKey}`;
        return '';
    }

    function buildUrlFromStableFields(siteInput, problemKeyInput, titleSlugInput) {
        const site = String(siteInput || '').trim().toLowerCase();
        const problemKey = String(problemKeyInput || titleSlugInput || '').trim();
        if (!site || !problemKey) return '';

        if (state.store && typeof state.store.buildProblemUrlFromSiteAndProblemKey === 'function') {
            const resolved = String(state.store.buildProblemUrlFromSiteAndProblemKey(site, problemKey) || '').trim();
            if (resolved) return resolved;
        }

        if (site === 'leetcode.cn' || site === 'leetcode.com') {
            return `https://${site}/problems/${problemKey}/`;
        }
        if (site === 'codefun2000.com') {
            return `https://${site}/p/${problemKey}`;
        }
        if (site === 'deep-ml.com') {
            return `https://${site}/problems/${problemKey}`;
        }
        if (site === 'duoan-torchcode.hf.space') {
            const normalizedKey = problemKey.replace(/\.ipynb$/i, '');
            return `https://${site}/tree/${normalizedKey}.ipynb`;
        }
        return '';
    }

    function parseIsoTime(value) {
        const stamp = Date.parse(value || '');
        return Number.isNaN(stamp) ? 0 : stamp;
    }

    function buildCanonicalRecordMap(recordMap) {
        const canonicalMap = new Map();
        Object.values(recordMap || {}).forEach((record) => {
            if (!record) return;
            const canonicalId = record.canonicalId
                || normalizeCanonicalByUrl(record.url || record.baseUrl || '')
                || normalizeCanonicalByStableFields(record.site, record.problemKey, record.titleSlug);
            if (!canonicalId) return;
            const existing = canonicalMap.get(canonicalId);
            if (!existing || parseIsoTime(record.updatedAt) >= parseIsoTime(existing.updatedAt)) {
                canonicalMap.set(canonicalId, record);
            }
        });
        return canonicalMap;
    }

    function buildEntryFromRecord(record) {
        const site = String(record.site || '').trim().toLowerCase();
        const problemKey = String(record.problemKey || record.titleSlug || '').trim();
        const recoveredUrl = buildUrlFromStableFields(site, problemKey, record.titleSlug);
        const canonicalId = record.canonicalId
            || normalizeCanonicalByUrl(record.url || record.baseUrl || recoveredUrl)
            || normalizeCanonicalByStableFields(site, problemKey, record.titleSlug);
        return {
            key: record.id || canonicalId || `record:${Math.random().toString(36).slice(2)}`,
            canonicalId: canonicalId || '',
            title: record.title || record.problemKey || '未命名题目',
            url: record.url || record.baseUrl || recoveredUrl || '',
            site,
            problemKey,
            titleSlug: String(record.titleSlug || '').trim(),
            noteContent: record.noteContent || '',
            updatedAt: record.updatedAt || '',
            hasSavedNote: hasSavedNote(record.noteContent || ''),
            order: Number(record.order || 0)
        };
    }

    function buildEntryFromListItem(item) {
        const matched = item.matchedRecord || {};
        const site = String(item.site || matched.site || '').trim().toLowerCase();
        const problemKey = String(item.problemKey || item.titleSlug || matched.problemKey || '').trim();
        const titleSlug = String(item.titleSlug || matched.titleSlug || '').trim();
        const recoveredUrl = buildUrlFromStableFields(site, problemKey, titleSlug);
        const canonicalId = item.canonicalId
            || matched.canonicalId
            || normalizeCanonicalByUrl(item.url || item.baseUrl || matched.url || matched.baseUrl || recoveredUrl)
            || normalizeCanonicalByStableFields(site, problemKey, titleSlug);
        return {
            key: canonicalId || `list-item:${item.order || item.frontendQuestionId || item.titleSlug || Math.random().toString(36).slice(2)}`,
            canonicalId: canonicalId || '',
            title: item.translatedTitle || item.title || item.titleSlug || '未命名题目',
            url: item.url || item.baseUrl || matched.url || matched.baseUrl || recoveredUrl || '',
            site,
            problemKey,
            titleSlug,
            noteContent: matched.noteContent || '',
            updatedAt: matched.updatedAt || '',
            hasSavedNote: hasSavedNote(matched.noteContent || ''),
            order: Number(item.order || 0)
        };
    }

    function sortEntries(entries) {
        return entries.slice().sort((left, right) => {
            if (left.order && right.order) return left.order - right.order;
            return String(left.title || '').localeCompare(String(right.title || ''));
        });
    }

    function sortEntriesByUpdatedAt(entries, sortMode) {
        const mode = sortMode === 'updated_asc' ? 'updated_asc' : 'updated_desc';
        return entries.slice().sort((left, right) => {
            const leftStamp = parseIsoTime(left.updatedAt);
            const rightStamp = parseIsoTime(right.updatedAt);
            const diff = mode === 'updated_asc' ? leftStamp - rightStamp : rightStamp - leftStamp;
            if (diff !== 0) return diff;
            if (left.order && right.order) return left.order - right.order;
            return String(left.title || '').localeCompare(String(right.title || ''));
        });
    }

    function buildEntrySearchText(entry) {
        return [
            entry.title,
            entry.canonicalId,
            entry.url,
            entry.site,
            entry.problemKey,
            entry.titleSlug
        ].filter(Boolean).join(' ').toLowerCase();
    }

    function getVisibleEntriesByState(entries, viewState) {
        const source = Array.isArray(entries) ? entries : [];
        const query = normalizeSearchText(viewState && viewState.query);
        const statusFilter = String(viewState && viewState.statusFilter || 'all').trim();
        const sortMode = String(viewState && viewState.sortMode || 'updated_desc').trim();

        const filtered = source.filter((entry) => {
            if (statusFilter === 'saved' && !entry.hasSavedNote) return false;
            if (statusFilter === 'unsaved' && entry.hasSavedNote) return false;
            if (!query) return true;
            return buildEntrySearchText(entry).includes(query);
        });

        return sortEntriesByUpdatedAt(filtered, sortMode);
    }

    function getVisibleEntries(entries) {
        return getVisibleEntriesByState(entries, {
            query: state.query,
            statusFilter: state.statusFilter,
            sortMode: state.sortMode
        });
    }

    function hasViewFilterApplied() {
        return Boolean(normalizeSearchText(state.query)) || state.statusFilter !== 'all';
    }

    function escapeSelectorValue(value) {
        if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
            return CSS.escape(String(value || ''));
        }
        return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function scrollActiveEntryIntoView(container, activeKey, behavior) {
        if (!container || !activeKey || typeof container.querySelector !== 'function') {
            return false;
        }
        const selector = `[data-note-key="${escapeSelectorValue(activeKey)}"]`;
        const target = container.querySelector(selector);
        if (!target || typeof target.scrollIntoView !== 'function') {
            return false;
        }
        target.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: behavior || 'auto'
        });
        return true;
    }

    async function loadEntriesFromRawList(listId) {
        if (!state.store || typeof state.store.getProblemLists !== 'function' || typeof state.store.getProblemRecords !== 'function') {
            return null;
        }

        const [rawLists, recordMap] = await Promise.all([
            state.store.getProblemLists(),
            state.store.getProblemRecords()
        ]);

        const list = rawLists && rawLists[listId];
        if (!list) return null;

        const canonicalMap = buildCanonicalRecordMap(recordMap);
        const entries = sortEntries((list.items || []).map((item) => {
            const canonicalId = item.canonicalId || normalizeCanonicalByUrl(item.url || item.baseUrl || '');
            const matchedRecord = canonicalMap.get(canonicalId) || null;
            return buildEntryFromListItem({
                ...item,
                matchedRecord
            });
        }));

        return {
            notebookTitle: `${list.title || '题单'}笔记本`,
            entries
        };
    }

    async function loadEntriesFromListProgress(listId) {
        if (!state.store || typeof state.store.getProblemListsWithProgress !== 'function') {
            return null;
        }

        const lists = await state.store.getProblemListsWithProgress();
        const list = (lists || []).find((item) => item.listId === listId);
        if (!list) return null;

        return {
            notebookTitle: `${list.title || '题单'}笔记本`,
            entries: sortEntries((list.items || []).map(buildEntryFromListItem))
        };
    }

    async function loadNotebookEntries() {
        if (state.source === 'lists' && state.listId) {
            const rawResult = await loadEntriesFromRawList(state.listId);
            if (rawResult) {
                state.notebookTitle = rawResult.notebookTitle;
                state.notebookEntries = rawResult.entries;
                return;
            }

            const fallbackResult = await loadEntriesFromListProgress(state.listId);
            if (fallbackResult) {
                state.notebookTitle = fallbackResult.notebookTitle;
                state.notebookEntries = fallbackResult.entries;
                return;
            }

            state.notebookTitle = '当前题单笔记本';
            state.notebookEntries = [];
            return;
        }

        const records = await state.store.getSortedProblemRecords();
        state.notebookTitle = '题目笔记本';
        state.notebookEntries = (records || []).map(buildEntryFromRecord);
    }

    function resolveInitialEntryWithoutAutoFocus(entries, options) {
        const list = Array.isArray(entries) ? entries.slice() : [];
        const config = options || {};
        const initialUrl = String(config.initialUrl || '').trim();
        const initialSite = String(config.initialSite || '').trim().toLowerCase();
        const initialProblemKey = String(config.initialProblemKey || '').trim();
        const initialCanonicalId = String(config.initialCanonicalId || '').trim();
        const initialTitleSlug = String(config.initialTitleSlug || '').trim();
        const initialTitle = String(config.initialTitle || '').trim();
        const source = String(config.source || 'problems').trim();
        const initialCanonical = initialCanonicalId
            || normalizeCanonicalByUrl(initialUrl)
            || normalizeCanonicalByStableFields(initialSite, initialProblemKey, initialTitleSlug);
        const normalizedInitialUrl = initialUrl.replace(/\/+$/, '');
        let matchedEntry = null;

        if (initialCanonical) {
            matchedEntry = list.find((entry) => String(entry.canonicalId || '').trim() === initialCanonical) || null;
        }
        if (!matchedEntry && initialSite && initialProblemKey) {
            matchedEntry = list.find((entry) => {
                const entrySite = String(entry.site || '').trim().toLowerCase();
                const entryProblemKey = String(entry.problemKey || entry.titleSlug || '').trim();
                return entrySite === initialSite && entryProblemKey === initialProblemKey;
            }) || null;
        }
        if (!matchedEntry && normalizedInitialUrl) {
            matchedEntry = list.find((entry) => {
                const entryUrl = String(entry.url || '').trim().replace(/\/+$/, '');
                return Boolean(entryUrl) && entryUrl === normalizedInitialUrl;
            }) || null;
        }

        if (!list.length && (initialUrl || initialCanonical || (initialSite && (initialProblemKey || initialTitleSlug)))) {
            const recoveredUrl = initialUrl || buildUrlFromStableFields(initialSite, initialProblemKey, initialTitleSlug);
            const resolvedProblemKey = initialProblemKey || initialTitleSlug;
            list.unshift({
                key: initialCanonical
                    ? `canonical:${initialCanonical}`
                    : (recoveredUrl ? `url:${recoveredUrl}` : `identity:${initialSite}:${resolvedProblemKey}`),
                canonicalId: initialCanonical || '',
                title: initialTitle || (source === 'lists' ? '题单题目' : '题目'),
                url: recoveredUrl,
                site: initialSite,
                problemKey: resolvedProblemKey,
                titleSlug: initialTitleSlug,
                noteContent: '',
                updatedAt: '',
                hasSavedNote: false,
                order: 0
            });
            matchedEntry = list[0];
        }

        return {
            entries: list,
            activeKey: matchedEntry
                ? matchedEntry.key
                : (list.length ? list[0].key : '')
        };
    }

    function ensureInitialEntry() {
        const resolved = resolveInitialEntryWithoutAutoFocus(state.notebookEntries, {
            initialUrl: state.initialUrl,
            initialSite: state.initialSite,
            initialProblemKey: state.initialProblemKey,
            initialCanonicalId: state.initialCanonicalId,
            initialTitleSlug: state.initialTitleSlug,
            initialTitle: state.initialTitle,
            source: state.source
        });
        state.notebookEntries = resolved.entries;
        state.activeKey = resolved.activeKey;
    }

    function renderNotebookMeta(visibleCount) {
        const savedCount = state.notebookEntries.filter((entry) => entry.hasSavedNote).length;
        const total = state.notebookEntries.length;
        const visible = Number.isFinite(visibleCount) ? visibleCount : total;
        const showVisible = visible !== total || hasViewFilterApplied() || state.sortMode !== 'updated_desc';

        if (elements.notebookTitle) {
            elements.notebookTitle.textContent = state.notebookTitle;
        }
        if (elements.notebookMeta) {
            const visibleText = showVisible ? ` · 当前显示 ${visible}` : '';
            elements.notebookMeta.textContent = `已写笔记 ${savedCount} / ${total}${visibleText}`;
        }
    }

    function renderNotebookList(options) {
        if (!elements.notebookList) return;
        const config = options || {};
        const visibleEntries = getVisibleEntries(state.notebookEntries);
        elements.notebookList.innerHTML = '';
        renderNotebookMeta(visibleEntries.length);

        if (!state.notebookEntries.length) {
            const empty = document.createElement('div');
            empty.className = 'notebook-empty';
            empty.textContent = '还没有可展示的题目笔记。';
            elements.notebookList.appendChild(empty);
            return;
        }

        if (!visibleEntries.length) {
            const empty = document.createElement('div');
            empty.className = 'notebook-empty';
            empty.textContent = '没有找到符合筛选条件的题目。';
            elements.notebookList.appendChild(empty);
            return;
        }

        visibleEntries.forEach((entry) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `notebook-item${entry.key === state.activeKey ? ' active' : ''}`;
            button.dataset.noteKey = entry.key;

            const title = document.createElement('div');
            title.className = 'item-title';
            title.textContent = entry.title || '未命名题目';

            const meta = document.createElement('div');
            meta.className = `item-meta${entry.hasSavedNote ? ' saved' : ''}`;
            meta.textContent = entry.hasSavedNote
                ? `已保存 · ${formatDateTime(entry.updatedAt)}`
                : '未写笔记';

            button.appendChild(title);
            button.appendChild(meta);
            elements.notebookList.appendChild(button);
        });

        if (config.scrollActive) {
            scrollActiveEntryIntoView(elements.notebookList, state.activeKey, config.scrollBehavior || 'auto');
        }
    }

    function renderActiveEntry() {
        const active = getActiveEntry();
        if (!active) {
            if (elements.noteTitle) elements.noteTitle.textContent = '未找到题目';
            if (elements.noteSubtitle) elements.noteSubtitle.textContent = '请从左侧笔记本选择题目';
            if (elements.noteEditor) elements.noteEditor.value = '';
            if (elements.notePreview) elements.notePreview.innerHTML = '<div class="notebook-empty">暂无可渲染内容</div>';
            state.previewTocEntries = [];
            state.activeTocTarget = '';
            if (elements.previewToc) {
                elements.previewToc.innerHTML = '';
            }
            applyPreviewTocVisibility();
            return;
        }

        if (elements.noteTitle) {
            elements.noteTitle.textContent = active.title || '未命名题目';
        }
        if (elements.noteSubtitle) {
            const sourceLabel = state.source === 'lists' ? '来源：当前题单' : '来源：题目记录';
            const savedLabel = active.hasSavedNote ? '已保存' : '未写笔记';
            elements.noteSubtitle.textContent = `${sourceLabel} · ${savedLabel} · 最近更新：${formatDateTime(active.updatedAt)}`;
        }
        if (elements.noteEditor) {
            elements.noteEditor.value = active.noteContent || '';
        }

        state.dirty = false;
        renderPreview();
        setStatus('已加载笔记');
    }

    function switchActiveEntry(nextKey) {
        if (!nextKey || nextKey === state.activeKey) return;
        if (state.dirty) {
            const confirmed = window.confirm('当前笔记有未保存修改，确认切换吗？');
            if (!confirmed) return;
        }
        state.activeKey = nextKey;
        renderNotebookList({
            scrollActive: true,
            scrollBehavior: 'smooth'
        });
        renderActiveEntry();
    }

    async function openUrlInNewTab(url) {
        if (!url) return;
        if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.create === 'function') {
            await chrome.tabs.create({ url, active: true });
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    async function handleSave() {
        const active = getActiveEntry();
        if (!active) {
            setStatus('没有可保存的题目', true);
            return;
        }
        const resolvedUrl = String(active.url || '').trim() || buildUrlFromStableFields(active.site, active.problemKey, active.titleSlug);
        const resolvedProblemKey = String(active.problemKey || active.titleSlug || '').trim();
        const resolvedSite = String(active.site || '').trim();
        if (!resolvedUrl && !(resolvedSite && resolvedProblemKey)) {
            setStatus('当前题目缺少可用标识，无法保存', true);
            return;
        }

        const noteContent = String(elements.noteEditor ? elements.noteEditor.value : '');
        if (elements.saveNoteBtn) {
            elements.saveNoteBtn.disabled = true;
        }
        setStatus('正在保存...');

        try {
            const payload = {
                title: active.title,
                noteContent
            };
            if (resolvedUrl) {
                payload.url = resolvedUrl;
            }
            if (resolvedSite && resolvedProblemKey) {
                payload.site = resolvedSite;
                payload.problemKey = resolvedProblemKey;
            }
            const savedRecord = await state.store.saveProblemNote(payload);

            active.noteContent = noteContent;
            active.updatedAt = savedRecord && savedRecord.updatedAt ? savedRecord.updatedAt : new Date().toISOString();
            active.hasSavedNote = hasSavedNote(noteContent);
            active.url = savedRecord && (savedRecord.url || savedRecord.baseUrl)
                ? (savedRecord.url || savedRecord.baseUrl)
                : (active.url || resolvedUrl);
            active.site = savedRecord && savedRecord.site
                ? String(savedRecord.site).trim().toLowerCase()
                : resolvedSite;
            active.problemKey = savedRecord && savedRecord.problemKey
                ? String(savedRecord.problemKey).trim()
                : resolvedProblemKey;
            active.canonicalId = savedRecord && savedRecord.canonicalId
                ? savedRecord.canonicalId
                : (active.canonicalId
                    || normalizeCanonicalByUrl(active.url)
                    || normalizeCanonicalByStableFields(active.site, active.problemKey, active.titleSlug));

            state.dirty = false;
            renderNotebookList();
            renderActiveEntry();

            if (active.hasSavedNote) {
                setStatus('保存成功：已计入已保存笔记');
                showSaveToast('保存成功');
            } else {
                setStatus('保存成功：当前笔记为空，不计入已保存笔记');
                showSaveToast('已保存（当前笔记为空）');
            }
        } catch (error) {
            console.error('[Notes] 保存笔记失败：', error);
            setStatus(`保存失败：${error && error.message ? error.message : '未知错误'}`, true);
            showSaveToast('保存失败，请稍后重试', true);
        } finally {
            if (elements.saveNoteBtn) {
                elements.saveNoteBtn.disabled = false;
            }
        }
    }

    async function handleOpenProblem() {
        const active = getActiveEntry();
        if (!active) {
            setStatus('当前没有可打开的题目', true);
            return;
        }
        const resolvedUrl = String(active.url || '').trim() || buildUrlFromStableFields(active.site, active.problemKey, active.titleSlug);
        if (!resolvedUrl) {
            setStatus('当前题目缺少可用链接，无法打开', true);
            return;
        }

        try {
            active.url = resolvedUrl;
            await openUrlInNewTab(resolvedUrl);
        } catch (error) {
            console.error('[Notes] 打开题目失败：', error);
            setStatus('打开题目失败，请稍后重试', true);
        }
    }

    function resetViewState() {
        const defaults = getDefaultViewState();
        state.query = defaults.query;
        state.statusFilter = defaults.statusFilter;
        state.sortMode = defaults.sortMode;

        if (elements.notebookSearchInput) {
            elements.notebookSearchInput.value = defaults.query;
        }
        if (elements.notebookStatusFilter) {
            elements.notebookStatusFilter.value = defaults.statusFilter;
        }
        if (elements.notebookSortMode) {
            elements.notebookSortMode.value = defaults.sortMode;
        }
    }

    function updateViewStateFromControls() {
        if (elements.notebookSearchInput) {
            state.query = elements.notebookSearchInput.value || '';
        }
        if (elements.notebookStatusFilter) {
            state.statusFilter = elements.notebookStatusFilter.value || 'all';
        }
        if (elements.notebookSortMode) {
            state.sortMode = elements.notebookSortMode.value || 'updated_desc';
        }
    }

    function bindEvents() {
        if (elements.toggleLayoutBtn) {
            elements.toggleLayoutBtn.addEventListener('click', cycleLayoutMode);
        }

        if (elements.openProblemBtn) {
            elements.openProblemBtn.addEventListener('click', handleOpenProblem);
        }

        if (elements.saveNoteBtn) {
            elements.saveNoteBtn.addEventListener('click', handleSave);
        }

        if (elements.exportNotesBtn) {
            elements.exportNotesBtn.addEventListener('click', handleExportNotes);
        }

        if (elements.noteEditor) {
            elements.noteEditor.addEventListener('input', () => {
                state.dirty = true;
                setStatus('有未保存修改');
                if (previewTimer) {
                    clearTimeout(previewTimer);
                }
                previewTimer = setTimeout(() => {
                    renderPreview();
                }, 160);
            });
        }

        if (elements.notebookList) {
            elements.notebookList.addEventListener('click', (event) => {
                const target = event.target.closest('[data-note-key]');
                if (!target || target.disabled) return;
                const key = target.getAttribute('data-note-key');
                switchActiveEntry(key);
            });
        }

        if (elements.previewToc) {
            elements.previewToc.addEventListener('click', (event) => {
                const target = event.target.closest('[data-toc-target]');
                if (!target || !elements.notePreview) return;
                const tocTarget = String(target.getAttribute('data-toc-target') || '').trim();
                if (!tocTarget) return;
                const selector = `#${escapeSelectorValue(tocTarget)}`;
                const heading = elements.notePreview.querySelector(selector);
                if (!heading || typeof heading.scrollIntoView !== 'function') return;
                heading.scrollIntoView({
                    block: 'start',
                    inline: 'nearest',
                    behavior: 'smooth'
                });
                setActiveTocTarget(tocTarget);
            });
        }

        if (elements.notebookSearchInput) {
            elements.notebookSearchInput.addEventListener('input', () => {
                updateViewStateFromControls();
                renderNotebookList();
            });
        }

        if (elements.notebookStatusFilter) {
            elements.notebookStatusFilter.addEventListener('change', () => {
                updateViewStateFromControls();
                renderNotebookList();
            });
        }

        if (elements.notebookSortMode) {
            elements.notebookSortMode.addEventListener('change', () => {
                updateViewStateFromControls();
                renderNotebookList();
            });
        }
    }

    function readQuery() {
        const params = new URLSearchParams(window.location.search || '');
        const from = String(params.get('from') || '').trim();
        state.source = from === 'lists' ? 'lists' : 'problems';
        state.listId = String(params.get('listId') || '').trim();
        state.initialUrl = String(params.get('url') || '').trim();
        state.initialTitle = String(params.get('title') || '').trim();
        state.initialSite = String(params.get('site') || '').trim().toLowerCase();
        state.initialProblemKey = String(params.get('problemKey') || '').trim();
        state.initialCanonicalId = String(params.get('canonicalId') || '').trim();
        state.initialTitleSlug = String(params.get('titleSlug') || '').trim();
    }

    async function initThemeSystem() {
        if (!window.ThemeCenter) {
            console.warn('[Notes] ThemeCenter 未加载');
            return;
        }

        const initResult = await window.ThemeCenter.init();
        if (!initResult.success) {
            console.error('[Notes] 主题系统初始化失败:', initResult.error);
            return;
        }

        themeRemoveListener = window.ThemeCenter.addChangeListener((event) => {
            if (event.type === 'themeChanged') {
                console.log('[Notes] 主题已变化:', event.theme?.name);
            }
        });
    }

    async function bootstrap() {
        state.store = window.NoteHelperProblemData;
        if (!state.store ||
            typeof state.store.getSortedProblemRecords !== 'function' ||
            typeof state.store.saveProblemNote !== 'function') {
            setStatus('笔记数据仓库未加载，无法继续', true);
            return;
        }

        await initThemeSystem();

        readQuery();
        resetViewState();
        bindEvents();
        bindBeforeUnloadGuard();
        applyLayoutMode('split');

        await loadNotebookEntries();
        ensureInitialEntry();
        renderNotebookList();
        renderActiveEntry();
    }

    const notesModules = window.NoteHelperNotesModules = window.NoteHelperNotesModules || {};
    notesModules.helpers = {
        getDefaultViewState,
        hasSavedNote,
        normalizeDisplayMathForPreview,
        buildTocAnchorSlug,
        collectPreviewTocEntries,
        shouldBlockNavigationByDirty,
        sortEntriesByUpdatedAt,
        getVisibleEntriesByState,
        resolveInitialEntryWithoutAutoFocus,
        scrollActiveEntryIntoView
    };

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', () => {
            bootstrap().catch((error) => {
                console.error('[Notes] 初始化失败：', error);
                setStatus(`初始化失败：${error && error.message ? error.message : '未知错误'}`, true);
            });
        });
    }

    window.addEventListener('beforeunload', () => {
        if (themeRemoveListener) {
            themeRemoveListener();
        }
    });
})();
