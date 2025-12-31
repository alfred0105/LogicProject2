/**
 * LoCAD - Logic Circuit Design Tool
 * Main Entry Point (ESM)
 * 
 * @description 애플리케이션 메인 진입점입니다.
 *              모든 모듈을 초기화하고 연결합니다.
 * 
 * Phase 2: Engine & Feature Upgrade 완료
 * - Module Factory Pattern (Deep Clone)
 * - Enhanced Oscilloscope (CircularBuffer)
 * - Quantum Abstraction Ready (ISimulationEngine)
 */

import { sim } from './core/CircuitSimulator.js';
import { logicEngine } from './core/ClassicLogicEngine.js';
import { componentFactory } from './components/ComponentFactory.js';
import { oscilloscope } from './ui/Oscilloscope.js';
import { TRANSLATIONS, CONFIG } from './utils/Constants.js';
import { eventBus, getFromStorage } from './utils/Helpers.js';

// ============================================================================
// 전역 설정 초기화
// ============================================================================
const savedSettings = getFromStorage('logic_sim_settings', {});
const currentLang = savedSettings.language || 'ko';
const dict = TRANSLATIONS[currentLang] || TRANSLATIONS['ko'];

// ============================================================================
// DOM 로드 완료 후 초기화
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[LoCAD] Initializing application...');
    console.log('[LoCAD] Phase 2: Engine & Feature Upgrade');

    // 시뮬레이터 초기화
    sim.init();

    // 로직 엔진 연결
    logicEngine.setComponents(sim.components);
    logicEngine.setWires(sim.wires);

    // NetManager 연결 (있는 경우)
    if (sim.netManager) {
        logicEngine.setNetManager(sim.netManager);
    }

    // [Phase 2] ComponentFactory 초기화
    componentFactory.setUserPackages(sim.userPackages || []);

    // [Phase 2] Oscilloscope 연결 (ESM과 레거시 둘 다 지원)
    if (oscilloscope.canvas) {
        sim.oscilloscope = oscilloscope;
        console.log('[LoCAD] ESM Oscilloscope connected');
    }

    // 이벤트 연결
    setupEventListeners();

    // 메인 루프 시작
    startMainLoop();

    // 로딩 화면 숨기기
    hideLoadingScreen();

    console.log('[LoCAD] Application initialized successfully');
});

// ============================================================================
// 이벤트 리스너 설정
// ============================================================================
function setupEventListeners() {
    // 글로벌 이벤트 버스 연결
    eventBus.on('circuit:update', () => {
        logicEngine.updateCircuit();
    });

    eventBus.on('circuit:reset', () => {
        logicEngine.reset();
        sim.showToast(dict.resetSimulation || '시뮬레이션 초기화', 'info');
    });

    eventBus.on('circuit:step', () => {
        logicEngine.step();
        sim.showToast('1 스텝 실행', 'info');
    });

    // 키보드 단축키는 CircuitSimulator에서 처리
}

// ============================================================================
// 메인 애니메이션 루프
// ============================================================================
function startMainLoop() {
    let lastFrameTime = performance.now();
    let lastOscilloscopeTime = 0;

    function animate(timestamp) {
        // Delta Time 계산
        const now = performance.now();
        const deltaTime = now - lastFrameTime;
        lastFrameTime = now;

        // 시뮬레이션 실행 중일 때
        if (sim.isRunning) {
            logicEngine.clockAccumulator += deltaTime;

            // 클럭 틱 처리
            while (logicEngine.clockAccumulator >= logicEngine.clockInterval) {
                logicEngine.step();
                logicEngine.clockAccumulator -= logicEngine.clockInterval;
            }
        }

        // 오실로스코프 업데이트 (10fps 제한)
        if (sim.oscilloscope && timestamp - lastOscilloscopeTime > 100) {
            sim.oscilloscope.update();
            sim.oscilloscope.draw();
            lastOscilloscopeTime = timestamp;
        }

        // 미니맵 업데이트 (10프레임마다)
        if (sim.updateMinimap) {
            if (!sim._minimapCounter) sim._minimapCounter = 0;
            sim._minimapCounter++;
            if (sim._minimapCounter >= 10) {
                sim._minimapCounter = 0;
                sim.updateMinimap();
            }
        }

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

// ============================================================================
// 로딩 화면 처리
// ============================================================================
function hideLoadingScreen() {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => loadingScreen.remove(), 500);
        }
    }, 1500);
}

// ============================================================================
// 글로벌 에러 핸들러
// ============================================================================
window.onerror = (msg, url, line, col, error) => {
    const errorMessages = {
        ko: {
            title: '시뮬레이터 오류',
            line: '위치',
            message: '오류 내용',
            suggestion: '페이지를 새로고침하거나 개발자 도구 콘솔(F12)을 확인하세요.'
        },
        en: {
            title: 'Simulator Error',
            line: 'Line',
            message: 'Error',
            suggestion: 'Please refresh the page or check the developer console (F12).'
        }
    };

    const t = errorMessages[currentLang] || errorMessages.ko;
    console.error('Simulator Error:', { msg, url, line, col, error });

    // 사용자에게 알림 (개발 중에는 상세 정보 표시)
    if (process?.env?.NODE_ENV !== 'production') {
        console.warn(`${t.title}\n\n${t.line}: ${line}\n${t.message}: ${msg}`);
    }

    return false;
};

// ============================================================================
// 모듈 내보내기 (다른 모듈에서 접근 가능)
// ============================================================================
export { sim, logicEngine, componentFactory, oscilloscope };
