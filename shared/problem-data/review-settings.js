/**
 * 复习参数配置与日期格式化
 * 版本：1.1.3
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const syncCore = modules.syncCore || {};
    const reviewFsrs = modules.reviewFsrs || {};

    const DEFAULT_REVIEW_FSRS_SETTINGS = constants.DEFAULT_SYNC_SETTINGS
        && constants.DEFAULT_SYNC_SETTINGS.reviewFsrs
        ? constants.DEFAULT_SYNC_SETTINGS.reviewFsrs
        : {
            enabled: false,
            preset: 'normal',
            custom: {
                request_retention: 0.9,
                maximum_interval: 365
            }
        };
    const REVIEW_FSRS_PRESETS = {
        intensive: {
            request_retention: 0.97,
            maximum_interval: 45
        },
        normal: {
            request_retention: 0.9,
            maximum_interval: 365
        },
        relaxed: {
            request_retention: 0.87,
            maximum_interval: 365
        }
    };

    function clampRequestRetention(value, fallback) {
        const number = Number(value);
        if (!(number > 0 && number <= 1)) return fallback;
        return Number(number.toFixed(8));
    }

    function clampMaximumInterval(value, fallback) {
        const number = Math.floor(Number(value));
        if (!Number.isFinite(number) || number < 1) return fallback;
        return number;
    }

    function normalizePreset(value) {
        const preset = String(value || '').trim().toLowerCase();
        if (preset === 'intensive' || preset === 'normal' || preset === 'relaxed' || preset === 'custom') {
            return preset;
        }
        return DEFAULT_REVIEW_FSRS_SETTINGS.preset || 'normal';
    }

    function normalizeReviewFsrsSettings(input) {
        const source = input && typeof input === 'object' ? input : {};
        const defaultCustom = DEFAULT_REVIEW_FSRS_SETTINGS.custom || {};
        const customSource = source.custom && typeof source.custom === 'object' ? source.custom : {};
        return {
            enabled: Boolean(source.enabled),
            preset: normalizePreset(source.preset),
            custom: {
                request_retention: clampRequestRetention(
                    customSource.request_retention,
                    defaultCustom.request_retention || 0.9
                ),
                maximum_interval: clampMaximumInterval(
                    customSource.maximum_interval,
                    defaultCustom.maximum_interval || 365
                )
            }
        };
    }

    function extractReviewFsrsSettings(source) {
        if (!source || typeof source !== 'object') {
            return normalizeReviewFsrsSettings(DEFAULT_REVIEW_FSRS_SETTINGS);
        }
        if (Object.prototype.hasOwnProperty.call(source, 'reviewFsrs')) {
            return normalizeReviewFsrsSettings(source.reviewFsrs);
        }
        return normalizeReviewFsrsSettings(source);
    }

    function resolvePresetValues(settings) {
        const normalized = extractReviewFsrsSettings(settings);
        if (normalized.preset === 'custom') {
            return {
                ...normalized.custom
            };
        }
        return {
            ...(REVIEW_FSRS_PRESETS[normalized.preset] || REVIEW_FSRS_PRESETS.normal)
        };
    }

    function getEffectiveReviewFsrsParams(source) {
        if (!reviewFsrs || typeof reviewFsrs.buildFsrsParameters !== 'function') {
            throw new Error('FSRS 内核未准备完成，无法读取复习参数');
        }

        const normalized = extractReviewFsrsSettings(source);
        if (!normalized.enabled) {
            return reviewFsrs.fsrsParamsRef;
        }

        const resolved = resolvePresetValues(normalized);
        return reviewFsrs.buildFsrsParameters({
            request_retention: resolved.request_retention,
            maximum_interval: resolved.maximum_interval,
            enable_fuzz: false,
            enable_short_term: false
        });
    }

    function formatReviewDate(value) {
        const date = new Date(value || 0);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async function getReviewFsrsSettings() {
        if (!syncCore || typeof syncCore.getSyncSettings !== 'function') {
            return extractReviewFsrsSettings(DEFAULT_REVIEW_FSRS_SETTINGS);
        }
        const settings = await syncCore.getSyncSettings();
        return extractReviewFsrsSettings(settings);
    }

    function mergeReviewFsrsSettings(syncSettings, reviewFsrsSettings) {
        const base = syncSettings && typeof syncSettings === 'object' ? syncSettings : {};
        const nextReviewFsrs = extractReviewFsrsSettings(reviewFsrsSettings);
        if (syncCore && typeof syncCore.normalizeSyncSettings === 'function') {
            return syncCore.normalizeSyncSettings({
                ...base,
                reviewFsrs: nextReviewFsrs
            });
        }
        return {
            ...base,
            reviewFsrs: nextReviewFsrs
        };
    }

    async function setReviewFsrsSettings(nextReviewFsrsSettings) {
        if (!syncCore || typeof syncCore.getSyncSettings !== 'function' || typeof syncCore.setSyncSettings !== 'function') {
            throw new Error('同步设置模块未加载，无法保存复习参数配置');
        }
        const current = await syncCore.getSyncSettings();
        const next = mergeReviewFsrsSettings(current, nextReviewFsrsSettings);
        await syncCore.setSyncSettings(next);
        return next.reviewFsrs;
    }

    modules.reviewSettings = {
        DEFAULT_REVIEW_FSRS_SETTINGS: normalizeReviewFsrsSettings(DEFAULT_REVIEW_FSRS_SETTINGS),
        REVIEW_FSRS_PRESETS,
        normalizeReviewFsrsSettings,
        extractReviewFsrsSettings,
        resolvePresetValues,
        getEffectiveReviewFsrsParams,
        formatReviewDate,
        getReviewFsrsSettings,
        mergeReviewFsrsSettings,
        setReviewFsrsSettings
    };
})();
