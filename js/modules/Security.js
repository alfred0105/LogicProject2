/**
 * Security.js
 * 클라이언트 측 보안 강화 및 콘솔 로그 숨김 처리
 */
(function () {
    // 로컬 호스트(개발 환경)가 아닐 경우 보안 모드 활성화
    const isDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

    if (!isDev) {
        // 1. 콘솔 로그 무력화 (일반 사용자에게 내부 로직 노출 방지)
        const noop = function () { };

        // 디버깅이 필요할 땐 URL 파라미터 ?debug=true 로 접속하면 보임
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') !== 'true') {
            console.log = noop;
            console.warn = noop;
            console.info = noop;
            console.error = noop; // 에러까지 숨길지는 선택사항이나, "안 들키게" 요청에 따름
            console.table = noop;
            console.trace = noop;
        }
    }

    // 2. 우클릭 컨텍스트 메뉴 차단 (선택적 - Simulator 캔버스 외의 영역)
    // 시뮬레이터 캔버스는 자체 우클릭 메뉴가 있으므로 제외해야 함.
    document.addEventListener('contextmenu', function (e) {
        // 시뮬레이터 캔버스나 내부 모달이 아니면 차단
        if (!e.target.closest('#workspace') && !e.target.closest('canvas')) {
            // e.preventDefault(); // 일반 웹사이트면 차단하지만, 여기서는 너무 불편할 수 있어 주석 처리
        }
    });

    // 3. XSS 방지 헬퍼 (전역 유틸리티)
    window.escapeHtml = function (text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    console.log("%cSTOP!", "color: red; font-size: 30px; font-weight: bold;");
    console.log("%cThis is a browser feature intended for developers. Do not paste any code here.", "font-size: 16px;");

})();
