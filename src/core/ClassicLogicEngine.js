/**
 * LoCAD - Logic Circuit Design Tool
 * Classic Logic Engine (ESM)
 * 
 * @description 클래식 디지털 로직 시뮬레이션 엔진입니다.
 *              ISimulationEngine 인터페이스를 구현합니다.
 */

import { ISimulationEngine } from './ISimulationEngine.js';
import { STANDARD_PACKAGES, CONFIG } from '../utils/Constants.js';
import { cloneDeep } from '../utils/Helpers.js';

/**
 * 클래식 로직 엔진 - Boolean 로직 시뮬레이션
 * @implements {ISimulationEngine}
 */
export class ClassicLogicEngine extends ISimulationEngine {
    constructor() {
        super();

        /** @type {Array<HTMLElement>} */
        this.components = [];

        /** @type {Array<Object>} */
        this.wires = [];

        /** @type {Object|null} */
        this.netManager = null;

        /** @type {boolean} */
        this.isRunning = false;

        /** @type {number} */
        this.tickCount = 0;

        /** @type {number} */
        this.clockAccumulator = 0;

        /** @type {number} */
        this.clockInterval = CONFIG.CLOCK_INTERVAL;

        // 표준 패키지 타입 목록
        this.standardPackageTypes = ['HALF_ADDER', 'FULL_ADDER', 'SR_LATCH', 'D_FLIPFLOP'];
    }

    /**
     * 컴포넌트 목록 설정
     * @param {Array<HTMLElement>} components 
     */
    setComponents(components) {
        this.components = components;
    }

    /**
     * 와이어 목록 설정
     * @param {Array<Object>} wires 
     */
    setWires(wires) {
        this.wires = wires;
    }

    /**
     * NetManager 설정 (고성능 모드)
     * @param {Object} netManager 
     */
    setNetManager(netManager) {
        this.netManager = netManager;
    }

    /**
     * 1 스텝 시뮬레이션 실행
     */
    step() {
        this.doClockTick();
        this.tickCount++;
    }

    /**
     * 시뮬레이션 상태 초기화
     */
    reset() {
        this.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            if (type !== 'VCC' && type !== 'GND') {
                comp.setAttribute('data-value', '0');
                if (type === 'SWITCH') {
                    const label = comp.querySelector('.comp-label');
                    if (label) label.innerText = 'OFF';
                    comp.classList.remove('switch-on');
                }
            } else if (type === 'VCC') {
                comp.setAttribute('data-value', '1');
            }
        });

        this.tickCount = 0;
        this.clockAccumulator = 0;
        this.updateCircuit();
    }

    /**
     * 현재 시뮬레이션 상태 반환
     * @returns {Object}
     */
    getState() {
        return {
            isRunning: this.isRunning,
            tickCount: this.tickCount,
            componentStates: this.components.map(c => ({
                id: c.id,
                type: c.getAttribute('data-type'),
                value: c.getAttribute('data-value')
            }))
        };
    }

    /**
     * 신호 전파 (메인 메서드)
     * @returns {boolean} 상태 변경 여부
     */
    propagate() {
        // NetManager가 있으면 Netlist 기반 전파
        if (this.netManager) {
            return this.propagateNetlist();
        }
        // 없으면 레거시 방식
        return this.propagateLegacy(this.wires);
    }

    /**
     * 전체 회로 업데이트
     */
    updateCircuit() {
        let changed = false;
        let limit = CONFIG.MAX_PROPAGATION_ITERATIONS;

        while (limit > 0) {
            let stepChanged = false;
            if (this.propagate()) stepChanged = true;
            if (this.propagateList(this.components)) stepChanged = true;

            if (!stepChanged) break;
            changed = true;
            limit--;
        }

        this.updateLEDs();
        return changed;
    }

    /**
     * 클럭 틱 처리
     */
    doClockTick() {
        const clocks = document.querySelectorAll('.component[data-type="CLOCK"]');
        if (clocks.length === 0) return;

        clocks.forEach(clk => {
            const current = clk.getAttribute('data-value');
            const next = current === '1' ? '0' : '1';
            clk.setAttribute('data-value', next);

            const label = clk.querySelector('.comp-label');
            if (label) label.innerText = next === '1' ? 'HIGH' : 'LOW';
        });

        this.updateCircuit();
    }

    /**
     * LED 시각적 업데이트
     */
    updateLEDs() {
        const leds = document.querySelectorAll('.component[data-type="LED"]');
        leds.forEach(led => {
            const val = led.getAttribute('data-value');
            if (val === '1') {
                led.classList.add('led-on');
            } else {
                led.classList.remove('led-on');
            }
        });
    }

    /**
     * 컴포넌트 리스트 기반 전파
     * @param {Array<HTMLElement>} components 
     * @returns {boolean}
     */
    propagateList(components) {
        let changed = false;

        components.forEach(comp => {
            const type = comp.getAttribute('data-type');

            // 패키지 컴포넌트 처리
            const isPackage = type === 'PACKAGE' ||
                comp.classList.contains('package-comp') ||
                this.standardPackageTypes.includes(type);

            if (isPackage) {
                if (!comp.internals || !comp.internals.components || comp.internals.components.length === 0) {
                    if (type === 'PACKAGE' && comp.getAttribute('data-package-id') !== null) {
                        this.buildUserPackageInternals(comp);
                    } else if (this.standardPackageTypes.includes(type)) {
                        this.buildStandardPackageInternals(comp, type);
                    }
                }
                this.evaluateComposite(comp);
                return;
            }

            let valStr = comp.getAttribute('data-value');
            if (type === 'SWITCH' && !valStr) valStr = '0';

            const currentVal = valStr === '1';
            let res = currentVal;

            const in1 = comp.querySelector('.in-1')?.getAttribute('data-signal') === '1';
            const in2 = comp.querySelector('.in-2')?.getAttribute('data-signal') === '1';

            switch (type) {
                case 'AND': res = in1 && in2; break;
                case 'OR': res = in1 || in2; break;
                case 'NOT': res = !in1; break;
                case 'NAND': res = !(in1 && in2); break;
                case 'NOR': res = !(in1 || in2); break;
                case 'XOR': res = in1 !== in2; break;
                case 'XNOR': res = in1 === in2; break;
                case 'JOINT':
                    const p1 = comp.querySelector('.pin');
                    res = p1?.getAttribute('data-signal') === '1';
                    break;
                case 'TRANSISTOR':
                    const base = comp.querySelector('.base')?.getAttribute('data-signal') === '1';
                    const col = comp.querySelector('.col')?.getAttribute('data-signal') === '1';
                    res = base && col;
                    break;
                case 'PMOS':
                    const pBase = comp.querySelector('.base')?.getAttribute('data-signal') === '1';
                    const pCol = comp.querySelector('.col')?.getAttribute('data-signal') === '1';
                    res = !pBase && pCol;
                    break;
                case 'LED':
                    const ledInput = comp.querySelector('.pin.input')?.getAttribute('data-signal') === '1';
                    res = ledInput;
                    break;
            }

            if (res !== currentVal) {
                comp.setAttribute('data-value', res ? '1' : '0');
                changed = true;
            }
        });

        return changed;
    }

    /**
     * Netlist 기반 신호 전파 (고성능)
     * @returns {boolean}
     */
    propagateNetlist() {
        let changed = false;

        if (!this.netManager) return false;

        this.netManager.nets.forEach(net => {
            let isHigh = false;

            for (const pin of net.pins) {
                if (this.isDrivingPin(pin)) {
                    if (this.getPinLevel(pin)) {
                        isHigh = true;
                        break;
                    }
                }
            }

            const newState = isHigh ? 1 : 0;
            if (net.state !== newState) {
                net.state = newState;
                changed = true;

                net.wires.forEach(wire => this.updateWireVisual(wire, isHigh));
            }

            const signalStr = isHigh ? '1' : '0';
            net.pins.forEach(pin => {
                if (pin.getAttribute('data-signal') !== signalStr) {
                    pin.setAttribute('data-signal', signalStr);
                }
            });
        });

        return changed;
    }

    /**
     * 레거시 전파 로직
     * @param {Array} wireList 
     * @returns {boolean}
     */
    propagateLegacy(wireList) {
        let changed = false;

        wireList.forEach(wire => {
            const fromPin = wire.from;
            const toPin = wire.to;

            let signal = false;

            if (this.isDrivingPin(fromPin)) {
                signal = this.getPinLevel(fromPin);
            }

            const currentSignal = toPin.getAttribute('data-signal') === '1';

            if (signal !== currentSignal) {
                toPin.setAttribute('data-signal', signal ? '1' : '0');
                changed = true;
            }

            this.updateWireVisual(wire, signal);
        });

        return changed;
    }

    /**
     * 핀이 출력(Driver)인지 판단
     * @param {HTMLElement} pin 
     * @returns {boolean}
     */
    isDrivingPin(pin) {
        if (pin.classList.contains('output')) return true;
        if (pin.classList.contains('emit')) return true;
        if (pin.classList.contains('out')) return true;
        if (pin.classList.contains('joint-pin')) return true;
        return false;
    }

    /**
     * 핀의 논리 레벨 읽기
     * @param {HTMLElement} pin 
     * @returns {boolean}
     */
    getPinLevel(pin) {
        const comp = pin.parentElement;
        if (!comp) return false;

        const type = comp.getAttribute('data-type');

        if (type === 'PACKAGE' || comp.classList.contains('package-comp')) {
            return pin.getAttribute('data-output-signal') === '1';
        }

        let val = comp.getAttribute('data-value');
        if (type === 'SWITCH' && !val) val = '0';
        const isCompHigh = val === '1';

        if (pin.classList.contains('output') || pin.classList.contains('out')) {
            return isCompHigh;
        }
        if (pin.classList.contains('emit')) {
            return isCompHigh;
        }
        if (pin.classList.contains('joint-pin') || type === 'JOINT') {
            return false;
        }

        return false;
    }

    /**
     * 전선 시각적 업데이트
     * @param {Object} wire 
     * @param {boolean} isHigh 
     */
    updateWireVisual(wire, isHigh) {
        if (!wire.line) return;

        if (isHigh) {
            if (!wire.line.classList.contains('active-flow')) {
                wire.line.classList.add('active-flow');
                wire.line.style.stroke = '';
                wire.line.style.strokeWidth = '';
                wire.line.style.strokeDasharray = '';
            }
        } else {
            if (wire.line.classList.contains('active-flow')) {
                wire.line.classList.remove('active-flow');
                wire.line.style.stroke = '#555555';
                wire.line.style.strokeWidth = '3px';
                wire.line.style.strokeDasharray = 'none';
            }
        }
    }

    /**
     * 복합 컴포넌트(패키지) 평가
     * @param {HTMLElement} comp 
     */
    evaluateComposite(comp) {
        if (!comp.internals || !comp.internals.components) return;

        // 외부 입력 -> 내부 PORT_IN
        const extInPins = Array.from(comp.querySelectorAll('.pin.input'));
        const intPortIns = comp.internals.components.filter(c =>
            c.getAttribute('data-type') === 'PORT_IN'
        );

        extInPins.sort((a, b) => {
            const idxA = this.getInputIndex(a);
            const idxB = this.getInputIndex(b);
            return idxA - idxB;
        });

        intPortIns.sort((a, b) =>
            parseFloat(a.style.top || '0') - parseFloat(b.style.top || '0')
        );

        for (let i = 0; i < Math.min(extInPins.length, intPortIns.length); i++) {
            const signal = extInPins[i].getAttribute('data-signal') === '1';
            intPortIns[i].setAttribute('data-value', signal ? '1' : '0');
        }

        // 내부 회로 시뮬레이션
        for (let i = 0; i < 15; i++) {
            this.propagateList(comp.internals.components, comp.internals.wires);
            this.propagateLegacy(comp.internals.wires || []);
        }

        // 내부 PORT_OUT -> 외부 출력
        const extOutPins = Array.from(comp.querySelectorAll('.pin.output'));
        const intPortOuts = comp.internals.components.filter(c =>
            c.getAttribute('data-type') === 'PORT_OUT'
        );

        extOutPins.sort((a, b) => {
            const idxA = this.getOutputIndex(a);
            const idxB = this.getOutputIndex(b);
            return idxA - idxB;
        });

        intPortOuts.sort((a, b) =>
            parseFloat(a.style.top || '0') - parseFloat(b.style.top || '0')
        );

        for (let i = 0; i < Math.min(extOutPins.length, intPortOuts.length); i++) {
            const inPin = intPortOuts[i].querySelector('.pin.input');
            const val = inPin?.getAttribute('data-signal') === '1';
            extOutPins[i].setAttribute('data-output-signal', val ? '1' : '0');
        }
    }

    getInputIndex(pin) {
        const classes = Array.from(pin.classList);
        const match = classes.find(c => /^in-(\d+)$/.test(c));
        return match ? parseInt(match.match(/^in-(\d+)$/)[1]) : 999;
    }

    getOutputIndex(pin) {
        const classes = Array.from(pin.classList);
        const match = classes.find(c => /^out-(\d+)$/.test(c));
        return match ? parseInt(match.match(/^out-(\d+)$/)[1]) : 999;
    }

    /**
     * 사용자 패키지 내부 회로 빌드
     * @param {HTMLElement} comp 
     */
    buildUserPackageInternals(comp) {
        // 실제 구현은 ComponentManager와 연동
        console.log('[ClassicLogicEngine] buildUserPackageInternals - stub');
    }

    /**
     * 표준 패키지 내부 회로 빌드
     * @param {HTMLElement} comp 
     * @param {string} type 
     */
    buildStandardPackageInternals(comp, type) {
        const circuit = STANDARD_PACKAGES[type];
        if (!circuit) {
            console.warn('[ClassicLogicEngine] Unknown package type:', type);
            return;
        }

        // Deep clone으로 독립 인스턴스 생성
        const circuitData = cloneDeep(circuit);
        this.buildInternals(comp, circuitData);
    }

    /**
     * 컴포넌트 내부 회로 빌드
     * @param {HTMLElement} comp 
     * @param {Object} circuitData 
     */
    buildInternals(comp, circuitData) {
        comp.internals = { components: [], wires: [] };
        const idMap = {};

        circuitData.components.forEach(part => {
            const el = document.createElement('div');
            el.classList.add('component');
            el.id = comp.id + '_internal_' + part.id + '_' + Math.random().toString(36).substr(2, 5);
            el.setAttribute('data-type', part.type);
            el.setAttribute('data-value', part.value || '0');
            el.style.left = (part.x || 0) + 'px';
            el.style.top = (part.y || 0) + 'px';

            // 핀 추가 로직은 ComponentManager 참조
            idMap[part.id] = el;
            comp.internals.components.push(el);
        });

        // 와이어 연결
        circuitData.wires.forEach(w => {
            const fromComp = idMap[w.from];
            const toComp = idMap[w.to];
            if (fromComp && toComp) {
                comp.internals.wires.push({ from: fromComp, to: toComp });
            }
        });
    }
}

// 싱글톤 인스턴스 생성
export const logicEngine = new ClassicLogicEngine();
