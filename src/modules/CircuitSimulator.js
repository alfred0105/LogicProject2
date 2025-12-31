/**
 * CircuitSimulator v3.5 (Integrated)
 * 모듈별 분할 파일 - 메인 클래스 정의
 */

class CircuitSimulator {
    constructor() {
        // [Safety] Global Access
        window.sim = this;

        // [1] 초기화 및 DOM 요소 가져오기
        this.workspace = document.getElementById('workspace');
        this.wireLayer = document.getElementById('wire-layer');

        // Cache Main Workspace references
        this.mainWorkspace = this.workspace;
        this.mainWireLayer = this.wireLayer;

        // Internal Editor References
        this.internalModal = document.getElementById('internal-modal');
        this.internalWorkspace = document.getElementById('internal-workspace');
        this.internalWireLayer = document.getElementById('internal-wire-layer');
        this.internalTitle = document.getElementById('internal-title');

        this.tooltip = document.getElementById('tooltip');
        this.selectionBox = document.getElementById('selection-box');
        this.contextMenu = document.getElementById('context-menu');

        // [2] 상태 변수들
        this.components = []; // 생성된 부품 목록
        this.wires = [];      // 연결된 전선 목록

        // Scope Stack for Sub-circuits
        this.scopeStack = []; // [{ components, wires, parentComp }]
        this.currentScopeComp = null; // The component whose internals we are viewing

        // 패키지 시스템
        this.userPackages = []; // 사용자 정의 패키지 저장

        // localStorage에서 사용자 패키지 로드
        this.loadUserPackages();

        // Undo/Redo 히스토리
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;

        // 시뮬레이션 상태 (처음에는 정지 상태로 시작)
        this.isRunning = false;
        this.simulationSpeed = 100; // ms

        // 줌 & 팬 (화면 이동/확대)
        this.scale = 1.0;

        this.panX = 0;
        this.panY = 0;
        this.mode = 'edit';   // 'edit' 또는 'pan'
        this.isPanning = false;

        // 드래그 & 선택
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.lastMouse = { x: 0, y: 0 };
        this.gridSize = 20;   // 격자 크기 (Snap to Grid)

        // 다중 선택 & 복사/붙여넣기 변수
        this.selectedComponents = [];
        this.clipboard = [];
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };

        // 와이어링 (전선 연결) - WireManager에서 관리
        // this.startPin = null;
        // this.tempWire = null;

        // 프로젝트 관리
        this.currentProjectId = null;
        this.currentProjectName = 'Untitled Project';

        // [3] 단축키 기본 설정 (커스텀 가능)
        this.shortcuts = {
            'A': 'AND', 'O': 'OR', 'N': 'NOT', 'X': 'XOR',
            'S': 'SWITCH', 'L': 'LED', 'C': 'CLOCK',
            'DELETE': 'DELETE', 'ESCAPE': 'ESCAPE'
        };

        // [4-1] 다국어 설정 - 계정 설정에서 불러오기
        const savedSettings = JSON.parse(localStorage.getItem('logic_sim_settings')) || {};
        this.currentLang = savedSettings.language || 'ko';
        this.dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['ko'];
        this.showTutorialHints = savedSettings.showTutorials !== false;
        this.autoSave = savedSettings.autoSave !== false;

        // [4-2] 부품 설명 데이터 (언어별 동적 처리)
        this.descriptions = {}; // Placeholder - dynamic lookup used

        // [Mode State] - 통합 모드 (모든 기능 활성화)
        this.userMode = 'expert'; // 모든 기능 항상 활성화

        // [Grid & Snap Settings]
        this.gridSnap = false; // 그리드 스냅 활성화 여부
        this.gridSize = 20; // 그리드 크기 (px)
        this.wireMode = 'pin'; // 'pin' (소자 핀 직접 연결) or 'grid' (격자 기준 연결)

        // [Simulation Settings]
        this.simulationSpeed = 1.0;

        // [Undo/Redo History System]
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;  // Maximum undo steps

        // [5] 이벤트 리스너 등록
        this.initEvents();

        // [수정] Delta Time 기반 Clock 시스템 (모니터 주사율 독립적)
        // setInterval 대신 누적 시간 방식으로 변경
        this.clockAccumulator = 0;  // 클럭 누적 시간 (ms)
        this.clockInterval = 1000;   // 클럭 간격 (ms) - 1초
        this.lastFrameTime = performance.now();  // 마지막 프레임 시간

        // [6] 오실로스코프 및 렌더 루프
        this.oscilloscope = new Oscilloscope(this);
        this.lastTime = 0;
        requestAnimationFrame((time) => this.loop(time));

        // 통합 모드: body에 expert-mode 클래스 추가하여 모든 스타일 활성화
        document.body.classList.add('expert-mode');

        // URL 파라미터 확인 및 로드
        this.initProject();
    }

    loop(timestamp) {
        // 루프 정의가 없을 경우 대비 안전 장치
        if (!this.oscilloscope) return;

        // [Delta Time 시뮬레이션] 모니터 주사율과 무관하게 일정한 시뮬레이션 속도 유지
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Clock 업데이트 (누적 시간 기반)
        if (this.isRunning !== false) {
            this.clockAccumulator += deltaTime;

            // 클럭 간격마다 tick 실행 (여러 번 누적된 경우 모두 처리)
            while (this.clockAccumulator >= this.clockInterval) {
                this.doClockTick();
                this.clockAccumulator -= this.clockInterval;
            }
        }

        // 오실로스코프 업데이트 (10fps 제한 유지)
        const dt = timestamp - this.lastTime;
        if (dt > 100) {
            this.oscilloscope.update();
            this.oscilloscope.draw();
            this.lastTime = timestamp;
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    // =============== 유틸리티 메서드 (코드 중복 감소) ===============

    /**
     * 현재 모듈 편집 모드인지 확인
     * @returns {boolean}
     */
    isModuleMode() {
        return this.currentTab && this.currentTab.startsWith('module');
    }

    /**
     * 현재 활성화된 캔버스 반환
     * @returns {HTMLElement}
     */
    getActiveCanvas() {
        return this.isModuleMode() ? this.moduleCanvas : this.workspace;
    }

    /**
     * 현재 활성화된 와이어 레이어 반환
     * @returns {SVGSVGElement}
     */
    getActiveWireLayer() {
        return this.isModuleMode() ? this.moduleWireLayer : this.wireLayer;
    }

    /**
     * 현재 활성 컴포넌트 배열 반환
     * @returns {Array}
     */
    getActiveComponents() {
        return this.isModuleMode() ? this.moduleComponents : this.components;
    }

    /**
     * 현재 활성 와이어 배열 반환
     * @returns {Array}
     */
    getActiveWires() {
        return this.isModuleMode() ? this.moduleWires : this.wires;
    }

    /**
     * 객체 깊은 복사
     * @param {Object} obj 
     * @returns {Object}
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * 배열에서 중복 제거 (ID 기반)
     * @param {Array} arr 
     * @param {string} key 
     * @returns {Array}
     */
    uniqueByKey(arr, key = 'id') {
        const seen = new Set();
        return arr.filter(item => {
            const val = item[key] || item;
            if (seen.has(val)) return false;
            seen.add(val);
            return true;
        });
    }
}


// [Vite Export] Make globally available
// [Vite Export] Make globally available
window.CircuitSimulator = CircuitSimulator;
