/**
 * 共享错误信息映射
 * 版本：1.0.47
 */

(function () {
    'use strict';

    const HTTP_STATUS_HINTS = {
        400: '请求格式错误或参数无效，请检查请求参数后重试。',
        401: 'API 密钥无效或未提供，请检查 API Key 配置。',
        403: '请求被拒绝，通常是余额不足或权限不足。',
        404: '请求的资源未找到，请检查接口地址是否正确。',
        413: '请求体过大，请减少请求内容后重试。',
        429: '请求过于频繁，已触发速率限制，请稍后重试。',
        500: '服务器内部错误，可能是服务端异常或请求参数问题。',
        503: '服务暂时不可用，可能在维护或负载过高，请稍后重试。'
    };

    function isAbortError(error) {
        if (!error) return false;
        if (error.name === 'AbortError') return true;
        const message = String(error.message || error);
        return /已取消|aborted|abort/i.test(message);
    }

    function extractStatusCode(error) {
        if (!error) return null;
        const fromField = Number(error.status);
        if (Number.isInteger(fromField) && fromField >= 100 && fromField <= 599) {
            return fromField;
        }

        const message = String(error.message || error);
        const match = message.match(/(?:HTTP|API\s*Error[:：]?)\s*(\d{3})/i) ||
            message.match(/\b(\d{3})\b/);
        if (!match) return null;

        const code = Number(match[1]);
        if (!Number.isInteger(code) || code < 100 || code > 599) return null;
        return code;
    }

    function getStatusHint(statusCode) {
        return HTTP_STATUS_HINTS[statusCode] || '';
    }

    function formatStatusError(statusCode) {
        const hint = getStatusHint(statusCode);
        if (hint) {
            return `HTTP ${statusCode}：${hint}`;
        }
        return `HTTP ${statusCode}：请求失败，请稍后重试。`;
    }

    function normalizeError(error, fallbackMessage = '生成失败，请稍后重试。') {
        if (isAbortError(error)) {
            return {
                isAbort: true,
                statusCode: null,
                message: 'API 调用已取消'
            };
        }

        const statusCode = extractStatusCode(error);
        if (statusCode) {
            return {
                isAbort: false,
                statusCode,
                message: formatStatusError(statusCode)
            };
        }

        const rawMessage = String(error && error.message ? error.message : error || '').trim();
        if (/timeout|超时/i.test(rawMessage)) {
            return {
                isAbort: false,
                statusCode: null,
                message: '接口响应超时，请稍后重试。'
            };
        }

        if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_INTERNET|ERR_NAME_NOT_RESOLVED|ERR_NETWORK/i.test(rawMessage)) {
            return {
                isAbort: false,
                statusCode: null,
                message: '网络连接失败，请检查网络或接口地址后重试。'
            };
        }

        return {
            isAbort: false,
            statusCode: null,
            message: rawMessage || fallbackMessage
        };
    }

    window.NoteHelperErrorMessages = {
        HTTP_STATUS_HINTS,
        isAbortError,
        extractStatusCode,
        getStatusHint,
        formatStatusError,
        normalizeError
    };
})();
