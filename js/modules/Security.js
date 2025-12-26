/**
 * 🔒 Security.js - 클라이언트 측 보안 강화
 * 
 * 기능:
 * - 어드민 전용 오류 메시지 표시
 * - 프로덕션 환경에서 콘솔 로그 숨김
 * - XSS 방지 헬퍼
 * - 전역 에러 핸들러
 */
(function () {
    'use strict';

    // ===== 어드민 계정 설정 =====
    const ADMIN_EMAILS = [
        'ace060408@gmail.com'
    ];

    // 개발 환경 체크
    const isDev = window.location.hostname === '127.0.0.1' ||
        window.location.hostname === 'localhost';

    // URL 파라미터 체크
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true';

    // ===== 어드민 상태 관리 =====
    let _isAdmin = false;
    let _adminChecked = false;

    /**
     * 현재 사용자가 어드민인지 확인
     * @returns {boolean}
     */
    window.isAdmin = function () {
        return _isAdmin;
    };

    /**
     * 어드민 상태 설정 (SupabaseClient에서 호출)
     * @param {string} email 
     */
    window.setAdminStatus = function (email) {
        _isAdmin = email && ADMIN_EMAILS.includes(email.toLowerCase());
        _adminChecked = true;

        if (_isAdmin) {
            console.log('%c🔑 Admin mode activated', 'color: #22c55e; font-weight: bold;');
        }
    };

    // ===== 오류 저장소 (어드민 전용) =====
    window._errorLog = [];
    const MAX_ERROR_LOG = 50;

    /**
     * 오류를 기록하고 어드민에게만 표시
     */
    function logError(type, message, source, lineno, colno, error) {
        const errorInfo = {
            type: type,
            message: message,
            source: source,
            line: lineno,
            column: colno,
            stack: error?.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };

        // 오류 저장 (최대 50개)
        window._errorLog.push(errorInfo);
        if (window._errorLog.length > MAX_ERROR_LOG) {
            window._errorLog.shift();
        }

        // 어드민인 경우에만 상세 오류 표시
        if (_isAdmin || isDev || debugMode) {
            return false; // 기본 에러 핸들러도 실행
        }

        // 일반 사용자: 오류 숨김
        return true; // 기본 에러 핸들러 차단
    }

    // ===== 전역 에러 핸들러 =====
    window.onerror = function (message, source, lineno, colno, error) {
        return logError('error', message, source, lineno, colno, error);
    };

    window.onunhandledrejection = function (event) {
        return logError('promise', event.reason?.message || 'Unhandled Promise Rejection',
            '', 0, 0, event.reason);
    };

    // ===== 콘솔 보안 =====
    if (!isDev && !debugMode) {
        // 원본 콘솔 함수 백업
        const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            table: console.table,
            trace: console.trace
        };

        // 프로덕션에서 콘솔 무력화
        const secureConsole = function (type, args) {
            // 어드민이면 원본 실행
            if (_isAdmin) {
                originalConsole[type].apply(console, args);
                return;
            }
            // 일반 사용자: 무시
        };

        console.log = function () { secureConsole('log', arguments); };
        console.warn = function () { secureConsole('warn', arguments); };
        console.info = function () { secureConsole('info', arguments); };
        console.table = function () { secureConsole('table', arguments); };
        console.trace = function () { secureConsole('trace', arguments); };

        // error는 로깅하되 표시하지 않음
        console.error = function () {
            const args = Array.from(arguments);
            window._errorLog.push({
                type: 'console.error',
                message: args.join(' '),
                timestamp: new Date().toISOString()
            });
            if (_isAdmin) {
                originalConsole.error.apply(console, arguments);
            }
        };
    }

    // ===== XSS 방지 헬퍼 =====
    window.escapeHtml = function (text) {
        if (!text) return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // ===== 보안 유틸리티 =====

    /**
     * 어드민 전용 토스트 (오류 상세 정보)
     */
    window.showAdminError = function (message, details) {
        if (!_isAdmin && !isDev) {
            // 일반 사용자에게는 간단한 메시지만
            if (window.sim && window.sim.showToast) {
                window.sim.showToast('오류가 발생했습니다. 새로고침 해주세요.', 'error');
            }
            return;
        }

        // 어드민에게는 상세 정보 표시
        if (window.sim && window.sim.showToast) {
            window.sim.showToast(`❌ ${message}\n${details || ''}`, 'error');
        }
        console.error('[Admin Debug]', message, details);
    };

    /**
     * 오류 로그 가져오기 (어드민 전용)
     */
    window.getErrorLog = function () {
        if (!_isAdmin && !isDev) {
            return '🔒 접근이 거부되었습니다.';
        }
        return window._errorLog;
    };

    /**
     * 오류 로그 콘솔 출력 (어드민 전용)
     */
    window.printErrorLog = function () {
        if (!_isAdmin && !isDev) {
            console.log('🔒 접근이 거부되었습니다.');
            return;
        }
        console.table(window._errorLog);
    };

    // ===== 보안 경고 =====
    if (!isDev) {
        // 일반 사용자에게 Self-XSS 경고
        console.log('%cSTOP!', 'color: red; font-size: 50px; font-weight: bold; text-shadow: 2px 2px 0 black;');
        console.log('%c⚠️ 이것은 개발자를 위한 브라우저 기능입니다.', 'font-size: 16px; color: #fbbf24;');
        console.log('%c누군가 여기에 코드를 붙여넣으라고 했다면, 그것은 사기입니다!', 'font-size: 14px; color: #f87171;');
    }

    // ===== 어드민 체크 대기 =====
    // Supabase 로그인 후 setAdminStatus가 호출될 때까지 기다림
    const checkAdmin = setInterval(() => {
        if (_adminChecked || window.sb === undefined) {
            clearInterval(checkAdmin);
        }
    }, 1000);

    // 10초 후 타임아웃
    setTimeout(() => {
        clearInterval(checkAdmin);
        if (!_adminChecked) {
            _adminChecked = true;
            _isAdmin = false;
        }
    }, 10000);

})();
