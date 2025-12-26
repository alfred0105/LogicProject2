/**
 * 모듈: 시뮬레이션 및 로직 연산 엔진
 */
Object.assign(CircuitSimulator.prototype, {
    toggleSwitch(e, el) {
        if (this.mode !== 'edit') return;
        // 선택 여부와 상관없이 즉시 토글되도록 수정

        const current = el.getAttribute('data-value');
        const next = current === '1' ? '0' : '1';
        el.setAttribute('data-value', next);

        const label = el.querySelector('.comp-label');
        if (label) label.innerText = next === '1' ? 'ON' : 'OFF';

        if (next === '1') {
            el.style.color = '#4ade80';
        } else {
            el.style.color = '';
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
                    c.style.color = '';
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

            clk.style.background = next === '1' ? '#9b59b6' : '#8e44ad';
            clk.style.boxShadow = next === '1' ? '0 0 10px #9b59b6' : '3px 3px 10px rgba(0,0,0,0.2)';
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

    updateCircuit() {
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
                led.style.boxShadow = `0 0 15px ${led.getAttribute('data-color') || 'red'}`;
            } else {
                led.classList.remove('led-on');
                led.style.boxShadow = 'none';
            }
        });
    },

    evaluateComposite(comp) {
        if (!comp.internals) return;
        for (let i = 0; i < 5; i++) {
            this.propagateList(comp.internals.components, comp.internals.wires);
            this.propagate(comp.internals.wires);
        }
    },

    propagateList(components, wires = this.wires) {
        let changed = false;
        components.forEach(comp => {
            const type = comp.getAttribute('data-type');
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
                case 'PACKAGE':
                    this.evaluateComposite(comp);
                    return;
            }

            if (res !== currentVal) {
                comp.setAttribute('data-value', res ? '1' : '0');
                changed = true;
            }
        });
        return changed;
    },

    propagate(wireList = this.wires) {
        let changed = false;
        wireList.forEach(wire => {
            const fromPin = wire.from;
            const toPin = wire.to;

            let signal = false;
            const fromComp = fromPin.parentElement;

            if (fromComp) {
                const type = fromComp.getAttribute('data-type');
                let val = fromComp.getAttribute('data-value');

                if (type === 'SWITCH' && !val) val = '0';

                const isHigh = val === '1';

                if (fromPin.classList.contains('emit')) {
                    signal = isHigh;
                } else if (fromPin.classList.contains('output')) {
                    signal = isHigh;
                } else if (fromPin.classList.contains('joint-pin') || type === 'JOINT') {
                    // [FIX] JOINT support
                    signal = isHigh;
                }
            }

            const currentSignal = toPin.getAttribute('data-signal') === '1';

            // 데이터 업데이트
            if (signal !== currentSignal) {
                toPin.setAttribute('data-signal', signal ? '1' : '0');
                changed = true;
            }

            // [VISUALIZATION FIX] Use CSS classes for animation
            if (signal) {
                wire.line.classList.add('active-flow');
                wire.line.style.stroke = '';
                wire.line.style.strokeWidth = '';
                wire.line.style.strokeDasharray = '';
                // Force Reflow
                void wire.line.offsetWidth;
            } else {
                wire.line.classList.remove('active-flow');
                // Reset to default inline styles if needed, or rely on CSS default
                wire.line.style.stroke = '#555555';
                wire.line.style.strokeWidth = '3px';
                wire.line.style.strokeDasharray = 'none';
            }
        });
        return changed;
    }
});
