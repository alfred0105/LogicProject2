/**
 * LoCAD - Logic Circuit Design Tool
 * Simulation Engine Interface (ESM)
 * 
 * @description 시뮬레이션 엔진의 추상 인터페이스를 정의합니다.
 *              추후 QuantumEngine 도입을 위한 추상화 레이어입니다.
 * 
 * @interface ISimulationEngine
 * @method step() - 1 스텝 시뮬레이션 실행
 * @method reset() - 시뮬레이션 상태 초기화
 * @method getState() - 현재 시뮬레이션 상태 반환
 * @method propagate() - 신호 전파
 */

/**
 * 시뮬레이션 엔진 인터페이스 (JSDoc 기반)
 * TypeScript의 interface를 JavaScript에서 구현
 */
export class ISimulationEngine {
    /**
     * 1 스텝 시뮬레이션 실행
     * @abstract
     */
    step() {
        throw new Error('ISimulationEngine.step() must be implemented');
    }

    /**
     * 시뮬레이션 상태 초기화
     * @abstract
     */
    reset() {
        throw new Error('ISimulationEngine.reset() must be implemented');
    }

    /**
     * 현재 시뮬레이션 상태 반환
     * @abstract
     * @returns {Object} 시뮬레이션 상태
     */
    getState() {
        throw new Error('ISimulationEngine.getState() must be implemented');
    }

    /**
     * 신호 전파
     * @abstract
     * @returns {boolean} 상태 변경 여부
     */
    propagate() {
        throw new Error('ISimulationEngine.propagate() must be implemented');
    }

    /**
     * 컴포넌트 목록 설정
     * @abstract
     * @param {Array} components 
     */
    setComponents(components) {
        throw new Error('ISimulationEngine.setComponents() must be implemented');
    }

    /**
     * 와이어 목록 설정
     * @abstract
     * @param {Array} wires 
     */
    setWires(wires) {
        throw new Error('ISimulationEngine.setWires() must be implemented');
    }
}
