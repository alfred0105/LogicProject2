/**
 * LoCAD - Logic Circuit Design Tool
 * Constants & Configuration Module (ESM)
 * 
 * @description 전역 상수 및 설정값을 정의합니다.
 *              모든 모듈에서 import하여 사용합니다.
 */

// ============================================================================
// 다국어 번역 데이터
// ============================================================================
export const TRANSLATIONS = {
    ko: {
        component: "부품",
        save: "저장",
        exit: "나가기",
        edit: "편집",
        pan: "이동",
        zoomIn: "확대",
        zoomOut: "축소",
        shortcut: "단축키 설정",
        inputOutput: "입력 / 출력",
        logicGates: "논리 게이트",
        settings: "설정",
        copy: "복사",
        paste: "붙여넣기",
        delete: "삭제",
        descSwitch: '클릭하여 ON/OFF를 전환하는 입력 스위치입니다.',
        descLed: '전기가 흐르면 불이 켜지는 출력 장치입니다.',
        descClock: '1초마다 신호가 바뀌는 펄스 생성기입니다.',
        descAnd: '모든 입력이 1일 때만 1을 출력합니다.',
        descOr: '입력 중 하나라도 1이면 1을 출력합니다.',
        descNot: '입력 값을 반대로 뒤집습니다.',
        descXor: '입력 값이 서로 다를 때만 1을 출력합니다.',
        descNand: 'AND 게이트의 반대입니다. 모든 입력이 1일 때만 0을 출력합니다.',
        descNor: 'OR 게이트의 반대입니다. 입력 중 하나라도 1이면 0을 출력합니다.',
        descXnor: 'XOR 게이트의 반대입니다. 입력 값이 서로 같을 때 1을 출력합니다.',
        // Gate Names
        gateAnd: "AND 게이트",
        gateOr: "OR 게이트",
        gateNot: "NOT 게이트",
        gateXor: "XOR 게이트",
        gateNand: "NAND 게이트",
        gateNor: "NOR 게이트",
        gateXnor: "XNOR 게이트",
        gateSwitch: "스위치",
        gateLed: "LED 전구",
        gateClock: "클럭 (펄스)",
        gateTr: "NPN 트랜지스터",
        gatePmos: "PMOS 트랜지스터",
        gateVcc: "VCC (전원)",
        gateGnd: "GND (접지)",
        compLib: "부품 라이브러리"
    },
    en: {
        component: "Components",
        save: "Save",
        exit: "Exit",
        edit: "Edit",
        pan: "Pan",
        zoomIn: "Zoom In",
        zoomOut: "Zoom Out",
        shortcut: "Shortcuts",
        inputOutput: "Input / Output",
        logicGates: "Logic Gates",
        settings: "Settings",
        copy: "Copy",
        paste: "Paste",
        delete: "Delete",
        descSwitch: 'A switch that toggles ON/OFF when clicked.',
        descLed: 'Output device that lights up when powered.',
        descClock: 'Pulse generator that changes signal every second.',
        descAnd: 'Outputs 1 only if all inputs are 1.',
        descOr: 'Outputs 1 if at least one input is 1.',
        descNot: 'Inverts the input value.',
        descXor: 'Outputs 1 only if inputs are different.',
        descNand: 'Opposite of AND. Outputs 0 only if all inputs are 1.',
        descNor: 'Opposite of OR. Outputs 0 if at least one input is 1.',
        descXnor: 'Opposite of XOR. Outputs 1 if inputs are same.',
        gateAnd: "AND Gate",
        gateOr: "OR Gate",
        gateNot: "NOT Gate",
        gateXor: "XOR Gate",
        gateNand: "NAND Gate",
        gateNor: "NOR Gate",
        gateXnor: "XNOR Gate",
        gateSwitch: "Switch",
        gateLed: "LED",
        gateClock: "Clock",
        gateTr: "NPN Transistor",
        gatePmos: "PMOS Transistor",
        gateVcc: "VCC (1)",
        gateGnd: "GND (0)",
        compLib: "Component Library"
    }
};

// ============================================================================
// 시뮬레이터 설정
// ============================================================================
export const CONFIG = {
    // Grid Settings
    GRID_SIZE: 20,
    GRID_SNAP: false,

    // Simulation Settings
    DEFAULT_SIMULATION_SPEED: 1.0,
    CLOCK_INTERVAL: 1000, // ms
    MAX_PROPAGATION_ITERATIONS: 50,

    // History (Undo/Redo)
    MAX_HISTORY_STEPS: 50,

    // Oscilloscope Buffer
    OSCILLOSCOPE_BUFFER_SIZE: 1000,

    // Wire Settings
    WIRE_MODE: 'pin', // 'pin' or 'grid'

    // Zoom Settings
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 5.0,
    ZOOM_STEP: 0.1,
};

// ============================================================================
// 단축키 기본 설정
// ============================================================================
export const DEFAULT_SHORTCUTS = {
    'A': 'AND',
    'O': 'OR',
    'N': 'NOT',
    'X': 'XOR',
    'S': 'SWITCH',
    'L': 'LED',
    'C': 'CLOCK',
    'DELETE': 'DELETE',
    'ESCAPE': 'ESCAPE'
};

// ============================================================================
// 게이트 트랜지스터 스키마틱 (Expert Mode)
// ============================================================================
export const GATE_SCHEMATICS = {
    'AND': {
        parts: [
            { type: 'TRANSISTOR', x: 100, y: 100, id: 't1' },
            { type: 'TRANSISTOR', x: 200, y: 100, id: 't2' },
            { type: 'VCC', x: 50, y: 50, id: 'vcc' },
            { type: 'PORT_IN', x: 50, y: 100, label: 'A', id: 'in_1' },
            { type: 'PORT_IN', x: 150, y: 100, label: 'B', id: 'in_2' },
            { type: 'PORT_OUT', x: 300, y: 100, label: 'Out', id: 'out' }
        ],
        wires: [
            { from: 'vcc.out', to: 't1.col' },
            { from: 'in_1.out', to: 't1.base' },
            { from: 't1.emit', to: 't2.col' },
            { from: 'in_2.out', to: 't2.base' },
            { from: 't2.emit', to: 'out.in' }
        ]
    },
    'OR': {
        parts: [
            { type: 'TRANSISTOR', x: 150, y: 50, id: 't1' },
            { type: 'TRANSISTOR', x: 150, y: 150, id: 't2' },
            { type: 'VCC', x: 50, y: 100, id: 'vcc' },
            { type: 'PORT_IN', x: 50, y: 50, label: 'A', id: 'in_1' },
            { type: 'PORT_IN', x: 50, y: 150, label: 'B', id: 'in_2' },
            { type: 'PORT_OUT', x: 300, y: 100, label: 'Out', id: 'out' }
        ],
        wires: [
            { from: 'vcc.out', to: 't1.col' },
            { from: 'vcc.out', to: 't2.col' },
            { from: 'in_1.out', to: 't1.base' },
            { from: 'in_2.out', to: 't2.base' },
            { from: 't1.emit', to: 'out.in' },
            { from: 't2.emit', to: 'out.in' }
        ]
    },
    'NOT': {
        parts: [
            { type: 'PMOS', x: 150, y: 100, id: 't1' },
            { type: 'VCC', x: 50, y: 50, id: 'vcc' },
            { type: 'TRANSISTOR', x: 150, y: 200, id: 't2' },
            { type: 'GND', x: 150, y: 250, id: 'gnd' },
            { type: 'PORT_IN', x: 50, y: 150, label: 'In', id: 'in_1' },
            { type: 'PORT_OUT', x: 300, y: 150, label: 'Out', id: 'out' }
        ],
        wires: [
            { from: 'vcc.out', to: 't1.col' },
            { from: 'gnd.out', to: 't2.emit' },
            { from: 'in_1.out', to: 't1.base' },
            { from: 'in_1.out', to: 't2.base' },
            { from: 't1.emit', to: 'out.in' },
            { from: 't2.col', to: 'out.in' }
        ]
    },
    'NAND': {
        parts: [
            { type: 'VCC', x: 150, y: 50, id: 'vcc' },
            { type: 'GND', x: 150, y: 300, id: 'gnd' },
            { type: 'PMOS', x: 100, y: 100, id: 'p1', label: 'P1' },
            { type: 'PMOS', x: 200, y: 100, id: 'p2', label: 'P2' },
            { type: 'TRANSISTOR', x: 150, y: 200, id: 'n1', label: 'N1' },
            { type: 'TRANSISTOR', x: 150, y: 250, id: 'n2', label: 'N2' },
            { type: 'PORT_IN', x: 50, y: 150, label: 'A', id: 'in_1' },
            { type: 'PORT_IN', x: 250, y: 150, label: 'B', id: 'in_2' },
            { type: 'PORT_OUT', x: 300, y: 200, label: 'Out', id: 'out' }
        ],
        wires: [
            { from: 'vcc.out', to: 'p1.col' },
            { from: 'vcc.out', to: 'p2.col' },
            { from: 'p1.emit', to: 'out.in' },
            { from: 'p2.emit', to: 'out.in' },
            { from: 'p1.emit', to: 'n1.col' },
            { from: 'n1.emit', to: 'n2.col' },
            { from: 'n2.emit', to: 'gnd.out' },
            { from: 'in_1.out', to: 'p1.base' },
            { from: 'in_1.out', to: 'n1.base' },
            { from: 'in_2.out', to: 'p2.base' },
            { from: 'in_2.out', to: 'n2.base' }
        ]
    },
    'NOR': {
        parts: [
            { type: 'VCC', x: 150, y: 50, id: 'vcc' },
            { type: 'GND', x: 150, y: 300, id: 'gnd' },
            { type: 'PMOS', x: 150, y: 100, id: 'p1', label: 'P1' },
            { type: 'PMOS', x: 150, y: 150, id: 'p2', label: 'P2' },
            { type: 'TRANSISTOR', x: 100, y: 250, id: 'n1', label: 'N1' },
            { type: 'TRANSISTOR', x: 200, y: 250, id: 'n2', label: 'N2' },
            { type: 'PORT_IN', x: 50, y: 150, label: 'A', id: 'in_1' },
            { type: 'PORT_IN', x: 250, y: 150, label: 'B', id: 'in_2' },
            { type: 'PORT_OUT', x: 300, y: 200, label: 'Out', id: 'out' }
        ],
        wires: [
            { from: 'vcc.out', to: 'p1.col' },
            { from: 'p1.emit', to: 'p2.col' },
            { from: 'p2.emit', to: 'out.in' },
            { from: 'p2.emit', to: 'n1.col' },
            { from: 'n1.col', to: 'out.in' },
            { from: 'n2.col', to: 'out.in' },
            { from: 'n1.emit', to: 'gnd.out' },
            { from: 'n2.emit', to: 'gnd.out' },
            { from: 'in_1.out', to: 'p1.base' },
            { from: 'in_1.out', to: 'n1.base' },
            { from: 'in_2.out', to: 'p2.base' },
            { from: 'in_2.out', to: 'n2.base' }
        ]
    },
    'XOR': { parts: [], wires: [] },
    'XNOR': { parts: [], wires: [] }
};

// ============================================================================
// 표준 패키지 회로 정의
// ============================================================================
export const STANDARD_PACKAGES = {
    'HALF_ADDER': {
        components: [
            { id: 'xor1', type: 'XOR', x: 60, y: 20, label: 'XOR' },
            { id: 'and1', type: 'AND', x: 60, y: 80, label: 'AND' },
            { id: 'in_a', type: 'PORT_IN', x: 10, y: 30, label: 'A' },
            { id: 'in_b', type: 'PORT_IN', x: 10, y: 70, label: 'B' },
            { id: 'out_s', type: 'PORT_OUT', x: 140, y: 30, label: 'S' },
            { id: 'out_c', type: 'PORT_OUT', x: 140, y: 90, label: 'C' }
        ],
        wires: [
            { from: 'in_a', fromPin: 'out', to: 'xor1', toPin: 'in-1' },
            { from: 'in_b', fromPin: 'out', to: 'xor1', toPin: 'in-2' },
            { from: 'in_a', fromPin: 'out', to: 'and1', toPin: 'in-1' },
            { from: 'in_b', fromPin: 'out', to: 'and1', toPin: 'in-2' },
            { from: 'xor1', fromPin: 'out', to: 'out_s', toPin: 'in' },
            { from: 'and1', fromPin: 'out', to: 'out_c', toPin: 'in' }
        ]
    },
    'FULL_ADDER': {
        components: [
            { id: 'xor1', type: 'XOR', x: 50, y: 20, label: 'XOR1' },
            { id: 'xor2', type: 'XOR', x: 120, y: 30, label: 'XOR2' },
            { id: 'and1', type: 'AND', x: 50, y: 80, label: 'AND1' },
            { id: 'and2', type: 'AND', x: 120, y: 100, label: 'AND2' },
            { id: 'or1', type: 'OR', x: 190, y: 90, label: 'OR' },
            { id: 'in_a', type: 'PORT_IN', x: 10, y: 20, label: 'A' },
            { id: 'in_b', type: 'PORT_IN', x: 10, y: 60, label: 'B' },
            { id: 'in_cin', type: 'PORT_IN', x: 10, y: 100, label: 'Cin' },
            { id: 'out_s', type: 'PORT_OUT', x: 200, y: 30, label: 'S' },
            { id: 'out_cout', type: 'PORT_OUT', x: 260, y: 90, label: 'Cout' }
        ],
        wires: [
            { from: 'in_a', fromPin: 'out', to: 'xor1', toPin: 'in-1' },
            { from: 'in_b', fromPin: 'out', to: 'xor1', toPin: 'in-2' },
            { from: 'xor1', fromPin: 'out', to: 'xor2', toPin: 'in-1' },
            { from: 'in_cin', fromPin: 'out', to: 'xor2', toPin: 'in-2' },
            { from: 'in_a', fromPin: 'out', to: 'and1', toPin: 'in-1' },
            { from: 'in_b', fromPin: 'out', to: 'and1', toPin: 'in-2' },
            { from: 'xor1', fromPin: 'out', to: 'and2', toPin: 'in-1' },
            { from: 'in_cin', fromPin: 'out', to: 'and2', toPin: 'in-2' },
            { from: 'and1', fromPin: 'out', to: 'or1', toPin: 'in-1' },
            { from: 'and2', fromPin: 'out', to: 'or1', toPin: 'in-2' },
            { from: 'xor2', fromPin: 'out', to: 'out_s', toPin: 'in' },
            { from: 'or1', fromPin: 'out', to: 'out_cout', toPin: 'in' }
        ]
    },
    'SR_LATCH': {
        components: [
            { id: 'nor1', type: 'NOR', x: 60, y: 20, label: 'NOR1' },
            { id: 'nor2', type: 'NOR', x: 60, y: 80, label: 'NOR2' },
            { id: 'in_s', type: 'PORT_IN', x: 10, y: 20, label: 'S' },
            { id: 'in_r', type: 'PORT_IN', x: 10, y: 80, label: 'R' },
            { id: 'out_q', type: 'PORT_OUT', x: 140, y: 20, label: 'Q' },
            { id: 'out_qn', type: 'PORT_OUT', x: 140, y: 80, label: 'Q̅' }
        ],
        wires: [
            { from: 'in_s', fromPin: 'out', to: 'nor1', toPin: 'in-1' },
            { from: 'nor2', fromPin: 'out', to: 'nor1', toPin: 'in-2' },
            { from: 'in_r', fromPin: 'out', to: 'nor2', toPin: 'in-2' },
            { from: 'nor1', fromPin: 'out', to: 'nor2', toPin: 'in-1' },
            { from: 'nor1', fromPin: 'out', to: 'out_q', toPin: 'in' },
            { from: 'nor2', fromPin: 'out', to: 'out_qn', toPin: 'in' }
        ]
    },
    'D_FLIPFLOP': {
        components: [
            { id: 'nand1', type: 'NAND', x: 40, y: 20, label: 'NAND1' },
            { id: 'nand2', type: 'NAND', x: 40, y: 80, label: 'NAND2' },
            { id: 'nand3', type: 'NAND', x: 100, y: 20, label: 'NAND3' },
            { id: 'nand4', type: 'NAND', x: 100, y: 80, label: 'NAND4' },
            { id: 'nand5', type: 'NAND', x: 160, y: 30, label: 'NAND5' },
            { id: 'nand6', type: 'NAND', x: 160, y: 70, label: 'NAND6' },
            { id: 'not1', type: 'NOT', x: 10, y: 80, label: 'NOT' },
            { id: 'in_d', type: 'PORT_IN', x: 5, y: 20, label: 'D' },
            { id: 'in_clk', type: 'PORT_IN', x: 5, y: 50, label: 'CLK' },
            { id: 'out_q', type: 'PORT_OUT', x: 220, y: 30, label: 'Q' },
            { id: 'out_qn', type: 'PORT_OUT', x: 220, y: 70, label: 'Q̅' }
        ],
        wires: [
            { from: 'in_d', fromPin: 'out', to: 'nand1', toPin: 'in-1' },
            { from: 'in_d', fromPin: 'out', to: 'not1', toPin: 'in-1' },
            { from: 'in_clk', fromPin: 'out', to: 'nand1', toPin: 'in-2' },
            { from: 'in_clk', fromPin: 'out', to: 'nand2', toPin: 'in-1' },
            { from: 'not1', fromPin: 'out', to: 'nand2', toPin: 'in-2' },
            { from: 'nand1', fromPin: 'out', to: 'nand3', toPin: 'in-1' },
            { from: 'nand4', fromPin: 'out', to: 'nand3', toPin: 'in-2' },
            { from: 'nand3', fromPin: 'out', to: 'nand4', toPin: 'in-1' },
            { from: 'nand2', fromPin: 'out', to: 'nand4', toPin: 'in-2' },
            { from: 'nand3', fromPin: 'out', to: 'nand5', toPin: 'in-1' },
            { from: 'nand6', fromPin: 'out', to: 'nand5', toPin: 'in-2' },
            { from: 'nand5', fromPin: 'out', to: 'nand6', toPin: 'in-1' },
            { from: 'nand4', fromPin: 'out', to: 'nand6', toPin: 'in-2' },
            { from: 'nand5', fromPin: 'out', to: 'out_q', toPin: 'in' },
            { from: 'nand6', fromPin: 'out', to: 'out_qn', toPin: 'in' }
        ]
    }
};

// ============================================================================
// 사용자 등급 시스템 (Phase 3)
// ============================================================================
export const TIER_SYSTEM = {
    tiers: [
        { name: 'Silicon', minScore: 0, icon: '🪨', color: '#78716c' },
        { name: 'Diode', minScore: 100, icon: '🔌', color: '#fbbf24' },
        { name: 'Transistor', minScore: 500, icon: '⚡', color: '#22c55e' },
        { name: 'Gate', minScore: 1500, icon: '🔷', color: '#3b82f6' },
        { name: 'Processor', minScore: 5000, icon: '💎', color: '#8b5cf6' },
        { name: 'Quantum', minScore: 15000, icon: '🌟', color: '#ec4899' }
    ],
    getTier(score) {
        const sorted = [...this.tiers].sort((a, b) => b.minScore - a.minScore);
        return sorted.find(t => score >= t.minScore) || this.tiers[0];
    }
};
