/**
 * FSRS 复习调度内核（对齐 ts-fsrs@4.7.0）
 * 版本：1.1.3
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const DAY_MS = 24 * 60 * 60 * 1000;
    const FSRS_STATE = {
        New: 0,
        Learning: 1,
        Review: 2,
        Relearning: 3
    };
    const FSRS_RATING = {
        Again: 1,
        Hard: 2,
        Good: 3,
        Easy: 4
    };
    const FSRS_S_MIN = 0.01;
    const FSRS_DECAY = -0.5;
    const FSRS_FACTOR = 19 / 81;
    const FSRS_DEFAULT_REQUEST_RETENTION = 0.9;
    const FSRS_DEFAULT_MAXIMUM_INTERVAL = 36500;
    const FSRS_DEFAULT_ENABLE_FUZZ = false;
    const FSRS_DEFAULT_ENABLE_SHORT_TERM = true;
    const FSRS_DEFAULT_WEIGHTS = [
        0.40255, 1.18385, 3.173, 15.69105, 7.1949,
        0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
        1.01925, 1.9395, 0.11, 0.29605, 2.2698,
        0.2315, 2.9898, 0.51655, 0.6621
    ];
    const FSRS_WEIGHT_CLAMP_RANGES = [
        [FSRS_S_MIN, 100], [FSRS_S_MIN, 100], [FSRS_S_MIN, 100], [FSRS_S_MIN, 100],
        [1, 10], [0.001, 4], [0.001, 4], [0.001, 0.75], [0, 4.5], [0, 0.8],
        [0.001, 3.5], [0.001, 5], [0.001, 0.25], [0.001, 0.9], [0, 4],
        [0, 1], [1, 6], [0, 2], [0, 2]
    ];

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

    function parseFsrsTimestamp(input) {
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

    function toFixed8(input) {
        const value = Number(input);
        if (!Number.isFinite(value)) return 0;
        return Number(value.toFixed(8));
    }

    function getFsrsRatingFromMemoryRating(rating) {
        if (rating === 1) return FSRS_RATING.Again;
        if (rating === 2) return FSRS_RATING.Hard;
        if (rating === 3) return FSRS_RATING.Good;
        return FSRS_RATING.Easy;
    }

    function getFsrsDateDiffInDays(left, right) {
        const leftDate = new Date(left);
        const rightDate = new Date(right);
        if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
            return 0;
        }
        const leftUtc = Date.UTC(leftDate.getUTCFullYear(), leftDate.getUTCMonth(), leftDate.getUTCDate());
        const rightUtc = Date.UTC(rightDate.getUTCFullYear(), rightDate.getUTCMonth(), rightDate.getUTCDate());
        return Math.floor((rightUtc - leftUtc) / DAY_MS);
    }

    function buildFsrsParameters(input) {
        const options = input && typeof input === 'object' ? input : {};
        let weights = FSRS_DEFAULT_WEIGHTS.slice();
        if (Array.isArray(options.w)) {
            if (options.w.length === 19) {
                weights = options.w.slice();
            } else if (options.w.length === 17) {
                weights = options.w.concat([0, 0]);
                weights[4] = Number((weights[5] * 2 + weights[4]).toFixed(8));
                weights[5] = Number((Math.log(weights[5] * 3 + 1) / 3).toFixed(8));
                weights[6] = Number((weights[6] + 0.5).toFixed(8));
            }
        }
        weights = weights.map((value, index) => {
            const range = FSRS_WEIGHT_CLAMP_RANGES[index];
            return clampNumber(value, range[0], range[1]);
        });

        return {
            request_retention: options.request_retention || FSRS_DEFAULT_REQUEST_RETENTION,
            maximum_interval: options.maximum_interval || FSRS_DEFAULT_MAXIMUM_INTERVAL,
            w: weights,
            enable_fuzz: options.enable_fuzz ?? FSRS_DEFAULT_ENABLE_FUZZ,
            enable_short_term: options.enable_short_term ?? FSRS_DEFAULT_ENABLE_SHORT_TERM
        };
    }

    function buildFsrsParamsDigest(params) {
        const safe = params && typeof params === 'object' ? params : fsrsParamsRef;
        return {
            request_retention: Number(safe.request_retention || fsrsParamsRef.request_retention),
            maximum_interval: Number(safe.maximum_interval || fsrsParamsRef.maximum_interval),
            enable_fuzz: safe.enable_fuzz ?? fsrsParamsRef.enable_fuzz,
            enable_short_term: safe.enable_short_term ?? fsrsParamsRef.enable_short_term,
            w: Array.isArray(safe.w) ? safe.w.slice() : fsrsParamsRef.w.slice()
        };
    }

    function calculateFsrsIntervalModifier(requestRetention) {
        const retention = Number(requestRetention);
        if (!(retention > 0 && retention <= 1)) {
            throw new Error('FSRS request_retention 必须在 (0, 1] 范围内');
        }
        return toFixed8((Math.pow(retention, 1 / FSRS_DECAY) - 1) / FSRS_FACTOR);
    }

    function fsrsConstrainDifficulty(value) {
        return Math.min(Math.max(toFixed8(value), 1), 10);
    }

    function fsrsInitStability(params, rating) {
        return Math.max(params.w[rating - 1], 0.1);
    }

    function fsrsInitDifficulty(params, rating) {
        return fsrsConstrainDifficulty(params.w[4] - Math.exp((rating - 1) * params.w[5]) + 1);
    }

    function fsrsLinearDamping(value, difficulty) {
        return toFixed8(value * (10 - difficulty) / 9);
    }

    function fsrsMeanReversion(params, initDifficulty, currentDifficulty) {
        return toFixed8(params.w[7] * initDifficulty + (1 - params.w[7]) * currentDifficulty);
    }

    function fsrsNextDifficulty(params, difficulty, rating) {
        const delta = -params.w[6] * (rating - 3);
        const adjusted = difficulty + fsrsLinearDamping(delta, difficulty);
        return fsrsConstrainDifficulty(fsrsMeanReversion(params, fsrsInitDifficulty(params, FSRS_RATING.Easy), adjusted));
    }

    function fsrsNextRecallStability(params, difficulty, stability, retrievability, rating) {
        const hardPenalty = rating === FSRS_RATING.Hard ? params.w[15] : 1;
        const easyBonus = rating === FSRS_RATING.Easy ? params.w[16] : 1;
        const value = stability * (
            1 +
            Math.exp(params.w[8]) *
            (11 - difficulty) *
            Math.pow(stability, -params.w[9]) *
            (Math.exp((1 - retrievability) * params.w[10]) - 1) *
            hardPenalty *
            easyBonus
        );
        return toFixed8(clampNumber(value, FSRS_S_MIN, 36500));
    }

    function fsrsNextForgetStability(params, difficulty, stability, retrievability) {
        const value = params.w[11] *
            Math.pow(difficulty, -params.w[12]) *
            (Math.pow(stability + 1, params.w[13]) - 1) *
            Math.exp((1 - retrievability) * params.w[14]);
        return toFixed8(clampNumber(value, FSRS_S_MIN, 36500));
    }

    function cloneFsrsCard(card) {
        return {
            ...card,
            due: new Date(card.due.getTime()),
            last_review: card.last_review ? new Date(card.last_review.getTime()) : undefined
        };
    }

    function getFsrsNextInterval(params, intervalModifier, stability) {
        const bounded = Math.min(
            Math.max(1, Math.round(stability * intervalModifier)),
            params.maximum_interval
        );
        if (!params.enable_fuzz || bounded < 2.5) {
            return Math.round(bounded);
        }
        return Math.round(bounded);
    }

    function scheduleByDays(baseDate, days) {
        return new Date(baseDate.getTime() + days * DAY_MS);
    }

    function normalizeFsrsStateValue(input) {
        const number = Number(input);
        if (!Number.isInteger(number)) return FSRS_STATE.New;
        if (number < FSRS_STATE.New || number > FSRS_STATE.Relearning) return FSRS_STATE.New;
        return number;
    }

    function normalizeFsrsCard(card, nowDate) {
        const dueTime = parseFsrsTimestamp(card && card.due) || nowDate.getTime();
        const lastReviewTime = parseFsrsTimestamp(card && card.last_review);
        return {
            due: new Date(dueTime),
            stability: Math.max(0, Number(card && card.stability || 0)),
            difficulty: Math.max(0, Number(card && card.difficulty || 0)),
            elapsed_days: Math.max(0, Number(card && card.elapsed_days || 0)),
            scheduled_days: Math.max(0, Number(card && card.scheduled_days || 0)),
            reps: Math.max(0, Number(card && card.reps || 0)),
            lapse_count: Math.max(0, Number(card && card.lapse_count || 0)),
            state: normalizeFsrsStateValue(card && card.state),
            last_review: lastReviewTime ? new Date(lastReviewTime) : undefined
        };
    }

    function buildNextFsrsCard(lastCard, nowDate, rating, params) {
        const algorithmParams = params || fsrsParamsRef;
        const intervalModifier = calculateFsrsIntervalModifier(algorithmParams.request_retention);
        const last = normalizeFsrsCard(lastCard, nowDate);
        const current = normalizeFsrsCard(lastCard, nowDate);
        const elapsedDays = last.state !== FSRS_STATE.New && last.last_review
            ? getFsrsDateDiffInDays(last.last_review, nowDate)
            : 0;
        current.last_review = new Date(nowDate.getTime());
        current.elapsed_days = elapsedDays;
        current.reps += 1;

        const ratingCards = {};
        const createStateCards = () => ({
            again: cloneFsrsCard(current),
            hard: cloneFsrsCard(current),
            good: cloneFsrsCard(current),
            easy: cloneFsrsCard(current)
        });

        const cards = createStateCards();

        if (last.state === FSRS_STATE.New) {
            current.scheduled_days = 0;
            current.elapsed_days = 0;
            cards.again.difficulty = fsrsInitDifficulty(algorithmParams, FSRS_RATING.Again);
            cards.again.stability = fsrsInitStability(algorithmParams, FSRS_RATING.Again);
            cards.hard.difficulty = fsrsInitDifficulty(algorithmParams, FSRS_RATING.Hard);
            cards.hard.stability = fsrsInitStability(algorithmParams, FSRS_RATING.Hard);
            cards.good.difficulty = fsrsInitDifficulty(algorithmParams, FSRS_RATING.Good);
            cards.good.stability = fsrsInitStability(algorithmParams, FSRS_RATING.Good);
            cards.easy.difficulty = fsrsInitDifficulty(algorithmParams, FSRS_RATING.Easy);
            cards.easy.stability = fsrsInitStability(algorithmParams, FSRS_RATING.Easy);
        } else {
            const difficulty = last.difficulty;
            const stability = last.stability;
            const retrievability = fsrsForgettingCurve(elapsedDays, stability);
            cards.again.difficulty = fsrsNextDifficulty(algorithmParams, difficulty, FSRS_RATING.Again);
            const forgetStability = fsrsNextForgetStability(algorithmParams, difficulty, stability, retrievability);
            cards.again.stability = clampNumber(stability, FSRS_S_MIN, forgetStability);
            cards.hard.difficulty = fsrsNextDifficulty(algorithmParams, difficulty, FSRS_RATING.Hard);
            cards.hard.stability = fsrsNextRecallStability(algorithmParams, difficulty, stability, retrievability, FSRS_RATING.Hard);
            cards.good.difficulty = fsrsNextDifficulty(algorithmParams, difficulty, FSRS_RATING.Good);
            cards.good.stability = fsrsNextRecallStability(algorithmParams, difficulty, stability, retrievability, FSRS_RATING.Good);
            cards.easy.difficulty = fsrsNextDifficulty(algorithmParams, difficulty, FSRS_RATING.Easy);
            cards.easy.stability = fsrsNextRecallStability(algorithmParams, difficulty, stability, retrievability, FSRS_RATING.Easy);
            cards.again.lapse_count += 1;
        }

        let againInterval = getFsrsNextInterval(algorithmParams, intervalModifier, cards.again.stability);
        let hardInterval = getFsrsNextInterval(algorithmParams, intervalModifier, cards.hard.stability);
        let goodInterval = getFsrsNextInterval(algorithmParams, intervalModifier, cards.good.stability);
        let easyInterval = getFsrsNextInterval(algorithmParams, intervalModifier, cards.easy.stability);

        againInterval = Math.min(againInterval, hardInterval);
        hardInterval = Math.max(hardInterval, againInterval + 1);
        goodInterval = Math.max(goodInterval, hardInterval + 1);
        easyInterval = Math.max(easyInterval, goodInterval + 1);

        cards.again.scheduled_days = againInterval;
        cards.again.due = scheduleByDays(nowDate, againInterval);
        cards.again.state = FSRS_STATE.Review;
        cards.hard.scheduled_days = hardInterval;
        cards.hard.due = scheduleByDays(nowDate, hardInterval);
        cards.hard.state = FSRS_STATE.Review;
        cards.good.scheduled_days = goodInterval;
        cards.good.due = scheduleByDays(nowDate, goodInterval);
        cards.good.state = FSRS_STATE.Review;
        cards.easy.scheduled_days = easyInterval;
        cards.easy.due = scheduleByDays(nowDate, easyInterval);
        cards.easy.state = FSRS_STATE.Review;

        ratingCards[FSRS_RATING.Again] = cards.again;
        ratingCards[FSRS_RATING.Hard] = cards.hard;
        ratingCards[FSRS_RATING.Good] = cards.good;
        ratingCards[FSRS_RATING.Easy] = cards.easy;
        return ratingCards[rating];
    }

    function fsrsForgettingCurve(elapsedDays, stability) {
        const elapsed = Math.max(0, Number(elapsedDays || 0));
        const safeStability = Math.max(FSRS_S_MIN, Number(stability || 0));
        return toFixed8(Math.pow(1 + FSRS_FACTOR * elapsed / safeStability, FSRS_DECAY));
    }

    function calculateElapsedDays(lastReviewTime, nowTime = Date.now()) {
        const left = parseFsrsTimestamp(lastReviewTime);
        const right = Number(nowTime || Date.now());
        if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return 0;
        return Math.max(0, getFsrsDateDiffInDays(new Date(left), new Date(right)));
    }

    function rescheduleExistingFsrsCard(fsrsState, params) {
        const source = fsrsState && typeof fsrsState === 'object' ? fsrsState : null;
        if (!source) return null;

        const lastReviewTime = parseFsrsTimestamp(source.lastReview);
        const stability = Number(source.stability || 0);
        if (!(lastReviewTime > 0) || !(stability > 0)) {
            return null;
        }

        const algorithmParams = params || fsrsParamsRef;
        const intervalModifier = calculateFsrsIntervalModifier(algorithmParams.request_retention);
        const scheduledDays = getFsrsNextInterval(algorithmParams, intervalModifier, stability);
        const due = scheduleByDays(new Date(lastReviewTime), scheduledDays);

        return {
            nextReview: due.getTime(),
            nextReviewAt: due.toISOString(),
            scheduledDays
        };
    }

    const fsrsParamsRef = buildFsrsParameters({
        request_retention: 0.9,
        maximum_interval: 365,
        enable_fuzz: false,
        enable_short_term: false
    });

    modules.reviewFsrs = {
        FSRS_STATE,
        FSRS_RATING,
        buildFsrsParameters,
        buildFsrsParamsDigest,
        fsrsParamsRef,
        parseFsrsTimestamp,
        normalizeFsrsStateValue,
        getFsrsRatingFromMemoryRating,
        calculateElapsedDays,
        forgettingCurve: fsrsForgettingCurve,
        buildNextFsrsCard,
        rescheduleExistingFsrsCard
    };
})();
