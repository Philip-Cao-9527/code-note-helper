/**
 * 刷题记录模块
 * 版本：1.1.3
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
    const LEETCODE_SITES = new Set(['leetcode.cn', 'leetcode.com']);
    const DEEP_LEARNING_SITES = new Set(['deep-ml.com', 'duoan-torchcode.hf.space']);
    const reviewDomain = modules.reviewDomain || {};
    const reviewSettings = modules.reviewSettings || {};
    const REQUIRED_REVIEW_DOMAIN_FUNCTIONS = [
        'normalizeReviewState',
        'buildDefaultReviewState',
        'parseRating',
        'getRecordReviewMeta',
        'buildNextReviewState',
        'buildReviewRatingPreviewsByRecord',
        'forgettingCurve'
    ];
    REQUIRED_REVIEW_DOMAIN_FUNCTIONS.forEach((name) => {
        if (typeof reviewDomain[name] !== 'function') {
            throw new Error(`复习域模块未正确加载：缺少 ${name}`);
        }
    });
    const normalizeReviewState = reviewDomain.normalizeReviewState;
    const buildDefaultReviewState = reviewDomain.buildDefaultReviewState;
    const parseRating = reviewDomain.parseRating;
    const forgettingCurve = reviewDomain.forgettingCurve;

    if (typeof reviewSettings.getEffectiveReviewFsrsParams !== 'function' || typeof reviewSettings.normalizeReviewFsrsSettings !== 'function') {
        throw new Error('复习参数配置模块未正确加载');
    }

    function getLocalDateKeyFromTime(input) {
        const date = input instanceof Date ? input : new Date(input || Date.now());
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

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

    function isLeetcodeSite(site) {
        return LEETCODE_SITES.has(String(site || '').trim().toLowerCase());
    }

    function isDeepLearningSite(site) {
        return DEEP_LEARNING_SITES.has(String(site || '').trim().toLowerCase());
    }

    function getRecordReviewMeta(record, nowTime = Date.now()) {
        return reviewDomain.getRecordReviewMeta(record, nowTime, { isLeetcodeSite });
    }

    function buildNextReviewState(record, rating, nowTime = Date.now(), fsrsParams) {
        return reviewDomain.buildNextReviewState(record, rating, nowTime, { isLeetcodeSite, fsrsParams });
    }

    function buildReviewRatingPreviewsByRecord(record, nowTime = Date.now(), fsrsParams) {
        return reviewDomain.buildReviewRatingPreviewsByRecord(record, nowTime, { isLeetcodeSite, fsrsParams });
    }

    function formatReviewDate(value) {
        return typeof reviewDomain.formatReviewDate === 'function'
            ? reviewDomain.formatReviewDate(value)
            : '';
    }

    async function getReviewFsrsSettings() {
        return reviewSettings.getReviewFsrsSettings();
    }

    async function getEffectiveReviewFsrsParams() {
        const settings = await getReviewFsrsSettings();
        return reviewSettings.getEffectiveReviewFsrsParams(settings);
    }

    async function setReviewFsrsSettings(nextReviewFsrsSettings) {
        const normalized = reviewSettings.normalizeReviewFsrsSettings(nextReviewFsrsSettings);
        const savedSettings = await reviewSettings.setReviewFsrsSettings(normalized);
        return {
            settings: savedSettings
        };
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

    function createIdentityFromSiteAndProblemKey(siteInput, problemKeyInput) {
        const site = helpers.normalizeHost(siteInput);
        const problemKey = String(problemKeyInput || '').trim();
        if (!site || !problemKey) return null;

        if (site === 'leetcode.cn' || site === 'leetcode.com') {
            const baseUrl = `https://${site}/problems/${problemKey}/`;
            return {
                supported: true,
                type: 'leetcode_problem',
                site,
                problemKey,
                canonicalId: `leet:${problemKey}`,
                url: baseUrl,
                baseUrl
            };
        }

        if (site === 'codefun2000.com') {
            const baseUrl = `https://${site}/p/${problemKey}`;
            return {
                supported: true,
                type: 'codefun_problem',
                site,
                problemKey,
                canonicalId: `codefun:${problemKey}`,
                url: baseUrl,
                baseUrl
            };
        }

        if (site === 'deep-ml.com') {
            const baseUrl = `https://${site}/problems/${problemKey}`;
            return {
                supported: true,
                type: 'deepml_problem',
                site,
                problemKey,
                canonicalId: `deepml:${problemKey}`,
                url: baseUrl,
                baseUrl
            };
        }

        if (site === 'duoan-torchcode.hf.space') {
            const baseUrl = `https://${site}/tree/${problemKey}.ipynb`;
            return {
                supported: true,
                type: 'torchcode_notebook',
                site,
                problemKey,
                canonicalId: `torchcode:${problemKey}`,
                url: baseUrl,
                baseUrl,
                notebookPath: `${problemKey}.ipynb`,
                notebookFileName: `${problemKey}.ipynb`,
                notebookSlug: problemKey
            };
        }

        return null;
    }

    function buildProblemUrlFromSiteAndProblemKey(site, problemKey) {
        const identity = createIdentityFromSiteAndProblemKey(site, problemKey);
        return identity && identity.supported ? (identity.url || identity.baseUrl || '') : '';
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
            manualAddedCount: 0,
            manualAddedAt: null,
            submissionPassedCount: 0,
            submissionPassedAt: null,
            noteContent: '',
            review: buildDefaultReviewState()
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
            manualAddedCount: record.manualAddedCount || 0,
            manualAddedAt: record.manualAddedAt,
            submissionPassedCount: record.submissionPassedCount || 0,
            submissionPassedAt: record.submissionPassedAt,
            review: normalizeReviewState(record.review),
            hasNoteContent: hasSavedNoteContent(record)
        };
    }

    function inflateRecordFromDigest(digest) {
        return {
            ...digest,
            noteContent: '',
            review: normalizeReviewState(digest && digest.review)
        };
    }

    async function trackProblemAction(options) {
        const { url, title, actionType, noteContent, rating, site, problemKey, nowTime: inputNowTime, fsrsParams } = options || {};
        let identity = extractProblemIdentity(url);
        if ((!identity || !identity.supported) && site && problemKey) {
            identity = createIdentityFromSiteAndProblemKey(site, problemKey);
        }
        if (!identity || !identity.supported) {
            console.warn('[ProblemData] 当前地址不支持记录：', url);
            return null;
        }

        const records = await getProblemRecords();
        const problemLists = await helpers.readLocal(STORAGE_KEYS.problemLists, {});
        const tombstones = await syncCore.getSyncTombstones();
        const beforeCompletedCanonicalSet = buildCompletedCanonicalSet(records);
        const resolvedNowTime = Number(inputNowTime);
        const nowTime = Number.isFinite(resolvedNowTime) ? resolvedNowTime : Date.now();
        const now = new Date(nowTime).toISOString();
        const recordId = buildRecordId(identity);
        const hadRecord = Boolean(records[recordId]);
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
            lastActionAt: now,
            review: normalizeReviewState(previous.review, nowTime)
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
        } else if (actionType === 'manual_added') {
            nextRecord.manualAddedCount = Number(nextRecord.manualAddedCount || 0) + 1;
            nextRecord.manualAddedAt = now;
        } else if (actionType === 'submission_passed') {
            nextRecord.submissionPassedCount = Number(nextRecord.submissionPassedCount || 0) + 1;
            nextRecord.submissionPassedAt = now;
        } else if (actionType === 'review_rated') {
            nextRecord.review = buildNextReviewState(nextRecord, rating, nowTime, fsrsParams);
        }

        records[recordId] = nextRecord;
        if (tombstones.records[recordId]) {
            delete tombstones.records[recordId];
        }
        const afterCompletedCanonicalSet = buildCompletedCanonicalSet(records);
        const newlyCompletedLists = collectNewlyCompletedLists(
            problemLists,
            beforeCompletedCanonicalSet,
            afterCompletedCanonicalSet
        );

        await syncCore.writeLocalMultiple({
            [STORAGE_KEYS.problemRecords]: records,
            [STORAGE_KEYS.syncTombstones]: tombstones
        }, {
            autoSync: true,
            markDirty: true
        });
        return {
            ...nextRecord,
            isNewRecord: !hadRecord,
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

        const tombstones = await syncCore.getSyncTombstones();
        const deletedAt = new Date().toISOString();
        delete records[recordId];
        tombstones.records[recordId] = deletedAt;
        await syncCore.writeLocalMultiple({
            [STORAGE_KEYS.problemRecords]: records,
            [STORAGE_KEYS.syncTombstones]: tombstones
        }, {
            autoSync: true,
            markDirty: true
        });

        return {
            success: true,
            deleted: true,
            recordId,
            deletedAt,
            total: Object.keys(records).length
        };
    }

    async function saveProblemNote(options) {
        return trackProblemAction({
            ...(options || {}),
            actionType: 'note_saved'
        });
    }

    async function getReviewRatingPreviews(options) {
        const { url, title, site, problemKey, nowTime: inputNowTime } = options || {};
        const resolvedNowTime = Number(inputNowTime);
        const nowTime = Number.isFinite(resolvedNowTime) ? resolvedNowTime : Date.now();

        let identity = extractProblemIdentity(url);
        if ((!identity || !identity.supported) && site && problemKey) {
            identity = createIdentityFromSiteAndProblemKey(site, problemKey);
        }
        if (!identity || !identity.supported || !isLeetcodeSite(identity.site)) {
            return null;
        }

        const recordsMap = await getProblemRecords();
        const recordId = buildRecordId(identity);
        const baseRecord = recordsMap[recordId] || createEmptyRecord(identity, title, new Date(nowTime).toISOString());
        const fsrsParams = await getEffectiveReviewFsrsParams();
        return buildReviewRatingPreviewsByRecord(baseRecord, nowTime, fsrsParams);
    }

    async function rateProblemMemory(options) {
        const { url, title, rating, site, problemKey, nowTime: inputNowTime } = options || {};
        let identity = extractProblemIdentity(url);
        if ((!identity || !identity.supported) && site && problemKey) {
            identity = createIdentityFromSiteAndProblemKey(site, problemKey);
        }
        if (!identity || !identity.supported) {
            return {
                success: false,
                reason: 'unsupported'
            };
        }
        if (!isLeetcodeSite(identity.site)) {
            return {
                success: false,
                reason: 'site_not_supported'
            };
        }

        const safeRating = parseRating(rating);
        if (!safeRating) {
            throw new Error('记忆状态评分无效');
        }

        const resolvedNowTime = Number(inputNowTime);
        const nowTime = Number.isFinite(resolvedNowTime) ? resolvedNowTime : Date.now();
        const recordsMap = await getProblemRecords();
        const recordId = buildRecordId(identity);
        const existingRecord = recordsMap[recordId];
        if (existingRecord) {
            const reviewMeta = getRecordReviewMeta(existingRecord, nowTime);
            if (reviewMeta && (reviewMeta.ratedToday || reviewMeta.reviewedToday)) {
                return {
                    ...existingRecord,
                    review: normalizeReviewState(existingRecord.review, nowTime),
                    success: false,
                    reason: 'already_rated_today',
                    isNewRecord: false
                };
            }
        }

        const fsrsParams = await getEffectiveReviewFsrsParams();
        const result = await trackProblemAction({
            url: identity.url || url,
            title,
            actionType: 'review_rated',
            rating: safeRating,
            nowTime,
            fsrsParams
        });

        return {
            ...(result || {}),
            success: Boolean(result),
            reason: result ? 'ok' : 'failed'
        };
    }

    async function markProblemReviewReminded(options) {
        const { url, site, problemKey, title, nowTime: inputNowTime } = options || {};
        let identity = extractProblemIdentity(url);
        if ((!identity || !identity.supported) && site && problemKey) {
            identity = createIdentityFromSiteAndProblemKey(site, problemKey);
        }
        if (!identity || !identity.supported) {
            return {
                success: false,
                reason: 'unsupported'
            };
        }
        if (!isLeetcodeSite(identity.site)) {
            return {
                success: false,
                reason: 'site_not_supported'
            };
        }

        const resolvedNowTime = Number(inputNowTime);
        const nowTime = Number.isFinite(resolvedNowTime) ? resolvedNowTime : Date.now();
        const nowDate = new Date(nowTime);
        const nowIso = nowDate.toISOString();
        const todayKey = getLocalDateKeyFromTime(nowTime);

        const recordsMap = await getProblemRecords();
        const recordId = buildRecordId(identity);
        const existingRecord = recordsMap[recordId];
        const baseRecord = existingRecord || createEmptyRecord(identity, title, nowIso);
        const reviewState = normalizeReviewState(baseRecord.review, nowTime);
        const reviewMeta = getRecordReviewMeta(baseRecord, nowTime);
        if (reviewMeta && (reviewMeta.ratedToday || reviewMeta.reviewedToday)) {
            return {
                ...baseRecord,
                review: reviewState,
                success: false,
                reason: 'already_rated_today',
                isNewRecord: !existingRecord
            };
        }
        if (reviewMeta && reviewMeta.remindedToday) {
            return {
                ...baseRecord,
                review: reviewState,
                success: false,
                reason: 'already_reminded_today',
                isNewRecord: !existingRecord
            };
        }

        const updatedRecord = {
            ...baseRecord,
            id: recordId,
            canonicalId: identity.canonicalId,
            site: identity.site,
            problemKey: identity.problemKey,
            title: title || baseRecord.title || identity.problemKey || '未命名题目',
            url: identity.url || baseRecord.url || '',
            baseUrl: identity.baseUrl || baseRecord.baseUrl || '',
            updatedAt: nowIso,
            review: {
                ...reviewState,
                lastRemindedDateKey: todayKey
            }
        };

        recordsMap[recordId] = updatedRecord;
        await syncCore.writeLocalMultiple({
            [STORAGE_KEYS.problemRecords]: recordsMap
        }, {
            autoSync: true,
            markDirty: true
        });

        return {
            ...updatedRecord,
            success: true,
            reason: 'ok',
            isNewRecord: !existingRecord
        };
    }

    async function getLeetcodeReviewSummary(nowTime = Date.now()) {
        const records = await getProblemRecords();
        const reviewRecords = Object.values(records || {})
            .map((record) => ({
                record,
                reviewMeta: getRecordReviewMeta(record, nowTime)
            }))
            .filter((item) => item.reviewMeta.isLeetcode && item.reviewMeta.enabled && item.reviewMeta.dueByToday)
            .sort((left, right) => {
                if (left.reviewMeta.nextReviewTime !== right.reviewMeta.nextReviewTime) {
                    return left.reviewMeta.nextReviewTime - right.reviewMeta.nextReviewTime;
                }
                return helpers.compareIsoDesc(left.record.updatedAt, right.record.updatedAt);
            });
        const pendingRecords = reviewRecords.filter((item) => !item.reviewMeta.reviewedToday);
        const completedRecords = reviewRecords.filter((item) => item.reviewMeta.reviewedToday);
        const recent = pendingRecords[0] || completedRecords[0] || null;
        const dueTotalCount = reviewRecords.length;
        const dueRemainingCount = pendingRecords.length;
        return {
            dueCount: dueRemainingCount,
            dueRemainingCount,
            dueTotalCount,
            dueCompletedCount: completedRecords.length,
            recentDueTitle: recent ? (recent.record.title || recent.record.problemKey || '未命名题目') : '',
            recentDueUrl: recent ? (recent.record.url || recent.record.baseUrl || '') : ''
        };
    }

    modules.records = {
        extractProblemIdentity,
        isLeetcodeSite,
        isDeepLearningSite,
        buildRecordId,
        createIdentityFromSiteAndProblemKey,
        buildProblemUrlFromSiteAndProblemKey,
        createEmptyRecord,
        getRecordStageCode,
        getRecordStage,
        getActionLabel,
        getRecordReviewMeta,
        forgettingCurve,
        buildNextReviewState,
        getReviewFsrsSettings,
        setReviewFsrsSettings,
        getEffectiveReviewFsrsParams,
        formatReviewDate,
        aggregateRecordsByCanonicalId,
        buildRecordSummary,
        getProblemRecords,
        getProblemRecordSummary,
        getSortedProblemRecords,
        getProblemRecordByUrl,
        getLeetcodeReviewSummary,
        buildRecordSyncDigest,
        inflateRecordFromDigest,
        trackProblemAction,
        getReviewRatingPreviews,
        rateProblemMemory,
        markProblemReviewReminded,
        deleteProblemRecord,
        saveProblemNote
    };
})();

