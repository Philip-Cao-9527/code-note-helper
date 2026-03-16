/**
 * 刷题记录模块
 * 版本：1.0.65
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const helpers = modules.helpers || {};
    const syncCore = modules.syncCore || {};

    const STORAGE_KEYS = constants.STORAGE_KEYS;
    const STAGE_LABELS = constants.STAGE_LABELS;
    const ACTION_LABELS = constants.ACTION_LABELS;
    const STAGE_PRIORITY = constants.STAGE_PRIORITY;

    function parseTorchCodeNotebookPath(pathname) {
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

        return '';
    }

    function extractProblemIdentity(url) {
        if (!url || typeof url !== 'string') return null;

        let urlObject;
        try {
            urlObject = new URL(url);
        } catch (error) {
            console.warn('[ProblemData] 无法解析题目地址：', url, error);
            return null;
        }

        const site = helpers.normalizeHost(urlObject.hostname);
        const pathname = urlObject.pathname || '';

        if (site === 'leetcode.cn' || site === 'leetcode.com') {
            const match = pathname.match(/\/problems\/([^/?#]+)/);
            if (!match) {
                return {
                    supported: false,
                    site,
                    url: urlObject.toString(),
                    baseUrl: `${urlObject.origin}${pathname}`
                };
            }
            const problemKey = match[1];
            return {
                supported: true,
                type: 'leetcode_problem',
                site,
                problemKey,
                canonicalId: `leet:${problemKey}`,
                url: urlObject.toString(),
                baseUrl: `${urlObject.origin}/problems/${problemKey}/`
            };
        }

        if (site === 'codefun2000.com') {
            const match = pathname.match(/\/p\/([^/?#]+)/);
            const problemKey = match ? match[1] : pathname.replace(/^\/+|\/+$/g, '');
            if (!problemKey) {
                return {
                    supported: false,
                    site,
                    url: urlObject.toString(),
                    baseUrl: `${urlObject.origin}${pathname}`
                };
            }
            return {
                supported: true,
                type: 'codefun_problem',
                site,
                problemKey,
                canonicalId: `codefun:${problemKey}`,
                url: urlObject.toString(),
                baseUrl: `${urlObject.origin}/p/${problemKey}`
            };
        }

        if (site === 'deep-ml.com') {
            const match = pathname.match(/\/problems\/([^/?#]+)/i);
            if (!match || !match[1]) {
                return {
                    supported: false,
                    site,
                    url: urlObject.toString(),
                    baseUrl: `${urlObject.origin}${pathname}`
                };
            }

            const problemKey = String(match[1]).trim();
            return {
                supported: true,
                type: 'deepml_problem',
                site,
                problemKey,
                canonicalId: `deepml:${problemKey}`,
                url: urlObject.toString(),
                baseUrl: `${urlObject.origin}/problems/${problemKey}`
            };
        }

        if (site === 'duoan-torchcode.hf.space') {
            const notebookPath = parseTorchCodeNotebookPath(pathname);
            if (!notebookPath) {
                return {
                    supported: false,
                    site,
                    url: urlObject.toString(),
                    baseUrl: `${urlObject.origin}${pathname}`
                };
            }

            const normalizedNotebookPath = notebookPath.replace(/^\/+/, '');
            const fileName = normalizedNotebookPath.split('/').pop() || normalizedNotebookPath;
            const baseName = fileName
                .replace(/_solution\.ipynb$/i, '')
                .replace(/\.ipynb$/i, '');
            const normalizedProblemKey = baseName.toLowerCase();
            const normalizedCanonicalSlug = normalizedProblemKey.replace(/^\d+_/, '');

            return {
                supported: true,
                type: 'torchcode_notebook',
                site,
                problemKey: normalizedProblemKey,
                canonicalId: `torchcode:${normalizedCanonicalSlug}`,
                url: urlObject.toString(),
                baseUrl: `${urlObject.origin}${pathname}`,
                notebookPath: normalizedNotebookPath,
                notebookFileName: fileName,
                notebookSlug: normalizedCanonicalSlug
            };
        }

        return {
            supported: false,
            site,
            url: urlObject.toString(),
            baseUrl: `${urlObject.origin}${pathname}`
        };
    }

    function buildRecordId(identity) {
        return `${identity.site}:${identity.problemKey}`;
    }

    function createEmptyRecord(identity, title, now) {
        return {
            id: buildRecordId(identity),
            canonicalId: identity.canonicalId,
            site: identity.site,
            problemKey: identity.problemKey,
            title: title || identity.problemKey || '未命名题目',
            url: identity.url,
            baseUrl: identity.baseUrl,
            createdAt: now,
            updatedAt: now,
            lastActionType: null,
            lastActionAt: null,
            promptCopiedCount: 0,
            promptCopiedAt: null,
            noteGeneratedCount: 0,
            noteGeneratedAt: null,
            resultCopiedCount: 0,
            resultCopiedAt: null,
            noteSavedCount: 0,
            noteSavedAt: null,
            noteContent: ''
        };
    }

    function hasSavedNoteContent(record) {
        if (!record || typeof record.noteContent !== 'string') return false;
        return record.noteContent.trim().length > 0;
    }

    function getRecordStageCode(record) {
        if (!record) return 'none';
        if (hasSavedNoteContent(record)) return 'saved';
        if (record.noteGeneratedAt) return 'generated';
        if (record.promptCopiedAt) return 'prompt';
        return 'none';
    }

    function getRecordStage(record) {
        const code = getRecordStageCode(record);
        return {
            code,
            label: STAGE_LABELS[code] || STAGE_LABELS.none,
            priority: STAGE_PRIORITY[code] || 0
        };
    }

    function getActionLabel(actionType) {
        if (!actionType) return '暂无记录';
        return ACTION_LABELS[actionType] || actionType;
    }

    function aggregateRecordsByCanonicalId(records) {
        const canonicalMap = new Map();
        Object.values(records || {}).forEach((record) => {
            if (!record || !record.canonicalId) return;
            const current = canonicalMap.get(record.canonicalId);
            if (!current) {
                canonicalMap.set(record.canonicalId, record);
                return;
            }
            const currentStage = getRecordStage(current);
            const nextStage = getRecordStage(record);
            if (nextStage.priority > currentStage.priority) {
                canonicalMap.set(record.canonicalId, record);
                return;
            }
            if (nextStage.priority === currentStage.priority &&
                helpers.compareIsoDesc(current.updatedAt, record.updatedAt) > 0) {
                canonicalMap.set(record.canonicalId, record);
            }
        });
        return canonicalMap;
    }

    function buildRecordSummary(records) {
        const values = Object.values(records || {});
        return values.reduce((summary, record) => {
            summary.total += 1;
            const stage = getRecordStageCode(record);
            if (stage === 'saved') {
                summary.saved += 1;
            } else if (stage === 'generated') {
                summary.generated += 1;
            } else if (stage === 'prompt') {
                summary.promptOnly += 1;
            }
            return summary;
        }, {
            total: 0,
            promptOnly: 0,
            generated: 0,
            saved: 0
        });
    }

    function buildCompletedCanonicalSet(recordsMap) {
        const canonicalMap = aggregateRecordsByCanonicalId(recordsMap);
        return new Set(Array.from(canonicalMap.keys()));
    }

    function buildListCompletionSnapshot(problemLists, completedCanonicalSet) {
        return Object.values(problemLists || {}).map((list) => {
            const items = Array.isArray(list && list.items) ? list.items : [];
            let total = 0;
            let completed = 0;

            items.forEach((item) => {
                total += 1;
                const canonicalId = String(item && item.canonicalId || '').trim();
                if (canonicalId && completedCanonicalSet.has(canonicalId)) {
                    completed += 1;
                }
            });

            return {
                listId: String(list && list.listId || '').trim(),
                title: String(list && list.title || '').trim() || '未命名题单',
                sourceUrl: String(list && list.sourceUrl || '').trim(),
                site: String(list && list.site || '').trim(),
                total,
                completed,
                isCompleted: total > 0 && completed === total
            };
        }).filter((item) => item.listId);
    }

    function collectNewlyCompletedLists(problemLists, beforeSet, afterSet) {
        const beforeSnapshot = buildListCompletionSnapshot(problemLists, beforeSet);
        const afterSnapshot = buildListCompletionSnapshot(problemLists, afterSet);
        const beforeMap = new Map(beforeSnapshot.map((item) => [item.listId, item]));

        return afterSnapshot.filter((item) => {
            if (!item.isCompleted) return false;
            const previous = beforeMap.get(item.listId);
            return !(previous && previous.isCompleted);
        });
    }

    async function getProblemRecords() {
        return helpers.readLocal(STORAGE_KEYS.problemRecords, {});
    }

    async function getProblemRecordSummary() {
        return buildRecordSummary(await getProblemRecords());
    }

    async function getSortedProblemRecords() {
        const records = await getProblemRecords();
        return Object.values(records || {}).sort((left, right) => {
            return helpers.compareIsoDesc(left.updatedAt, right.updatedAt);
        });
    }

    async function getProblemRecordByUrl(url) {
        const identity = extractProblemIdentity(url);
        if (!identity || !identity.supported) return null;
        const records = await getProblemRecords();
        return records[buildRecordId(identity)] || null;
    }

    function buildRecordSyncDigest(record) {
        return {
            id: record.id,
            canonicalId: record.canonicalId,
            site: record.site,
            problemKey: record.problemKey,
            title: record.title,
            url: record.url,
            baseUrl: record.baseUrl,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            lastActionType: record.lastActionType,
            lastActionAt: record.lastActionAt,
            promptCopiedCount: record.promptCopiedCount || 0,
            promptCopiedAt: record.promptCopiedAt,
            noteGeneratedCount: record.noteGeneratedCount || 0,
            noteGeneratedAt: record.noteGeneratedAt,
            resultCopiedCount: record.resultCopiedCount || 0,
            resultCopiedAt: record.resultCopiedAt,
            noteSavedCount: record.noteSavedCount || 0,
            noteSavedAt: record.noteSavedAt,
            hasNoteContent: hasSavedNoteContent(record)
        };
    }

    function inflateRecordFromDigest(digest) {
        return {
            ...digest,
            noteContent: ''
        };
    }

    async function trackProblemAction(options) {
        const { url, title, actionType, noteContent } = options || {};
        const identity = extractProblemIdentity(url);
        if (!identity || !identity.supported) {
            console.warn('[ProblemData] 当前地址不支持记录：', url);
            return null;
        }

        const records = await getProblemRecords();
        const problemLists = await helpers.readLocal(STORAGE_KEYS.problemLists, {});
        const beforeCompletedCanonicalSet = buildCompletedCanonicalSet(records);
        const now = new Date().toISOString();
        const recordId = buildRecordId(identity);
        const previous = records[recordId] || createEmptyRecord(identity, title, now);
        const nextRecord = {
            ...previous,
            id: recordId,
            canonicalId: identity.canonicalId,
            site: identity.site,
            problemKey: identity.problemKey,
            title: title || previous.title || identity.problemKey || '未命名题目',
            url: identity.url,
            baseUrl: identity.baseUrl,
            updatedAt: now,
            lastActionType: actionType,
            lastActionAt: now
        };

        if (actionType === 'prompt_copied') {
            nextRecord.promptCopiedCount = Number(nextRecord.promptCopiedCount || 0) + 1;
            nextRecord.promptCopiedAt = now;
        } else if (actionType === 'note_generated') {
            nextRecord.noteGeneratedCount = Number(nextRecord.noteGeneratedCount || 0) + 1;
            nextRecord.noteGeneratedAt = now;
        } else if (actionType === 'result_copied') {
            nextRecord.resultCopiedCount = Number(nextRecord.resultCopiedCount || 0) + 1;
            nextRecord.resultCopiedAt = now;
        } else if (actionType === 'note_saved') {
            nextRecord.noteSavedCount = Number(nextRecord.noteSavedCount || 0) + 1;
            nextRecord.noteSavedAt = now;
            nextRecord.noteContent = typeof noteContent === 'string' ? noteContent : (nextRecord.noteContent || '');
        }

        records[recordId] = nextRecord;
        const afterCompletedCanonicalSet = buildCompletedCanonicalSet(records);
        const newlyCompletedLists = collectNewlyCompletedLists(
            problemLists,
            beforeCompletedCanonicalSet,
            afterCompletedCanonicalSet
        );

        await syncCore.writeLocalNamespace(STORAGE_KEYS.problemRecords, records, {
            autoSync: true,
            markDirty: true
        });
        return {
            ...nextRecord,
            celebration: newlyCompletedLists.length ? {
                triggered: true,
                completedAt: now,
                completedLists: newlyCompletedLists.map((item) => ({
                    listId: item.listId,
                    title: item.title,
                    sourceUrl: item.sourceUrl,
                    site: item.site,
                    total: item.total,
                    completed: item.completed
                }))
            } : null
        };
    }

    async function deleteProblemRecord(recordId) {
        if (!recordId) {
            throw new Error('缺少要删除的题目记录 ID');
        }

        const records = await getProblemRecords();
        if (!records[recordId]) {
            return {
                success: true,
                deleted: false,
                recordId
            };
        }

        delete records[recordId];
        await syncCore.writeLocalNamespace(STORAGE_KEYS.problemRecords, records, {
            autoSync: true,
            markDirty: true
        });

        return {
            success: true,
            deleted: true,
            recordId,
            total: Object.keys(records).length
        };
    }

    async function saveProblemNote(options) {
        return trackProblemAction({
            ...(options || {}),
            actionType: 'note_saved'
        });
    }

    modules.records = {
        extractProblemIdentity,
        buildRecordId,
        createEmptyRecord,
        getRecordStageCode,
        getRecordStage,
        getActionLabel,
        aggregateRecordsByCanonicalId,
        buildRecordSummary,
        getProblemRecords,
        getProblemRecordSummary,
        getSortedProblemRecords,
        getProblemRecordByUrl,
        buildRecordSyncDigest,
        inflateRecordFromDigest,
        trackProblemAction,
        deleteProblemRecord,
        saveProblemNote
    };
})();
