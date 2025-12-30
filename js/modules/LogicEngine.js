/**
 * 모듈: 시뮬레이션 및 로직 연산 엔진
 */
Object.assign(CircuitSimulator.prototype, {
    toggleSwitch(e, el) {
        // [수정] 읽기 전용 모드에서도 스위치 토글 허용 (인터랙티브 미리보기)
        // pan 모드일 때만 차단하되, 읽기 전용 모드에서는 예외 허용
        if (this.mode === 'pan' && !window.isReadOnlyMode) return;
        // 선택 여부와 상관없이 즉시 토글되도록 수정

        const current = el.getAttribute('data-value');
        const next = current === '1' ? '0' : '1';
        el.setAttribute('data-value', next);

        const label = el.querySelector('.comp-label');
        if (label) label.innerText = next === '1' ? 'ON' : 'OFF';

        // [FIX] 인라인 스타일 대신 클래스 토글 (SVG 충돌 방지)
        if (next === '1') {
            el.classList.add('switch-on');
        } else {
            el.classList.remove('switch-on');
        }
        this.updateCircuit();
    },

    toggleSimulation() {
        if (this.isRunning === undefined) this.isRunning = true;
        this.isRunning = !this.isRunning;

        const btn = document.getElementById('btn-run');
        if (btn) {
            if (this.isRunning) {
                // 일시정지 아이콘으로 변경
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                        <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
                    </svg>
                    <span class="btn-text">일시정지</span>
                `;
            } else {
                // 재생 아이콘으로 변경
                btn.innerHTML = `
                    <svg>
                        <use href="#icon-play" />
                    </svg>
                    <span class="btn-text">실행</span>
                `;
            }
            btn.classList.toggle('active', this.isRunning);
        }
        this.showToast(this.isRunning ? '시뮬레이션 시작' : '시뮬레이션 일시정지', 'info');
    },

    stepSimulation() {
        this.doClockTick();
        this.showToast('1 스텝 실행', 'info');
    },

    resetSimulation() {
        this.components.forEach(c => {
            const type = c.getAttribute('data-type');
            if (type !== 'VCC' && type !== 'GND') {
                c.setAttribute('data-value', '0');
                if (type === 'SWITCH') {
                    const label = c.querySelector('.comp-label');
                    if (label) label.innerText = 'OFF';
                    c.classList.remove('switch-on');
                }
            } else if (type === 'VCC') {
                c.setAttribute('data-value', '1');
            }
        });
        this.updateCircuit();
        this.showToast('시뮬레이션 초기화', 'info');
    },

    clockTick() {
        if (this.isRunning === false) return;
        this.doClockTick();
    },

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
    },

    restoreInternals(parentComp, data) {
        parentComp.internals = { components: [], wires: [] };
        const idMap = {};
        data.components.forEach(part => {
            const el = document.createElement('div');
            el.classList.add('component');
            el.id = part.id;
            el.setAttribute('data-type', part.type);
            el.setAttribute('data-value', part.value || '0');
            el.style.left = part.x + 'px';
            el.style.top = part.y + 'px';
            const label = document.createElement('div');
            label.classList.add('comp-label');
            label.innerText = part.label || part.type;
            el.appendChild(label);

            const type = part.type;
            if (type === 'TRANSISTOR' || type === 'PMOS') {
                this.addPin(el, 'base', 'input base');
                this.addPin(el, 'col', 'input col');
                this.addPin(el, 'emit', 'output emit');
            } else if (type === 'VCC' || type === 'GND' || type === 'PORT_IN') {
                this.addPin(el, 'out', 'output center');
            } else if (type === 'PORT_OUT') {
                this.addPin(el, 'in', 'input center');
            }

            idMap[part.id] = el;
            parentComp.internals.components.push(el);
        });
        data.wires.forEach(wData => {
            const fromComp = idMap[wData.fromCompId];
            const toComp = idMap[wData.toCompId];
            if (fromComp && toComp) {
                const fromPin = fromComp.querySelector(`.${wData.fromPinClass}`);
                const toPin = toComp.querySelector(`.${wData.toPinClass}`);
                if (fromPin && toPin) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    parentComp.internals.wires.push({ from: fromPin, to: toPin, line: line });
                }
            }
        });
    },

    /**
     * 사용자 정의 패키지의 내부 회로를 동적으로 빌드
     * 각 패키지 인스턴스가 독립적인 내부 상태를 가지도록 딥 클론 사용
     */
    buildUserPackageInternals(comp) {
        const pkgIndex = comp.getAttribute('data-package-id');
        if (pkgIndex === null || pkgIndex === undefined) return;

        const pkg = this.userPackages?.[parseInt(pkgIndex)];
        if (!pkg || !pkg.circuit) {
            console.warn('[buildUserPackageInternals] Package not found:', pkgIndex);
            return;
        }

        // [중요] 깊은 복사로 독립 인스턴스 생성 (공유 버그 방지)
        const circuitData = JSON.parse(JSON.stringify(pkg.circuit));

        comp.internals = { components: [], wires: [] };
        const idMap = {};

        // 내부 컴포넌트 생성
        circuitData.components.forEach(part => {
            const el = document.createElement('div');
            el.classList.add('component');
            // 고유 ID 생성 (부모 컴포넌트 ID + 내부 ID)
            el.id = comp.id + '_internal_' + part.id + '_' + Math.random().toString(36).substr(2, 5);
            el.setAttribute('data-type', part.type);
            el.setAttribute('data-value', part.value || '0');
            el.style.left = (part.x || 0) + 'px';
            el.style.top = (part.y || 0) + 'px';

            const label = document.createElement('div');
            label.classList.add('comp-label');
            label.innerText = part.label || part.type;
            el.appendChild(label);

            // 타입별 핀 추가
            const type = part.type;
            if (['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(type)) {
                this.addPin(el, 'in-1', 'input in-1');
                this.addPin(el, 'in-2', 'input in-2');
                this.addPin(el, 'out', 'output out');
            } else if (type === 'NOT') {
                this.addPin(el, 'in-1', 'input in-1');
                this.addPin(el, 'out', 'output out');
            } else if (type === 'TRANSISTOR' || type === 'PMOS') {
                this.addPin(el, 'base', 'input base');
                this.addPin(el, 'col', 'input col');
                this.addPin(el, 'emit', 'output emit');
            } else if (type === 'VCC') {
                el.setAttribute('data-value', '1');
                this.addPin(el, 'out', 'output center');
            } else if (type === 'GND') {
                el.setAttribute('data-value', '0');
                this.addPin(el, 'out', 'output center');
            } else if (type === 'PORT_IN') {
                this.addPin(el, 'out', 'output center');
            } else if (type === 'PORT_OUT') {
                this.addPin(el, 'in', 'input center');
            } else if (type === 'SWITCH') {
                this.addPin(el, 'out', 'output center');
            } else if (type === 'LED') {
                this.addPin(el, 'in', 'input center');
            } else if (type === 'JOINT') {
                this.addPin(el, 'p1', 'joint-pin');
            }

            idMap[part.id] = el;
            comp.internals.components.push(el);
        });

        // 내부 와이어 생성
        circuitData.wires.forEach(w => {
            let fromId, fromPinCls, toId, toPinCls;

            // 다양한 와이어 데이터 형식 지원
            if (w.from && w.fromPin) {
                fromId = w.from;
                fromPinCls = w.fromPin;
                toId = w.to;
                toPinCls = w.toPin;
            } else if (w.fromId && w.fromPin) {
                fromId = w.fromId;
                fromPinCls = w.fromPin;
                toId = w.toId;
                toPinCls = w.toPin;
            } else {
                return; // 알 수 없는 형식
            }

            const fromComp = idMap[fromId];
            const toComp = idMap[toId];

            if (fromComp && toComp) {
                // 핀 찾기 (여러 방식 시도)
                let fromPin = fromComp.querySelector(`.${fromPinCls}`);
                if (!fromPin) fromPin = fromComp.querySelector('.output, .out, .emit');

                let toPin = toComp.querySelector(`.${toPinCls}`);
                if (!toPin) toPin = toComp.querySelector('.input, .in, .in-1');

                if (fromPin && toPin) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    comp.internals.wires.push({ from: fromPin, to: toPin, line: line });
                }
            }
        });

        console.log(`[Package] Built internals for ${comp.id}: ${comp.internals.components.length} components, ${comp.internals.wires.length} wires`);
    },

    /**
     * 표준 패키지(HALF_ADDER, FULL_ADDER 등)의 내부 회로 빌드
     * PackageManager.addPackage에 정의된 회로 스키마를 사용
     */
    buildStandardPackageInternals(comp, type) {
        // 표준 패키지 정의 (PackageManager.addPackage의 pkgDefs와 동일)
        const pkgDefs = {
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

        const circuit = pkgDefs[type];
        if (!circuit) {
            console.warn('[buildStandardPackageInternals] Unknown package type:', type);
            return;
        }

        // buildInternals 호출하여 내부 회로 생성
        if (this.buildInternals) {
            this.buildInternals(comp, JSON.parse(JSON.stringify(circuit)));
        }

        console.log(`[Standard Package] Built internals for ${type}: ${comp.internals?.components?.length || 0} components`);
    },

    updateCircuit() {
        // 최적화된 엔진이 있으면 우선 사용 (PerformanceOptimizer.js)
        if (typeof this.updateCircuitOptimized === 'function') {
            this.updateCircuitOptimized();
            return;
        }

        // Fallback: 기본 DOM 기반 엔진
        let changed = false;
        let limit = 50;

        while (limit > 0) {
            let stepChanged = false;
            if (this.propagate()) stepChanged = true;
            if (this.propagateList(this.components)) stepChanged = true;

            if (!stepChanged) break;
            changed = true;
            limit--;
        }
        this.updateLEDs();
    },

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
    },

    evaluateComposite(comp) {
        if (!comp.internals || !comp.internals.components) return;

        // [Bridge Input] External Pin -> Internal PORT_IN
        // 핀 인덱스 기반 매핑 (in-1, in-2...) 우선, 없으면 Y 좌표 정렬
        const extInPins = Array.from(comp.querySelectorAll('.pin.input'));
        const intPortIns = comp.internals.components.filter(c => c.getAttribute('data-type') === 'PORT_IN');

        // 핀 인덱스 추출 함수
        const getInputIndex = (pin) => {
            const classes = Array.from(pin.classList);
            const match = classes.find(c => /^in-(\d+)$/.test(c));
            return match ? parseInt(match.match(/^in-(\d+)$/)[1]) : 999;
        };

        // 인덱스 기반 정렬 (인덱스가 없으면 Y 좌표로 정렬)
        extInPins.sort((a, b) => {
            const idxA = getInputIndex(a);
            const idxB = getInputIndex(b);
            if (idxA !== 999 || idxB !== 999) return idxA - idxB;
            return parseFloat(a.style.top || '0') - parseFloat(b.style.top || '0');
        });

        // 내부 PORT_IN은 라벨 기반 또는 Y 좌표 정렬
        intPortIns.sort((a, b) => parseFloat(a.style.top || '0') - parseFloat(b.style.top || '0'));

        // 외부 입력 신호 -> 내부 PORT_IN 전달
        for (let i = 0; i < Math.min(extInPins.length, intPortIns.length); i++) {
            const signal = extInPins[i].getAttribute('data-signal') === '1';
            intPortIns[i].setAttribute('data-value', signal ? '1' : '0');
        }

        // [Simulate Internals] 내부 회로 시뮬레이션 (반복하여 안정화)
        for (let i = 0; i < 15; i++) {  // 10 -> 15로 증가 (복잡한 회로 대응)
            this.propagateList(comp.internals.components, comp.internals.wires);
            this.propagate(comp.internals.wires);
        }

        // [Bridge Output] Internal PORT_OUT -> External Pin
        const extOutPins = Array.from(comp.querySelectorAll('.pin.output'));
        const intPortOuts = comp.internals.components.filter(c => c.getAttribute('data-type') === 'PORT_OUT');

        // 출력 핀 인덱스 추출 함수
        const getOutputIndex = (pin) => {
            const classes = Array.from(pin.classList);
            const match = classes.find(c => /^out-(\d+)$/.test(c));
            return match ? parseInt(match.match(/^out-(\d+)$/)[1]) : 999;
        };

        // 인덱스 기반 정렬
        extOutPins.sort((a, b) => {
            const idxA = getOutputIndex(a);
            const idxB = getOutputIndex(b);
            if (idxA !== 999 || idxB !== 999) return idxA - idxB;
            return parseFloat(a.style.top || '0') - parseFloat(b.style.top || '0');
        });

        intPortOuts.sort((a, b) => parseFloat(a.style.top || '0') - parseFloat(b.style.top || '0'));

        // 내부 PORT_OUT 결과 -> 외부 출력 핀으로 전파
        for (let i = 0; i < Math.min(extOutPins.length, intPortOuts.length); i++) {
            const inPin = intPortOuts[i].querySelector('.pin.input');
            const val = inPin?.getAttribute('data-signal') === '1';
            extOutPins[i].setAttribute('data-output-signal', val ? '1' : '0');
        }
    },

    propagateList(components, wires = this.wires) {
        let changed = false;

        // 표준 패키지 타입 목록
        const standardPackageTypes = ['HALF_ADDER', 'FULL_ADDER', 'SR_LATCH', 'D_FLIPFLOP'];

        components.forEach(comp => {
            const type = comp.getAttribute('data-type');

            // [FIX] Detect Package (Standard or Custom) and simulate internals
            const isPackage = type === 'PACKAGE' ||
                comp.classList.contains('package-comp') ||
                standardPackageTypes.includes(type);

            if (isPackage) {
                // 내부 회로가 없거나 비어 있으면 다시 빌드
                if (!comp.internals || !comp.internals.components || comp.internals.components.length === 0) {
                    // 사용자 패키지인 경우
                    if (type === 'PACKAGE' && comp.getAttribute('data-package-id') !== null) {
                        this.buildUserPackageInternals(comp);
                    }
                    // 표준 패키지인 경우 - buildInternals 호출
                    else if (standardPackageTypes.includes(type) && this.buildStandardPackageInternals) {
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
                // [FIX] JOINT Logic Added
                case 'JOINT':
                    const p1 = comp.querySelector('.pin');
                    if (p1 && p1.getAttribute('data-signal') === '1') {
                        res = true;
                    } else {
                        res = false;
                    }
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
                // [FIX] LED Logic Added - 입력 신호를 받으면 켜짐
                case 'LED':
                    const ledInput = comp.querySelector('.pin.input')?.getAttribute('data-signal') === '1';
                    res = ledInput;
                    break;
                // case 'PACKAGE' handled above
            }

            if (res !== currentVal) {
                comp.setAttribute('data-value', res ? '1' : '0');
                changed = true;
            }
        });
        return changed;
    },

    propagate(wireList = this.wires) {
        // [Hybrid Mode]
        // 내부 회로 시뮬레이션(wires 인자가 전달됨)이거나 NetManager가 없으면 레거시 모드 사용
        if (wireList !== this.wires || !this.sim?.netManager) {
            return this.propagateLegacy(wireList);
        }

        // Netlist 기반 시뮬레이션 (High Performance)
        return this.propagateNetlist();
    },

    /**
     * Netlist 기반 신호 전파 (O(N) -> O(1) 수준 최적화)
     */
    propagateNetlist() {
        let changed = false;
        const netManager = this.sim.netManager || this.netManager; // Access check

        if (!netManager) return false;

        // 모든 Net 순회
        netManager.nets.forEach(net => {
            // Wired-OR Logic: 하나의 Output이라도 High면 전체 Net이 High
            let isHigh = false;

            for (const pin of net.pins) {
                // 이 핀이 소스(Output) 역할을 하는지 확인하고 값 읽기
                if (this.isDrivingPin(pin)) {
                    if (this.getPinLevel(pin)) {
                        isHigh = true;
                        break; // 하나만 High여도 됨
                    }
                }
            }

            // [상태 동기화]
            // Net 상태가 변경되었거나, 핀들의 signal이 동기화되지 않았을 경우를 위해
            // 변경이 없더라도 한 번은 전파해야 함? -> 아니오, 변경 시에만 전파.
            // 단, 최초 로드 시 등에는 불일치할 수 있음.

            const newState = isHigh ? 1 : 0;
            if (net.state !== newState) {
                net.state = newState;
                changed = true;

                // 시각적 업데이트 (Net에 속한 모든 Wire)
                net.wires.forEach(wire => this.updateWireVisual(wire, isHigh));
            }

            // 모든 핀에게 신호 전파 (Input 핀들이 읽을 수 있게)
            // 최적화: 값이 다를 때만 setAttribute
            const signalStr = isHigh ? '1' : '0';
            net.pins.forEach(pin => {
                if (pin.getAttribute('data-signal') !== signalStr) {
                    pin.setAttribute('data-signal', signalStr);
                }
            });
        });

        return changed;
    },

    /**
     * 레거시 전파 로직 (Wire-by-Wire) - 패키지 내부 등에서 사용
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
    },

    /**
     * [Helper] 핀이 신호를 출력하는지 판단
     */
    isDrivingPin(pin) {
        // Output Pin Types
        if (pin.classList.contains('output')) return true;
        if (pin.classList.contains('emit')) return true; // Transistor Emitter (can be input too, but usually source in digital logic abstraction)
        if (pin.classList.contains('out')) return true;
        if (pin.classList.contains('joint-pin')) return true; // Joint는 양방향이지만, 값이 1이면 Driver가 됨

        // Package Output check
        const comp = pin.parentElement;
        if (comp && (comp.getAttribute('data-type') === 'PACKAGE' || comp.classList.contains('package-comp'))) {
            // Package의 Pin은 방향을 클래스로 구분하기 어려울 수 있음.
            // 하지만 보통 output 클래스가 붙어있음.
            // 안 붙어있다면? -> 여기서 추가 로직 필요하지만 일단 패스
        }

        return false;
    },

    /**
     * [Helper] 핀의 현재 논리 레벨(High/Low) 읽기
     */
    getPinLevel(pin) {
        const comp = pin.parentElement;
        if (!comp) return false;

        const type = comp.getAttribute('data-type');

        // 1. Package Output (Special handling)
        if (type === 'PACKAGE' || comp.classList.contains('package-comp')) {
            return pin.getAttribute('data-output-signal') === '1';
        }

        // 2. Component Value
        let val = comp.getAttribute('data-value');
        if (type === 'SWITCH' && !val) val = '0';
        const isCompHigh = val === '1';

        // 3. Pin Type Specifics
        if (pin.classList.contains('output') || pin.classList.contains('out')) {
            return isCompHigh;
        }
        if (pin.classList.contains('emit')) { // Transistor Emitter
            return isCompHigh;
        }
        if (pin.classList.contains('joint-pin') || type === 'JOINT') {
            // Joint는 data-value를 따르지 않고, 자신이 Input으로 받은 data-signal이 1이면 1임
            // 하지만 Netlist에서는 Joint 핀은 Driver가 아니라 그냥 Net의 일부임.
            // 문제는 Legacy 모드에서는 Joint가 Driver 역할을 할 수도 있음.
            // Netlist 모드에서는 이 부분이 무시되어야 함.
            // 하지만 isDrivingPin에서 true를 반환하므로 여기서 처리해야 함.

            // Netlist 모드에서 Joint 핀은 사실상 '투명'해야 함.
            // 하지만 Net에 전원을 공급하는 '진짜' Driver(VCC 등)가 없다면 Joint 혼자 High가 될 수 없음.
            // 따라서 false 리턴이 안전함. (Joint 자체는 전원 소스가 아님)
            return false;
        }

        return false;
    },

    /**
     * [Visual] 전선 애니메이션 및 스타일 업데이트
     */
    updateWireVisual(wire, isHigh) {
        if (!wire.line) return;

        if (isHigh) {
            // Animation Classes
            if (!wire.line.classList.contains('active-flow')) {
                wire.line.classList.add('active-flow');
                wire.line.style.stroke = '';
                wire.line.style.strokeWidth = '';
                wire.line.style.strokeDasharray = '';
                void wire.line.offsetWidth; // Force Reflow
            }
        } else {
            if (wire.line.classList.contains('active-flow')) {
                wire.line.classList.remove('active-flow');
                wire.line.style.stroke = '#555555';
                wire.line.style.strokeWidth = '3px';
                wire.line.style.strokeDasharray = 'none';
            }
        }

        // Hitbox는 업데이트 불필요 (투명함)
    }
});
