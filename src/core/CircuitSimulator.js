/**
 * LoCAD - Logic Circuit Design Tool
 * Circuit Simulator (ESM - Singleton)
 * 
 * @description 메인 시뮬레이터 클래스입니다.
 *              싱글톤 패턴으로 구현되어 전역에서 동일한 인스턴스를 사용합니다.
 */

import { TRANSLATIONS, CONFIG, DEFAULT_SHORTCUTS } from '../utils/Constants.js';
import { getFromStorage, saveToStorage, eventBus, generateShortId } from '../utils/Helpers.js';

/**
 * CircuitSimulator 클래스
 * 회로 시뮬레이션의 핵심 클래스
 */
class CircuitSimulator {
    constructor() {
        // 싱글톤 보호
        if (CircuitSimulator._instance) {
            return CircuitSimulator._instance;
        }
        CircuitSimulator._instance = this;

        // ========================================
        // DOM 요소 참조
        // ========================================
        this.workspace = null;
        this.wireLayer = null;
        this.mainWorkspace = null;
        this.mainWireLayer = null;
        this.internalModal = null;
        this.internalWorkspace = null;
        this.internalWireLayer = null;
        this.tooltip = null;
        this.selectionBox = null;
        this.contextMenu = null;

        // ========================================
        // 상태 변수
        // ========================================
        /** @type {Array<HTMLElement>} */
        this.components = [];

        /** @type {Array<Object>} */
        this.wires = [];

        /** @type {Array} */
        this.scopeStack = [];

        /** @type {HTMLElement|null} */
        this.currentScopeComp = null;

        /** @type {Array} */
        this.userPackages = [];

        // ========================================
        // Undo/Redo
        // ========================================
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = CONFIG.MAX_HISTORY_STEPS;

        // ========================================
        // 시뮬레이션 상태
        // ========================================
        this.isRunning = false;
        this.simulationSpeed = CONFIG.DEFAULT_SIMULATION_SPEED;

        // ========================================
        // 줌 & 팬
        // ========================================
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.mode = 'edit';
        this.isPanning = false;

        // ========================================
        // 드래그 & 선택
        // ========================================
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.lastMouse = { x: 0, y: 0 };
        this.gridSize = CONFIG.GRID_SIZE;
        this.gridSnap = CONFIG.GRID_SNAP;

        // 다중 선택
        this.selectedComponents = [];
        this.clipboard = [];
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };

        // ========================================
        // 프로젝트 관리
        // ========================================
        this.currentProjectId = null;
        this.currentProjectName = 'Untitled Project';
        this.currentTab = 'main';

        // ========================================
        // 단축키
        // ========================================
        this.shortcuts = { ...DEFAULT_SHORTCUTS };

        // ========================================
        // 다국어
        // ========================================
        const savedSettings = getFromStorage('logic_sim_settings', {});
        this.currentLang = savedSettings.language || 'ko';
        this.dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['ko'];
        this.showTutorialHints = savedSettings.showTutorials !== false;
        this.autoSave = savedSettings.autoSave !== false;

        // ========================================
        // 모드 (항상 Expert)
        // ========================================
        this.userMode = 'expert';

        // ========================================
        // 클럭 시스템
        // ========================================
        this.clockAccumulator = 0;
        this.clockInterval = CONFIG.CLOCK_INTERVAL;
        this.lastFrameTime = performance.now();

        // ========================================
        // 기타 매니저 참조
        // ========================================
        this.oscilloscope = null;
        this.netManager = null;
        this.validator = null;
        this.collaboration = null;
        this.contextMenuManager = null;
        this.cloud = null;

        // 모듈 모드용
        this.moduleCanvas = null;
        this.moduleWireLayer = null;
        this.moduleComponents = [];
        this.moduleWires = [];
    }

    /**
     * 초기화 메서드
     */
    init() {
        console.log('[CircuitSimulator] Initializing...');

        // DOM 요소 바인딩
        this.bindDOMElements();

        // 사용자 패키지 로드
        this.loadUserPackages();

        // 이벤트 리스너 등록
        this.initEvents();

        // Expert 모드 활성화
        document.body.classList.add('expert-mode');

        // URL 파라미터 확인
        this.initProject();

        console.log('[CircuitSimulator] Initialized');
    }

    /**
     * DOM 요소 바인딩
     */
    bindDOMElements() {
        this.workspace = document.getElementById('workspace');
        this.wireLayer = document.getElementById('wire-layer');
        this.mainWorkspace = this.workspace;
        this.mainWireLayer = this.wireLayer;

        this.internalModal = document.getElementById('internal-modal');
        this.internalWorkspace = document.getElementById('internal-workspace');
        this.internalWireLayer = document.getElementById('internal-wire-layer');
        this.internalTitle = document.getElementById('internal-title');

        this.tooltip = document.getElementById('tooltip');
        this.selectionBox = document.getElementById('selection-box');
        this.contextMenu = document.getElementById('context-menu');
    }

    /**
     * 이벤트 리스너 초기화
     * @note 실제 이벤트 핸들러는 InputHandler 모듈로 분리
     */
    initEvents() {
        // 추후 InputHandler에서 처리
        console.log('[CircuitSimulator] Events will be handled by InputHandler');
    }

    /**
     * 사용자 패키지 로드
     */
    loadUserPackages() {
        this.userPackages = getFromStorage('user_packages', []);
    }

    /**
     * 사용자 패키지 저장
     */
    saveUserPackages() {
        saveToStorage('user_packages', this.userPackages);
    }

    /**
     * 프로젝트 초기화 (URL 파라미터 확인)
     */
    initProject() {
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('project');

        if (projectId) {
            this.currentProjectId = projectId;
            console.log('[CircuitSimulator] Loading project:', projectId);
            // 클라우드에서 프로젝트 로드 (CloudManager에서 처리)
        }
    }

    // ========================================
    // 유틸리티 메서드
    // ========================================

    /**
     * 현재 모듈 편집 모드인지 확인
     */
    isModuleMode() {
        return this.currentTab && this.currentTab.startsWith('module');
    }

    /**
     * 현재 활성화된 캔버스 반환
     */
    getActiveCanvas() {
        return this.isModuleMode() ? this.moduleCanvas : this.workspace;
    }

    /**
     * 현재 활성화된 와이어 레이어 반환
     */
    getActiveWireLayer() {
        return this.isModuleMode() ? this.moduleWireLayer : this.wireLayer;
    }

    /**
     * 현재 활성 컴포넌트 배열 반환
     */
    getActiveComponents() {
        return this.isModuleMode() ? this.moduleComponents : this.components;
    }

    /**
     * 현재 활성 와이어 배열 반환
     */
    getActiveWires() {
        return this.isModuleMode() ? this.moduleWires : this.wires;
    }

    // ========================================
    // 시뮬레이션 제어
    // ========================================

    /**
     * 시뮬레이션 토글
     */
    toggleSimulation() {
        this.isRunning = !this.isRunning;

        const btn = document.getElementById('btn-run');
        if (btn) {
            btn.classList.toggle('active', this.isRunning);
            // 아이콘 변경은 UIManager에서 처리
        }

        eventBus.emit('simulation:toggle', this.isRunning);
        this.showToast(this.isRunning ? '시뮬레이션 시작' : '시뮬레이션 일시정지', 'info');
    }

    /**
     * 토스트 메시지 표시
     */
    showToast(message, type = 'info') {
        // Toast UI 표시 로직
        console.log(`[Toast-${type}] ${message}`);

        // 실제 토스트 UI가 있으면 표시
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            toastContainer.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }

    /**
     * 스위치 토글
     */
    toggleSwitch(e, el) {
        if (this.mode === 'pan') return;

        const current = el.getAttribute('data-value');
        const next = current === '1' ? '0' : '1';
        el.setAttribute('data-value', next);

        const label = el.querySelector('.comp-label');
        if (label) label.innerText = next === '1' ? 'ON' : 'OFF';

        if (next === '1') {
            el.classList.add('switch-on');
        } else {
            el.classList.remove('switch-on');
        }

        eventBus.emit('circuit:update');
    }

    /**
     * 컴포넌트 생성 ID
     */
    generateComponentId(type) {
        return `${type.toLowerCase()}_${generateShortId(6)}`;
    }

    // ========================================
    // 루프 (레거시 호환)
    // ========================================
    loop(timestamp) {
        // 메인 루프는 main.js에서 처리
        // 이 메서드는 레거시 호환용
    }
}

// ============================================================================
// 싱글톤 인스턴스 생성 및 내보내기
// ============================================================================
export const sim = new CircuitSimulator();

// window.sim 호환성 레이어 (점진적 마이그레이션용)
// 새 코드에서는 import { sim } 사용
if (typeof window !== 'undefined') {
    window.sim = sim;
}
