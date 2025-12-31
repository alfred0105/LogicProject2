/**
 * 🚀 LoCAD - Main Entry Point (Vite ESM)
 * All modules are loaded here and attached to window.sim
 */

// ============================================
// 📦 Import All Modules
// ============================================

// Core Modules (순서 중요!)
import './modules/Security.js';            // 보안 (가장 먼저)
import './modules/Constants.js';           // 상수 정의
import './modules/SupabaseClient.js';      // Supabase 클라이언트
import './modules/CircuitSimulator.js';    // 메인 시뮬레이터 클래스
import './modules/ComponentManager.js';    // 컴포넌트 관리
import './modules/WireManager.js';         // 전선 관리
import './modules/NetManager.js';          // 네트리스트 관리
import './modules/InputHandler.js';        // 입력 처리
import './modules/SelectionManager.js';    // 선택 관리
import './modules/HistoryManager.js';      // 실행취소/다시실행
import './modules/LogicEngine.js';         // 논리 계산 엔진

// UI Modules
import './modules/UIManager.js';           // UI 관리
import './modules/ContextMenuManager.js';  // 컨텍스트 메뉴
import './modules/Minimap.js';             // 미니맵
import './modules/Oscilloscope.js';        // 오실로스코프

// Feature Modules
import './modules/TabManager.js';          // 탭/모듈 시스템
import './modules/PackageManager.js';      // 패키지 관리
import './modules/AdvancedComponents.js';  // 고급 컴포넌트
import './modules/ProjectIO.js';           // 프로젝트 저장/로드
import './modules/CloudManager.js';        // 클라우드 저장
import './modules/LibraryManager.js';      // 라이브러리

// Advanced Features
import './modules/CircuitValidator.js';    // 회로 검증
import './modules/TimingAnalyzer.js';      // 타이밍 분석
import './modules/CollaborationManager.js'; // 실시간 협업
import './modules/PerformanceOptimizer.js'; // 성능 최적화
import './modules/TouchHandler.js';        // 터치 입력

// Education & Tutorial
import './modules/TutorialSystem.js';      // 튜토리얼
import './modules/PuzzleSystem.js';        // 퍼즐 시스템

// Utility
import './modules/PostManager.js';         // 게시물 관리

// ============================================
// 🎬 Application Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 LoCAD Vite ESM Initializing...');

    // 시뮬레이터 인스턴스 생성
    if (typeof CircuitSimulator !== 'undefined') {
        window.sim = new CircuitSimulator();
        console.log('✅ CircuitSimulator created');
    } else {
        console.error('❌ CircuitSimulator class not found!');
        return;
    }

    // NetManager (회로 연결 관리) 초기화
    if (typeof NetManager !== 'undefined') {
        window.sim.netManager = new NetManager(window.sim);
        console.log('✅ NetManager initialized');
    }

    // 컨텍스트 메뉴 시스템 초기화
    if (typeof ContextMenuManager !== 'undefined') {
        window.sim.contextMenuManager = new ContextMenuManager(window.sim);
        console.log('✅ ContextMenuManager initialized');
    }

    // 탭 시스템 초기화
    if (window.sim.initTabs) {
        window.sim.initTabs();
        console.log('✅ Tab System initialized');
    }

    // 회로 검증 도구 초기화
    if (typeof CircuitValidator !== 'undefined') {
        window.sim.validator = new CircuitValidator(window.sim);
        console.log('✅ CircuitValidator initialized');
    }

    // 라이브러리 관리자 초기화
    if (typeof LibraryManager !== 'undefined') {
        window.library = new LibraryManager();
        console.log('✅ LibraryManager initialized');
    }

    // 협업 관리자 초기화
    if (typeof CollaborationManager !== 'undefined') {
        window.sim.collaboration = new CollaborationManager(window.sim);
        console.log('✅ CollaborationManager initialized');

        // URL에 협업 파라미터가 있으면 자동 시작
        const urlParams = new URLSearchParams(window.location.search);
        const collaborateId = urlParams.get('collaborate');
        if (collaborateId && window.sim.currentProjectId) {
            setTimeout(() => {
                window.sim.collaboration.startCollaboration(window.sim.currentProjectId);
            }, 2000);
        }
    }

    // 미니맵 초기화
    if (window.sim.initMinimap) {
        setTimeout(() => {
            window.sim.initMinimap();
            console.log('✅ Minimap initialized');
        }, 500);
    }

    // 타이밍 분석기 초기화
    if (window.sim.initTimingAnalyzer) {
        window.sim.initTimingAnalyzer();
        console.log('✅ TimingAnalyzer initialized');
    }

    // 퍼즐 시스템 초기화
    if (window.sim.initPuzzleSystem) {
        window.sim.initPuzzleSystem();
        console.log('✅ PuzzleSystem initialized');
    }

    // ============================================
    // 🔄 Main Animation Loop
    // ============================================
    function animate() {
        if (window.sim) {
            window.sim.loop();

            if (window.sim.oscilloscope) {
                window.sim.oscilloscope.draw();
            }

            if (window.sim.updateAdvancedComponents) {
                window.sim.updateAdvancedComponents();
            }

            // 미니맵 업데이트 (10프레임마다)
            if (window.sim.updateMinimap) {
                window.sim._minimapCounter = (window.sim._minimapCounter || 0) + 1;
                if (window.sim._minimapCounter >= 10) {
                    window.sim._minimapCounter = 0;
                    window.sim.updateMinimap();
                }
            }

            // 자동 검증 모드
            if (window.autoValidateEnabled && window.sim.validator) {
                clearTimeout(window.autoValidateTimer);
                window.autoValidateTimer = setTimeout(() => {
                    if (window.sim.validator) {
                        const results = window.sim.validator.validateCircuit();
                        if (window.updateValidationStats) {
                            window.updateValidationStats(results);
                        }
                    }
                }, 2000);
            }
        }
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    // ============================================
    // 🎬 Hide Loading Screen
    // ============================================
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => loadingScreen.remove(), 500);
        }
        console.log('🎉 LoCAD Ready!');
    }, 1500);
});

// ============================================
// 🌐 Global Exports (for HTML onclick handlers)
// ============================================
// HTML에서 sim.xxx() 호출을 위해 window.sim 노출
// (이미 DOMContentLoaded에서 설정됨)

console.log('📦 LoCAD modules loaded via Vite ESM');
