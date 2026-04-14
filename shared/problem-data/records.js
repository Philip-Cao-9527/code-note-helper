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
    const reviewFsrs = modules.reviewFsrs || {};
    const reviewDomain = modules.reviewDomain || {};
    const REVIEW_RATING_LABELS = reviewDomain.REVIEW_RATING_LABELS || {
        1: '很难想起',
        2: '有点吃力',
        3: '基本记得',
        4: '很熟练'
    };

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
        if (typeof reviewDomain.getLocalDateKeyFromTime === 'function') {
            return reviewDomain.getLocalDateKeyFromTime(input);
        }
        const date = input instanceof Date ? input : new Date(input || Date.now());
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getLocalDayEndTimestamp(input) {
        if (typeof reviewDomain.getLocalDayEndTimestamp === 'function') {
            return reviewDomain.getLocalDayEndTimestamp(input);
        }
        const date = input instanceof Date ? new Date(input.getTime()) : new Date(input || Date.now());
        if (Number.isNaN(date.getTime())) return Date.now();
        date.setHours(23, 59, 59, 999);
        return date.getTime();
    }

    function getLocalDayStartTimestamp(input) {
        if (typeof reviewDomain.getLocalDayStartTimestamp === 'function') {
            return reviewDomain.getLocalDayStartTimestamp(input);
        }
        const date = input instanceof Date ? new Date(input.getTime()) : new Date(input || Date.now());
        if (Number.isNaN(date.getTime())) return Date.now();
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    function normalizeIso(input) {
        if (typeof reviewDomain.normalizeIso === 'function') {
            return reviewDomain.normalizeIso(input);
        }
        if (!input) return null;
        const date = new Date(input);
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString();
    }

    function parseRating(rating) {
        if (typeof reviewDomain.parseRating === 'function') {
            return reviewDomain.parseRating(rating);
        }
        const number = Number(rating);
        if (!Number.isInteger(number)) return 0;
        if (number < 1 || number > 4) return 0;
        return number;
    }

    function parseFsrsTimestamp(input) {
        if (typeof reviewDomain.parseFsrsTimestamp === 'function') {
            return reviewDomain.parseFsrsTimestamp(input);
        }
        if (reviewFsrs.parseFsrsTimestamp) {
            return reviewFsrs.parseFsrsTimestamp(input);
        }
        const value = Number(input);
        return Number.isFinite(value) ? value : 0;
    }

    function normalizeFsrsStateValue(input) {
        if (typeof reviewDomain.normalizeFsrsStateValue === 'function') {
            return reviewDomain.normalizeFsrsStateValue(input);
        }
        if (reviewFsrs.normalizeFsrsStateValue) {
            return reviewFsrs.normalizeFsrsStateValue(input);
        }
        const number = Number(input);
        return Number.isInteger(number) ? number : 0;
    }

    function getFsrsRatingFromMemoryRating(rating) {
        if (typeof reviewDomain.getFsrsRatingFromMemoryRating === 'function') {
            return reviewDomain.getFsrsRatingFromMemoryRating(rating);
        }
        if (reviewFsrs.getFsrsRatingFromMemoryRating) {
            return reviewFsrs.getFsrsRatingFromMemoryRating(rating);
        }
        return rating;
    }

    function buildNextFsrsCard(lastCard, nowDate, rating) {
        if (reviewFsrs.buildNextFsrsCard) {
            return reviewFsrs.buildNextFsrsCard(lastCard, nowDate, rating, reviewFsrs.fsrsParamsRef);
        }
        throw new Error('FSRS 内核未加载');
    }

    function resolveReviewBaseTime(record, previousReview, nowTime) {
        if (typeof reviewDomain.resolveReviewBaseTime === 'function') {
            return reviewDomain.resolveReviewBaseTime(record, previousReview, nowTime);
        }
        const fsrsState = previousReview.fsrsState || {};
        const timeCandidates = [
            fsrsState.lastReview,
            previousReview.lastRatedAt,
            record && record.submissionPassedAt,
            record && record.manualAddedAt,
            record && record.lastActionAt
        ];
        for (const candidate of timeCandidates) {
            const value = parseFsrsTimestamp(candidate);
            if (value > 0) return value;
        }
        return nowTime;
    }

    function buildDefaultReviewState() {
        if (typeof reviewDomain.buildDefaultReviewState === 'function') {
            return reviewDomain.buildDefaultReviewState();
        }
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
        if (typeof reviewDomain.normalizeReviewState === 'function') {
            return reviewDomain.normalizeReviewState(review, nowTime);
        }
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
            const nextReviewNumber = parseFsrsTimestamp(merged.fsrsState.nextReview);
            const lastReviewNumber = parseFsrsTimestamp(merged.fsrsState.lastReview);
            merged.fsrsState = {
                ...merged.fsrsState,
                difficulty: Math.max(0, Number(merged.fsrsState.difficulty || 0)),
                stability: Math.max(0, Number(merged.fsrsState.stability || 0)),
                state: normalizeFsrsStateValue(merged.fsrsState.state),
                reviewCount: Math.max(0, Number(merged.fsrsState.reviewCount || merged.fsrsState.reps || 0)),
                lapses: Math.max(0, Number(merged.fsrsState.lapses || merged.fsrsState.lapse_count || 0)),
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
        if (typeof reviewDomain.calculateElapsedDays === 'function') {
            return reviewDomain.calculateElapsedDays(lastReviewTime, nowTime);
        }
        if (reviewFsrs.calculateElapsedDays) {
            return reviewFsrs.calculateElapsedDays(lastReviewTime, nowTime);
        }
        const left = parseFsrsTimestamp(lastReviewTime);
        const right = Number(nowTime || Date.now());
        if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return 0;
        return Math.max(0, Math.floor((right - left) / DAY_MS));
    }

    function forgettingCurve(elapsedDays, stability) {
        if (typeof reviewDomain.forgettingCurve === 'function') {
            return reviewDomain.forgettingCurve(elapsedDays, stability);
        }
        const retention = reviewFsrs.forgettingCurve
            ? reviewFsrs.forgettingCurve(elapsedDays, stability)
            : 0;
        if (!Number.isFinite(retention)) return 0;
        return Math.max(0, Math.min(1, retention));
    }

    function getRecordReviewMeta(record, nowTime = Date.now()) {
        if (typeof reviewDomain.getRecordReviewMeta === 'function') {
            return reviewDomain.getRecordReviewMeta(record, nowTime, { isLeetcodeSite });
        }
        const review = normalizeReviewState(record && record.review, nowTime);
        const site = String(record && record.site || '').trim().toLowerCase();
        const isLeetcode = isLeetcodeSite(site);
        const dayStart = getLocalDayStartTimestamp(nowTime);
        const nextReviewIso = review.nextReviewAt;
        const nextReviewTime = nextReviewIso ? new Date(nextReviewIso).getTime() : 0;
        const hasNextReview = Number.isFinite(nextReviewTime) && nextReviewTime > 0;
        const rawDueByToday = hasNextReview && nextReviewTime <= getLocalDayEndTimestamp(nowTime);
        const reviewedToday = Boolean(review.reviewedToday);
        const dueByToday = Boolean(review.enabled && isLeetcode && (rawDueByToday || reviewedToday));
        const dueToday = Boolean(dueByToday && !review.reviewedToday);
        const overdueDays = dueToday && nextReviewTime < dayStart
            ? Math.max(1, Math.ceil((dayStart - nextReviewTime) / DAY_MS))
            : 0;
        const fsrsState = review.fsrsState || null;
        const recallProbability = fsrsState && fsrsState.stability > 0 && fsrsState.lastReview > 0
            ? forgettingCurve(calculateElapsedDays(fsrsState.lastReview, nowTime), fsrsState.stability)
            : 1;

        return {
            enabled: Boolean(review.enabled),
            review,
            isLeetcode,
            dueToday,
            dueByToday: Boolean(review.enabled && isLeetcode && dueByToday),
            reviewedToday,
            overdueDays,
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
        const previousDueByToday = Boolean(getRecordReviewMeta(record, nowTime).dueByToday);
        const previousFsrs = previousReview.fsrsState || {};
        let fsrsCard = null;
        if (typeof reviewDomain.buildFsrsInputCard === 'function') {
            const built = reviewDomain.buildFsrsInputCard(record, previousReview, nowTime);
            if (built && built.fsrsCard) {
                fsrsCard = built.fsrsCard;
            }
        }
        if (!fsrsCard) {
            const baseTime = resolveReviewBaseTime(record, previousReview, nowTime);
            const lastReviewDate = new Date(baseTime);
            const cardDueTime = parseFsrsTimestamp(previousFsrs.nextReview) || baseTime;
            const cardScheduledDays = Math.max(0, Math.floor((cardDueTime - baseTime) / DAY_MS));
            fsrsCard = {
                due: new Date(cardDueTime),
                stability: Number(previousFsrs.stability || 0),
                difficulty: Number(previousFsrs.difficulty || 0),
                elapsed_days: Math.max(0, (nowTime - baseTime) / DAY_MS),
                scheduled_days: cardScheduledDays,
                reps: Math.max(0, Number(previousFsrs.reviewCount || 0)),
                lapse_count: Math.max(0, Number(previousFsrs.lapses || 0)),
                state: normalizeFsrsStateValue(previousFsrs.state),
                last_review: lastReviewDate
            };
        }
        const fsrsRating = getFsrsRatingFromMemoryRating(safeRating);
        const nextFsrsCard = buildNextFsrsCard(fsrsCard, nowDate, fsrsRating);
        const nextReviewTime = nextFsrsCard.due.getTime();
        const nextReviewIso = nextFsrsCard.due.toISOString();

        return {
            enabled: true,
            algorithm: 'fsrs',
            lastRating: safeRating,
            lastRatedAt: nowIso,
            nextReviewAt: nextReviewIso,
            reviewedToday: previousDueByToday,
            reviewedDateKey: previousDueByToday ? todayKey : '',
            fsrsState: {
                difficulty: nextFsrsCard.difficulty,
                stability: nextFsrsCard.stability,
                state: nextFsrsCard.state,
                lastReview: parseFsrsTimestamp(nextFsrsCard.last_review || nowDate),
                nextReview: nextReviewTime,
                reviewCount: Math.max(0, Number(nextFsrsCard.reps || 0)),
                lapses: Math.max(0, Number(nextFsrsCard.lapse_count || 0)),
                quality: safeRating
            }
        };
    }

    function buildReviewRatingPreviewsByRecord(record, nowTime = Date.now()) {
        const previews = {};
        for (let rating = 1; rating <= 4; rating += 1) {
            const reviewState = buildNextReviewState(record, rating, nowTime);
            const previewText = typeof reviewDomain.buildReviewPreviewText === 'function'
                ? reviewDomain.buildReviewPreviewText(reviewState.nextReviewAt, nowTime)
                : `${Math.max(0, Math.ceil((new Date(reviewState.nextReviewAt).getTime() - nowTime) / DAY_MS))}天后`;
            previews[rating] = {
                rating,
                label: REVIEW_RATING_LABELS[rating] || '未设置',
                previewText,
                nextReviewAt: reviewState.nextReviewAt
            };
        }
        return previews;
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

        return null;
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
        const { url, title, actionType, noteContent, rating, nowTime: inputNowTime } = options || {};
        const identity = extractProblemIdentity(url);
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
        return buildReviewRatingPreviewsByRecord(baseRecord, nowTime);
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
            if (reviewMeta && reviewMeta.reviewedToday) {
                return {
                    ...existingRecord,
                    review: normalizeReviewState(existingRecord.review, nowTime),
                    success: false,
                    reason: 'already_reviewed_today',
                    isNewRecord: false
                };
            }
        }

        const result = await trackProblemAction({
            url: identity.url || url,
            title,
            actionType: 'review_rated',
            rating: safeRating,
            nowTime
        });

        return {
            ...(result || {}),
            success: Boolean(result),
            reason: result ? 'ok' : 'failed'
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
        getReviewRatingPreviews,
        rateProblemMemory,
        deleteProblemRecord,
        saveProblemNote
    };
})();

