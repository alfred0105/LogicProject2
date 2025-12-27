/**
 * Security.js - 클라이언트 측 보안 강화
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
            // 관리자용 비주얼 디버그 패널에 오류 추가
            showAdminDebugError(errorInfo);
            return false; // 기본 에러 핸들러도 실행
        }

        // 일반 사용자: 오류 숨김
        return true; // 기본 에러 핸들러 차단
    }

    /**
     * 관리자용 비주얼 디버그 패널 (콘솔 오류를 화면에 표시)
     */
    function showAdminDebugError(errorInfo) {
        // 디버그 패널이 없으면 생성
        let panel = document.getElementById('admin-debug-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'admin-debug-panel';
            panel.innerHTML = `
                <div class="admin-debug-header">
                    <span>Admin Debug Console</span>
                    <button onclick="document.getElementById('admin-debug-panel').classList.toggle('minimized')">_</button>
                    <button onclick="document.getElementById('admin-debug-panel').remove()">✕</button>
                </div>
                <div class="admin-debug-content"></div>
            `;
            panel.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 400px;
                max-height: 300px;
                background: rgba(15, 15, 20, 0.95);
                border: 1px solid #ef4444;
                border-radius: 8px;
                font-family: 'Consolas', monospace;
                font-size: 11px;
                z-index: 99999;
                box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
                overflow: hidden;
            `;
            document.body.appendChild(panel);

            // 스타일 추가
            const style = document.createElement('style');
            style.textContent = `
                #admin-debug-panel .admin-debug-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    font-weight: bold;
                }
                #admin-debug-panel .admin-debug-header button {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-left: 4px;
                }
                #admin-debug-panel .admin-debug-header button:hover {
                    background: rgba(255,255,255,0.4);
                }
                #admin-debug-panel .admin-debug-content {
                    max-height: 240px;
                    overflow-y: auto;
                    padding: 8px;
                }
                #admin-debug-panel.minimized .admin-debug-content {
                    display: none;
                }
                #admin-debug-panel .error-item {
                    padding: 6px 8px;
                    margin-bottom: 4px;
                    background: rgba(239, 68, 68, 0.1);
                    border-left: 3px solid #ef4444;
                    border-radius: 4px;
                    color: #fca5a5;
                }
                #admin-debug-panel .error-item .error-type {
                    color: #f87171;
                    font-weight: bold;
                }
                #admin-debug-panel .error-item .error-source {
                    color: #94a3b8;
                    font-size: 10px;
                }
            `;
            document.head.appendChild(style);
        }

        // 오류 항목 추가
        const content = panel.querySelector('.admin-debug-content');
        const errorItem = document.createElement('div');
        errorItem.className = 'error-item';

        const time = new Date().toLocaleTimeString();
        const shortSource = errorInfo.source ? errorInfo.source.split('/').pop() : '';

        errorItem.innerHTML = `
            <span class="error-type">[${errorInfo.type}]</span> 
            <span>${escapeHtmlLocal(errorInfo.message)}</span>
            <div class="error-source">${time} - ${shortSource}:${errorInfo.line}</div>
        `;
        content.prepend(errorItem);

        // 최대 20개만 표시
        while (content.children.length > 20) {
            content.lastChild.remove();
        }
    }

    // HTML 이스케이프 헬퍼 (Security.js 내부용)
    function escapeHtmlLocal(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            window.sim.showToast(`${message}\n${details || ''}`, 'error');
        }
        console.error('[Admin Debug]', message, details);
    };

    /**
     * 오류 로그 가져오기 (어드민 전용)
     */
    window.getErrorLog = function () {
        if (!_isAdmin && !isDev) {
            return '접근이 거부되었습니다.';
        }
        return window._errorLog;
    };

    /**
     * 오류 로그 콘솔 출력 (어드민 전용)
     */
    window.printErrorLog = function () {
        if (!_isAdmin && !isDev) {
            console.log('접근이 거부되었습니다.');
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
