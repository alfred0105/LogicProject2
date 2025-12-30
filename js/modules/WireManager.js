/**
 * 모듈: 전선(Wire) 및 연결 관리 - REFACTORED (v2.0)
 * - 히트박스(Hitbox) 도입으로 선택 용이성 향상
 * - 직각 배선(Orthogonal Routing) 알고리즘 강화
 * - 데이터 구조 확장 (Netlist 준비)
 */
Object.assign(CircuitSimulator.prototype, {
    // === Wiring State ===
    // this.isWiring = false;
    // this.startPin = null;
    // this.tempWire = null;     // 시각적 임시 와이어
    // this.tempHitbox = null;   // 임시 히트박스 (필요 없지만 일관성 위해?) -> 배선 중엔 필요 x

    handlePinDown(e, pin) {
        if (window.isReadOnlyMode) return;
        e.stopPropagation();
        e.preventDefault();

        if (this.mode !== 'edit' && this.mode !== 'wire') return;

        if (this.isWiring && this.startPin) {
            if (this.startPin !== pin) this.tryFinishWiring(pin);
            else this.cancelWiring();
            return;
        }

        this.startWiring(pin);
    },

    startWiring(pin) {
        this.isWiring = true;
        this.startPin = pin;
        this.startPin.classList.add('active');
        this.snappedPin = null;

        // 임시 전선 (Visual)
        this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempWire.setAttribute('fill', 'none');
        this.tempWire.classList.add('temp-wire');
        this.tempWire.style.stroke = 'var(--accent-secondary, #3498db)';
        this.tempWire.style.strokeWidth = '3px';
        this.tempWire.style.strokeDasharray = '5,5';
        this.tempWire.style.pointerEvents = 'none';

        // 임시 전선은 히트박스 불필요 (클릭 안 함)

        this.wireLayer.appendChild(this.tempWire);
        this.updateTempWireToPin(pin);
    },

    handleWireMove(e) {
        if (!this.isWiring || !this.startPin || !this.tempWire) return;

        const isModuleEditMode = this.currentTab && this.currentTab.startsWith('module_');
        let wsRect;
        if (isModuleEditMode && this.moduleCanvas) {
            wsRect = this.moduleCanvas.getBoundingClientRect();
        } else if (this.workspace) {
            wsRect = this.workspace.getBoundingClientRect();
        } else {
            return;
        }

        const scale = isModuleEditMode ? 1 : (this.scale || 1);
        const mouseX = (e.clientX - wsRect.left) / scale;
        const mouseY = (e.clientY - wsRect.top) / scale;

        this.findSnapTarget(mouseX, mouseY);

        const startPos = this.getPinCenter(this.startPin);
        let targetX = mouseX;
        let targetY = mouseY;

        if (this.snappedPin) {
            const snapPos = this.getPinCenter(this.snappedPin);
            targetX = snapPos.x;
            targetY = snapPos.y;
            this.tempWire.style.stroke = '#2ecc71';
            this.tempWire.style.strokeWidth = '4px';
        } else {
            this.tempWire.style.stroke = 'var(--accent-secondary, #3498db)';
            this.tempWire.style.strokeWidth = '3px';
        }

        // 라우팅 업데이트
        this.updateWirePath(this.tempWire, startPos.x, startPos.y, targetX, targetY);
    },

    handleGlobalWireUp(e) {
        if (!this.isWiring) return;
        if (this.snappedPin) {
            this.tryFinishWiring(this.snappedPin);
        }
    },

    tryFinishWiring(endPin) {
        if (!this.startPin || !endPin || this.startPin === endPin) {
            this.cancelWiring();
            return;
        }

        if (this.startPin.parentElement === endPin.parentElement) {
            this.showToast('같은 컴포넌트 내에는 연결할 수 없습니다.', 'warning');
            this.cancelWiring();
            return;
        }

        // Output-Output 방지
        const startIsOutput = this.isOutputPin(this.startPin);
        const endIsOutput = this.isOutputPin(endPin);
        if (!this.expertMode && startIsOutput && endIsOutput) {
            this.showToast('출력 핀끼리는 연결할 수 없습니다.', 'warning');
            this.cancelWiring();
            return;
        }

        // 와이어 생성
        const wire = this.createWire(this.startPin, endPin);

        // 모듈 모드 처리
        const isModuleMode = this.currentTab && this.currentTab.startsWith('module_');
        if (wire && isModuleMode && this.moduleWires) {
            this.moduleWires.push(wire);
        }

        this.cancelWiring();

        if (wire && !isModuleMode) {
            this.updateCircuit();
        }
    },

    isOutputPin(pin) {
        return pin.classList.contains('output') || pin.classList.contains('emit') || pin.classList.contains('out');
    },

    cancelWiring() {
        if (this.tempWire) {
            this.tempWire.remove();
            this.tempWire = null;
        }
        if (this.startPin) {
            this.startPin.classList.remove('active');
            this.startPin = null;
        }
        document.querySelectorAll('.pin.snap-target').forEach(p => p.classList.remove('snap-target'));
        this.snappedPin = null;
        this.isWiring = false;
    },

    /**
     * [핵심] 와이어 객체 생성 (Visible Line + Invisible Hitbox)
     */
    createWire(pinA, pinB, options = {}) {
        const { skipSave = false, skipRedraw = false } = options;

        // 중복 확인
        const exist = this.wires.find(w =>
            (w.from === pinA && w.to === pinB) || (w.from === pinB && w.to === pinA)
        );
        if (exist) return null;

        // 1. 시각적 선 (Visible Wire)
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('fill', 'none');
        line.classList.add('wire-line'); // 식별용 클래스
        line.style.stroke = '#22d3ee';
        line.style.filter = 'drop-shadow(0 0 2px rgba(34, 211, 238, 0.6))';
        line.style.strokeWidth = '3px';
        line.style.strokeLinecap = 'round';
        line.style.strokeLinejoin = 'round';
        line.style.pointerEvents = 'none'; // 이벤트는 히트박스가 담당

        // 2. 히트박스 (Invisible Hitbox)
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitbox.setAttribute('fill', 'none');
        hitbox.classList.add('wire-path'); // ContextMenuManager 호환 (wire-path를 찾음)
        hitbox.classList.add('wire-hitbox');
        hitbox.style.stroke = 'transparent'; // 투명
        hitbox.style.strokeWidth = '15px'; // 클릭 범위 대폭 확대
        hitbox.style.cursor = 'pointer';
        hitbox.style.pointerEvents = 'stroke'; // 스트로크 부분만 이벤트 감지

        // 이벤트 리스너 (히트박스에 부착)
        hitbox.onmousedown = (e) => {
            if (this.mode === 'pan' || e.button === 1) return;
            if (this.mode !== 'select' && this.mode !== 'edit') return;
            e.stopPropagation();
            this.insertJointOnWire(pinA, pinB, hitbox, e); // hitbox를 넘기지만 내부에서 wire 찾음
        };

        hitbox.oncontextmenu = (e) => {
            // ContextMenuManager가 글로벌로 처리하므로 보통 여기까지 안 옴 (Capture Phase).
            // 하지만 안전장치로 둠.
            e.preventDefault();
        };

        // 순서 중요: Hitbox가 Line보다 위에 있어야 함 (SVG는 나중에 그린 게 위에 옴)
        // 하지만 Line이 좀 더 빛나야 하나? Line이 위에 있으면 Line이 이벤트를 가림.
        // Line에 pointer-events: none을 주면 Line을 통과해 Hitbox(아래)나 Hitbox(위)에 도달.
        // Hitbox를 위에 두는 게 확실함.

        this.wireLayer.appendChild(line);
        this.wireLayer.appendChild(hitbox);

        // 데이터 구조 확장 (Netlist 준비)
        const newWire = {
            from: pinA,
            to: pinB,
            line: line,
            hitbox: hitbox
        };

        this.wires.push(newWire);

        // [NetManager] Update: Netlist 시스템 연동
        if (this.netManager) {
            this.netManager.onWireCreated(newWire);
        }

        if (!skipRedraw) this.redrawWires();
        if (!skipSave) this.saveState();
        if (this.updateStatusBar) this.updateStatusBar();

        return newWire;
    },

    removeWire(wire) {
        if (!wire) return;
        if (wire.line) wire.line.remove();
        if (wire.hitbox) wire.hitbox.remove(); // 히트박스 제거

        const idx = this.wires.indexOf(wire);
        if (idx !== -1) {
            this.wires.splice(idx, 1);

            // [NetManager] Update: Netlist 시스템 연동
            if (this.netManager) {
                this.netManager.onWireRemoved(wire);
            }

            if (this.updateStatusBar) this.updateStatusBar();
        }
    },

    redrawWires() {
        if (!this.workspace) return;
        const isModuleMode = this.currentTab && this.currentTab.startsWith('module_');
        const wiresToDraw = isModuleMode ? (this.moduleWires || []) : (this.wires || []);

        if (!wiresToDraw.length) return;

        wiresToDraw.forEach(wire => {
            if (!wire.from || !wire.to || !wire.line) return;
            if (!document.contains(wire.from) || !document.contains(wire.to)) return;

            const fromPos = this.getPinCenter(wire.from);
            const toPos = this.getPinCenter(wire.to);

            // Active Flow 상태 전파 (히트박스엔 영향 X)
            if (!isModuleMode && wire.line.classList.contains('active-flow')) {
                wire.line.style.stroke = '';
                wire.line.style.strokeWidth = '';
                void wire.line.offsetWidth;
            } else {
                wire.line.style.stroke = '#555555';
                wire.line.style.strokeWidth = '3px';
            }

            // [경로 업데이트] Line과 Hitbox 둘 다 업데이트
            this.updateWirePath(wire.line, fromPos.x, fromPos.y, toPos.x, toPos.y);
            if (wire.hitbox) {
                this.updateWirePath(wire.hitbox, fromPos.x, fromPos.y, toPos.x, toPos.y);
            }
        });
    },

    /**
     * [Routing Algorithm] 직각 배선 경로 계산
     * - Manhattan Routing (HV, VH, HVH)
     */
    updateWirePath(pathElement, x1, y1, x2, y2) {
        // 1. 단순한 2-Segment (ㄱ, ㄴ) 우선 시도
        // 핀의 연결 방향을 알면 4-Segment까지 확장 가능하지만, 지금은 중간 지점 꺾기로 단순화
        // "Smart"하게 꺾는 위치를 결정

        const dx = x2 - x1;
        const dy = y2 - y1;
        let d = '';

        // 수평/수직 정렬된 경우 -> 직선
        if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
            d = `M ${x1} ${y1} L ${x2} ${y2}`;
        } else {
            // 정렬되지 않음 -> 꺾어야 함
            // 기본 전략: HVH (수평-수직-수평) - 칩의 핀이 보통 좌/우에 있으므로

            const midX = (x1 + x2) / 2;

            // 만약 핀이 수직으로 배치된 컴포넌트(IC 등)라면 수평으로 먼저 나가는 게 유리
            // IC 핀은 보통 측면에 있으므로..

            // 단순 MidX는 핀이 가까우면 'ㄷ'자가 좁아짐.
            // 일단 기존 Manhattan Logic 유지하되 코드를 깔끔하게 정리
            d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
        }

        pathElement.setAttribute('d', d);
    },

    // ... (getPinCenter, findSnapTarget 등은 그대로 유지)

    getPinCenter(pin) {
        const rect = pin.getBoundingClientRect();
        const clientCenterX = rect.left + rect.width / 2;
        const clientCenterY = rect.top + rect.height / 2;
        const wsRect = this.workspace.getBoundingClientRect();
        const scale = this.scale || 1;
        const x = (clientCenterX - wsRect.left) / scale;
        const y = (clientCenterY - wsRect.top) / scale;
        return { x, y };
    },

    findSnapTarget(mouseX, mouseY) {
        const snapThreshold = 15;
        this.snappedPin = null;
        document.querySelectorAll('.pin.snap-target').forEach(p => p.classList.remove('snap-target'));
        const allPins = document.querySelectorAll('.pin');
        for (const pin of allPins) {
            if (pin === this.startPin) continue;
            const pos = this.getPinCenter(pin);
            if (Math.hypot(pos.x - mouseX, pos.y - mouseY) < snapThreshold) {
                this.snappedPin = pin;
                pin.classList.add('snap-target');
                return;
            }
        }
    },

    updateTempWireToPin(pin) {
        const pos = this.getPinCenter(pin);
        // 임시 선은 길이 0에서 시작
        this.updateWirePath(this.tempWire, pos.x, pos.y, pos.x, pos.y);
    },

    insertJointOnWire(fromPin, toPin, wireElement, event) {
        const wsRect = this.workspace.parentElement.getBoundingClientRect();
        const clickX = (event.clientX - wsRect.left - this.panX) / this.scale;
        const clickY = (event.clientY - wsRect.top - this.panY) / this.scale;

        // 히트박스든 라인이든 wireElement로 들어옴.
        // wires 배열에서 찾을 때 line or hitbox로 찾아야 함.
        const wireIndex = this.wires.findIndex(w => w.line === wireElement || w.hitbox === wireElement);
        if (wireIndex === -1) return;

        const joint = this.addModule('JOINT', clickX - 7, clickY - 7);
        if (!joint) return;
        const jointPin = joint.querySelector('.pin');

        this.createWire(fromPin, jointPin, { skipSave: true });
        this.createWire(jointPin, toPin, { skipSave: true });

        const originalWire = this.wires[wireIndex];
        this.removeWire(originalWire);

        this.dragTarget = joint;
        this.dragOffset = { x: 7, y: 7 };
        joint.style.cursor = 'grabbing';
        this.saveState();
    },

    handlePinClick(e, pin) {
        this.handlePinDown(e, pin);
    }
});
