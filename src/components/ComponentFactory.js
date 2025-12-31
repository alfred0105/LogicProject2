/**
 * LoCAD - Logic Circuit Design Tool
 * Component Factory (ESM)
 * 
 * @description Factory Pattern을 사용하여 컴포넌트를 생성합니다.
 *              각 인스턴스가 독립적인 state와 internal_circuit를 가집니다.
 */

import { cloneDeep, generateShortId } from '../utils/Helpers.js';
import { STANDARD_PACKAGES } from '../utils/Constants.js';

/**
 * ComponentFactory 클래스
 * - 컴포넌트 생성 및 관리
 * - Deep Clone으로 메모리 격리 보장
 * - 패키지/모듈 인스턴스화
 */
export class ComponentFactory {
    constructor() {
        /** @type {Array<Object>} */
        this.userPackages = [];

        /** @type {Map<string, Object>} */
        this.componentCache = new Map();
    }

    /**
     * 사용자 패키지 목록 설정
     * @param {Array<Object>} packages 
     */
    setUserPackages(packages) {
        this.userPackages = packages;
    }

    /**
     * 고유 컴포넌트 ID 생성
     * @param {string} type 
     * @returns {string}
     */
    generateComponentId(type) {
        return `${type.toLowerCase()}_${Date.now()}_${generateShortId(5)}`;
    }

    /**
     * 패키지 인스턴스 생성 (Factory Method)
     * 
     * @param {number|string} packageIdOrType - 패키지 인덱스 또는 표준 패키지 타입
     * @param {Object} options - 생성 옵션
     * @returns {Object} 독립적인 패키지 인스턴스
     */
    createPackageInstance(packageIdOrType, options = {}) {
        let packageDef;
        let isStandard = false;

        // 표준 패키지인지 사용자 패키지인지 판단
        if (typeof packageIdOrType === 'string' && STANDARD_PACKAGES[packageIdOrType]) {
            packageDef = STANDARD_PACKAGES[packageIdOrType];
            isStandard = true;
        } else if (typeof packageIdOrType === 'number') {
            packageDef = this.userPackages[packageIdOrType];
        } else {
            console.warn('[ComponentFactory] Unknown package:', packageIdOrType);
            return null;
        }

        if (!packageDef) {
            console.warn('[ComponentFactory] Package definition not found:', packageIdOrType);
            return null;
        }

        // ========================================
        // [핵심] Deep Clone으로 독립 인스턴스 생성
        // ========================================
        const instanceData = cloneDeep(packageDef);

        // 고유 인스턴스 ID 부여
        const instanceId = this.generateComponentId('pkg');

        // 내부 컴포넌트들의 ID도 모두 재생성 (충돌 방지)
        if (instanceData.components || instanceData.circuit?.components) {
            const components = instanceData.components || instanceData.circuit.components;
            const idMap = new Map();

            components.forEach(comp => {
                const oldId = comp.id;
                const newId = `${instanceId}_${oldId}_${generateShortId(4)}`;
                idMap.set(oldId, newId);
                comp.id = newId;
                comp.instanceId = instanceId;  // 부모 인스턴스 참조
            });

            // 와이어의 참조 ID도 업데이트
            const wires = instanceData.wires || instanceData.circuit?.wires;
            if (wires) {
                wires.forEach(wire => {
                    if (idMap.has(wire.from)) {
                        wire.from = idMap.get(wire.from);
                    }
                    if (idMap.has(wire.to)) {
                        wire.to = idMap.get(wire.to);
                    }
                    if (idMap.has(wire.fromId)) {
                        wire.fromId = idMap.get(wire.fromId);
                    }
                    if (idMap.has(wire.toId)) {
                        wire.toId = idMap.get(wire.toId);
                    }
                });
            }
        }

        // 인스턴스 메타데이터
        return {
            instanceId,
            type: isStandard ? packageIdOrType : 'PACKAGE',
            packageIndex: !isStandard ? packageIdOrType : null,
            isStandard,
            data: instanceData,
            state: this.createInitialState(instanceData),
            internals: null,  // buildInternals에서 채워짐
            createdAt: Date.now()
        };
    }

    /**
     * 초기 상태 객체 생성
     * @param {Object} packageDef 
     * @returns {Object}
     */
    createInitialState(packageDef) {
        const state = {
            value: 0,
            lastUpdate: 0
        };

        // 순차 회로(래치, 플립플롭)용 상태
        if (packageDef.outputs?.includes('Q')) {
            state.Q = 0;
            state['Q̅'] = 1;
        }

        // 입력별 상태
        if (packageDef.inputs) {
            state.inputs = {};
            packageDef.inputs.forEach(input => {
                state.inputs[input] = 0;
            });
        }

        // 출력별 상태
        if (packageDef.outputs) {
            state.outputs = {};
            packageDef.outputs.forEach(output => {
                state.outputs[output] = 0;
            });
        }

        return state;
    }

    /**
     * 패키지 내부 회로 빌드
     * DOM 요소 생성 없이 순수 데이터 구조로 내부 회로 표현
     * 
     * @param {Object} instance - createPackageInstance 결과
     * @returns {Object} 내부 회로 데이터
     */
    buildInternalsFromData(instance) {
        const circuitData = instance.data.circuit || instance.data;
        if (!circuitData?.components) return null;

        const internals = {
            components: [],
            wires: [],
            idMap: new Map()
        };

        // 컴포넌트 생성 (순수 데이터)
        circuitData.components.forEach(part => {
            const internalComp = {
                id: part.id,
                type: part.type,
                value: (part.value || '0') === '1' ? 1 : 0,
                x: part.x || 0,
                y: part.y || 0,
                label: part.label || part.type,
                pins: this.createPinsForType(part.type)
            };

            // VCC는 항상 High
            if (part.type === 'VCC') {
                internalComp.value = 1;
            }

            internals.idMap.set(part.id, internalComp);
            internals.components.push(internalComp);
        });

        // 와이어 연결
        const wires = circuitData.wires || [];
        wires.forEach(w => {
            const fromId = w.from || w.fromId;
            const toId = w.to || w.toId;
            const fromPin = w.fromPin || 'out';
            const toPin = w.toPin || 'in';

            const fromComp = internals.idMap.get(fromId);
            const toComp = internals.idMap.get(toId);

            if (fromComp && toComp) {
                internals.wires.push({
                    from: { compId: fromId, pin: fromPin },
                    to: { compId: toId, pin: toPin },
                    signal: 0
                });
            }
        });

        instance.internals = internals;
        return internals;
    }

    /**
     * 타입별 핀 구조 생성
     * @param {string} type 
     * @returns {Object}
     */
    createPinsForType(type) {
        const pins = {};

        switch (type) {
            case 'AND':
            case 'OR':
            case 'XOR':
            case 'NAND':
            case 'NOR':
            case 'XNOR':
                pins.inputs = ['in-1', 'in-2'];
                pins.outputs = ['out'];
                break;
            case 'NOT':
                pins.inputs = ['in-1'];
                pins.outputs = ['out'];
                break;
            case 'TRANSISTOR':
            case 'PMOS':
                pins.inputs = ['base', 'col'];
                pins.outputs = ['emit'];
                break;
            case 'VCC':
            case 'GND':
            case 'SWITCH':
            case 'CLOCK':
                pins.inputs = [];
                pins.outputs = ['out'];
                break;
            case 'LED':
                pins.inputs = ['in'];
                pins.outputs = [];
                break;
            case 'PORT_IN':
                pins.inputs = [];
                pins.outputs = ['out'];
                break;
            case 'PORT_OUT':
                pins.inputs = ['in'];
                pins.outputs = [];
                break;
            case 'JOINT':
                pins.inputs = ['p1'];
                pins.outputs = ['p1'];  // 양방향
                break;
            default:
                pins.inputs = ['in'];
                pins.outputs = ['out'];
        }

        return pins;
    }

    /**
     * 순수 로직 시뮬레이션 (내부 회로용)
     * @param {Object} internals - 내부 회로 데이터
     * @param {Object} externalInputs - 외부 입력 값 { pinName: value }
     * @returns {Object} 출력 값 { pinName: value }
     */
    simulateInternals(internals, externalInputs = {}) {
        if (!internals?.components) return {};

        const maxIterations = 20;  // 수렴 보장

        // PORT_IN 컴포넌트에 외부 입력 전달
        internals.components.forEach(comp => {
            if (comp.type === 'PORT_IN') {
                const inputName = comp.label;
                if (inputName in externalInputs) {
                    comp.value = externalInputs[inputName] ? 1 : 0;
                }
            }
        });

        // 반복 시뮬레이션 (안정화)
        for (let iter = 0; iter < maxIterations; iter++) {
            let changed = false;

            // 와이어를 통한 신호 전파
            internals.wires.forEach(wire => {
                const fromComp = internals.idMap.get(wire.from.compId);
                if (fromComp) {
                    wire.signal = fromComp.value;
                }
            });

            // 컴포넌트 로직 평가
            internals.components.forEach(comp => {
                const oldValue = comp.value;

                // 입력 신호 수집
                const inputSignals = {};
                internals.wires.forEach(wire => {
                    if (wire.to.compId === comp.id) {
                        inputSignals[wire.to.pin] = wire.signal;
                    }
                });

                // 게이트 로직
                let newValue;
                switch (comp.type) {
                    case 'AND':
                        newValue = (inputSignals['in-1'] && inputSignals['in-2']) ? 1 : 0;
                        break;
                    case 'OR':
                        newValue = (inputSignals['in-1'] || inputSignals['in-2']) ? 1 : 0;
                        break;
                    case 'NOT':
                        newValue = inputSignals['in-1'] ? 0 : 1;
                        break;
                    case 'NAND':
                        newValue = (inputSignals['in-1'] && inputSignals['in-2']) ? 0 : 1;
                        break;
                    case 'NOR':
                        newValue = (inputSignals['in-1'] || inputSignals['in-2']) ? 0 : 1;
                        break;
                    case 'XOR':
                        newValue = (inputSignals['in-1'] !== inputSignals['in-2']) ? 1 : 0;
                        break;
                    case 'XNOR':
                        newValue = (inputSignals['in-1'] === inputSignals['in-2']) ? 1 : 0;
                        break;
                    case 'TRANSISTOR':
                        newValue = (inputSignals['base'] && inputSignals['col']) ? 1 : 0;
                        break;
                    case 'PMOS':
                        newValue = (!inputSignals['base'] && inputSignals['col']) ? 1 : 0;
                        break;
                    case 'PORT_OUT':
                    case 'LED':
                        newValue = inputSignals['in'] || 0;
                        break;
                    case 'VCC':
                        newValue = 1;
                        break;
                    case 'GND':
                        newValue = 0;
                        break;
                    default:
                        newValue = comp.value;
                }

                if (newValue !== undefined && newValue !== oldValue) {
                    comp.value = newValue;
                    changed = true;
                }
            });

            // 안정화되면 종료
            if (!changed) break;
        }

        // PORT_OUT에서 출력 수집
        const outputs = {};
        internals.components.forEach(comp => {
            if (comp.type === 'PORT_OUT') {
                outputs[comp.label] = comp.value;
            }
        });

        return outputs;
    }
}

// 싱글톤 인스턴스
export const componentFactory = new ComponentFactory();
