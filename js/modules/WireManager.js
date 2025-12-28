/**
 * 모듈: 전선(Wire) 및 연결 관리 - REDESIGNED
 * 전선 연결의 시작, 이동, 종료, 렌더링을 통합 관리합니다.
 */
Object.assign(CircuitSimulator.prototype, {
    // === Wiring State Management ===
    // this.isWiring = false;
    // this.startPin = null;
    // this.tempWire = null;
    // this.snappedPin = null;

    /**
     * 핀에서 마우스 다운 발생 시 호출 (진입점)
     */
    handlePinDown(e, pin) {
        // 읽기 전용 모드 체크
        if (window.isReadOnlyMode) return;

        e.stopPropagation();
        e.preventDefault();

        if (this.mode !== 'edit' && this.mode !== 'wire') return;

        // 이미 배선 중이고 다른 핀을 클릭한 경우 -> 연결 시도
        if (this.isWiring && this.startPin) {
            if (this.startPin !== pin) {
                this.tryFinishWiring(pin);
            } else {
                // 같은 핀 다시 클릭 (클릭-클릭 모드에서 시작점 다시 클릭) -> 취소
                this.cancelWiring();
            }
            return;
        }

        // 새로운 배선 시작
        this.startWiring(pin);
    },

    /**
     * 배선 시작 초기화
     */
    startWiring(pin) {
        // [Validation] 출력/입력 구분 (필요시)
        // Expert 모드가 아닐 때, Output 핀에서만 시작 강제 등의 규칙이 있었으나
        // 사용자가 유연함을 원하므로 경고만 주거나 허용합니다.

        this.isWiring = true;
        this.startPin = pin;
        this.startPin.classList.add('active');
        this.snappedPin = null;

        // 임시 전선 생성
        this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempWire.setAttribute('fill', 'none');
        this.tempWire.classList.add('temp-wire');
        this.tempWire.style.stroke = 'var(--accent-secondary, #3498db)';
        this.tempWire.style.strokeWidth = '3px';
        this.tempWire.style.strokeDasharray = '5,5';
        this.tempWire.style.pointerEvents = 'none'; // 마우스 이벤트 방해 금지
        this.wireLayer.appendChild(this.tempWire);

        // 초기 위치 렌더링을 위해 가짜 이동 이벤트 처리
        // (현재 마우스 위치를 모르므로, 핀 위치에서 시작하는 점으로 설정)
        this.updateTempWireToPin(pin);
    },

    /**
     * 마우스 이동 시 임시 전선 업데이트 (InputHandler에서 호출)
     */
    handleWireMove(e) {
        if (!this.isWiring || !this.startPin || !this.tempWire) return;

        // 모듈 편집 모드인지 확인 (다중 탭 지원: module_로 시작)
        const isModuleEditMode = this.currentTab && this.currentTab.startsWith('module_');

        // 올바른 워크스페이스 참조 가져오기
        let wsRect;
        if (isModuleEditMode && this.moduleCanvas) {
            wsRect = this.moduleCanvas.getBoundingClientRect();
        } else if (this.workspace && this.workspace.parentElement) {
            // transform 없는 고정 컨테이너 기준 (parentElement)
            wsRect = this.workspace.parentElement.getBoundingClientRect();
        } else {
            return; // 워크스페이스 참조 없음
        }

        // 모듈 편집 모드에서는 pan/scale을 적용하지 않음
        const pan = isModuleEditMode ? { x: 0, y: 0 } : { x: this.panX || 0, y: this.panY || 0 };
        const scale = isModuleEditMode ? 1 : (this.scale || 1);

        const mouseX = (e.clientX - wsRect.left - pan.x) / scale;
        const mouseY = (e.clientY - wsRect.top - pan.y) / scale;

        // 스냅 타겟 찾기
        this.findSnapTarget(mouseX, mouseY);

        // 시작점 좌표
        const pinRect = this.startPin.getBoundingClientRect();
        const startX = (pinRect.left + pinRect.width / 2 - wsRect.left - pan.x) / scale;
        const startY = (pinRect.top + pinRect.height / 2 - wsRect.top - pan.y) / scale;

        // 목표 좌표 (스냅 or 마우스)
        let targetX = mouseX;
        let targetY = mouseY;

        if (this.snappedPin) {
            const snapRect = this.snappedPin.getBoundingClientRect();
            targetX = (snapRect.left + snapRect.width / 2 - wsRect.left - pan.x) / scale;
            targetY = (snapRect.top + snapRect.height / 2 - wsRect.top - pan.y) / scale;

            this.tempWire.style.stroke = '#2ecc71'; // 연결 가능 신호 (초록색)
            this.tempWire.style.strokeWidth = '4px';
        } else {
            this.tempWire.style.stroke = 'var(--accent-secondary, #3498db)';
            this.tempWire.style.strokeWidth = '3px';
        }

        // 라우팅 (Manhattan Style)
        this.drawManhattanWire(this.tempWire, startX, startY, targetX, targetY);
    },

    /**
     * 전역 마우스 업 이벤트 처리 (InputHandler에서 호출)
     */
    handleGlobalWireUp(e) {
        if (!this.isWiring) return;

        // 1. 스냅된 핀이 있으면 연결
        if (this.snappedPin) {
            this.tryFinishWiring(this.snappedPin);
            return;
        }

        // 2. 스냅되지 않았지만, 마우스가 시작점 근처라면? (단순 클릭으로 간주 -> 배선 모드 유지)
        //    그게 아니라 멀리 드래그했다가 허공에 놓으면? -> 배선 취소

        // 모듈 편집 모드인지 확인 (다중 탭 지원)
        const isModuleEditMode = this.currentTab && this.currentTab.startsWith('module_');

        let wsRect;
        if (isModuleEditMode && this.moduleCanvas) {
            wsRect = this.moduleCanvas.getBoundingClientRect();
        } else if (this.workspace && this.workspace.parentElement) {
            // transform 없는 고정 컨테이너 기준 (parentElement)
            wsRect = this.workspace.parentElement.getBoundingClientRect();
        } else {
            this.cancelWiring();
            return;
        }

        const pan = isModuleEditMode ? { x: 0, y: 0 } : { x: this.panX || 0, y: this.panY || 0 };
        const scale = isModuleEditMode ? 1 : (this.scale || 1);

        const mouseX = (e.clientX - wsRect.left - pan.x) / scale;
        const mouseY = (e.clientY - wsRect.top - pan.y) / scale;

        const pinRect = this.startPin.getBoundingClientRect();
        const startX = (pinRect.left + pinRect.width / 2 - wsRect.left - pan.x) / scale;
        const startY = (pinRect.top + pinRect.height / 2 - wsRect.top - pan.y) / scale;

        const dist = Math.hypot(mouseX - startX, mouseY - startY);

        // 20px 이상 드래그 후 허공에서 놓으면 취소
        if (dist > 20) {
            this.cancelWiring();
        }
        // 20px 이내면 클릭으로 간주, 배선 상태 유지 (떠 있는 전선)
    },

    /**
     * 연결 시도 및 검증
     */
    tryFinishWiring(endPin) {
        if (!this.startPin || !endPin) {
            this.cancelWiring();
            return;
        }

        if (this.startPin === endPin) {
            this.cancelWiring();
            return;
        }

        // 자기 자신 컴포넌트로의 루프 방지 (원한다면 제거 가능)
        if (this.startPin.parentElement === endPin.parentElement) {
            this.showToast('같은 컴포넌트 내에는 연결할 수 없습니다.', 'warning');
            this.cancelWiring();
            return;
        }
        // 연결 생성
        const wire = this.createWire(this.startPin, endPin);

        // 모듈 편집 모드일 때 moduleWires에도 추가 (다중 탭 지원)
        const isModuleMode = this.currentTab && this.currentTab.startsWith('module_');
        if (wire && isModuleMode && this.moduleWires) {
            this.moduleWires.push(wire);
        }

        // 배선 종료
        this.cancelWiring();

        // 회로 업데이트 (모듈 편집 모드가 아닐 때만)
        if (wire && !isModuleMode) {
            this.updateCircuit();
        }
    },

    /**
     * 배선 취소 및 상태 정리
     */
    cancelWiring() {
        if (this.tempWire) {
            this.tempWire.remove();
            this.tempWire = null;
        }
        if (this.startPin) {
            this.startPin.classList.remove('active');
            this.startPin = null;
        }

        // 스냅 타겟 초기화
        document.querySelectorAll('.pin.snap-target').forEach(p => p.classList.remove('snap-target'));
        this.snappedPin = null;
        this.isWiring = false;
    },

    /**
     * 실제 전선 객체 생성
     */
    createWire(pinA, pinB, options = {}) {
        const { skipSave = false, skipRedraw = false } = options;

        // 중복 연결 방지
        const exist = this.wires.find(w =>
            (w.from === pinA && w.to === pinB) || (w.from === pinB && w.to === pinA)
        );
        if (exist) return null;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'none');
        path.classList.add('wire-path');

        // 스타일
        path.style.stroke = '#22d3ee'; // Cyan-400 (Neon-like)
        path.style.filter = 'drop-shadow(0 0 2px rgba(34, 211, 238, 0.6))'; // Glow Effect
        path.style.strokeWidth = '3px';
        path.style.strokeLinecap = 'round';
        path.style.strokeLinejoin = 'round';
        path.style.cursor = 'pointer';

        // 이벤트: 전선 좌클릭하여 Joint 추가, 우클릭하여 삭제
        path.onmousedown = (e) => {
            // Pan 모드, 휠 클릭(1), 또는 스페이스바 누른 상태라면 이벤트 패스 (화면 이동 우선)
            if (this.mode === 'pan' || e.button === 1) return;

            if (this.mode !== 'select' && this.mode !== 'edit') return;
            e.stopPropagation();
            this.insertJointOnWire(pinA, pinB, path, e);
        };

        path.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 드래그 상태 초기화 (고정 버그 방지)
            if (this.resetDragState) this.resetDragState();

            // 전선 삭제
            const wire = this.wires.find(w => w.line === path);
            if (wire) {
                this.removeWire(wire);
                // 모듈 모드일 때 moduleWires에서도 제거
                if (this.currentTab && this.currentTab.startsWith('module_')) {
                    this.moduleWires = this.moduleWires.filter(w => w !== wire);
                    this.saveCurrentModuleTabState();
                }
                this.showToast('전선이 삭제되었습니다', 'info');
                this.saveState();
            }
        };

        this.wireLayer.appendChild(path);

        const newWire = { from: pinA, to: pinB, line: path };
        this.wires.push(newWire);

        if (!skipRedraw) this.redrawWires();
        if (!skipSave) this.saveState();
        if (this.updateStatusBar) this.updateStatusBar();

        return newWire;
    },

    /**
     * 전선 제거 (단일)
     */
    removeWire(wire) {
        if (!wire) return;
        if (wire.line) wire.line.remove();

        const idx = this.wires.indexOf(wire);
        if (idx !== -1) {
            this.wires.splice(idx, 1);
            if (this.updateStatusBar) this.updateStatusBar();
        }
    },

    /**
     * 모든 전선 다시 그리기
     */
    redrawWires() {
        if (!this.workspace) return;

        // 모듈 모드일 때는 moduleWires 사용 (다중 탭 지원)
        const isModuleMode = this.currentTab && this.currentTab.startsWith('module_');
        const wiresToDraw = isModuleMode ? (this.moduleWires || []) : (this.wires || []);

        if (!wiresToDraw.length) return;

        wiresToDraw.forEach(wire => {
            if (!wire.from || !wire.to || !wire.line) return;
            // 핀이 DOM에서 사라졌는지 확인
            if (!document.contains(wire.from) || !document.contains(wire.to)) {
                return;
            }

            const fromPos = this.getPinCenter(wire.from);
            const toPos = this.getPinCenter(wire.to);

            // LogicEngine 상태 반영 (active-flow) - 모듈 모드에서는 비활성
            if (!isModuleMode && wire.line.classList.contains('active-flow')) {
                // Keep CSS handling it
                wire.line.style.stroke = '';
                wire.line.style.strokeWidth = '';
                // Force reflow to ensure animation restarts if re-applied
                void wire.line.offsetWidth;
            } else {
                wire.line.style.stroke = '#555555';
                wire.line.style.strokeWidth = '3px';
            }

            this.drawManhattanWire(wire.line, fromPos.x, fromPos.y, toPos.x, toPos.y);
        });
    },

    /**
     * Manhattan Style (직각) 라우팅 계산 및 적용
     */
    drawManhattanWire(pathElement, x1, y1, x2, y2) {
        // 중간 지점 계산
        const midX = (x1 + x2) / 2;

        // 경로 생성: 시작 -> 중간수직선 -> 끝
        // M x1 y1 L midX y1 L midX y2 L x2 y2
        const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

        pathElement.setAttribute('d', d);
    },

    /**
     * 헬퍼: 핀 중심 좌표 구하기 (Workspace 기준)
     * Transform과 무관하게 정확한 SVG 로컬 좌표 반환
     */
    getPinCenter(pin) {
        // 핀이 속한 컴포넌트 찾기
        const comp = pin.closest('.component');
        if (!comp) {
            console.warn('Pin has no parent component:', pin);
            return { x: 0, y: 0 };
        }

        // 컴포넌트의 SVG 로컬 좌표 (style.left/top은 이미 workspace 좌표)
        const compX = parseFloat(comp.style.left) || 0;
        const compY = parseFloat(comp.style.top) || 0;

        // 핀의 컴포넌트 내 상대 위치
        const pinRelX = pin.offsetLeft + pin.offsetWidth / 2;
        const pinRelY = pin.offsetTop + pin.offsetHeight / 2;

        // 절대 좌표 = 컴포넌트 좌표 + 핀 상대 좌표
        return {
            x: compX + pinRelX,
            y: compY + pinRelY
        };
    },

    /**
     * 헬퍼: 스냅 타겟 찾기
     */
    findSnapTarget(mouseX, mouseY) {
        const snapThreshold = 15;
        this.snappedPin = null;

        // 기존 하이라이트 제거
        document.querySelectorAll('.pin.snap-target').forEach(p => p.classList.remove('snap-target'));

        const allPins = document.querySelectorAll('.pin');
        for (const pin of allPins) {
            if (pin === this.startPin) continue;

            const pos = this.getPinCenter(pin);
            if (Math.hypot(pos.x - mouseX, pos.y - mouseY) < snapThreshold) {
                this.snappedPin = pin;
                pin.classList.add('snap-target');
                return; // 가장 가까운 하나만 찾고 종료
            }
        }
    },

    /**
     * 헬퍼: 초기 임시 전선 위치 잡기
     */
    updateTempWireToPin(pin) {
        const pos = this.getPinCenter(pin);
        this.drawManhattanWire(this.tempWire, pos.x, pos.y, pos.x, pos.y);
    },

    /**
     * 전선 중간에 Joint 추가 (기존 로직 유지하되 안정화)
     */
    insertJointOnWire(fromPin, toPin, wirePath, event) {
        // transform 없는 고정 컨테이너 기준 (parentElement)
        const wsRect = this.workspace.parentElement.getBoundingClientRect();
        const clickX = (event.clientX - wsRect.left - this.panX) / this.scale;
        const clickY = (event.clientY - wsRect.top - this.panY) / this.scale;

        // 기존 전선 제거
        const wireIndex = this.wires.findIndex(w => w.line === wirePath);
        if (wireIndex === -1) return;

        // Joint 생성
        const joint = this.addModule('JOINT', clickX - 7, clickY - 7); // Joint 크기 고려 센터링
        if (!joint) return;
        const jointPin = joint.querySelector('.pin');

        // 새 전선 2개 생성
        this.createWire(fromPin, jointPin, { skipSave: true });
        this.createWire(jointPin, toPin, { skipSave: true });

        // 원래 전선 삭제
        const originalWire = this.wires[wireIndex];
        this.removeWire(originalWire);

        // 드래그 시작 (UX 향상)
        this.dragTarget = joint;
        this.dragOffset = { x: 7, y: 7 }; // Center offset
        joint.style.cursor = 'grabbing';

        this.saveState();
    },

    // --- Legacy Support / Compat ---
    handlePinClick(e, pin) {
        this.handlePinDown(e, pin);
    }
});
