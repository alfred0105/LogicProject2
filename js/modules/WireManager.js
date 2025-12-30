
/**
 * ⚡ Wire Manager Module
 * 전선 생성, 라우팅, 가상 조인트 관리, 시각화 담당
 */

/**
 * 🔗 Virtual Joint Class
 * 와이어 중간에 존재하는 가상 포인트
 * 일반 핀처럼 동작하지만 DOM 구조가 다름.
 */
class VirtualJoint {
    constructor(x, y, manager) {
        this.id = 'joint_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        this.x = x;
        this.y = y;
        this.manager = manager;

        // Visual Element
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.element.setAttribute('cx', x);
        this.element.setAttribute('cy', y);
        this.element.setAttribute('r', 4);
        this.element.setAttribute('class', 'virtual-joint');
        this.element.id = this.id;

        // Event Listeners
        this.element.onmousedown = (e) => this.onMouseDown(e);
        
        // Add to layer
        this.manager.jointLayer.appendChild(this.element);

        // DOM Compatibility Mock
        // 핀처럼 취급되기 위해 필요한 최소한의 속성들
        this.classList = {
            contains: (cls) => cls === 'virtual-joint',
            add: () => {},
            remove: () => {}
        };
        this.parentElement = null; // Important: No parent component
    }

    onMouseDown(e) {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();

        // Safety check
        if (!window.sim || !window.sim.mode) return;

        if (window.sim.mode === 'delete') {
            this.manager.removeJoint(this);
            return;
        }

        // Start Dragging
        this.startDrag(e);
    }

    startDrag(e) {
        // Safety check
        if (!window.sim) return;

        const startX = this.x;
        const startY = this.y;
        
        // 마우스 초기 위치 (Canvas 기준)
        const initialMouse = this.manager.getMousePosition(e);
        
        // 드래그 중 와이어 업데이트를 위해 연결된 와이어 찾기
        const connectedWires = this.manager.wires.filter(w => w.from === this || w.to === this);

        const onMove = (e) => {
            const currentMouse = this.manager.getMousePosition(e);
            
            // Grid Snap (10px)
            const dx = currentMouse.x - initialMouse.x;
            const dy = currentMouse.y - initialMouse.y;
            
            let nx = startX + dx;
            let ny = startY + dy;
            
            nx = Math.round(nx / 10) * 10;
            ny = Math.round(ny / 10) * 10;
            
            this.move(nx, ny);
            
            // Update Connected Wires
            connectedWires.forEach(w => this.manager.updateSmartPath(w));
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (window.sim && window.sim.saveState) window.sim.saveState();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    move(x, y) {
        this.x = x;
        this.y = y;
        this.element.setAttribute('cx', x);
        this.element.setAttribute('cy', y);
    }

    remove() {
        this.element.remove();
    }
    
    // 호환성: getBoundingClientRect
    getBoundingClientRect() {
        // 캔버스 스케일 등을 고려해야 하지만, 근사치 반환
        // 실제 라우팅에서는 getNodePosition을 사용하므로 크게 문제 안 됨
        return this.element.getBoundingClientRect();
    }
}

// 전역 노출 (다른 모듈에서 체크용)
window.VirtualJoint = VirtualJoint;

/**
 * 🧠 Smart Router (A* Pathfinding Implementation)
 * 컴포넌트 회피 및 최적 경로 탐색 (With Lead-out & Fast Path)
 */
const SmartRouter = {
    gridSize: 10, // 10px 격자
    usedCells: new Set(), // 사용된 그리드 셀 추적 (Key: "x,y")

    // 셀 키 생성
    cellKey(x, y) {
        const gx = Math.round(x / this.gridSize) * this.gridSize;
        const gy = Math.round(y / this.gridSize) * this.gridSize;
        return `${gx},${gy}`;
    },

    // 경로를 사용된 셀로 등록
    registerPath(pathPoints) {
        if (!pathPoints) return;
        for (const pt of pathPoints) {
            this.usedCells.add(this.cellKey(pt.x, pt.y));
        }
    },

    // 셀 사용 해제 (와이어 삭제 시)
    unregisterPath(pathPoints) {
        if (!pathPoints) return;
        for (const pt of pathPoints) {
            this.usedCells.delete(this.cellKey(pt.x, pt.y));
        }
    },

    // 셀이 사용 중인지 확인
    isCellUsed(x, y) {
        return this.usedCells.has(this.cellKey(x, y));
    },

    // 전체 초기화
    clearUsedCells() {
        this.usedCells.clear();
    },

    findPath(start, end, obstacles, startDir = null, endDir = null) {
        // [Feature] Smart Lead-out: 핀 방향으로 20px 직진
        const leadDist = 20;

        // 방향에 따른 Lead 포인트 계산
        const getDirectionalLead = (pt, dir, target) => {
            if (!dir || leadDist === 0) return { x: pt.x, y: pt.y };

            // 스마트 스킵: Lead-out 방향이 목적지와 반대면 스킵
            const dx = target.x - pt.x;
            const dy = target.y - pt.y;
            
            // 수평 연결(y 비슷)인데 상/하 Lead-out이면 스킵
            if (Math.abs(dy) < 30 && (dir === 'up' || dir === 'down')) {
                return { x: pt.x, y: pt.y };
            }
            // 수직 연결(x 비슷)인데 좌/우 Lead-out이면 스킵
            if (Math.abs(dx) < 30 && (dir === 'left' || dir === 'right')) {
                return { x: pt.x, y: pt.y };
            }

            const offsets = {
                'left': { dx: -leadDist, dy: 0 },
                'right': { dx: leadDist, dy: 0 },
                'up': { dx: 0, dy: -leadDist },
                'down': { dx: 0, dy: leadDist }
            };

            const offset = offsets[dir] || { dx: 0, dy: 0 };
            return { x: pt.x + offset.dx, y: pt.y + offset.dy };
        };

        const sLead = getDirectionalLead(start, startDir, end);
        const eLead = getDirectionalLead(end, endDir, start);

        // [Fast Path] 간단한 경로 체크: 직선 또는 단순 직각
        const trySimplePath = () => {
            const grid = this.gridSize;
            const snap = (v) => Math.round(v / grid) * grid;
            
            // 거의 수평인 경우
            if (Math.abs(start.y - end.y) < 20) {
                const midY = snap((start.y + end.y) / 2);
                // 직선 경로가 장애물에 안 걸리는지 체크
                const blocked = obstacles.some(obs => 
                    midY >= obs.top && midY <= obs.bottom &&
                    Math.min(start.x, end.x) < obs.right && Math.max(start.x, end.x) > obs.left
                );
                // 사용된 셀 체크 (비용이 너무 높으면 Fast Path 포기)
                // 간단하게 중간점 몇 개만 체크
                const midX = (start.x + end.x) / 2;
                const cellUsed = this.isCellUsed(midX, midY) || this.isCellUsed(start.x + 10, midY) || this.isCellUsed(end.x - 10, midY);

                if (!blocked && !cellUsed) {
                    return [
                        { x: start.x, y: start.y },
                        { x: end.x, y: end.y }
                    ];
                }
            }
            
            // 거의 수직인 경우
            if (Math.abs(start.x - end.x) < 20) {
                const midX = snap((start.x + end.x) / 2);
                const blocked = obstacles.some(obs => 
                    midX >= obs.left && midX <= obs.right &&
                    Math.min(start.y, end.y) < obs.bottom && Math.max(start.y, end.y) > obs.top
                );
                const midY = (start.y + end.y) / 2;
                const cellUsed = this.isCellUsed(midX, midY);
                
                if (!blocked && !cellUsed) {
                    return [
                        { x: start.x, y: start.y },
                        { x: end.x, y: end.y }
                    ];
                }
            }
            
            // Z-Shape 경로 시도 (중간에서 꺾기)
            const midX = snap((start.x + end.x) / 2);
            const zBlocked = obstacles.some(obs => {
                // 수평선 체크
                const hLine1 = start.y >= obs.top && start.y <= obs.bottom && 
                               Math.min(start.x, midX) < obs.right && Math.max(start.x, midX) > obs.left;
                const hLine2 = end.y >= obs.top && end.y <= obs.bottom &&
                               Math.min(midX, end.x) < obs.right && Math.max(midX, end.x) > obs.left;
                // 수직선 체크
                const vLine = midX >= obs.left && midX <= obs.right &&
                              Math.min(start.y, end.y) < obs.bottom && Math.max(start.y, end.y) > obs.top;
                return hLine1 || hLine2 || vLine;
            });
            
            // Z-Shape 사용 셀 체크는 복잡하므로 Fast Path에서는 생략하거나 A*로 넘김
            if (!zBlocked && !this.isCellUsed(midX, (start.y + end.y)/2)) {
                return [
                    { x: start.x, y: start.y },
                    { x: midX, y: start.y },
                    { x: midX, y: end.y },
                    { x: end.x, y: end.y }
                ];
            }
            
            return null; // A* 필요
        };
        
        const simplePath = trySimplePath();
        if (simplePath) return simplePath;

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
                // [Wire Avoidance] 이미 사용된 셀이면 비용 증가 (완전 차단 X)
                const overlapPenalty = this.isCellUsed(n.x, n.y) ? 50 : 0;
                const gScore = current.g + 10 + turnPenalty + overlapPenalty;

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
    initWireManager() {
        this.wires = [];
        this.wireLayer = document.getElementById('wire-layer');
        // 가상 조인트 레이어 (와이어 위)
        this.jointLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.jointLayer.id = 'joint-layer';
        this.wireLayer.parentNode.appendChild(this.jointLayer);
        
        this.isWiring = false;
        this.tempWire = null;
        
        // SmartRouter 초기화
        SmartRouter.clearUsedCells();

        // Double Click to Split Wire
        this.wireLayer.addEventListener('dblclick', (e) => {
            if (e.target.tagName === 'path' && e.target.classList.contains('wire-hitbox')) {
                const wire = this.wires.find(w => w.hitbox === e.target);
                if (wire) this.splitWireWithJoint(wire, e);
            }
        });
    },

    /**
     * [Helper] 마우스 이벤트 좌표를 Workspace 좌표로 변환
     */
    getMousePosition(e) {
        let clientX = e.clientX;
        let clientY = e.clientY;
        
        // Touch support
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
             clientX = e.changedTouches[0].clientX;
             clientY = e.changedTouches[0].clientY;
        }

        const rect = this.workspace.getBoundingClientRect();
        const scale = this.scale || 1;
        
        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale
        };
    },

    /**
     * [Core] 와이어 생성 및 연결
     */
    createWire(fromNode, toNode, { skipSave = false, skipRedraw = false } = {}) {
        if (!fromNode || !toNode) return null;
        
        // 중복 방지
        const exists = this.wires.some(w => 
            (w.from === fromNode && w.to === toNode) || 
            (w.from === toNode && w.to === fromNode)
        );
        if (exists) return null;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('class', 'wire');

        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitbox.setAttribute('class', 'wire-hitbox');
        
        // 이벤트 바인딩 (Hitbox)
        hitbox.onclick = (e) => {
            if (window.sim.mode === 'delete') {
                this.removeWire(newWire);
                if (window.sim.saveState) window.sim.saveState();
            }
        };
        hitbox.onmouseenter = () => {
             // Net highlight can be added here
        };
        hitbox.onmouseleave = () => {
             // Net highlight remove
        };
        // Context Menu for Wire
        hitbox.oncontextmenu = (e) => {
            e.preventDefault();
            // Optional: Wire Menu
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
        
        // [Wire Avoidance] 경로 셀 해제
        if (wire._pathPoints) {
            SmartRouter.unregisterPath(wire._pathPoints);
        }
        
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
        this.joints = this.joints || [];
        this.joints.push(joint);

        // 기존 와이어 제거
        const from = wire.from;
        const to = wire.to;
        this.removeWire(wire);

        // 새 와이어 2개 생성
        // [UX Improvement] 바로 드래그 시작
        if(joint.startDrag) joint.startDrag(event); // Immediately start dragging

        this.createWire(from, joint, { skipSave: true });
        this.createWire(joint, to, { skipSave: true });

        this.saveState();
    },
    
    // 조인트 제거
    removeJoint(joint) {
        // 연결된 와이어 모두 제거
        const wiresToRemove = this.wires.filter(w => w.from === joint || w.to === joint);
        wiresToRemove.forEach(w => this.removeWire(w)); // removeWire에서 경로 해제됨
        
        joint.remove();
        
        if (this.joints) {
            const idx = this.joints.indexOf(joint);
            if (idx !== -1) this.joints.splice(idx, 1);
        }
        this.saveState();
    },

    getNodePosition(node) {
        if (!node) return { x: 0, y: 0 };
        
        // Virtual Joint
        if (node instanceof VirtualJoint) {
            return { x: node.x, y: node.y };
        }

        // DOM Element (Pin)
        const rect = node.getBoundingClientRect();
        const wsRect = this.workspace.getBoundingClientRect();
        const scale = this.scale || 1; // 줌 스케일 고려

        return {
            x: (rect.left + rect.width / 2 - wsRect.left) / scale,
            y: (rect.top + rect.height / 2 - wsRect.top) / scale
        };
    },

    redrawWires() {
        this.wires.forEach(wire => {
             // 드래그 중인 템프 와이어는 제외
             if(wire !== this.tempWire) {
                 this.updateSmartPath(wire, false);
             }
        });
    },

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
        
        // 이전 경로 해제 (업데이트 전)
        if (wire._pathPoints) {
            SmartRouter.unregisterPath(wire._pathPoints);
        }

        // A* 실행 (핀 방향 전달)
        const pathPoints = SmartRouter.findPath(start, end, obstacles, startDir, endDir);

        if (pathPoints) {
            const d = SmartRouter.toPathString(pathPoints);
            wire.line.setAttribute('d', d);
            wire.hitbox.setAttribute('d', d);
            
            // [Wire Avoidance] 경로를 사용된 셀로 등록
            SmartRouter.registerPath(pathPoints);
            wire._pathPoints = pathPoints; // 나중에 삭제 시 사용
        } else {
            // 경로 못 찾으면 기본 라우팅 Fallback
            this.updateOrthogonalPath(wire.line, start.x, start.y, end.x, end.y);
            this.updateOrthogonalPath(wire.hitbox, start.x, start.y, end.x, end.y);
        }
    },

    /**
     * [Iteraction] 핀 클릭 시 와이어링 시작
     */
    handlePinDown(e, pin) {
        if (e.button !== 0) return;
        
        // 입력 핀은 1개의 와이어만? -> 기존 와이어 있으면 제거하고 새로 연결 (편의성)
        if (pin.classList.contains('input-pin')) {
            const existingWire = this.wires.find(w => w.to === pin);
            if (existingWire) {
                this.removeWire(existingWire);
            }
        }

        this.startWiring(pin);
        e.stopPropagation();
    },

    /**
     * [Iteraction] 핀에서 마우스 뗐을 때 와이어링 완료
     */
    handlePinUp(e, pin) {
        if (this.isWiring && this.tempWire) {
            this.finishWiring(pin);
            e.stopPropagation();
        }
    },

    /**
     * [Core] 와이어링 시작
     */
    startWiring(startNode) {
        this.isWiring = true;
        this.startNode = startNode;

        // 임시 와이어 생성
        this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempWire.setAttribute('class', 'wire temp-wire');
        this.tempWire.style.pointerEvents = 'none';
        this.wireLayer.appendChild(this.tempWire);

        // 전역 이벤트 리스너
        this._bindWiringEvents();
    },

    _bindWiringEvents() {
        this.onWiringMove = (e) => this.updateTempWire(e);
        this.onWiringUp = (e) => this.stopWiring();

        document.addEventListener('mousemove', this.onWiringMove);
        document.addEventListener('mouseup', this.onWiringUp);
        document.addEventListener('touchmove', this.onWiringMove, { passive: false });
        document.addEventListener('touchend', this.onWiringUp);
    },

    _unbindWiringEvents() {
        if (this.onWiringMove) {
            document.removeEventListener('mousemove', this.onWiringMove);
            document.removeEventListener('touchmove', this.onWiringMove);
        }
        if (this.onWiringUp) {
            document.removeEventListener('mouseup', this.onWiringUp);
            document.removeEventListener('touchend', this.onWiringUp);
        }
    },

    /**
     * [Core] 임시 와이어 업데이트 (드래그 중)
     */
    updateTempWire(e) {
        if (!this.isWiring || !this.startNode) return;

        const startPos = this.getNodePosition(this.startNode);
        const mousePos = this.getMousePosition(e);

        // 직각 라우팅 (빠르게)
        this.updateOrthogonalPath(this.tempWire, startPos.x, startPos.y, mousePos.x, mousePos.y);
    },

    /**
     * [Core] 와이어링 완료 시도
     */
    finishWiring(endNode) {
        if (!this.isWiring || !this.startNode) return;
        if (this.startNode === endNode) return;

        // 연결 유효성 및 방향 정규화 (Output -> Input)
        const isStartInput = this.startNode.classList.contains('input-pin');
        const isEndInput = endNode.classList.contains('input-pin');

        let fromNode = this.startNode;
        let toNode = endNode;

        if (isStartInput && !isEndInput) {
            fromNode = endNode;
            toNode = this.startNode;
        }

        // 와이어 생성
        this.createWire(fromNode, toNode);
        this.stopWiring();
    },

    /**
     * [Core] 와이어링 취소/종료
     */
    stopWiring() {
        this.isWiring = false;
        this.startNode = null;
        if (this.tempWire) {
            this.tempWire.remove();
            this.tempWire = null;
        }
        this._unbindWiringEvents();
    },

    /**
     * [Alias] 와이어링 취소 (호환성)
     */
    cancelWiring() {
        this.stopWiring();
    }
});
