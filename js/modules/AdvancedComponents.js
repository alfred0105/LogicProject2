/**
 * 모듈: 고급 컴포넌트 (7-Segment, RAM, 키패드 등)
 * 교육용 시뮬레이터를 위한 확장 컴포넌트
 */
Object.assign(CircuitSimulator.prototype, {

    /**
     * 7-Segment 디스플레이 추가
     * 4비트 BCD 입력 (D0~D3) + 소수점 입력 (DP)
     * 내장 BCD-to-7Segment 디코더
     */
    add7SegmentDisplay(x = null, y = null) {
        const scale = this.scale || 1.0;
        const panX = this.panX || 0;
        const panY = this.panY || 0;
        const spawnX = x !== null ? x : (-panX + 300) / scale;
        const spawnY = y !== null ? y : (-panY + 200) / scale;

        const el = document.createElement('div');
        el.className = 'component advanced-comp seven-segment-display';
        el.id = 'seg7_' + Date.now() + Math.random().toString(36).substr(2, 5);
        el.setAttribute('data-type', 'SEVEN_SEGMENT');
        el.setAttribute('data-value', '0');  // 현재 표시 값 (0-15)

        el.style.cssText = `
            position: absolute;
            left: ${spawnX}px;
            top: ${spawnY}px;
            width: 80px;
            height: 120px;
            background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
            border: 3px solid #0f3460;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1);
            cursor: move;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 8px;
        `;

        // 7-Segment 디스플레이 SVG
        const segmentSVG = this.create7SegmentSVG();
        el.appendChild(segmentSVG);

        // 라벨
        const label = document.createElement('div');
        label.className = 'comp-label';
        label.textContent = '7-SEG';
        label.style.cssText = `
            position: absolute;
            bottom: 4px;
            font-size: 9px;
            color: rgba(255,255,255,0.6);
            font-weight: 600;
        `;
        el.appendChild(label);

        // 입력 핀 (4비트 BCD + DP)
        const pinLabels = ['D0', 'D1', 'D2', 'D3', 'DP'];
        const pinSpacing = 100 / (pinLabels.length + 1);

        pinLabels.forEach((pinLabel, i) => {
            const topPos = pinSpacing * (i + 1);
            this.addPin(el, `in-${i + 1}`, `input left`, topPos);

            // 핀 라벨
            const lbl = document.createElement('span');
            lbl.className = 'pin-label left';
            lbl.textContent = pinLabel;
            lbl.style.cssText = `
                position: absolute;
                left: 10px;
                top: ${topPos}px;
                transform: translateY(-50%);
                font-size: 8px;
                color: rgba(255,255,255,0.7);
            `;
            el.appendChild(lbl);
        });

        // 이벤트
        el.onmousedown = (e) => this.handleComponentMouseDown(e, el);
        el.onmouseenter = () => this.showTooltip('7-Segment Display',
            '4비트 BCD 입력을 받아 0~9 숫자를 표시합니다.\nD0(LSB)~D3(MSB)에 이진수를 입력하세요.');
        el.onmouseleave = () => this.hideTooltip();
        el.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectComponent(el, false);
            this.showContextMenu(e.clientX, e.clientY);
        };

        if (this.workspace) {
            this.workspace.appendChild(el);
            this.components.push(el);
        }

        this.saveState();
        return el;
    },

    /**
     * 7-Segment SVG 생성
     * 각 세그먼트는 개별 path로 제어 가능
     */
    create7SegmentSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 60 100');
        svg.setAttribute('width', '60');
        svg.setAttribute('height', '85');
        svg.classList.add('segment-display');
        svg.style.cssText = 'filter: drop-shadow(0 0 8px rgba(255, 50, 50, 0.3));';

        // 세그먼트 정의 (a~g, dp)
        // 위치와 모양을 정교하게 설정
        const segments = {
            a: 'M 12 8 L 48 8 L 44 14 L 16 14 Z',      // 상단 가로
            b: 'M 50 10 L 54 14 L 50 48 L 46 44 L 46 14 Z',  // 우상단 세로
            c: 'M 50 52 L 54 56 L 50 90 L 46 86 L 46 56 Z',  // 우하단 세로
            d: 'M 12 92 L 48 92 L 44 86 L 16 86 Z',   // 하단 가로
            e: 'M 10 52 L 14 56 L 14 86 L 10 90 L 6 86 Z',   // 좌하단 세로
            f: 'M 10 10 L 14 14 L 14 44 L 10 48 L 6 44 Z',   // 좌상단 세로
            g: 'M 12 50 L 16 46 L 44 46 L 48 50 L 44 54 L 16 54 Z',  // 중앙 가로
            dp: 'M 56 88 A 4 4 0 1 1 56 89 Z' // 소수점
        };

        // 세그먼트 생성
        Object.entries(segments).forEach(([id, d]) => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('data-segment', id);
            path.classList.add('segment', 'segment-off');
            path.style.cssText = `
                fill: #2a2a3e;
                stroke: rgba(0,0,0,0.3);
                stroke-width: 0.5;
                transition: fill 0.08s ease, filter 0.08s ease;
            `;
            svg.appendChild(path);
        });

        return svg;
    },

    /**
     * 7-Segment 디스플레이 업데이트
     * BCD 입력에 따라 세그먼트 on/off
     */
    update7SegmentDisplay(comp) {
        if (!comp || comp.getAttribute('data-type') !== 'SEVEN_SEGMENT') return;

        // 입력 핀 읽기 (D0~D3, DP)
        const d0 = comp.querySelector('.in-1')?.getAttribute('data-signal') === '1' ? 1 : 0;
        const d1 = comp.querySelector('.in-2')?.getAttribute('data-signal') === '1' ? 2 : 0;
        const d2 = comp.querySelector('.in-3')?.getAttribute('data-signal') === '1' ? 4 : 0;
        const d3 = comp.querySelector('.in-4')?.getAttribute('data-signal') === '1' ? 8 : 0;
        const dp = comp.querySelector('.in-5')?.getAttribute('data-signal') === '1';

        const value = d0 + d1 + d2 + d3;
        comp.setAttribute('data-value', value.toString());

        // BCD to 7-Segment 디코딩 테이블
        // 각 숫자에서 켜져야 할 세그먼트 (a, b, c, d, e, f, g)
        const segmentMap = {
            0: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0 },
            1: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
            2: { a: 1, b: 1, c: 0, d: 1, e: 1, f: 0, g: 1 },
            3: { a: 1, b: 1, c: 1, d: 1, e: 0, f: 0, g: 1 },
            4: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 1, g: 1 },
            5: { a: 1, b: 0, c: 1, d: 1, e: 0, f: 1, g: 1 },
            6: { a: 1, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 },
            7: { a: 1, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
            8: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 },
            9: { a: 1, b: 1, c: 1, d: 1, e: 0, f: 1, g: 1 },
            10: { a: 1, b: 1, c: 1, d: 0, e: 1, f: 1, g: 1 }, // A
            11: { a: 0, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 }, // b
            12: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 0 }, // C
            13: { a: 0, b: 1, c: 1, d: 1, e: 1, f: 0, g: 1 }, // d
            14: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 1 }, // E
            15: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 1, g: 1 }  // F
        };

        const svg = comp.querySelector('.segment-display');
        if (!svg) return;

        const segments = segmentMap[value] || segmentMap[0];
        const onColor = '#ff3030';  // 빨간색 LED
        const offColor = '#2a2a3e';
        const glowFilter = 'drop-shadow(0 0 6px #ff3030) drop-shadow(0 0 12px #ff5050)';

        // 세그먼트 업데이트
        Object.entries(segments).forEach(([seg, isOn]) => {
            const path = svg.querySelector(`[data-segment="${seg}"]`);
            if (path) {
                if (isOn) {
                    path.style.fill = onColor;
                    path.style.filter = glowFilter;
                    path.classList.remove('segment-off');
                    path.classList.add('segment-on');
                } else {
                    path.style.fill = offColor;
                    path.style.filter = 'none';
                    path.classList.remove('segment-on');
                    path.classList.add('segment-off');
                }
            }
        });

        // 소수점 업데이트
        const dpPath = svg.querySelector('[data-segment="dp"]');
        if (dpPath) {
            if (dp) {
                dpPath.style.fill = onColor;
                dpPath.style.filter = glowFilter;
            } else {
                dpPath.style.fill = offColor;
                dpPath.style.filter = 'none';
            }
        }
    },

    /**
     * 4비트 카운터 추가 (7-Segment 테스트용)
     * Clock 입력을 받아 0~15를 순환
     */
    add4BitCounter(x = null, y = null) {
        const scale = this.scale || 1.0;
        const panX = this.panX || 0;
        const panY = this.panY || 0;
        const spawnX = x !== null ? x : (-panX + 300) / scale;
        const spawnY = y !== null ? y : (-panY + 200) / scale;

        const el = document.createElement('div');
        el.className = 'component advanced-comp counter-4bit';
        el.id = 'cnt4_' + Date.now() + Math.random().toString(36).substr(2, 5);
        el.setAttribute('data-type', 'COUNTER_4BIT');
        el.setAttribute('data-value', '0');
        el.setAttribute('data-prev-clk', '0');  // 에지 감지용

        el.style.cssText = `
            position: absolute;
            left: ${spawnX}px;
            top: ${spawnY}px;
            width: 100px;
            height: 90px;
            background: linear-gradient(135deg, #4a0080 0%, #2d0050 100%);
            border: 2px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(74, 0, 128, 0.4);
            cursor: move;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        // 현재 값 표시
        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'counter-value';
        valueDisplay.textContent = '0';
        valueDisplay.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            color: #00ff88;
            font-family: 'Consolas', 'Monaco', monospace;
            text-shadow: 0 0 10px #00ff88;
        `;
        el.appendChild(valueDisplay);

        // 라벨
        const label = document.createElement('div');
        label.className = 'comp-label';
        label.textContent = '4-BIT CNT';
        label.style.cssText = `
            position: absolute;
            bottom: 4px;
            font-size: 9px;
            color: rgba(255,255,255,0.7);
        `;
        el.appendChild(label);

        // 입력 핀: CLK, RST
        const inputs = [
            { name: 'CLK', top: 30 },
            { name: 'RST', top: 60 }
        ];
        inputs.forEach((input, i) => {
            this.addPin(el, `in-${i + 1}`, `input left`, input.top);
            const lbl = document.createElement('span');
            lbl.className = 'pin-label left';
            lbl.textContent = input.name;
            lbl.style.cssText = `
                position: absolute;
                left: 10px;
                top: ${input.top}px;
                transform: translateY(-50%);
                font-size: 8px;
                color: rgba(255,255,255,0.7);
            `;
            el.appendChild(lbl);
        });

        // 출력 핀: Q0, Q1, Q2, Q3
        const outputs = ['Q0', 'Q1', 'Q2', 'Q3'];
        const outSpacing = 70 / (outputs.length + 1);
        outputs.forEach((output, i) => {
            const topPos = 15 + outSpacing * (i + 1);
            this.addPin(el, `out-${i + 1}`, `output right`, topPos);
            const lbl = document.createElement('span');
            lbl.className = 'pin-label right';
            lbl.textContent = output;
            lbl.style.cssText = `
                position: absolute;
                right: 10px;
                top: ${topPos}px;
                transform: translateY(-50%);
                font-size: 8px;
                color: rgba(255,255,255,0.7);
            `;
            el.appendChild(lbl);
        });

        el.onmousedown = (e) => this.handleComponentMouseDown(e, el);
        el.onmouseenter = () => this.showTooltip('4-Bit Counter',
            'CLK 상승 엣지에서 0~15를 순환합니다.\nRST=1이면 0으로 리셋됩니다.');
        el.onmouseleave = () => this.hideTooltip();

        if (this.workspace) {
            this.workspace.appendChild(el);
            this.components.push(el);
        }

        this.saveState();
        return el;
    },

    /**
     * 4비트 카운터 업데이트
     */
    update4BitCounter(comp) {
        if (!comp || comp.getAttribute('data-type') !== 'COUNTER_4BIT') return;

        const clk = comp.querySelector('.in-1')?.getAttribute('data-signal') === '1';
        const rst = comp.querySelector('.in-2')?.getAttribute('data-signal') === '1';
        const prevClk = comp.getAttribute('data-prev-clk') === '1';
        let value = parseInt(comp.getAttribute('data-value')) || 0;

        // 리셋
        if (rst) {
            value = 0;
        }
        // 상승 에지 감지
        else if (clk && !prevClk) {
            value = (value + 1) % 16;
        }

        comp.setAttribute('data-prev-clk', clk ? '1' : '0');
        comp.setAttribute('data-value', value.toString());

        // 표시 업데이트
        const display = comp.querySelector('.counter-value');
        if (display) {
            display.textContent = value.toString();
        }

        // 출력 핀 업데이트
        for (let i = 0; i < 4; i++) {
            const pin = comp.querySelector(`.out-${i + 1}`);
            if (pin) {
                const bitValue = (value >> i) & 1;
                pin.setAttribute('data-output-signal', bitValue ? '1' : '0');
            }
        }
    },

    /**
     * 키패드 추가 (4x4 16키)
     * 출력: 4비트 이진수 + 키 눌림 신호
     */
    add4x4Keypad(x = null, y = null) {
        const scale = this.scale || 1.0;
        const panX = this.panX || 0;
        const panY = this.panY || 0;
        const spawnX = x !== null ? x : (-panX + 300) / scale;
        const spawnY = y !== null ? y : (-panY + 200) / scale;

        const el = document.createElement('div');
        el.className = 'component advanced-comp keypad-4x4';
        el.id = 'kpd_' + Date.now() + Math.random().toString(36).substr(2, 5);
        el.setAttribute('data-type', 'KEYPAD_4X4');
        el.setAttribute('data-value', '0');
        el.setAttribute('data-pressed', '0');  // 현재 눌린 키 (없으면 0)

        el.style.cssText = `
            position: absolute;
            left: ${spawnX}px;
            top: ${spawnY}px;
            width: 140px;
            height: 160px;
            background: linear-gradient(180deg, #2c3e50 0%, #1a252f 100%);
            border: 3px solid #34495e;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            cursor: move;
            padding: 10px;
        `;

        // 키패드 그리드
        const grid = document.createElement('div');
        grid.className = 'keypad-grid';
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
            width: 100%;
            height: calc(100% - 30px);
        `;

        const keys = [
            '7', '8', '9', 'F',
            '4', '5', '6', 'E',
            '1', '2', '3', 'D',
            'A', '0', 'B', 'C'
        ];

        keys.forEach((key, i) => {
            const btn = document.createElement('button');
            btn.className = 'keypad-key';
            btn.textContent = key;
            btn.setAttribute('data-key-value', key === 'A' ? '10' :
                key === 'B' ? '11' :
                    key === 'C' ? '12' :
                        key === 'D' ? '13' :
                            key === 'E' ? '14' :
                                key === 'F' ? '15' : key);
            btn.style.cssText = `
                background: linear-gradient(180deg, #4a5568 0%, #2d3748 100%);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 6px;
                color: white;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.1s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;

            btn.onmousedown = (e) => {
                e.stopPropagation();
                const value = parseInt(btn.getAttribute('data-key-value'));
                el.setAttribute('data-value', value.toString());
                el.setAttribute('data-pressed', '1');
                btn.style.transform = 'scale(0.95)';
                btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';
                this.updateCircuit();
            };

            btn.onmouseup = btn.onmouseleave = () => {
                el.setAttribute('data-pressed', '0');
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
                this.updateCircuit();
            };

            grid.appendChild(btn);
        });

        el.appendChild(grid);

        // 라벨
        const label = document.createElement('div');
        label.className = 'comp-label';
        label.textContent = '4×4 KEYPAD';
        label.style.cssText = `
            position: absolute;
            bottom: 4px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            color: rgba(255,255,255,0.6);
        `;
        el.appendChild(label);

        // 출력 핀: D0~D3 (4비트), KEY (키 눌림 신호)
        const outputs = ['D0', 'D1', 'D2', 'D3', 'KEY'];
        const outSpacing = 140 / (outputs.length + 1);
        outputs.forEach((output, i) => {
            const topPos = outSpacing * (i + 1);
            this.addPin(el, `out-${i + 1}`, `output right`, topPos);
            const lbl = document.createElement('span');
            lbl.className = 'pin-label right';
            lbl.textContent = output;
            lbl.style.cssText = `
                position: absolute;
                right: 8px;
                top: ${topPos}px;
                transform: translateY(-50%);
                font-size: 8px;
                color: rgba(255,255,255,0.7);
            `;
            el.appendChild(lbl);
        });

        el.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectComponent(el, false);
            this.showContextMenu(e.clientX, e.clientY);
        };

        el.onmouseenter = () => this.showTooltip('4×4 Keypad',
            '0~9, A~F 키를 제공합니다.\n키를 누르면 4비트 이진 출력과 KEY 신호를 생성합니다.');
        el.onmouseleave = () => this.hideTooltip();

        // 드래그는 키패드 외부 영역에서만
        el.addEventListener('mousedown', (e) => {
            if (!e.target.classList.contains('keypad-key')) {
                this.handleComponentMouseDown(e, el);
            }
        });

        if (this.workspace) {
            this.workspace.appendChild(el);
            this.components.push(el);
        }

        this.saveState();
        return el;
    },

    /**
     * 키패드 업데이트
     */
    updateKeypad(comp) {
        if (!comp || comp.getAttribute('data-type') !== 'KEYPAD_4X4') return;

        const value = parseInt(comp.getAttribute('data-value')) || 0;
        const pressed = comp.getAttribute('data-pressed') === '1';

        // 출력 핀 업데이트 (D0~D3)
        for (let i = 0; i < 4; i++) {
            const pin = comp.querySelector(`.out-${i + 1}`);
            if (pin) {
                const bitValue = pressed ? ((value >> i) & 1) : 0;
                pin.setAttribute('data-output-signal', bitValue ? '1' : '0');
            }
        }

        // KEY 신호
        const keyPin = comp.querySelector('.out-5');
        if (keyPin) {
            keyPin.setAttribute('data-output-signal', pressed ? '1' : '0');
        }
    },

    /**
     * 고급 컴포넌트 시뮬레이션 업데이트
     * 메인 updateCircuit에서 호출
     */
    updateAdvancedComponents() {
        this.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            switch (type) {
                case 'SEVEN_SEGMENT':
                    this.update7SegmentDisplay(comp);
                    break;
                case 'COUNTER_4BIT':
                    this.update4BitCounter(comp);
                    break;
                case 'KEYPAD_4X4':
                    this.updateKeypad(comp);
                    break;
            }
        });
    }
});

// CSS 스타일 추가
const advancedComponentStyles = document.createElement('style');
advancedComponentStyles.textContent = `
    /* 7-Segment 디스플레이 스타일 */
    .seven-segment-display .segment-on {
        fill: #ff3030 !important;
        filter: drop-shadow(0 0 6px #ff3030) drop-shadow(0 0 12px #ff5050);
    }

    .seven-segment-display .segment-off {
        fill: #2a2a3e;
    }

    /* 4비트 카운터 스타일 */
    .counter-4bit .counter-value {
        transition: all 0.1s ease;
    }

    /* 키패드 스타일 */
    .keypad-4x4 .keypad-key:hover {
        background: linear-gradient(180deg, #5a6578 0%, #3d4758 100%);
    }

    .keypad-4x4 .keypad-key:active {
        background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
        transform: scale(0.95);
    }

    /* 핀 라벨 스타일 */
    .advanced-comp .pin-label {
        pointer-events: none;
        white-space: nowrap;
    }

    .advanced-comp .pin-label.left {
        text-align: left;
    }

    .advanced-comp .pin-label.right {
        text-align: right;
    }
`;
document.head.appendChild(advancedComponentStyles);

console.log('[AdvancedComponents] 7-Segment, 4-bit Counter, Keypad loaded');
