/**
 * Chrome Storage 封装
 * 替代 GM_setValue / GM_getValue
 */

const Storage = {
    _contextInvalidatedNotified: false,

    _isContextInvalidatedError(error) {
        const message = String(error && error.message || error || '').toLowerCase();
        return message.includes('extension context invalidated');
    },

    _shouldSuppressError(error) {
        if (!this._isContextInvalidatedError(error)) {
            return false;
        }
        if (!this._contextInvalidatedNotified) {
            this._contextInvalidatedNotified = true;
            console.info('[Storage] 扩展上下文已失效，后续存储调用将静默跳过，等待页面刷新。');
        }
        return true;
    },

    /**
     * 获取存储值
     * @param {string} key 键名
     * @param {*} defaultValue 默认值
     * @returns {Promise<*>}
     */
    async get(key, defaultValue = null) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] !== undefined ? result[key] : defaultValue;
        } catch (e) {
            if (this._shouldSuppressError(e)) {
                return defaultValue;
            }
            console.error('[Storage] 获取失败:', key, e);
            return defaultValue;
        }
    },

    /**
     * 设置存储值
     * @param {string} key 键名
     * @param {*} value 值
     * @returns {Promise<void>}
     */
    async set(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (e) {
            if (this._shouldSuppressError(e)) {
                return;
            }
            console.error('[Storage] 设置失败:', key, e);
        }
    },

    /**
     * 批量获取
     * @param {string[]} keys 键名数组
     * @returns {Promise<Object>}
     */
    async getMultiple(keys) {
        try {
            return await chrome.storage.local.get(keys);
        } catch (e) {
            if (this._shouldSuppressError(e)) {
                return {};
            }
            console.error('[Storage] 批量获取失败:', e);
            return {};
        }
    },

    /**
     * 批量设置
     * @param {Object} data 键值对象
     * @returns {Promise<void>}
     */
    async setMultiple(data) {
        try {
            await chrome.storage.local.set(data);
        } catch (e) {
            if (this._shouldSuppressError(e)) {
                return;
            }
            console.error('[Storage] 批量设置失败:', e);
        }
    },

    /**
     * 删除存储项
     * @param {string|string[]} keys 键名或键名数组
     * @returns {Promise<void>}
     */
    async remove(keys) {
        try {
            await chrome.storage.local.remove(keys);
        } catch (e) {
            if (this._shouldSuppressError(e)) {
                return;
            }
            console.error('[Storage] 删除失败:', keys, e);
        }
    }
};

// 导出到全局（内容脚本使用）
if (typeof window !== 'undefined') {
    window.Storage = Storage;
}
