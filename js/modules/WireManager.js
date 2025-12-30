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
        // [Safety Check]
        const sim = window.sim;
        if (!sim) return;

        if (sim.mode === 'pan' || e.button === 1) return;
        e.stopPropagation();
        this.startDrag(e);
    }

    startDrag(e) {
        const sim = this.manager || window.sim;
        if (!sim) return;

        const startX = e.clientX;
        const startY = e.clientY;
        let hasMoved = false;

        const onMove = (evt) => {
            const dx = evt.clientX - startX;
            const dy = evt.clientY - startY;
            if (dx * dx + dy * dy > 9) hasMoved = true;

            const pos = sim.getMousePosition(evt);
            // Snap to Grid (10px)
            const gx = Math.round(pos.x / 10) * 10;
            const gy = Math.round(pos.y / 10) * 10;

            this.x = gx;
            this.y = gy;
            if (this.element) {
                this.element.setAttribute('cx', gx);
                this.element.setAttribute('cy', gy);
            }
            // Smart Routing (Fast Mode) for responsiveness
            // redrawWires 내부에서 isDragging 등을 체크하므로
            // 여기서는 강제로 isDragging을 흉내내거나 직접 updateSmartPath 호출이 나음
            // 하지만 redrawWires()가 가장 안전.
            sim.isDragging = true;
            sim.redrawWires();
            sim.isDragging = false;
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);

            if (hasMoved) {
                sim.saveState();
            } else {
                // Click Action: Start Wiring from here
                if (sim.mode === 'wire' || sim.mode === 'edit') {
                    sim.handlePinDown(e, this);
                }
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // 핀 인터페이스 호환 (getPinCenter 등에서 사용)
    getBoundingClientRect() {
        return null;
    }

    // [Dom Compatibility Helpers]
    setAttribute(name, value) {
        if (this.element) this.element.setAttribute(name, value);
    }

    getAttribute(name) {
        return this.element ? this.element.getAttribute(name) : null;
    }

    get classList() {
        return this.element ? this.element.classList : { add: () => { }, remove: () => { }, contains: () => false };
    }

    get parentElement() {
        return null; // LogicEngine에서 체크 시 안전하게 처리
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

        // [Smart Route] Initial Calculation (with obstacle avoidance)
        // redrawWires에서 다시 그릴 수도 있지만 초기 계산 중요
        this.updateSmartPath(newWire, false);

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
        // 10px Grid Snap for clean lines (시작/끝점 제외한 중간점만)
        const grid = 10;
        const snap = (v) => Math.round(v / grid) * grid;

        let d = '';
        const dx = x2 - x1;
        const dy = y2 - y1;

        // 직선
        if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
            d = `M ${x1} ${y1} L ${x2} ${y2}`;
        }
        else {
            // Z-Shape: 중간 꺾임점을 그리드에 스냅
            const midX = snap((x1 + x2) / 2);
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

        // [Feature] 조인트 즉시 드래그 (위치 수정 용이성)
        if (joint.startDrag) joint.startDrag(event);

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

        // Fast Mode Check: Wiring, Panning, or Dragging
        const isFastMode = this.isWiring || this.mode === 'pan' || !!this.isDragging;

        this.wires.forEach(w => {
            // 유효성 체크 (DOM Pin이 사라졌으면 제거)
            const fromValid = (w.from instanceof window.VirtualJoint) || document.contains(w.from);
            const toValid = (w.to instanceof window.VirtualJoint) || document.contains(w.to);

            if (!fromValid || !toValid) {
                w.toBeRemoved = true;
                return;
            }

            // [MOD] Smart Routing Call
            this.updateSmartPath(w, isFastMode);
        });

        // Cleanup Loop
        const invalidWires = this.wires.filter(w => w.toBeRemoved);
        invalidWires.forEach(w => this.removeWire(w));
    }
});

// Expose VirtualJoint for ProjectIO
window.VirtualJoint = VirtualJoint;

/**
 * 🧠 Smart Router (A* Pathfinding Implementation)
 * 컴포넌트 회피 및 최적 경로 탐색 (With Lead-out)
 */
const SmartRouter = {
    gridSize: 10, // 10px 격자

    findPath(start, end, obstacles, startDir = null, endDir = null) {
        // [Feature] Smart Lead-out: 핀 방향으로 20px 직진
        const leadDist = 20;

        // 방향에 따른 Lead 포인트 계산
        const getDirectionalLead = (pt, dir) => {
            if (!dir || leadDist === 0) return { x: pt.x, y: pt.y };

            const offsets = {
                'left': { dx: -leadDist, dy: 0 },
                'right': { dx: leadDist, dy: 0 },
                'up': { dx: 0, dy: -leadDist },
                'down': { dx: 0, dy: leadDist }
            };

            const offset = offsets[dir] || { dx: 0, dy: 0 };
            return { x: pt.x + offset.dx, y: pt.y + offset.dy };
        };

        const sLead = getDirectionalLead(start, startDir);
        const eLead = getDirectionalLead(end, endDir);

        const sNode = this.toGrid(sLead.x, sLead.y);
        const eNode = this.toGrid(eLead.x, eLead.y);

        const padding = 100;
        const bounds = {
            minX: Math.min(start.x, end.x) - padding,
            maxX: Math.max(start.x, end.x) + padding,
            minY: Math.min(start.y, end.y) - padding,
            maxY: Math.max(start.y, end.y) + padding
        };

        const openSet = [];
        const closedSet = new Set();

        openSet.push({
            x: sNode.x, y: sNode.y,
            g: 0, h: this.heuristic(sNode, eNode),
            parent: null, dir: null
        });

        let loops = 0;
        const maxLoops = 3000;

        while (openSet.length > 0) {
            if (loops++ > maxLoops) return null;

            openSet.sort((a, b) => (a.g + a.h) - (b.g + b.h));
            const current = openSet.shift();
            const key = `${current.x},${current.y}`;

            if (closedSet.has(key)) continue;
            closedSet.add(key);

            if (Math.abs(current.x - eNode.x) < 5 && Math.abs(current.y - eNode.y) < 5) {
                return this.reconstructPath(current, start, end, sLead, eLead);
            }

            const neighbors = [
                { x: current.x, y: current.y - this.gridSize, dir: 'up' },
                { x: current.x, y: current.y + this.gridSize, dir: 'down' },
                { x: current.x - this.gridSize, y: current.y, dir: 'left' },
                { x: current.x + this.gridSize, y: current.y, dir: 'right' }
            ];

            for (const n of neighbors) {
                if (n.x < bounds.minX || n.x > bounds.maxX || n.y < bounds.minY || n.y > bounds.maxY) continue;
                if (this.isColliding(n.x, n.y, obstacles)) continue;

                const turnPenalty = (current.dir && current.dir !== n.dir) ? 5 : 0;
                const gScore = current.g + 10 + turnPenalty;

                const neighborKey = `${n.x},${n.y}`;
                if (closedSet.has(neighborKey)) continue;

                const existing = openSet.find(o => o.x === n.x && o.y === n.y);
                if (!existing || gScore < existing.g) {
                    if (!existing) {
                        openSet.push({
                            x: n.x, y: n.y,
                            g: gScore, h: this.heuristic(n, eNode),
                            parent: current, dir: n.dir
                        });
                    } else {
                        existing.g = gScore; existing.parent = current; existing.dir = n.dir;
                    }
                }
            }
        }
        return null; // Fallback
    },

    toGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    },

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    },

    isColliding(x, y, obstacles) {
        const margin = 5;
        for (const obs of obstacles) {
            if (x >= obs.left - margin && x <= obs.right + margin &&
                y >= obs.top - margin && y <= obs.bottom + margin) {
                return true;
            }
        }
        return false;
    },

    reconstructPath(node, startReal, endReal, startLead, endLead) {
        const grid = this.gridSize;
        const snap = (v) => Math.round(v / grid) * grid;

        const path = [];
        let curr = node;
        while (curr) {
            path.push({ x: snap(curr.x), y: snap(curr.y) });
            curr = curr.parent;
        }
        path.reverse();

        // Lead 포인트도 그리드에 스냅
        path.unshift({ x: snap(startLead.x), y: snap(startLead.y) });
        // 실제 핀 위치는 스냅하지 않음 (정확한 연결 유지)
        path.unshift({ x: startReal.x, y: startReal.y });

        path.push({ x: snap(endLead.x), y: snap(endLead.y) });
        path.push({ x: endReal.x, y: endReal.y });

        return path;
    },

    /**
     * 경로 데이터를 SVG D 문자열로 변환
     */
    toPathString(path) {
        if (!path || path.length === 0) return '';

        // 경로 단순화: 일직선상의 중간 점 제거
        const simplified = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const curr = path[i];
            const next = path[i + 1];

            // 세 점이 일직선이면 중간 점 스킵
            const sameX = prev.x === curr.x && curr.x === next.x;
            const sameY = prev.y === curr.y && curr.y === next.y;
            if (!sameX && !sameY) {
                simplified.push(curr);
            }
        }
        if (path.length > 1) simplified.push(path[path.length - 1]);

        // SVG 경로 생성
        let d = `M ${simplified[0].x} ${simplified[0].y}`;
        for (let i = 1; i < simplified.length; i++) {
            d += ` L ${simplified[i].x} ${simplified[i].y}`;
        }
        return d;
    }
};

// WireManager 확장에 Router 통합
Object.assign(CircuitSimulator.prototype, {
    // ... (기존 메서드들 중 일부 오버라이드 또는 추가) ...

    /**
     * [Routing] 스마트 경로 계산 (충돌 회피)
     */
    updateSmartPath(wire, skipObstacles = false) {
        if (!wire || !wire.from || !wire.to) return;

        const start = this.getNodePosition(wire.from);
        const end = this.getNodePosition(wire.to);

        // 드래그 중이거나 옵션이 꺼져있으면 기본 직각 라우팅 (빠름)
        if (this.isWiring || skipObstacles) {
            this.updateOrthogonalPath(wire.line, start.x, start.y, end.x, end.y);
            this.updateOrthogonalPath(wire.hitbox, start.x, start.y, end.x, end.y);
            return;
        }

        // [Smart Lead-out] 핀 방향 계산
        const getPinDirection = (node) => {
            // VirtualJoint는 방향 없음
            if (!node || !node.closest) return null;

            const comp = node.closest('.component');
            if (!comp) return null;

            const pinRect = node.getBoundingClientRect();
            const compRect = comp.getBoundingClientRect();
            const wsRect = this.workspace.getBoundingClientRect();
            const scale = this.scale || 1;

            // 핀 중심과 컴포넌트 중심 (월드 좌표)
            const pinX = (pinRect.left + pinRect.width / 2 - wsRect.left) / scale;
            const pinY = (pinRect.top + pinRect.height / 2 - wsRect.top) / scale;
            const compX = (compRect.left + compRect.width / 2 - wsRect.left) / scale;
            const compY = (compRect.top + compRect.height / 2 - wsRect.top) / scale;

            const dx = pinX - compX;
            const dy = pinY - compY;

            // 더 큰 축 방향 선택
            if (Math.abs(dx) > Math.abs(dy)) {
                return dx > 0 ? 'right' : 'left';
            } else {
                return dy > 0 ? 'down' : 'up';
            }
        };

        const startDir = getPinDirection(wire.from);
        const endDir = getPinDirection(wire.to);

        // 장애물 수집 (캐싱 가능)
        const obstacles = [];
        document.querySelectorAll('.component').forEach(comp => {
            // [Fix] Node check for VirtualJoint compatibility
            const fromDOM = (wire.from && wire.from.nodeType) ? wire.from : null;
            const toDOM = (wire.to && wire.to.nodeType) ? wire.to : null;
            const isConnected = (fromDOM && comp.contains(fromDOM)) || (toDOM && comp.contains(toDOM));

            if (!isConnected) {
                const rect = comp.getBoundingClientRect();
                const wsRect = this.workspace.getBoundingClientRect();
                const scale = this.scale || 1;

                obstacles.push({
                    left: (rect.left - wsRect.left) / scale,
                    top: (rect.top - wsRect.top) / scale,
                    right: (rect.right - wsRect.left) / scale,
                    bottom: (rect.bottom - wsRect.top) / scale
                });
            }
        });

        // A* 실행 (핀 방향 전달)
        const pathPoints = SmartRouter.findPath(start, end, obstacles, startDir, endDir);

        if (pathPoints) {
            const d = SmartRouter.toPathString(pathPoints);
            wire.line.setAttribute('d', d);
            wire.hitbox.setAttribute('d', d);
        } else {
            // 경로 못 찾으면 기본 라우팅 Fallback
            this.updateOrthogonalPath(wire.line, start.x, start.y, end.x, end.y);
            this.updateOrthogonalPath(wire.hitbox, start.x, start.y, end.x, end.y);
        }
    }
});
