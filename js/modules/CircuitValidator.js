/**
 * CircuitValidator.js
 * 회로 검증, 타이밍 분석, 전력 소비 계산, 최적화 제안 기능
 */

class CircuitValidator {
    constructor(simulator) {
        this.sim = simulator;
        this.validationResults = {
            errors: [],
            warnings: [],
            suggestions: []
        };

        // 게이트 타입별 지연 시간 (ns)
        this.gateDelays = {
            'AND': 2.0,
            'OR': 2.0,
            'NOT': 1.0,
            'NAND': 1.5,
            'NOR': 1.5,
            'XOR': 3.0,
            'XNOR': 3.0,
            'SWITCH': 0,
            'LED': 0,
            'CLOCK': 0,
            'HALF_ADDER': 5.0,
            'FULL_ADDER': 7.0,
            'SR_LATCH': 4.0,
            'D_FLIPFLOP': 5.0,
            'PACKAGE': 10.0 // 기본값
        };

        // 게이트 타입별 전력 소비 (μW)
        this.gatePower = {
            'AND': 0.5,
            'OR': 0.5,
            'NOT': 0.3,
            'NAND': 0.4,
            'NOR': 0.4,
            'XOR': 0.8,
            'XNOR': 0.8,
            'SWITCH': 0.1,
            'LED': 5.0,
            'CLOCK': 1.0,
            'HALF_ADDER': 2.0,
            'FULL_ADDER': 3.0,
            'SR_LATCH': 1.5,
            'D_FLIPFLOP': 2.0,
            'PACKAGE': 5.0
        };
    }

    /**
     * 전체 회로 검증 실행
     */
    validateCircuit() {
        this.validationResults = {
            errors: [],
            warnings: [],
            suggestions: [],
            timing: null,
            power: null
        };

        // 1. 논리 오류 감지
        this.detectLogicErrors();

        // 2. 타이밍 분석
        this.analyzeTimingPaths();

        // 3. 전력 소비 계산
        this.calculatePowerConsumption();

        // 4. 최적화 제안
        this.generateOptimizationSuggestions();

        // UI 업데이트
        this.displayResults();

        return this.validationResults;
    }

    /**
     * 1. 논리 오류 감지
     */
    detectLogicErrors() {
        // 1.1 미연결 핀 감지
        this.detectUnconnectedPins();

        // 1.2 순환 참조 (루프) 감지
        this.detectCycles();

        // 1.3 다중 드라이버 감지 (여러 출력이 하나의 입력에 연결)
        this.detectMultipleDrivers();

        // 1.4 플로팅 상태 감지
        this.detectFloatingSignals();
    }

    /**
     * 미연결 핀 감지
     */
    detectUnconnectedPins() {
        this.sim.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            if (type === 'SWITCH' || type === 'LED' || type === 'CLOCK') return;

            const pins = comp.querySelectorAll('.pin');
            pins.forEach(pin => {
                const isConnected = this.sim.wires.some(wire =>
                    wire.from === pin || wire.to === pin
                );

                if (!isConnected) {
                    this.validationResults.warnings.push({
                        type: 'unconnected_pin',
                        severity: 'warning',
                        component: comp.id,
                        componentType: type,
                        message: `${type} (${comp.id})의 핀이 연결되지 않았습니다.`,
                        position: { x: parseFloat(comp.style.left), y: parseFloat(comp.style.top) }
                    });
                }
            });
        });
    }

    /**
     * 순환 참조 감지 (DFS 기반)
     */
    detectCycles() {
        const graph = this.buildDependencyGraph();
        const visited = new Set();
        const recursionStack = new Set();

        const dfs = (nodeId) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            const neighbors = graph.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) return true;
                } else if (recursionStack.has(neighbor)) {
                    // 순환 감지!
                    this.validationResults.errors.push({
                        type: 'cycle_detected',
                        severity: 'error',
                        message: `순환 참조가 감지되었습니다: ${nodeId} → ${neighbor}`,
                        components: [nodeId, neighbor]
                    });
                    return true;
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const nodeId of graph.keys()) {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        }
    }

    /**
     * 의존성 그래프 구축
     */
    buildDependencyGraph() {
        const graph = new Map();

        this.sim.components.forEach(comp => {
            graph.set(comp.id, []);
        });

        this.sim.wires.forEach(wire => {
            const fromComp = wire.from.closest('.component');
            const toComp = wire.to.closest('.component');

            if (fromComp && toComp) {
                const list = graph.get(fromComp.id) || [];
                list.push(toComp.id);
                graph.set(fromComp.id, list);
            }
        });

        return graph;
    }

    /**
     * 다중 드라이버 감지
     */
    detectMultipleDrivers() {
        const inputPins = new Map(); // pin -> [source components]

        this.sim.wires.forEach(wire => {
            const toPin = wire.to;
            const fromComp = wire.from.closest('.component');

            if (!inputPins.has(toPin)) {
                inputPins.set(toPin, []);
            }
            inputPins.get(toPin).push(fromComp.id);
        });

        inputPins.forEach((drivers, pin) => {
            if (drivers.length > 1) {
                const toComp = pin.closest('.component');
                this.validationResults.errors.push({
                    type: 'multiple_drivers',
                    severity: 'error',
                    message: `${toComp.id}의 입력 핀에 여러 출력이 연결되어 있습니다.`,
                    component: toComp.id,
                    drivers: drivers
                });
            }
        });
    }

    /**
     * 플로팅 신호 감지
     */
    detectFloatingSignals() {
        // 스위치나 클럭에 연결되지 않은 신호 경로
        const sourceComponents = this.sim.components.filter(c => {
            const type = c.getAttribute('data-type');
            return type === 'SWITCH' || type === 'CLOCK';
        });

        if (sourceComponents.length === 0 && this.sim.components.length > 0) {
            this.validationResults.warnings.push({
                type: 'no_signal_source',
                severity: 'warning',
                message: '회로에 신호 소스(스위치 또는 클럭)가 없습니다.'
            });
        }
    }

    /**
     * 2. 타이밍 분석
     */
    analyzeTimingPaths() {
        const paths = this.findAllPaths();
        let criticalPath = null;
        let maxDelay = 0;

        paths.forEach(path => {
            const delay = this.calculatePathDelay(path);
            if (delay > maxDelay) {
                maxDelay = delay;
                criticalPath = path;
            }
        });

        this.validationResults.timing = {
            criticalPath: criticalPath,
            maxDelay: maxDelay.toFixed(2) + ' ns',
            maxFrequency: maxDelay > 0 ? (1000 / maxDelay).toFixed(2) + ' MHz' : 'N/A',
            totalPaths: paths.length
        };

        if (maxDelay > 100) {
            this.validationResults.warnings.push({
                type: 'high_delay',
                severity: 'warning',
                message: `크리티컬 패스의 지연이 매우 큽니다 (${maxDelay.toFixed(2)} ns)`
            });
        }
    }

    /**
     * 모든 신호 경로 찾기
     */
    findAllPaths() {
        const paths = [];
        const sources = this.sim.components.filter(c =>
            c.getAttribute('data-type') === 'SWITCH' ||
            c.getAttribute('data-type') === 'CLOCK'
        );

        const sinks = this.sim.components.filter(c =>
            c.getAttribute('data-type') === 'LED'
        );

        sources.forEach(source => {
            sinks.forEach(sink => {
                const path = this.findPath(source.id, sink.id);
                if (path && path.length > 0) {
                    paths.push(path);
                }
            });
        });

        return paths;
    }

    /**
     * DFS로 경로 찾기
     */
    findPath(startId, endId) {
        const graph = this.buildDependencyGraph();
        const visited = new Set();
        const path = [];

        const dfs = (nodeId) => {
            if (nodeId === endId) {
                path.push(nodeId);
                return true;
            }

            visited.add(nodeId);
            const neighbors = graph.get(nodeId) || [];

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) {
                        path.push(nodeId);
                        return true;
                    }
                }
            }

            return false;
        };

        dfs(startId);
        return path.reverse();
    }

    /**
     * 경로의 총 지연 시간 계산
     */
    calculatePathDelay(path) {
        let totalDelay = 0;

        path.forEach(compId => {
            const comp = this.sim.components.find(c => c.id === compId);
            if (comp) {
                const type = comp.getAttribute('data-type');
                totalDelay += this.gateDelays[type] || 0;
            }
        });

        return totalDelay;
    }

    /**
     * 3. 전력 소비 계산
     */
    calculatePowerConsumption() {
        let staticPower = 0;
        let dynamicPower = 0;

        this.sim.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            const basePower = this.gatePower[type] || 0;

            // 정적 전력 (모든 게이트)
            staticPower += basePower * 0.1; // 10% 누설 전력

            // 동적 전력 (활성 게이트만)
            const value = comp.getAttribute('data-value');
            if (value === '1') {
                dynamicPower += basePower;
            }
        });

        const totalPower = staticPower + dynamicPower;

        this.validationResults.power = {
            static: staticPower.toFixed(2) + ' μW',
            dynamic: dynamicPower.toFixed(2) + ' μW',
            total: totalPower.toFixed(2) + ' μW',
            componentCount: this.sim.components.length
        };

        if (totalPower > 1000) {
            this.validationResults.warnings.push({
                type: 'high_power',
                severity: 'warning',
                message: `전력 소비가 높습니다 (${totalPower.toFixed(2)} μW). 최적화를 고려하세요.`
            });
        }
    }

    /**
     * 4. 최적화 제안
     */
    generateOptimizationSuggestions() {
        // 4.1 이중 NOT 게이트 감지
        this.detectDoubleInverters();

        // 4.2 사용되지 않는 컴포넌트 감지
        this.detectUnusedComponents();

        // 4.3 간소화 가능한 게이트 조합 감지
        this.detectSimplifiableGates();
    }

    /**
     * 이중 NOT 게이트 감지
     */
    detectDoubleInverters() {
        const graph = this.buildDependencyGraph();

        this.sim.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            if (type === 'NOT') {
                const children = graph.get(comp.id) || [];
                children.forEach(childId => {
                    const child = this.sim.components.find(c => c.id === childId);
                    if (child && child.getAttribute('data-type') === 'NOT') {
                        this.validationResults.suggestions.push({
                            type: 'double_inverter',
                            severity: 'suggestion',
                            message: `이중 NOT 게이트가 감지되었습니다. 제거하여 간소화할 수 있습니다.`,
                            components: [comp.id, childId]
                        });
                    }
                });
            }
        });
    }

    /**
     * 사용되지 않는 컴포넌트 감지
     */
    detectUnusedComponents() {
        this.sim.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            if (type === 'SWITCH' || type === 'CLOCK' || type === 'LED') return;

            const pins = comp.querySelectorAll('.pin');
            const hasConnection = Array.from(pins).some(pin =>
                this.sim.wires.some(wire => wire.from === pin || wire.to === pin)
            );

            if (!hasConnection) {
                this.validationResults.suggestions.push({
                    type: 'unused_component',
                    severity: 'suggestion',
                    message: `${type} (${comp.id})는 연결되지 않았습니다. 제거를 고려하세요.`,
                    component: comp.id
                });
            }
        });
    }

    /**
     * 간소화 가능한 게이트 조합 감지
     */
    detectSimplifiableGates() {
        // NAND + NAND = OR (드모르간의 법칙)
        // NOR + NOR = AND
        // 등의 패턴 감지 (간단한 예시)

        const graph = this.buildDependencyGraph();

        this.sim.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            if (type === 'NAND') {
                const children = graph.get(comp.id) || [];
                const nandChildren = children.filter(id => {
                    const child = this.sim.components.find(c => c.id === id);
                    return child && child.getAttribute('data-type') === 'NAND';
                });

                if (nandChildren.length > 0) {
                    this.validationResults.suggestions.push({
                        type: 'simplifiable_gates',
                        severity: 'suggestion',
                        message: `NAND 게이트 조합을 OR 게이트로 간소화할 수 있습니다.`,
                        components: [comp.id, ...nandChildren]
                    });
                }
            }
        });
    }

    /**
     * UI에 결과 표시
     */
    displayResults() {
        const panel = document.getElementById('validation-panel');
        if (!panel) {
            console.warn('Validation panel not found');
            return;
        }

        const content = panel.querySelector('.validation-content');
        if (!content) return;

        // 통계 업데이트
        if (window.updateValidationStats) {
            window.updateValidationStats(this.validationResults);
        }

        let html = '';

        // 오류
        if (this.validationResults.errors.length > 0) {
            html += '<div class="validation-section error-section">';
            html += '<h3>❌ 오류 (' + this.validationResults.errors.length + ')</h3>';
            this.validationResults.errors.forEach(err => {
                html += `<div class="validation-item error" onclick="sim.validator.highlightIssue('${err.component || ''}')">`;
                html += `<div class="item-message">${err.message}</div>`;
                html += '</div>';
            });
            html += '</div>';
        }

        // 경고
        if (this.validationResults.warnings.length > 0) {
            html += '<div class="validation-section warning-section">';
            html += '<h3>⚠️ 경고 (' + this.validationResults.warnings.length + ')</h3>';
            this.validationResults.warnings.forEach(warn => {
                html += `<div class="validation-item warning" onclick="sim.validator.highlightIssue('${warn.component || ''}')">`;
                html += `<div class="item-message">${warn.message}</div>`;
                html += '</div>';
            });
            html += '</div>';
        }

        // 타이밍 분석
        if (this.validationResults.timing) {
            const timing = this.validationResults.timing;
            html += '<div class="validation-section timing-section">';
            html += '<h3>⏱️ 타이밍 분석</h3>';
            html += `<div class="timing-info">`;
            html += `<div>최대 지연: <strong>${timing.maxDelay}</strong></div>`;
            html += `<div>최대 주파수: <strong>${timing.maxFrequency}</strong></div>`;
            html += `<div>총 경로 수: <strong>${timing.totalPaths}</strong></div>`;
            html += `</div>`;
            html += '</div>';
        }

        // 전력 소비
        if (this.validationResults.power) {
            const power = this.validationResults.power;
            html += '<div class="validation-section power-section">';
            html += '<h3>⚡ 전력 소비</h3>';
            html += `<div class="power-info">`;
            html += `<div>정적 전력: <strong>${power.static}</strong></div>`;
            html += `<div>동적 전력: <strong>${power.dynamic}</strong></div>`;
            html += `<div>총 전력: <strong>${power.total}</strong></div>`;
            html += `</div>`;
            html += '</div>';
        }

        // 최적화 제안
        if (this.validationResults.suggestions.length > 0) {
            html += '<div class="validation-section suggestion-section">';
            html += '<h3>💡 최적화 제안 (' + this.validationResults.suggestions.length + ')</h3>';
            this.validationResults.suggestions.forEach(sug => {
                html += `<div class="validation-item suggestion" onclick="sim.validator.highlightIssue('${sug.component || sug.components?.[0] || ''}')">`;
                html += `<div class="item-message">${sug.message}</div>`;
                html += '</div>';
            });
            html += '</div>';
        }

        if (html === '') {
            html = '<div class="validation-success">✅ 회로가 정상입니다!</div>';
        }

        content.innerHTML = html;

        // 패널 표시
        panel.classList.add('show');
    }

    /**
     * 문제 컴포넌트 하이라이트
     */
    highlightIssue(componentId) {
        if (!componentId) return;

        const comp = this.sim.components.find(c => c.id === componentId);
        if (comp) {
            // 기존 선택 해제
            this.sim.components.forEach(c => c.classList.remove('highlighted-issue'));

            // 하이라이트
            comp.classList.add('highlighted-issue');

            // 화면으로 이동
            const x = parseFloat(comp.style.left);
            const y = parseFloat(comp.style.top);

            // 중앙으로 이동 (panTo 함수가 있다면)
            if (this.sim.panTo) {
                this.sim.panTo(x, y);
            }

            // 3초 후 하이라이트 제거
            setTimeout(() => {
                comp.classList.remove('highlighted-issue');
            }, 3000);
        }
    }

    /**
     * 패널 토글
     */
    togglePanel() {
        const panel = document.getElementById('validation-panel');
        if (panel) {
            panel.classList.toggle('show');
        }
    }
}

// 전역에 등록
window.CircuitValidator = CircuitValidator;
