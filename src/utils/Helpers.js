/**
 * LoCAD - Logic Circuit Design Tool
 * Utility Helper Functions (ESM)
 * 
 * @description 공통 유틸리티 함수들을 정의합니다.
 */

/**
 * 객체 깊은 복사 (JSON 기반)
 * @param {Object} obj - 복사할 객체
 * @returns {Object} 깊은 복사된 객체
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.warn('deepClone failed, returning shallow copy:', e);
        return { ...obj };
    }
}

/**
 * 고급 깊은 복사 (순환 참조 및 특수 타입 지원)
 * lodash.cloneDeep의 대체
 * @param {*} obj - 복사할 값
 * @param {WeakMap} seen - 순환 참조 추적용
 * @returns {*} 깊은 복사된 값
 */
export function cloneDeep(obj, seen = new WeakMap()) {
    // Primitives
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Circular reference check
    if (seen.has(obj)) {
        return seen.get(obj);
    }

    // Date
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    // RegExp
    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags);
    }

    // Array
    if (Array.isArray(obj)) {
        const arrCopy = [];
        seen.set(obj, arrCopy);
        obj.forEach((item, index) => {
            arrCopy[index] = cloneDeep(item, seen);
        });
        return arrCopy;
    }

    // Map
    if (obj instanceof Map) {
        const mapCopy = new Map();
        seen.set(obj, mapCopy);
        obj.forEach((value, key) => {
            mapCopy.set(cloneDeep(key, seen), cloneDeep(value, seen));
        });
        return mapCopy;
    }

    // Set
    if (obj instanceof Set) {
        const setCopy = new Set();
        seen.set(obj, setCopy);
        obj.forEach(value => {
            setCopy.add(cloneDeep(value, seen));
        });
        return setCopy;
    }

    // Object
    const objCopy = Object.create(Object.getPrototypeOf(obj));
    seen.set(obj, objCopy);

    for (const key of Object.keys(obj)) {
        objCopy[key] = cloneDeep(obj[key], seen);
    }

    return objCopy;
}

/**
 * 배열에서 중복 제거 (ID 기반)
 * @param {Array} arr - 대상 배열
 * @param {string} key - 중복 판단 키 (기본: 'id')
 * @returns {Array} 중복 제거된 배열
 */
export function uniqueByKey(arr, key = 'id') {
    const seen = new Set();
    return arr.filter(item => {
        const val = item[key] || item;
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
    });
}

/**
 * UUID 생성 (v4 형식)
 * @returns {string} UUID
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 짧은 고유 ID 생성
 * @param {number} length - ID 길이 (기본: 8)
 * @returns {string} 고유 ID
 */
export function generateShortId(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

/**
 * 디바운스 함수
 * @param {Function} func - 실행할 함수
 * @param {number} wait - 대기 시간 (ms)
 * @returns {Function} 디바운스된 함수
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 스로틀 함수
 * @param {Function} func - 실행할 함수
 * @param {number} limit - 제한 시간 (ms)
 * @returns {Function} 스로틀된 함수
 */
export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 값을 범위 내로 제한
 * @param {number} value - 입력 값
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {number} 제한된 값
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * 그리드에 스냅
 * @param {number} value - 입력 값
 * @param {number} gridSize - 그리드 크기
 * @returns {number} 스냅된 값
 */
export function snapToGrid(value, gridSize = 20) {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * 로컬 스토리지 안전 읽기
 * @param {string} key - 키
 * @param {*} defaultValue - 기본값
 * @returns {*} 저장된 값 또는 기본값
 */
export function getFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.warn(`Failed to read from localStorage: ${key}`, e);
        return defaultValue;
    }
}

/**
 * 로컬 스토리지 안전 쓰기
 * @param {string} key - 키
 * @param {*} value - 저장할 값
 * @returns {boolean} 성공 여부
 */
export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn(`Failed to write to localStorage: ${key}`, e);
        return false;
    }
}

/**
 * 간단한 이벤트 버스 (Pub/Sub 패턴)
 */
export class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`EventBus error in ${event}:`, e);
                }
            });
        }
    }

    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        return this.on(event, wrapper);
    }
}

/**
 * 원형 버퍼 (Oscilloscope용)
 */
export class CircularBuffer {
    constructor(size = 1000) {
        this.size = size;
        this.buffer = new Array(size).fill(null);
        this.head = 0;
        this.count = 0;
    }

    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.size;
        if (this.count < this.size) this.count++;
    }

    get(index) {
        if (index < 0 || index >= this.count) return null;
        const actualIndex = (this.head - this.count + index + this.size) % this.size;
        return this.buffer[actualIndex];
    }

    toArray() {
        const result = [];
        for (let i = 0; i < this.count; i++) {
            result.push(this.get(i));
        }
        return result;
    }

    clear() {
        this.buffer.fill(null);
        this.head = 0;
        this.count = 0;
    }

    get length() {
        return this.count;
    }
}

// 전역 이벤트 버스 인스턴스 (싱글톤)
export const eventBus = new EventBus();
