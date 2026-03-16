/**
 * TorchCode 上下文工具模块
 * 版本：1.0.52
 */

(function () {
    'use strict';

    function normalizeNotebookFileName(fileName) {
        const raw = String(fileName || '').trim().replace(/\\/g, '/');
        return raw.split('/').pop() || '';
    }

    function stripNotebookExtension(fileName) {
        return normalizeNotebookFileName(fileName).replace(/\.ipynb$/i, '');
    }

    function slugFromFileName(fileName) {
        return stripNotebookExtension(fileName).replace(/^\d+_/, '').toLowerCase();
    }

    function extractNotebookPathFromUrl(url) {
        try {
            const urlObject = new URL(url || window.location.href);
            const pathname = urlObject.pathname || '';
            const matchers = [
                /\/doc\/tree\/(.+\.ipynb)/i,
                /\/lab\/tree\/(.+\.ipynb)/i,
                /\/tree\/(.+\.ipynb)/i,
                /\/([^/?#]+\.ipynb)$/i
            ];

            for (const matcher of matchers) {
                const match = pathname.match(matcher);
                if (match && match[1]) {
                    return match[1].replace(/^\/+/, '');
                }
            }
        } catch (error) {
            console.warn('[TorchCode] 解析 notebook 路径失败：', error);
        }
        return '';
    }

    function cleanCellText(text) {
        return String(text || '')
            .replace(/\r\n/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/^\[\s*\d*\s*\]:\s*/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function extractNotebookPartsFromContent(notebookContent) {
        const notebook = notebookContent && notebookContent.content && Array.isArray(notebookContent.content.cells)
            ? notebookContent.content
            : notebookContent;

        const markdownTexts = [];
        const codeTexts = [];

        (notebook && Array.isArray(notebook.cells) ? notebook.cells : []).forEach((cell) => {
            const text = cleanCellText(Array.isArray(cell.source) ? cell.source.join('') : cell.source);
            if (!text) return;

            if (cell.cell_type === 'markdown') {
                markdownTexts.push(text);
                return;
            }

            if (cell.cell_type === 'code') {
                codeTexts.push(text);
            }
        });

        return {
            markdownTexts,
            codeTexts
        };
    }

    function getCatalogTask(fileName) {
        const catalog = window.TorchCodeCatalog;
        if (!catalog || !catalog.tasks) return null;
        return catalog.tasks[normalizeNotebookFileName(fileName)] || null;
    }

    function buildFallbackTask(fileName) {
        const normalizedFileName = normalizeNotebookFileName(fileName);
        const slug = slugFromFileName(normalizedFileName);
        const prettyTitle = slug
            .split('_')
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        return {
            slug,
            templateFileName: normalizedFileName,
            title: prettyTitle || normalizedFileName,
            difficulty: '',
            heading: prettyTitle || normalizedFileName,
            summary: '',
            signature: '',
            rules: '',
            example: '',
            overviewMarkdown: '',
            solutionOverviewMarkdown: '',
            starterCode: '',
            exampleCode: '',
            submitCode: '',
            referenceCode: '',
            links: {
                githubTemplate: '',
                githubSolution: ''
            }
        };
    }

    function extractImplementationCode(codeTexts, task) {
        const list = Array.isArray(codeTexts) ? codeTexts : [];
        const preferred = list.find((code) => code.includes('YOUR IMPLEMENTATION HERE'));
        if (preferred) return preferred;

        const taskSignature = String(task && task.signature || '');
        const signatureName = taskSignature.match(/(?:def|class)\s+([A-Za-z0-9_]+)/)?.[1] || '';

        if (signatureName) {
            const bySignature = list.find((code) => new RegExp(`(?:def|class)\\s+${signatureName}\\b`).test(code));
            if (bySignature) return bySignature;
        }

        const ranked = list
            .filter((code) => !code.includes('pip install'))
            .filter((code) => !/from\s+torch_judge\s+import\s+check/.test(code))
            .filter((code) => !/check\(\s*["']/.test(code))
            .sort((left, right) => right.length - left.length);

        return ranked[0] || '';
    }

    function extractSignatureFromCode(code) {
        const text = String(code || '');
        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        const matched = lines.find((line) => /^(def|class)\s+[A-Za-z_][A-Za-z0-9_]*\s*/.test(line));
        return matched || '';
    }

    function buildPromptContextFromNotebook(pageData) {
        const normalizedFileName = normalizeNotebookFileName(pageData.fileName || extractNotebookPathFromUrl(pageData.sourceUrl));
        const task = getCatalogTask(normalizedFileName) || buildFallbackTask(normalizedFileName);

        const liveParts = {
            markdownTexts: Array.isArray(pageData.markdownTexts) ? pageData.markdownTexts.filter(Boolean) : [],
            codeTexts: Array.isArray(pageData.codeTexts) ? pageData.codeTexts.filter(Boolean) : []
        };

        const currentCode = extractImplementationCode(liveParts.codeTexts, task) || task.starterCode || '';
        const allCode = liveParts.codeTexts.length > 0 ? liveParts.codeTexts : [
            task.starterCode,
            task.exampleCode,
            task.submitCode
        ].filter(Boolean);

        return {
            sourceType: 'torchcode-workspace',
            fileName: normalizedFileName,
            notebookPath: pageData.notebookPath || normalizedFileName,
            slug: task.slug || slugFromFileName(normalizedFileName),
            taskTitle: task.title || normalizedFileName,
            difficulty: task.difficulty || '',
            sourceLabel: pageData.sourceLabel || 'TorchCode 工作区',
            sourceUrl: pageData.sourceUrl || window.location.href,
            summary: task.summary || '',
            signature: task.signature || extractSignatureFromCode(currentCode || task.starterCode),
            rules: task.rules || '',
            example: task.example || '',
            overviewMarkdown: task.overviewMarkdown || '',
            solutionOverviewMarkdown: task.solutionOverviewMarkdown || '',
            starterCode: task.starterCode || '',
            currentCode,
            allCode,
            referenceCode: task.referenceCode || '',
            exampleCode: task.exampleCode || '',
            submitCode: task.submitCode || '',
            links: task.links || {},
            markdownTexts: liveParts.markdownTexts.length > 0 ? liveParts.markdownTexts : [task.overviewMarkdown].filter(Boolean),
            codeTexts: allCode,
            learnContent: ''
        };
    }

    function normalizeDeepMlDifficulty(raw) {
        const value = String(raw || '').trim();
        if (!value) return '';
        const normalized = value.toLowerCase();
        if (normalized === 'easy') return 'Easy';
        if (normalized === 'medium') return 'Medium';
        if (normalized === 'hard') return 'Hard';
        return value;
    }

    function buildPromptContextFromDeepML(pageData) {
        const problemId = String(pageData.problemId || '').trim();
        const taskTitle = String(pageData.taskTitle || '').trim() || (problemId ? `Deep-ML #${problemId}` : 'Deep-ML 题目');
        const difficulty = normalizeDeepMlDifficulty(pageData.difficulty);
        const description = cleanCellText(pageData.description || pageData.summary || '');
        const learnContent = cleanCellText(pageData.learnContent || '');
        const starterCode = String(pageData.starterCode || '').trim();
        const currentCode = String(pageData.currentCode || '').trim() || starterCode;
        const referenceCode = String(pageData.referenceCode || pageData.solutionCode || '').trim();
        const rules = cleanCellText(pageData.rules || '');
        const example = cleanCellText(pageData.example || '');
        const summary = description || cleanCellText(pageData.summary || '');
        const pageContextTexts = Array.isArray(pageData.pageContextTexts) ? pageData.pageContextTexts.filter(Boolean) : [];
        const pageCodeSnippets = Array.isArray(pageData.pageCodeSnippets) ? pageData.pageCodeSnippets.filter(Boolean) : [];

        return {
            sourceType: 'deep-ml',
            slug: pageData.slug || (problemId ? `deepml-${problemId}` : 'deepml-problem'),
            taskTitle,
            difficulty,
            sourceLabel: pageData.sourceLabel || 'Deep-ML 题库',
            sourceUrl: pageData.sourceUrl || window.location.href,
            summary,
            description,
            signature: extractSignatureFromCode(starterCode || currentCode),
            rules,
            example,
            starterCode,
            currentCode,
            allCode: [currentCode, starterCode, referenceCode, ...pageCodeSnippets].filter(Boolean),
            referenceCode,
            links: pageData.links || {},
            markdownTexts: [
                description,
                learnContent,
                pageData.solutionVisible ? pageData.solutionContent : '',
                ...pageContextTexts
            ].filter(Boolean),
            codeTexts: [currentCode, starterCode, referenceCode, ...pageCodeSnippets].filter(Boolean),
            learnContent,
            solutionVisible: Boolean(pageData.solutionVisible),
            solutionContent: String(pageData.solutionContent || '').trim(),
            solutionSnippetCount: Number(pageData.solutionSnippetCount || 0),
            solutionStatus: String(pageData.solutionStatus || '').trim(),
            solutionAutoSwitched: Boolean(pageData.solutionAutoSwitched),
            problemId
        };
    }

    function buildPromptContext(pageData) {
        if (pageData && pageData.sourceType === 'deep-ml') {
            return buildPromptContextFromDeepML(pageData);
        }
        return buildPromptContextFromNotebook(pageData || {});
    }

    window.TorchCodeNotebookUtils = {
        normalizeNotebookFileName,
        stripNotebookExtension,
        slugFromFileName,
        extractNotebookPathFromUrl,
        cleanCellText,
        extractNotebookPartsFromContent,
        getCatalogTask,
        buildFallbackTask,
        extractImplementationCode,
        extractSignatureFromCode,
        buildPromptContextFromNotebook,
        buildPromptContextFromDeepML,
        buildPromptContext
    };
})();
