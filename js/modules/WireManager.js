/**
 * ⚡ WireManager 3.0: High-Performance EDA Wiring System
 * 
 * [Key Features]
 * 1. Netlist Integration: Connects directly with NetManager for O(1) simulation.
 * 2. Virtual Joints: Lightweight SVG-based joints (No DOM overhead).
 * 3. Smart Orthogonal Routing: Manhattan geometry with intelligent pathfinding.
 * 4. Hitbox System: Invisible wide stroke for easy selection.
 */

// === Virtual Joint Class ===
// 가벼운 조인트 객체 (DOM 요소가 아님)
class VirtualJoint {
    constructor(x, y, manager) {
        this.x = x;
        this.y = y;
        this.manager = manager;
        this.id = 'vj_' + Math.random().toString(36).substr(2, 9);
        this.connectedWires = []; // 연결된 와이어들

        // SVG Element (렌더링용)
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.element.setAttribute('r', '4'); // 반지름 4px
        this.element.setAttribute('cx', x);
        this.element.setAttribute('cy', y);
        this.element.classList.add('virtual-joint');

        // 스타일 (CSS로 뺄 수도 있지만 확실한 적용을 위해)
        this.element.style.fill = '#22d3ee'; // Cyan
        this.element.style.stroke = '#fff';
        this.element.style.strokeWidth = '2px';
        this.element.style.cursor = 'move';
        this.element.style.pointerEvents = 'all';

        // 이벤트
        this.element.onmousedown = (e) => this.onMouseDown(e);
    }

    onMouseDown(e) {
        if (window.sim.mode === 'pan' || e.button === 1) return;
        e.stopPropagation();

        // 조인트 드래그 시작 (또는 와이어 시작)
        // 여기서는 와이어 시작점으로 활용
        if (window.sim.mode === 'wire' || window.sim.mode === 'edit') {
            window.sim.handlePinDown(e, this); // 핀처럼 행동
        }
    }

    // 핀 인터페이스 호환 (getPinCenter 등에서 사용)
    getBoundingClientRect() {
        // SVG 좌표계를 화면 좌표계로 변환해야 함
        // 하지만 getPinCenter는 다시 역변환을 하므로...
        // VirtualJoint는 이미 Workspace 좌표계임.
        // 따라서 특수 처리가 필요함. (isVirtual 확인)
        return null;
    }
}

// === Main WireManager Implementation ===
Object.assign(CircuitSimulator.prototype, {

    // 초기 상태 (Main.js 등에서 호출 필요 없게 Lazy Init 가능하지만 명시적 선언)
    // this.virtualJoints = []; 
    // this.wires = []; 

    /**
     * [Event] 핀/조인트에서 마우스 다운 (배선 시작)
     */
    handlePinDown(e, startNode) {
        if (window.isReadOnlyMode) return;
        e.stopPropagation();
        e.preventDefault();

        if (this.mode !== 'edit' && this.mode !== 'wire') return;

        // 이미 배선 중이면 연결 완료 시도
        if (this.isWiring && this.startNode) {
            if (this.startNode !== startNode) {
                this.tryFinishWiring(startNode);
            } else {
                this.cancelWiring(); // 같은 핀 클릭 = 취소
            }
            return;
        }

        // 새 배선 시작
        this.startWiring(startNode);
    },

    /**
     * 배선 모드 진입
     */
    startWiring(node) {
        this.isWiring = true;
        this.startNode = node;
        this.snappedNode = null;

        // 노드 활성화 표시 (핀인 경우만)
        if (node.classList) node.classList.add('active');

        // 임시 와이어 (Visual Guide)
        this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempWire.setAttribute('fill', 'none');
        this.tempWire.style.stroke = 'var(--accent-secondary, #3498db)';
        this.tempWire.style.strokeWidth = '2px';
        this.tempWire.style.strokeDasharray = '4,4';
        this.tempWire.style.pointerEvents = 'none';

        this.wireLayer.appendChild(this.tempWire);

        // 시작점 업데이트
        const pos = this.getNodePosition(node);
        this.updateOrthogonalPath(this.tempWire, pos.x, pos.y, pos.x, pos.y);
    },

    /**
     * [Event] 마우스 이동 (와이어 프리뷰)
     */
    handleWireMove(e) {
        if (!this.isWiring || !this.startNode || !this.tempWire) return;

        // 좌표 계산
        const pos = this.getMousePosition(e);
        const mouseX = pos.x;
        const mouseY = pos.y;

        // 스냅 타겟 찾기 (Pin or VirtualJoint)
        this.findSnapTarget(mouseX, mouseY);

        const startPos = this.getNodePosition(this.startNode);
        let targetX = mouseX;
        let targetY = mouseY;

        // 스냅 
        if (this.snappedNode) {
            const snapPos = this.getNodePosition(this.snappedNode);
            targetX = snapPos.x;
            targetY = snapPos.y;
            this.tempWire.style.stroke = '#2ecc71'; // Green
            this.tempWire.style.strokeWidth = '3px';
        } else {
            this.tempWire.style.stroke = 'var(--accent-secondary, #3498db)';
            this.tempWire.style.strokeWidth = '2px';

            // 허공일 때 그리드 스냅 (Grid Snap) - 10px 단위
            // targetX = Math.round(targetX / 10) * 10;
            // targetY = Math.round(targetY / 10) * 10;
            // (사용자가 원하셨음)
            targetX = Math.round(mouseX / 10) * 10;
            targetY = Math.round(mouseY / 10) * 10;
        }

        // 직각 경로 업데이트
        this.updateOrthogonalPath(this.tempWire, startPos.x, startPos.y, targetX, targetY);
    },

    /**
     * [Event] 배선 종료 시도
     */
    tryFinishWiring(endNode) {
        if (!this.startNode || !endNode || this.startNode === endNode) {
            this.cancelWiring();
            return;
        }

        // 유효성 검사 (같은 컴포넌트, 출력-출력 등)
        if (!this.validateConnection(this.startNode, endNode)) {
            this.cancelWiring();
            return;
        }

        // 와이어 생성
        this.createWire(this.startNode, endNode);
        this.cancelWiring();
    },

    /**
     * 연결 유효성 검사
     */
    validateConnection(nodeA, nodeB) {
        // VirtualJoint는 제약 없음
        const isJointA = nodeA instanceof VirtualJoint;
        const isJointB = nodeB instanceof VirtualJoint;
        if (isJointA || isJointB) return true;

        // Pin - Pin 인 경우
        if (nodeA.parentElement === nodeB.parentElement) {
            this.showToast('같은 컴포넌트 내부 연결 불가', 'warning');
            return false;
        }

        // Output - Output 방지
        const isOutA = this.isOutputPin(nodeA);
        const isOutB = this.isOutputPin(nodeB);
        if (!this.expertMode && isOutA && isOutB) {
            this.showToast('출력-출력 충돌 위험', 'warning');
            return false;
        }
        return true;
    },

    isOutputPin(pin) {
        return pin.classList.contains('output') || pin.classList.contains('emit') || pin.classList.contains('out');
    },

    /**
     * 배선 취소
     */
    cancelWiring() {
        if (this.tempWire) {
            this.tempWire.remove();
            this.tempWire = null;
        }
        if (this.startNode && this.startNode.classList) {
            this.startNode.classList.remove('active');
        }
        this.startNode = null;
        this.snappedNode = null;
        this.isWiring = false;

        // 스냅 하이라이트 제거
        document.querySelectorAll('.pin.snap-target').forEach(p => p.classList.remove('snap-target'));
        if (this.virtualJoints) {
            this.virtualJoints.forEach(vj => vj.element.classList.remove('snap-target'));
        }
    },

    /**
     * [Core] 와이어 생성
     */
    createWire(fromNode, toNode, options = {}) {
        const { skipSave = false, skipRedraw = false } = options;

        // 중복 체크
        const exist = this.wires.find(w =>
            (w.from === fromNode && w.to === toNode) ||
            (w.from === toNode && w.to === fromNode)
        );
        if (exist) return null;

        // 1. Visible Line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('wire-line');
        line.style.stroke = '#22d3ee';
        line.style.strokeWidth = '2px'; // 얇고 세련되게
        line.style.fill = 'none';
        line.style.strokeLinecap = 'round';
        line.style.strokeLinejoin = 'round';
        line.style.pointerEvents = 'none'; // 클릭 불가

        // 2. Invisible Hitbox (15px)
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitbox.classList.add('wire-hitbox');
        hitbox.classList.add('wire-path'); // 호환성
        hitbox.style.stroke = 'transparent';
        hitbox.style.strokeWidth = '15px';
        hitbox.style.fill = 'none';
        hitbox.style.cursor = 'crosshair';
        hitbox.style.pointerEvents = 'stroke';

        // Hitbox Events
        hitbox.onmousedown = (e) => {
            if (this.mode === 'pan' || e.button === 1) return;
            e.stopPropagation();
            // 좌클릭: 조인트 생성
            if (e.button === 0) {
                this.splitWireWithJoint(newWire, e);
            }
        };

        hitbox.oncontextmenu = (e) => {
            e.preventDefault();
            // 우클릭: 삭제 (ContextMenuManager가 덮어쓸 수도 있음)
            // 여기선 간단 삭제 로직
            this.removeWire(newWire);
            if (this.netManager) this.netManager.onWireRemoved(newWire);
        };

        this.wireLayer.appendChild(line);
        this.wireLayer.appendChild(hitbox);

        const newWire = { from: fromNode, to: toNode, line, hitbox };
        this.wires.push(newWire);

        // NetManager 등록
        if (this.netManager) {
            this.netManager.onWireCreated(newWire);
        }

        if (!skipRedraw) this.redrawWires();
        if (!skipSave) this.saveState();

        return newWire;
    },

    /**
     * [Core] 와이어 제거
     */
    removeWire(wire) {
        if (!wire) return;
        wire.line.remove();
        wire.hitbox.remove();

        const idx = this.wires.indexOf(wire);
        if (idx !== -1) this.wires.splice(idx, 1);

        // NetManager 업데이트
        if (this.netManager) this.netManager.onWireRemoved(wire);

        // 연결된 조인트가 고립되면 제거? (Optional)
        // 일단 유지.
    },

    /**
     * [Routing] 직각 경로 계산 (Smart Manhattan)
     */
    updateOrthogonalPath(pathElement, x1, y1, x2, y2) {
        // 10px Grid Snap for clean lines
        x1 = Math.round(x1); y1 = Math.round(y1);
        x2 = Math.round(x2); y2 = Math.round(y2);

        let d = '';
        const dx = x2 - x1;
        const dy = y2 - y1;

        // 직선
        if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
            d = `M ${x1} ${y1} L ${x2} ${y2}`;
        }
        else {
            // Z-Shape (Horizontal First or Vertical First)
            // 핀의 성격(가로형/세로형)을 알면 좋지만, 일단 거리 기반 판단.
            // 가로 거리가 더 멀면, 가로로 먼저 간다? (Case by Case)
            // 보통 회로는 가로로 깁니다. -> Horizontal-Vertical-Horizontal (HVH)

            const midX = Math.round((x1 + x2) / 2 / 10) * 10; // Grid aligned center
            d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
        }
        pathElement.setAttribute('d', d);
    },

    /**
     * [Feature] 와이어 중간에 조인트 삽입
     */
    splitWireWithJoint(wire, event) {
        const mousePos = this.getMousePosition(event);
        // 그리드 스냅
        const jx = Math.round(mousePos.x / 10) * 10;
        const jy = Math.round(mousePos.y / 10) * 10;

        // 가상 조인트 생성
        const joint = new VirtualJoint(jx, jy, this);
        if (!this.virtualJoints) this.virtualJoints = [];
        this.virtualJoints.push(joint);
        this.wireLayer.appendChild(joint.element);

        // 기존 와이어 제거
        const { from, to } = wire;
        this.removeWire(wire);

        // 새 와이어 2개 생성
        this.createWire(from, joint, { skipSave: true });
        this.createWire(joint, to, { skipSave: true });

        this.saveState();
    },

    /**
     * [Helper] 노드(핀 또는 조인트) 위치 구하기
     */
    getNodePosition(node) {
        // 1. Virtual Joint
        if (node instanceof VirtualJoint) {
            return { x: node.x, y: node.y };
        }
        // 2. DOM Pin
        const rect = node.getBoundingClientRect();
        // Workspace scale 역보정
        const wsRect = this.workspace.getBoundingClientRect();
        const scale = this.scale || 1;

        return {
            x: (rect.left + rect.width / 2 - wsRect.left) / scale,
            y: (rect.top + rect.height / 2 - wsRect.top) / scale
        };
    },

    /**
     * [Helper] 마우스 월드 좌표
     */
    getMousePosition(e) {
        const wsRect = this.workspace.getBoundingClientRect();
        const scale = this.scale || 1;
        return {
            x: (e.clientX - wsRect.left) / scale,
            y: (e.clientY - wsRect.top) / scale
        };
    },

    /**
     * [Helper] 스냅 타겟 찾기 (Pin + VirtualJoint)
     */
    findSnapTarget(x, y) {
        const threshold = 15;
        this.snappedNode = null;

        // Reset highlights
        document.querySelectorAll('.snap-target').forEach(el => el.classList.remove('snap-target'));

        // 1. Check Pins
        const pins = document.querySelectorAll('.pin');
        for (const pin of pins) {
            if (pin === this.startNode) continue;
            const pos = this.getNodePosition(pin);
            if (Math.hypot(pos.x - x, pos.y - y) < threshold) {
                this.snappedNode = pin;
                pin.classList.add('snap-target');
                return;
            }
        }

        // 2. Check Virtual Joints
        if (this.virtualJoints) {
            for (const vj of this.virtualJoints) {
                if (vj === this.startNode) continue;
                // 거리 체크 (vj.x, vj.y는 이미 월드 좌표)
                if (Math.hypot(vj.x - x, vj.y - y) < threshold) {
                    this.snappedNode = vj;
                    vj.element.classList.add('snap-target');
                    return;
                }
            }
        }
    },

    // 글로벌 마우스 업
    handleGlobalWireUp(e) {
        if (!this.isWiring) return;
        if (this.snappedNode) {
            this.tryFinishWiring(this.snappedNode);
        }
        // 클릭-클릭 모드인 경우 허공 클릭은 무시 (계속 배선)
    },

    // 리드로우
    redrawWires() {
        if (!this.workspace) return;
        // Wires
        this.wires.forEach(w => {
            // 유효성 체크 (DOM Pin이 사라졌으면 제거)
            const fromValid = (w.from instanceof VirtualJoint) || document.contains(w.from);
            const toValid = (w.to instanceof VirtualJoint) || document.contains(w.to);

            if (!fromValid || !toValid) {
                // Cleanup invalid wire (defer splice)
                w.toBeRemoved = true;
                return;
            }

            const p1 = this.getNodePosition(w.from);
            const p2 = this.getNodePosition(w.to);

            // Visual Updates (Signal Colors)
            // (생략 - LogicEngine에서 처리됨. 여기선 좌표만)

            this.updateOrthogonalPath(w.line, p1.x, p1.y, p2.x, p2.y);
            this.updateOrthogonalPath(w.hitbox, p1.x, p1.y, p2.x, p2.y);
        });

        // Cleanup Loop
        const invalidWires = this.wires.filter(w => w.toBeRemoved);
        invalidWires.forEach(w => this.removeWire(w));

        // Joints (렌더링은 되어있으므로 위치만? 조인트는 움직이지 않음)
        // 만약 조인트 이동 기능을 넣는다면 여기서 업데이트
    }
});

// Expose VirtualJoint for ProjectIO
window.VirtualJoint = VirtualJoint;
