/**
 * 复习域公共逻辑（状态归一化 / reviewMeta / FSRS 输入组装）
 * 版本：1.1.3
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const reviewFsrs = modules.reviewFsrs || {};
    const reviewSettings = modules.reviewSettings || {};
    const DAY_MS = 24 * 60 * 60 * 1000;
    const REVIEW_RATING_LABELS = {
        1: '很难想起',
        2: '有点吃力',
        3: '基本记得',
        4: '很熟练'
    };

    function parseFsrsTimestamp(input) {
        if (typeof reviewFsrs.parseFsrsTimestamp === 'function') {
            return reviewFsrs.parseFsrsTimestamp(input);
        }
        if (input instanceof Date) {
            const value = input.getTime();
            return Number.isFinite(value) ? value : 0;
        }
        if (typeof input === 'string') {
            const value = Date.parse(input);
            return Number.isFinite(value) ? value : 0;
        }
        const value = Number(input);
        return Number.isFinite(value) ? value : 0;
    }

    function normalizeFsrsStateValue(input) {
        if (typeof reviewFsrs.normalizeFsrsStateValue === 'function') {
            return reviewFsrs.normalizeFsrsStateValue(input);
        }
        const number = Number(input);
        return Number.isInteger(number) ? number : 0;
    }

    function getFsrsRatingFromMemoryRating(rating) {
        if (typeof reviewFsrs.getFsrsRatingFromMemoryRating === 'function') {
            return reviewFsrs.getFsrsRatingFromMemoryRating(rating);
        }
        return parseRating(rating);
    }

    function buildNextFsrsCard(lastCard, nowDate, rating, params) {
        if (typeof reviewFsrs.buildNextFsrsCard === 'function') {
            return reviewFsrs.buildNextFsrsCard(lastCard, nowDate, rating, params || reviewFsrs.fsrsParamsRef);
        }
        throw new Error('FSRS 内核未加载');
    }

    function getLocalDateKeyFromTime(input) {
        const date = input instanceof Date ? input : new Date(input || Date.now());
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getLocalDayStartTimestamp(input) {
        const date = input instanceof Date ? new Date(input.getTime()) : new Date(input || Date.now());
        if (Number.isNaN(date.getTime())) return Date.now();
        date.setHours(0, 0, 0, 0);
        return date.getTime();
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
            // 记录“今天是否已评分”的日期键，用于同题同天评分去重。
            lastRatedDateKey: '',
            // 记录“今天是否已提醒”的日期键，与评分状态独立，避免重复提醒。
            lastRemindedDateKey: '',
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
        merged.lastRatedDateKey = String(merged.lastRatedDateKey || '').trim();
        merged.lastRemindedDateKey = String(merged.lastRemindedDateKey || '').trim();
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

        if (!merged.lastRatedDateKey && merged.lastRatedAt) {
            merged.lastRatedDateKey = getLocalDateKeyFromTime(merged.lastRatedAt);
        }
        if (!merged.reviewedDateKey && merged.reviewedToday && merged.lastRatedAt) {
            merged.reviewedDateKey = getLocalDateKeyFromTime(merged.lastRatedAt);
        }

        merged.reviewedToday = merged.reviewedDateKey === todayKey && Boolean(merged.reviewedToday);
        merged.enabled = Boolean(merged.enabled) && Boolean(merged.nextReviewAt);

        return merged;
    }

    function calculateElapsedDays(lastReviewTime, nowTime = Date.now()) {
        if (typeof reviewFsrs.calculateElapsedDays === 'function') {
            return reviewFsrs.calculateElapsedDays(lastReviewTime, nowTime);
        }
        const left = parseFsrsTimestamp(lastReviewTime);
        const right = Number(nowTime || Date.now());
        if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return 0;
        return Math.max(0, Math.floor((right - left) / DAY_MS));
    }

    function forgettingCurve(elapsedDays, stability) {
        const retention = typeof reviewFsrs.forgettingCurve === 'function'
            ? reviewFsrs.forgettingCurve(elapsedDays, stability)
            : 0;
        if (!Number.isFinite(retention)) return 0;
        return Math.max(0, Math.min(1, retention));
    }

    function resolveReviewBaseTime(record, previousReview, nowTime) {
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

    function buildFsrsInputCard(record, previousReview, nowTime = Date.now()) {
        const baseTime = resolveReviewBaseTime(record, previousReview, nowTime);
        const previousFsrs = previousReview.fsrsState || {};
        const cardDueTime = parseFsrsTimestamp(previousFsrs.nextReview) || baseTime;
        const cardScheduledDays = Math.max(0, Math.floor((cardDueTime - baseTime) / DAY_MS));

        return {
            baseTime,
            fsrsCard: {
                due: new Date(cardDueTime),
                stability: Number(previousFsrs.stability || 0),
                difficulty: Number(previousFsrs.difficulty || 0),
                elapsed_days: Math.max(0, (nowTime - baseTime) / DAY_MS),
                scheduled_days: cardScheduledDays,
                reps: Math.max(0, Number(previousFsrs.reviewCount || 0)),
                lapse_count: Math.max(0, Number(previousFsrs.lapses || 0)),
                state: normalizeFsrsStateValue(previousFsrs.state),
                last_review: new Date(baseTime)
            }
        };
    }

    function getRecordReviewMeta(record, nowTime = Date.now(), options = {}) {
        const review = normalizeReviewState(record && record.review, nowTime);
        const site = String(record && record.site || '').trim().toLowerCase();
        const isLeetcode = typeof options.isLeetcodeSite === 'function'
            ? Boolean(options.isLeetcodeSite(site))
            : false;
        const dayStart = getLocalDayStartTimestamp(nowTime);
        const todayKey = getLocalDateKeyFromTime(nowTime);
        const nextReviewIso = review.nextReviewAt;
        const nextReviewTime = nextReviewIso ? new Date(nextReviewIso).getTime() : 0;
        const hasNextReview = Number.isFinite(nextReviewTime) && nextReviewTime > 0;
        const rawDueByToday = hasNextReview && nextReviewTime <= getLocalDayEndTimestamp(nowTime);
        const reviewedToday = Boolean(review.reviewedToday);
        const ratedToday = review.lastRatedDateKey === todayKey;
        const remindedToday = review.lastRemindedDateKey === todayKey;
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
            ratedToday,
            remindedToday,
            overdueDays,
            nextReviewTime,
            recallProbability,
            ratingLabel: getReviewRatingLabel(review.lastRating)
        };
    }

    function getReviewRatingLabel(rating) {
        return REVIEW_RATING_LABELS[parseRating(rating)] || '未设置';
    }

    function formatReviewDate(nextReviewAt) {
        if (reviewSettings && typeof reviewSettings.formatReviewDate === 'function') {
            return reviewSettings.formatReviewDate(nextReviewAt);
        }
        const date = new Date(nextReviewAt || 0);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function buildNextReviewState(record, rating, nowTime = Date.now(), options = {}) {
        const safeRating = parseRating(rating);
        if (!safeRating) {
            throw new Error('记忆状态评分无效');
        }

        const nowDate = new Date(nowTime);
        const nowIso = nowDate.toISOString();
        const todayKey = getLocalDateKeyFromTime(nowDate);
        const previousReview = normalizeReviewState(record && record.review, nowTime);
        const previousDueByToday = Boolean(getRecordReviewMeta(record, nowTime, options).dueByToday);
        const built = buildFsrsInputCard(record, previousReview, nowTime);
        const fsrsCard = built && built.fsrsCard ? built.fsrsCard : null;
        if (!fsrsCard) {
            throw new Error('FSRS 输入组装失败');
        }

        const fsrsRating = getFsrsRatingFromMemoryRating(safeRating);
        const nextFsrsCard = buildNextFsrsCard(fsrsCard, nowDate, fsrsRating, options.fsrsParams);
        const nextReviewTime = nextFsrsCard.due.getTime();
        const nextReviewIso = nextFsrsCard.due.toISOString();

        return {
            enabled: true,
            algorithm: 'fsrs',
            lastRating: safeRating,
            lastRatedAt: nowIso,
            lastRatedDateKey: todayKey,
            lastRemindedDateKey: previousReview.lastRemindedDateKey || '',
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

    function buildReviewPreviewText(nextReviewAt, nowTime = Date.now()) {
        const nextTime = parseFsrsTimestamp(nextReviewAt);
        if (!nextTime) return '计算中';
        const days = Math.max(0, Math.ceil((nextTime - Number(nowTime || Date.now())) / DAY_MS));
        return `${days}天后`;
    }

    function buildReviewRatingPreviewsByRecord(record, nowTime = Date.now(), options = {}) {
        const previews = {};
        for (let rating = 1; rating <= 4; rating += 1) {
            const reviewState = buildNextReviewState(record, rating, nowTime, options);
            previews[rating] = {
                rating,
                label: REVIEW_RATING_LABELS[rating] || '未设置',
                previewText: buildReviewPreviewText(reviewState.nextReviewAt, nowTime),
                nextReviewAt: reviewState.nextReviewAt
            };
        }
        return previews;
    }

    modules.reviewDomain = {
        DAY_MS,
        REVIEW_RATING_LABELS,
        getLocalDateKeyFromTime,
        getLocalDayStartTimestamp,
        getLocalDayEndTimestamp,
        normalizeIso,
        parseRating,
        parseFsrsTimestamp,
        normalizeFsrsStateValue,
        getFsrsRatingFromMemoryRating,
        buildDefaultReviewState,
        normalizeReviewState,
        calculateElapsedDays,
        forgettingCurve,
        resolveReviewBaseTime,
        buildFsrsInputCard,
        getRecordReviewMeta,
        getReviewRatingLabel,
        formatReviewDate,
        buildReviewPreviewText,
        buildNextReviewState,
        buildReviewRatingPreviewsByRecord
    };
})();
