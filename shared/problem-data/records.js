/**
 * 刷题记录模块
 * 版本：1.1.0
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
    const DAY_MS = 24 * 60 * 60 * 1000;
    const LEETCODE_SITES = new Set(['leetcode.cn', 'leetcode.com']);
    const DEEP_LEARNING_SITES = new Set(['deep-ml.com', 'duoan-torchcode.hf.space']);
    const REVIEW_INTERVAL_DAY_MAP = {
        1: 5,
        2: 10,
        3: 18,
        4: 36
    };
    const REVIEW_RATING_LABELS = {
        1: '很难想起',
        2: '有点吃力',
        3: '基本记得',
        4: '很熟练'
    };
    const FORGETTING_CURVE_FACTOR = 19 / 81;
    const FORGETTING_CURVE_DECAY = -0.5;

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

    function getLocalDateKeyFromTime(input) {
        const date = input instanceof Date ? input : new Date(input || Date.now());
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getLocalDayEndTimestamp(input) {
        const date = input instanceof Date ? new Date(input.getTime()) : new Date(input || Date.now());
        if (Number.isNaN(date.getTime())) return Date.now();
        date.setHours(23, 59, 59, 999);
        return date.getTime();
    }

    function normalizeIso(input) {
        if (!input) return null;
        const date = new Date(input);
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString();
    }

    function clampNumber(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return min;
        return Math.min(max, Math.max(min, number));
    }

    function parseRating(rating) {
        const number = Number(rating);
        if (!Number.isInteger(number)) return 0;
        if (number < 1 || number > 4) return 0;
        return number;
    }

    function buildDefaultReviewState() {
        return {
            enabled: false,
            algorithm: 'fsrs',
            lastRating: 0,
            lastRatedAt: null,
            nextReviewAt: null,
            reviewedToday: false,
            reviewedDateKey: '',
            fsrsState: null
        };
    }

    function normalizeReviewState(review, nowTime = Date.now()) {
        if (!review || typeof review !== 'object') {
            return buildDefaultReviewState();
        }

        const todayKey = getLocalDateKeyFromTime(nowTime);
        const merged = {
            ...buildDefaultReviewState(),
            ...review
        };

        merged.algorithm = merged.algorithm || 'fsrs';
        merged.lastRating = parseRating(merged.lastRating);
        merged.lastRatedAt = normalizeIso(merged.lastRatedAt);
        merged.nextReviewAt = normalizeIso(merged.nextReviewAt);
        merged.reviewedDateKey = String(merged.reviewedDateKey || '').trim();

        if (merged.fsrsState && typeof merged.fsrsState === 'object') {
            const nextReviewNumber = Number(merged.fsrsState.nextReview || 0);
            const lastReviewNumber = Number(merged.fsrsState.lastReview || 0);
            merged.fsrsState = {
                ...merged.fsrsState,
                difficulty: clampNumber(merged.fsrsState.difficulty || 5.5, 1, 10),
                stability: Math.max(1, Number(merged.fsrsState.stability || 1)),
                state: Number(merged.fsrsState.state || 2),
                reviewCount: Math.max(0, Number(merged.fsrsState.reviewCount || 0)),
                lapses: Math.max(0, Number(merged.fsrsState.lapses || 0)),
                quality: parseRating(merged.fsrsState.quality || merged.lastRating || 0),
                lastReview: Number.isFinite(lastReviewNumber) ? lastReviewNumber : 0,
                nextReview: Number.isFinite(nextReviewNumber) ? nextReviewNumber : 0
            };
        } else {
            merged.fsrsState = null;
        }

        if (!merged.reviewedDateKey && merged.lastRatedAt) {
            merged.reviewedDateKey = getLocalDateKeyFromTime(merged.lastRatedAt);
        }

        merged.reviewedToday = merged.reviewedDateKey === todayKey && Boolean(merged.reviewedToday);
        merged.enabled = Boolean(merged.enabled) && Boolean(merged.nextReviewAt);

        return merged;
    }

    function calculateElapsedDays(lastReviewTime, nowTime = Date.now()) {
        const left = Number(lastReviewTime || 0);
        const right = Number(nowTime || Date.now());
        if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return 0;
        return Math.max(0, (right - left) / DAY_MS);
    }

    function forgettingCurve(elapsedDays, stability) {
        const elapsed = Math.max(0, Number(elapsedDays || 0));
        const safeStability = Math.max(0.1, Number(stability || 0.1));
        const retention = Math.pow(1 + FORGETTING_CURVE_FACTOR * (elapsed / (9 * safeStability)), FORGETTING_CURVE_DECAY);
        if (!Number.isFinite(retention)) return 0;
        return Math.max(0, Math.min(1, retention));
    }

    function getRecordReviewMeta(record, nowTime = Date.now()) {
        const review = normalizeReviewState(record && record.review, nowTime);
        const site = String(record && record.site || '').trim().toLowerCase();
        const isLeetcode = isLeetcodeSite(site);
        const nextReviewIso = review.nextReviewAt;
        const nextReviewTime = nextReviewIso ? new Date(nextReviewIso).getTime() : 0;
        const hasNextReview = Number.isFinite(nextReviewTime) && nextReviewTime > 0;
        const dueByToday = hasNextReview && nextReviewTime <= getLocalDayEndTimestamp(nowTime);
        const dueToday = Boolean(review.enabled && isLeetcode && dueByToday && !review.reviewedToday);
        const fsrsState = review.fsrsState || null;
        const recallProbability = fsrsState
            ? forgettingCurve(calculateElapsedDays(fsrsState.lastReview, nowTime), fsrsState.stability)
            : 1;

        return {
            enabled: Boolean(review.enabled),
            review,
            isLeetcode,
            dueToday,
            nextReviewTime,
            recallProbability,
            ratingLabel: REVIEW_RATING_LABELS[review.lastRating] || '未设置'
        };
    }

    function buildNextReviewState(record, rating, nowTime = Date.now()) {
        const safeRating = parseRating(rating);
        if (!safeRating) {
            throw new Error('记忆状态评分无效');
        }

        const nowDate = new Date(nowTime);
        const nowIso = nowDate.toISOString();
        const todayKey = getLocalDateKeyFromTime(nowDate);
        const previousReview = normalizeReviewState(record && record.review, nowTime);
        const previousFsrs = previousReview.fsrsState || {};
        const previousReviewCount = Math.max(0, Number(previousFsrs.reviewCount || 0));
        const previousStability = Math.max(1, Number(previousFsrs.stability || 0));
        const baseInterval = REVIEW_INTERVAL_DAY_MAP[safeRating] || 10;

        let nextIntervalDays = baseInterval;
        if (previousReviewCount > 0 && previousStability > 0) {
            const retentionFactor = safeRating === 1 ? 0.6 : safeRating === 2 ? 0.95 : safeRating === 3 ? 1.25 : 1.7;
            nextIntervalDays = Math.max(1, Math.round(previousStability * retentionFactor));
        }

        const baseDifficulty = previousReviewCount > 0
            ? clampNumber(previousFsrs.difficulty || 5.5, 1, 10)
            : clampNumber(7 - safeRating * 1.2, 1, 10);
        const difficultyDelta = safeRating === 1 ? 0.55 : safeRating === 2 ? 0.2 : safeRating === 3 ? -0.1 : -0.35;
        const nextDifficulty = clampNumber(baseDifficulty + difficultyDelta, 1, 10);
        const nextReviewTime = nowTime + nextIntervalDays * DAY_MS;
        const nextReviewIso = new Date(nextReviewTime).toISOString();
        const nextReviewCount = previousReviewCount + 1;
        const nextLapses = Math.max(0, Number(previousFsrs.lapses || 0)) + (safeRating === 1 ? 1 : 0);

        return {
            enabled: true,
            algorithm: 'fsrs',
            lastRating: safeRating,
            lastRatedAt: nowIso,
            nextReviewAt: nextReviewIso,
            reviewedToday: true,
            reviewedDateKey: todayKey,
            fsrsState: {
                difficulty: nextDifficulty,
                stability: Math.max(1, nextIntervalDays),
                state: 2,
                lastReview: nowTime,
                nextReview: nextReviewTime,
                reviewCount: nextReviewCount,
                lapses: nextLapses,
                quality: safeRating
            }
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
        const { url, title, actionType, noteContent, rating } = options || {};
        const identity = extractProblemIdentity(url);
        if (!identity || !identity.supported) {
            console.warn('[ProblemData] 当前地址不支持记录：', url);
            return null;
        }

        const records = await getProblemRecords();
        const problemLists = await helpers.readLocal(STORAGE_KEYS.problemLists, {});
        const tombstones = await syncCore.getSyncTombstones();
        const beforeCompletedCanonicalSet = buildCompletedCanonicalSet(records);
        const now = new Date().toISOString();
        const nowTime = new Date(now).getTime();
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
            nextRecord.review = buildNextReviewState(nextRecord, rating, nowTime);
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

    async function rateProblemMemory(options) {
        const { url, title, rating } = options || {};
        const identity = extractProblemIdentity(url);
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

        const result = await trackProblemAction({
            url,
            title,
            actionType: 'review_rated',
            rating: safeRating
        });

        return {
            ...(result || {}),
            success: Boolean(result),
            reason: result ? 'ok' : 'failed'
        };
    }

    async function getLeetcodeReviewSummary(nowTime = Date.now()) {
        const records = await getProblemRecords();
        const dueRecords = Object.values(records || {})
            .filter((record) => {
                const reviewMeta = getRecordReviewMeta(record, nowTime);
                return reviewMeta.isLeetcode && reviewMeta.dueToday;
            })
            .sort((left, right) => {
                const leftMeta = getRecordReviewMeta(left, nowTime);
                const rightMeta = getRecordReviewMeta(right, nowTime);
                if (leftMeta.nextReviewTime !== rightMeta.nextReviewTime) {
                    return leftMeta.nextReviewTime - rightMeta.nextReviewTime;
                }
                return helpers.compareIsoDesc(left.updatedAt, right.updatedAt);
            });

        const recent = dueRecords[0] || null;
        return {
            dueCount: dueRecords.length,
            recentDueTitle: recent ? (recent.title || recent.problemKey || '未命名题目') : '',
            recentDueUrl: recent ? (recent.url || recent.baseUrl || '') : ''
        };
    }

    modules.records = {
        extractProblemIdentity,
        isLeetcodeSite,
        isDeepLearningSite,
        buildRecordId,
        createEmptyRecord,
        getRecordStageCode,
        getRecordStage,
        getActionLabel,
        getRecordReviewMeta,
        forgettingCurve,
        buildNextReviewState,
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
        rateProblemMemory,
        deleteProblemRecord,
        saveProblemNote
    };
})();

