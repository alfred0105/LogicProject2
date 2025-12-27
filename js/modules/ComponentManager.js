/**
 * 모듈: 컴포넌트 생성 및 관리
 */
Object.assign(CircuitSimulator.prototype, {
    addModule(type, x = null, y = null, options = {}) {
        const { skipSave = false } = options;
        let el;
        // ... (existing logic)

        try {
            el = document.createElement('div');
            el.classList.add('component');
            el.id = 'comp_' + Date.now() + Math.random().toString(36).substr(2, 5);
            el.setAttribute('data-type', type);
            el.setAttribute('data-value', '0');

            // Expert Mode Properties
            el.setAttribute('data-delay', '10');
            el.setAttribute('data-transistors', this.getDefaultTransistors(type));

            // 위치 설정 - 겹침 방지를 위한 오프셋 추가
            if (!this._componentPlacementOffset) {
                this._componentPlacementOffset = 0;
            }

            let finalX, finalY;
            if (x !== null && y !== null) {
                // 명시적 좌표가 주어진 경우
                finalX = x;
                finalY = y;
            } else {
                // 기본 위치 + 오프셋 (겹침 방지)
                const baseX = (Math.abs(this.panX) + 150) / this.scale;
                const baseY = (Math.abs(this.panY) + 150) / this.scale;
                finalX = baseX + (this._componentPlacementOffset % 5) * 80;
                finalY = baseY + Math.floor(this._componentPlacementOffset / 5) * 60;
                this._componentPlacementOffset++;

                // 20개마다 초기화
                if (this._componentPlacementOffset >= 20) {
                    this._componentPlacementOffset = 0;
                }
            }

            el.style.left = finalX + 'px';
            el.style.top = finalY + 'px';

            // 이벤트 연결
            el.onmouseenter = () => this.showTooltip(type);
            el.onmouseleave = () => this.hideTooltip();
            el.onmousedown = (e) => this.handleComponentMouseDown(e, el);

            el.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (type === 'JOINT' && this.userMode === 'expert') {
                    const pin = el.querySelector('.pin');
                    if (pin) {
                        // 핀 클릭과 유사한 동작 (전선 연결 시작)
                        const rect = pin.getBoundingClientRect();
                        const mockEvent = {
                            stopPropagation: () => { },
                            preventDefault: () => { },
                            clientX: rect.left + rect.width / 2,
                            clientY: rect.top + rect.height / 2,
                            target: pin
                        };
                        this.handlePinClick(mockEvent, pin);
                        return;
                    }
                }

                if (!this.selectedComponents.includes(el)) {
                    this.selectComponent(el, false);
                }
                this.showContextMenu(e.clientX, e.clientY);
            };

            const label = document.createElement('div');
            label.classList.add('comp-label');
            el.appendChild(label);

            // SVG Symbols (복구됨)
            const symbols = {
                'AND': `<svg viewBox="0 0 72 48"><path d="M12 8 L36 8 A 16 20 0 0 1 36 40 L12 40 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="12" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="12" y2="32" stroke="currentColor" stroke-width="2"/><line x1="52" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
                'OR': `<svg viewBox="0 0 72 48"><path d="M8 8 Q 18 24 8 40 Q 32 40 52 24 Q 32 8 8 8 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="16" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="16" y2="32" stroke="currentColor" stroke-width="2"/><line x1="52" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
                'NOT': `<svg viewBox="0 0 56 40"><path d="M8 4 L40 20 L8 36 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="46" cy="20" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="20" x2="8" y2="20" stroke="currentColor" stroke-width="2"/><line x1="51" y1="20" x2="56" y2="20" stroke="currentColor" stroke-width="2"/></svg>`,
                'NAND': `<svg viewBox="0 0 72 48"><path d="M10 8 L30 8 A 16 20 0 0 1 30 40 L10 40 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="52" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="10" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="10" y2="32" stroke="currentColor" stroke-width="2"/><line x1="57" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
                'NOR': `<svg viewBox="0 0 72 48"><path d="M6 8 Q 16 24 6 40 Q 28 40 44 24 Q 28 8 6 8 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="52" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="14" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="14" y2="32" stroke="currentColor" stroke-width="2"/><line x1="57" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
                'XOR': `<svg viewBox="0 0 72 48"><path d="M14 8 Q 24 24 14 40 Q 36 40 54 24 Q 36 8 14 8 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6 8 Q 16 24 6 40" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="18" y2="32" stroke="currentColor" stroke-width="2"/><line x1="54" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
                'XNOR': `<svg viewBox="0 0 72 48"><path d="M14 8 Q 24 24 14 40 Q 34 40 48 24 Q 34 8 14 8 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6 8 Q 16 24 6 40" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="54" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="18" y2="32" stroke="currentColor" stroke-width="2"/><line x1="59" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
                'SWITCH': `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="3"/><line x1="22" y1="10" x2="22" y2="22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="22" x2="44" y2="22" stroke="currentColor" stroke-width="2"/></svg>`,
                'LED': `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="currentFill" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="4" y2="16" stroke="currentColor" stroke-width="2"/></svg>`,
                'CLOCK': `<svg viewBox="0 0 56 40"><rect x="4" y="6" width="48" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="10,26 10,14 18,14 18,26 26,26 26,14 34,14 34,26 42,26 42,14 46,14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="miter"/><line x1="52" y1="20" x2="56" y2="20" stroke="currentColor" stroke-width="2"/></svg>`,
                'JOINT': `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor" stroke="none"/></svg>`,
                'TRANSISTOR': `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" stroke-width="2"/><line x1="20" y1="16" x2="20" y2="40" stroke="currentColor" stroke-width="3"/><line x1="0" y1="28" x2="20" y2="28" stroke="currentColor" stroke-width="2"/><line x1="20" y1="22" x2="40" y2="10" stroke="currentColor" stroke-width="2"/><line x1="40" y1="10" x2="40" y2="0" stroke="currentColor" stroke-width="2"/><line x1="20" y1="34" x2="40" y2="46" stroke="currentColor" stroke-width="2"/><line x1="40" y1="46" x2="40" y2="56" stroke="currentColor" stroke-width="2"/><polygon points="34,42 40,46 36,48" fill="currentColor"/></svg>`,
                'PMOS': `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" stroke-width="2"/><line x1="20" y1="16" x2="20" y2="40" stroke="currentColor" stroke-width="3"/><line x1="0" y1="28" x2="14" y2="28" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="28" r="3" fill="none" stroke="currentColor" stroke-width="2"/><line x1="20" y1="22" x2="40" y2="10" stroke="currentColor" stroke-width="2"/><line x1="40" y1="10" x2="40" y2="0" stroke="currentColor" stroke-width="2"/><line x1="20" y1="34" x2="40" y2="46" stroke="currentColor" stroke-width="2"/><line x1="40" y1="46" x2="40" y2="56" stroke="currentColor" stroke-width="2"/></svg>`,
                // VCC: 화살표 오른쪽, 선 왼쪽, 핀은 왼쪽 (유지)
                'VCC': `<svg viewBox="0 0 44 40"><line x1="0" y1="20" x2="24" y2="20" stroke="currentColor" stroke-width="3"/><polygon points="40,20 24,10 24,30" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
                // GND: 선 왼쪽, 접지 심볼 오른쪽, 핀은 왼쪽 (수정됨)
                'GND': `<svg viewBox="0 0 44 40"><line x1="0" y1="20" x2="24" y2="20" stroke="currentColor" stroke-width="3"/><line x1="24" y1="6" x2="24" y2="34" stroke="currentColor" stroke-width="3"/><line x1="32" y1="10" x2="32" y2="30" stroke="currentColor" stroke-width="2.5"/><line x1="40" y1="14" x2="40" y2="26" stroke="currentColor" stroke-width="2"/></svg>`
            };

            // HTML 구조 생성 및 핀 추가
            if (['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'].includes(type)) {
                el.innerHTML = symbols[type];
                label.innerText = type; // [FIX] 라벨 텍스트 설정
                el.appendChild(label);
                this.addPin(el, 'in-1', 'input in-1');
                this.addPin(el, 'in-2', 'input in-2');
                this.addPin(el, 'out', 'output out');
            } else if (type === 'NOT') {
                el.innerHTML = symbols[type];
                label.innerText = 'NOT'; // 라벨 텍스트 추가
                el.appendChild(label);
                this.addPin(el, 'in-1', 'input center-in');
                this.addPin(el, 'out', 'output center-out');
            } else if (type === 'SWITCH') {
                el.innerHTML = symbols[type];
                label.innerText = 'OFF';
                el.appendChild(label);
                el.setAttribute('data-value', '0');

                // [FIX] 스위치 클릭 핸들러 - mousedown 없이 직접 처리
                el.addEventListener('click', (e) => {
                    // 핀 클릭은 제외
                    if (e.target.closest('.pin')) {
                        return;
                    }
                    // 드래그 중이면 무시 (dragTarget이 설정되어 있으면 드래그 중)
                    // click 이벤트는 mouseup 후에 발생하므로 dragTarget은 이미 null
                    // 따라서 _justDragged 플래그로 판단
                    if (this._justDragged) {
                        return;
                    }
                    e.stopPropagation();
                    this.toggleSwitch(e, el);
                });

                this.addPin(el, 'out', 'output center');
            } else if (type === 'LED') {
                el.innerHTML = symbols[type];
                el.setAttribute('data-color', 'red');
                label.innerText = '';
                el.appendChild(label);
                this.addPin(el, 'in-1', 'input center');
            } else if (type === 'CLOCK') {
                el.innerHTML = symbols[type];
                label.innerText = 'CLK';
                el.appendChild(label);
                el.classList.add('comp-clock');
                this.addPin(el, 'out', 'output center');
            } else if (type === 'VCC') {
                el.innerHTML = symbols[type];
                label.innerText = 'VCC';
                el.appendChild(label);
                el.setAttribute('data-value', '1');
                this.addPin(el, 'out', 'output vcc-left');  // 왼쪽 핀 (출력)
            } else if (type === 'GND') {
                el.innerHTML = symbols[type];
                label.innerText = 'GND';
                el.appendChild(label);
                el.setAttribute('data-value', '0');
                this.addPin(el, 'in', 'input gnd-left');  // 왼쪽 핀 (입력)
            } else if (type === 'TRANSISTOR') {
                el.innerHTML = symbols[type];
                label.innerText = 'NPN';
                el.appendChild(label);
                this.addPin(el, 'base', 'input base');
                this.addPin(el, 'col', 'input col');
                this.addPin(el, 'emit', 'output emit');
            } else if (type === 'PMOS') {
                el.innerHTML = symbols[type];
                label.innerText = 'PMOS';
                el.appendChild(label);
                this.addPin(el, 'base', 'input base');
                this.addPin(el, 'col', 'input col');
                this.addPin(el, 'emit', 'output emit');
            } else if (type === 'JOINT') {
                el.innerHTML = symbols[type];
                el.classList.add('joint');
                label.style.display = 'none';
                el.appendChild(label);
                this.addPin(el, 'p1', 'joint-pin');
            } else {
                // 패키지 등 기본값
                el.innerHTML = `<div class="comp-label">${type}</div>`;
                this.addPin(el, 'in', 'input center-in');
                this.addPin(el, 'out', 'output center-out');
            }

            this.workspace.appendChild(el);
            this.components.push(el);
            this.updateStatusBar();
            if (!skipSave) this.saveState();
        } catch (err) {
            console.error('Error adding module:', err);
        }
        return el;
    },

    getDefaultTransistors(type) {
        switch (type) {
            case 'NOT': return 2;
            case 'AND': return 6;
            case 'OR': return 6;
            case 'NAND': return 4;
            case 'NOR': return 4;
            case 'XNOR': return 10;
            case 'JOINT': return 0;
            case 'TRANSISTOR': return 1;
            default: return 0;
        }
    },

    addPin(parent, posClass, roleString, topPosition) {
        const pin = document.createElement('div');
        // roleString parsing: "input output" allowed
        const role = roleString.includes('input') ? 'input' : 'output';
        // posClass와 role 클래스 모두 추가
        pin.className = `pin ${posClass} ${role}`;
        pin.setAttribute('data-role', role);
        pin.setAttribute('data-pinid', 'pin_' + Date.now() + Math.random().toString(36).substr(2, 5));

        // 패키지 등에서 top 위치를 직접 지정하는 경우
        if (topPosition !== undefined) {
            pin.style.position = 'absolute';
            pin.style.top = topPosition + 'px';
            // left/right 클래스에 따라 위치 결정
            if (posClass.includes('left') || roleString.includes('left')) {
                pin.style.left = '-6px';
                pin.style.right = 'auto';
            } else if (posClass.includes('right') || roleString.includes('right')) {
                pin.style.right = '-6px';
                pin.style.left = 'auto';
            }
            // 직접 위치 지정 시 transform 기본 설정 (hover 시 덮어쓰지 않도록)
            pin.style.transform = 'translateY(-50%)';
        }

        // [Unified Wiring Logic]
        // WireManager.handlePinDown handles start/continue wiring
        pin.onmousedown = (e) => {
            // Joint dragging check (bubble up only if user drags the joint body, 
            // but here we are on the pin. Actually Joint pin should act as a wire target too.)
            // If parent is JOINT, we might want to prioritize dragging IF not in wire mode?
            // But usually pins are for wiring. User can drag Joint by body.
            this.handlePinDown(e, pin);
        };

        // WireManager.handlePinUp (optional, mostly for drag-drop wiring)
        pin.onmouseup = (e) => {
            if (this.handlePinUp) this.handlePinUp(e, pin);
        };

        parent.appendChild(pin);
    }
});
