/**
 * 모듈: 성능 최적화 유틸리티
 * 고성능 회로 시뮬레이션을 위한 최적화 기법 모음
 */

// === 성능 유틸리티 함수 ===

/**
 * 쓰로틀 함수 - 지정된 시간 간격으로만 함수 실행
 * @param {Function} fn - 실행할 함수
 * @param {number} limit - 밀리초 단위 간격
 * @returns {Function} 쓰로틀된 함수
 */
function throttle(fn, limit) {
    let inThrottle = false;
    let lastArgs = null;

    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastArgs) {
                    fn.apply(this, lastArgs);
                    lastArgs = null;
                }
            }, limit);
        } else {
            lastArgs = args;
        }
    };
}

/**
 * 디바운스 함수 - 마지막 호출 후 지정 시간 경과 시 실행
 * @param {Function} fn - 실행할 함수
 * @param {number} delay - 밀리초 단위 지연
 * @returns {Function} 디바운스된 함수
 */
function debounce(fn, delay) {
    let timeoutId = null;

    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * requestAnimationFrame 기반 쓰로틀
 * 60fps 기준으로 최적화된 업데이트
 */
function rafThrottle(fn) {
    let rafId = null;
    let lastArgs = null;

    return function (...args) {
        lastArgs = args;
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                fn.apply(this, lastArgs);
                rafId = null;
            });
        }
    };
}

// === 성능 최적화 모듈 ===

Object.assign(CircuitSimulator.prototype, {

    /**
     * 성능 모니터링 초기화
     */
    initPerformanceMonitor() {
        this.perfStats = {
            updateCount: 0,
            lastUpdateTime: 0,
            avgUpdateTime: 0,
            maxComponents: 0,
            maxWires: 0,
            frameDrops: 0
        };

        // 성능 모니터 활성화 시 콘솔 출력 (개발용)
        this.perfMonitorEnabled = false;
    },

    /**
     * 컴포넌트 캐시 초기화 - DOM 조회 최소화
     */
    initComponentCache() {
        this._cache = {
            pinsByComponent: new WeakMap(),
            componentsByType: new Map(),
            wiresByPin: new Map(),
            lastCacheTime: 0
        };
    },

    /**
     * 컴포넌트의 핀들을 캐시에서 가져오기
     * @param {HTMLElement} comp - 컴포넌트 요소
     * @returns {Object} 핀 정보 객체
     */
    getCachedPins(comp) {
        if (!this._cache) this.initComponentCache();

        let cached = this._cache.pinsByComponent.get(comp);
        if (!cached) {
            cached = {
                in1: comp.querySelector('.in-1'),
                in2: comp.querySelector('.in-2'),
                out: comp.querySelector('.out, .output.center'),
                base: comp.querySelector('.base'),
                col: comp.querySelector('.col'),
                emit: comp.querySelector('.emit'),
                input: comp.querySelector('.pin.input'),
                all: Array.from(comp.querySelectorAll('.pin'))
            };
            this._cache.pinsByComponent.set(comp, cached);
        }
        return cached;
    },

    /**
     * 캐시 무효화 - 컴포넌트 추가/삭제 시 호출
     */
    invalidateCache() {
        if (this._cache) {
            this._cache.pinsByComponent = new WeakMap();
            this._cache.componentsByType.clear();
            this._cache.wiresByPin.clear();
            this._cache.lastCacheTime = performance.now();
        }
    },

    /**
     * 배치 DOM 업데이트 - 여러 변경사항을 한 번에 적용
     * @param {Function[]} updates - 실행할 업데이트 함수 배열
     */
    batchDOMUpdates(updates) {
        // DocumentFragment 사용하거나 RAF로 묶기
        requestAnimationFrame(() => {
            updates.forEach(update => update());
        });
    },

    /**
     * 최적화된 전선 다시 그리기 - 변경된 전선만 업데이트
     */
    redrawWiresOptimized() {
        if (!this.workspace || !this.wires) return;

        const wsRect = this.workspace.parentElement.getBoundingClientRect();
        const panX = this.panX;
        const panY = this.panY;
        const scale = this.scale;

        // RAF로 배치 처리
        requestAnimationFrame(() => {
            const fragment = document.createDocumentFragment();

            this.wires.forEach(wire => {
                if (!wire.from || !wire.to || !wire.line) return;
                if (!document.contains(wire.from) || !document.contains(wire.to)) return;

                const fromRect = wire.from.getBoundingClientRect();
                const toRect = wire.to.getBoundingClientRect();

                const fromX = (fromRect.left + fromRect.width / 2 - wsRect.left - panX) / scale;
                const fromY = (fromRect.top + fromRect.height / 2 - wsRect.top - panY) / scale;
                const toX = (toRect.left + toRect.width / 2 - wsRect.left - panX) / scale;
                const toY = (toRect.top + toRect.height / 2 - wsRect.top - panY) / scale;

                // Manhattan routing
                const midX = (fromX + toX) / 2;
                const d = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
                wire.line.setAttribute('d', d);
            });
        });
    },

    /**
     * 최적화된 회로 업데이트 - 변경 감지 최적화
     */
    updateCircuitOptimized() {
        const startTime = performance.now();

        let changed = false;
        let limit = 50;

        // 컴포넌트를 타입별로 그룹화하여 처리
        const componentsByType = this.groupComponentsByType();

        while (limit > 0) {
            let stepChanged = false;

            // 최적화된 전파
            if (this.propagateOptimized()) stepChanged = true;
            if (this.propagateListOptimized(componentsByType)) stepChanged = true;

            if (!stepChanged) break;
            changed = true;
            limit--;
        }

        // RAF로 LED 업데이트 배치
        requestAnimationFrame(() => {
            this.updateLEDsOptimized();
            // [FIX] 와이어 시각화도 업데이트
            this.updateWireVisualsOptimized();
        });

        // 성능 통계 업데이트
        if (this.perfMonitorEnabled) {
            const elapsed = performance.now() - startTime;
            this.perfStats.updateCount++;
            this.perfStats.lastUpdateTime = elapsed;
            this.perfStats.avgUpdateTime =
                (this.perfStats.avgUpdateTime * (this.perfStats.updateCount - 1) + elapsed)
                / this.perfStats.updateCount;
        }
    },

    /**
     * 컴포넌트를 타입별로 그룹화
     */
    groupComponentsByType() {
        const groups = {
            gates: [],      // AND, OR, NOT, NAND, NOR, XOR, XNOR
            io: [],         // SWITCH, LED, CLOCK
            transistors: [], // TRANSISTOR, PMOS
            joints: [],     // JOINT
            packages: [],   // PACKAGE
            other: []
        };

        this.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            switch (type) {
                case 'AND': case 'OR': case 'NOT':
                case 'NAND': case 'NOR': case 'XOR': case 'XNOR':
                    groups.gates.push(comp);
                    break;
                case 'SWITCH': case 'LED': case 'CLOCK':
                    groups.io.push(comp);
                    break;
                case 'TRANSISTOR': case 'PMOS':
                    groups.transistors.push(comp);
                    break;
                case 'JOINT':
                    groups.joints.push(comp);
                    break;
                case 'PACKAGE':
                    groups.packages.push(comp);
                    break;
                default:
                    groups.other.push(comp);
            }
        });

        return groups;
    },

    /**
     * 최적화된 신호 전파 - 불필요한 DOM 접근 최소화
     */
    propagateOptimized() {
        let changed = false;
        const wireCount = this.wires.length;

        for (let i = 0; i < wireCount; i++) {
            const wire = this.wires[i];
            const fromPin = wire.from;
            const toPin = wire.to;
            const fromComp = fromPin.parentElement;

            if (!fromComp) continue;

            // 캐시된 속성 사용
            const type = fromComp._cachedType ||
                (fromComp._cachedType = fromComp.getAttribute('data-type'));
            let val = fromComp.getAttribute('data-value');

            if (type === 'SWITCH' && !val) val = '0';

            const isHigh = val === '1';
            let signal = false;

            // [FIX] classList.contains 사용하여 output 핀 확인
            const isOutputPin = fromPin._isOutput !== undefined
                ? fromPin._isOutput
                : (fromPin._isOutput = fromPin.classList.contains('output') || fromPin.classList.contains('emit'));

            if (isOutputPin || type === 'JOINT') {
                signal = isHigh;
            }

            // 현재 신호 비교
            const currentSignal = toPin._cachedSignal;

            if (signal !== currentSignal) {
                toPin._cachedSignal = signal;
                toPin.setAttribute('data-signal', signal ? '1' : '0');
                changed = true;

                // 시각화 업데이트는 나중에 배치로 처리
                wire._needsVisualUpdate = true;
                wire._signalState = signal;
            }
        }

        return changed;
    },

    /**
     * 최적화된 컴포넌트 리스트 전파
     */
    propagateListOptimized(groups) {
        let changed = false;

        // 게이트 처리 (가장 일반적인 컴포넌트)
        for (const comp of groups.gates) {
            const pins = this.getCachedPins(comp);
            const type = comp._cachedType ||
                (comp._cachedType = comp.getAttribute('data-type'));
            const currentVal = comp.getAttribute('data-value') === '1';

            const in1 = pins.in1?.getAttribute('data-signal') === '1';
            const in2 = pins.in2?.getAttribute('data-signal') === '1';

            let res;
            switch (type) {
                case 'AND': res = in1 && in2; break;
                case 'OR': res = in1 || in2; break;
                case 'NOT': res = !in1; break;
                case 'NAND': res = !(in1 && in2); break;
                case 'NOR': res = !(in1 || in2); break;
                case 'XOR': res = in1 !== in2; break;
                case 'XNOR': res = in1 === in2; break;
            }

            if (res !== currentVal) {
                comp.setAttribute('data-value', res ? '1' : '0');
                changed = true;
            }
        }

        // LED 처리
        for (const comp of groups.io) {
            const type = comp._cachedType ||
                (comp._cachedType = comp.getAttribute('data-type'));

            if (type !== 'LED') continue;

            const pins = this.getCachedPins(comp);
            const currentVal = comp.getAttribute('data-value') === '1';
            const ledInput = pins.input?.getAttribute('data-signal') === '1';

            if (ledInput !== currentVal) {
                comp.setAttribute('data-value', ledInput ? '1' : '0');
                changed = true;
            }
        }

        // 트랜지스터 처리
        for (const comp of groups.transistors) {
            const pins = this.getCachedPins(comp);
            const type = comp._cachedType ||
                (comp._cachedType = comp.getAttribute('data-type'));
            const currentVal = comp.getAttribute('data-value') === '1';

            const base = pins.base?.getAttribute('data-signal') === '1';
            const col = pins.col?.getAttribute('data-signal') === '1';

            let res;
            if (type === 'TRANSISTOR') {
                res = base && col;
            } else { // PMOS
                res = !base && col;
            }

            if (res !== currentVal) {
                comp.setAttribute('data-value', res ? '1' : '0');
                changed = true;
            }
        }

        // JOINT 처리
        for (const comp of groups.joints) {
            const pins = this.getCachedPins(comp);
            const currentVal = comp.getAttribute('data-value') === '1';
            const jointSignal = pins.all[0]?.getAttribute('data-signal') === '1';

            if (jointSignal !== currentVal) {
                comp.setAttribute('data-value', jointSignal ? '1' : '0');
                changed = true;
            }
        }

        // PACKAGE 처리
        for (const comp of groups.packages) {
            this.evaluateComposite(comp);
        }

        return changed;
    },

    /**
     * 최적화된 LED 업데이트 - 배치 처리
     */
    updateLEDsOptimized() {
        const leds = this.components.filter(c =>
            c.getAttribute('data-type') === 'LED'
        );

        leds.forEach(led => {
            const val = led.getAttribute('data-value');
            const isOn = val === '1';
            const wasOn = led.classList.contains('led-on');

            if (isOn !== wasOn) {
                led.classList.toggle('led-on', isOn);
                led.style.boxShadow = isOn
                    ? `0 0 15px ${led.getAttribute('data-color') || 'red'}`
                    : 'none';
            }
        });
    },

    /**
     * 배치 와이어 시각화 업데이트
     */
    updateWireVisualsOptimized() {
        requestAnimationFrame(() => {
            this.wires.forEach(wire => {
                if (!wire._needsVisualUpdate) return;

                const signal = wire._signalState;
                if (signal) {
                    wire.line.classList.add('active-flow');
                    wire.line.style.stroke = '';
                    wire.line.style.strokeWidth = '';
                    wire.line.style.strokeDasharray = '';
                } else {
                    wire.line.classList.remove('active-flow');
                    wire.line.style.stroke = '#555555';
                    wire.line.style.strokeWidth = '3px';
                    wire.line.style.strokeDasharray = 'none';
                }

                wire._needsVisualUpdate = false;
            });
        });
    },

    /**
     * 성능 통계 가져오기
     */
    getPerformanceStats() {
        return {
            ...this.perfStats,
            currentComponents: this.components.length,
            currentWires: this.wires.length,
            memoryUsage: performance.memory?.usedJSHeapSize || 'N/A'
        };
    },

    /**
     * 성능 모니터링 토글
     */
    togglePerformanceMonitor(enable) {
        this.perfMonitorEnabled = enable;
        if (enable) {
            this.initPerformanceMonitor();
            console.log('🚀 Performance Monitor Enabled');
        } else {
            console.log('Performance Monitor Disabled');
        }
    }
});

// === 전역 유틸리티 함수 노출 ===
window.throttle = throttle;
window.debounce = debounce;
window.rafThrottle = rafThrottle;
