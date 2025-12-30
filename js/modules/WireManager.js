/**
 * ??WireManager 3.0: High-Performance EDA Wiring System
 * 
 * [Key Features]
 * 1. Netlist Integration: Connects directly with NetManager for O(1) simulation.
 * 2. Virtual Joints: Lightweight SVG-based joints (No DOM overhead).
 * 3. Smart Orthogonal Routing: Manhattan geometry with intelligent pathfinding.
 * 4. Hitbox System: Invisible wide stroke for easy selection.
 */

// === Virtual Joint Class ===
// 媛踰쇱슫 議곗씤??媛앹껜 (DOM ?붿냼媛 ?꾨떂)
class VirtualJoint {
    constructor(x, y, manager) {
        this.x = x;
        this.y = y;
        this.manager = manager;
        this.id = 'vj_' + Math.random().toString(36).substr(2, 9);
        this.connectedWires = []; // ?곌껐????댁뼱??

        // SVG Element (?뚮뜑留곸슜)
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.element.setAttribute('r', '4'); // 諛섏?由?4px
        this.element.setAttribute('cx', x);
        this.element.setAttribute('cy', y);
        this.element.classList.add('virtual-joint');

        // ?ㅽ???(CSS濡?類??섎룄 ?덉?留??뺤떎???곸슜???꾪빐)
        this.element.style.fill = '#22d3ee'; // Cyan
        this.element.style.stroke = '#fff';
        this.element.style.strokeWidth = '2px';
        this.element.style.cursor = 'move';
        this.element.style.pointerEvents = 'all';

        // ?대깽??
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
            // redrawWires ?대??먯꽌 isDragging ?깆쓣 泥댄겕?섎?濡?
            // ?ш린?쒕뒗 媛뺤젣濡?isDragging???됰궡?닿굅??吏곸젒 updateSmartPath ?몄텧???섏쓬
            // ?섏?留?redrawWires()媛 媛???덉쟾.
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

    // ? ?명꽣?섏씠???명솚 (getPinCenter ?깆뿉???ъ슜)
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
        return null; // LogicEngine?먯꽌 泥댄겕 ???덉쟾?섍쾶 泥섎━
    }
}

// === Main WireManager Implementation ===
Object.assign(CircuitSimulator.prototype, {

    // 珥덇린 ?곹깭 (Main.js ?깆뿉???몄텧 ?꾩슂 ?녾쾶 Lazy Init 媛?ν븯吏留?紐낆떆???좎뼵)
    // this.virtualJoints = []; 
    // this.wires = []; 

    /**
     * [Event] ?/議곗씤?몄뿉??留덉슦???ㅼ슫 (諛곗꽑 ?쒖옉)
     */
    handlePinDown(e, startNode) {
        if (window.isReadOnlyMode) return;
        e.stopPropagation();
        e.preventDefault();

        if (this.mode !== 'edit' && this.mode !== 'wire') return;

        // ?대? 諛곗꽑 以묒씠硫??곌껐 ?꾨즺 ?쒕룄
        if (this.isWiring && this.startNode) {
            if (this.startNode !== startNode) {
                this.tryFinishWiring(startNode);
            } else {
                this.cancelWiring(); // 媛숈? ? ?대┃ = 痍⑥냼
            }
            return;
        }

        // ??諛곗꽑 ?쒖옉
        this.startWiring(startNode);
    },

    /**
     * 諛곗꽑 紐⑤뱶 吏꾩엯
     */
    startWiring(node) {
        this.isWiring = true;
        this.startNode = node;
        this.snappedNode = null;

        // ?몃뱶 ?쒖꽦???쒖떆 (???寃쎌슦留?
        if (node.classList) node.classList.add('active');

        // ?꾩떆 ??댁뼱 (Visual Guide)
        this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempWire.setAttribute('fill', 'none');
        this.tempWire.style.stroke = 'var(--accent-secondary, #3498db)';
        this.tempWire.style.strokeWidth = '2px';
        this.tempWire.style.strokeDasharray = '4,4';
        this.tempWire.style.pointerEvents = 'none';

        this.wireLayer.appendChild(this.tempWire);

        // ?쒖옉???낅뜲?댄듃
        const pos = this.getNodePosition(node);
        this.updateOrthogonalPath(this.tempWire, pos.x, pos.y, pos.x, pos.y);
    },

    /**
     * [Event] 留덉슦???대룞 (??댁뼱 ?꾨━酉?
     */
    handleWireMove(e) {
        if (!this.isWiring || !this.startNode || !this.tempWire) return;

        // 醫뚰몴 怨꾩궛
        const pos = this.getMousePosition(e);
        const mouseX = pos.x;
        const mouseY = pos.y;

        // ?ㅻ깄 ?寃?李얘린 (Pin or VirtualJoint)
        this.findSnapTarget(mouseX, mouseY);

        const startPos = this.getNodePosition(this.startNode);
        let targetX = mouseX;
        let targetY = mouseY;

        // ?ㅻ깄 
        if (this.snappedNode) {
            const snapPos = this.getNodePosition(this.snappedNode);
            targetX = snapPos.x;
            targetY = snapPos.y;
            this.tempWire.style.stroke = '#2ecc71'; // Green
            this.tempWire.style.strokeWidth = '3px';
        } else {
            this.tempWire.style.stroke = 'var(--accent-secondary, #3498db)';
            this.tempWire.style.strokeWidth = '2px';

            // ?덇났????洹몃━???ㅻ깄 (Grid Snap) - 10px ?⑥쐞
            // targetX = Math.round(targetX / 10) * 10;
            // targetY = Math.round(targetY / 10) * 10;
            // (?ъ슜?먭? ?먰븯?⑥쓬)
            targetX = Math.round(mouseX / 10) * 10;
            targetY = Math.round(mouseY / 10) * 10;
        }

        // 吏곴컖 寃쎈줈 ?낅뜲?댄듃
        this.updateOrthogonalPath(this.tempWire, startPos.x, startPos.y, targetX, targetY);
    },

    /**
     * [Event] 諛곗꽑 醫낅즺 ?쒕룄
     */
    tryFinishWiring(endNode) {
        if (!this.startNode || !endNode || this.startNode === endNode) {
            this.cancelWiring();
            return;
        }

        // ?좏슚??寃??(媛숈? 而댄룷?뚰듃, 異쒕젰-異쒕젰 ??
        if (!this.validateConnection(this.startNode, endNode)) {
            this.cancelWiring();
            return;
        }

        // ??댁뼱 ?앹꽦
        this.createWire(this.startNode, endNode);
        this.cancelWiring();
    },

    /**
     * ?곌껐 ?좏슚??寃??
     */
    validateConnection(nodeA, nodeB) {
        // VirtualJoint???쒖빟 ?놁쓬
        const isJointA = nodeA instanceof VirtualJoint;
        const isJointB = nodeB instanceof VirtualJoint;
        if (isJointA || isJointB) return true;

        // Pin - Pin ??寃쎌슦
        if (nodeA.parentElement === nodeB.parentElement) {
            this.showToast('媛숈? 而댄룷?뚰듃 ?대? ?곌껐 遺덇?', 'warning');
            return false;
        }

        // Output - Output 諛⑹?
        const isOutA = this.isOutputPin(nodeA);
        const isOutB = this.isOutputPin(nodeB);
        if (!this.expertMode && isOutA && isOutB) {
            this.showToast('異쒕젰-異쒕젰 異⑸룎 ?꾪뿕', 'warning');
            return false;
        }
        return true;
    },

    isOutputPin(pin) {
        return pin.classList.contains('output') || pin.classList.contains('emit') || pin.classList.contains('out');
    },

    /**
     * 諛곗꽑 痍⑥냼
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

        // ?ㅻ깄 ?섏씠?쇱씠???쒓굅
        document.querySelectorAll('.pin.snap-target').forEach(p => p.classList.remove('snap-target'));
        if (this.virtualJoints) {
            this.virtualJoints.forEach(vj => vj.element.classList.remove('snap-target'));
        }
    },

    /**
     * [Core] ??댁뼱 ?앹꽦
     */
    createWire(fromNode, toNode, options = {}) {
        const { skipSave = false, skipRedraw = false } = options;

        // 以묐났 泥댄겕
        const exist = this.wires.find(w =>
            (w.from === fromNode && w.to === toNode) ||
            (w.from === toNode && w.to === fromNode)
        );
        if (exist) return null;

        // 1. Visible Line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('wire-line');
        line.style.stroke = '#22d3ee';
        line.style.strokeWidth = '2px'; // ?뉕퀬 ?몃젴?섍쾶
        line.style.fill = 'none';
        line.style.strokeLinecap = 'round';
        line.style.strokeLinejoin = 'round';
        line.style.pointerEvents = 'none'; // ?대┃ 遺덇?

        // 2. Invisible Hitbox (15px)
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitbox.classList.add('wire-hitbox');
        hitbox.classList.add('wire-path'); // ?명솚??
        hitbox.style.stroke = 'transparent';
        hitbox.style.strokeWidth = '15px';
        hitbox.style.fill = 'none';
        hitbox.style.cursor = 'crosshair';
        hitbox.style.pointerEvents = 'stroke';

        // Hitbox Events
        hitbox.onmousedown = (e) => {
            if (this.mode === 'pan' || e.button === 1) return;
            e.stopPropagation();
            // 醫뚰겢由? 議곗씤???앹꽦
            if (e.button === 0) {
                this.splitWireWithJoint(newWire, e);
            }
        };

        hitbox.oncontextmenu = (e) => {
            e.preventDefault();
            // ?고겢由? ??젣 (ContextMenuManager媛 ??뼱???섎룄 ?덉쓬)
            // ?ш린??媛꾨떒 ??젣 濡쒖쭅
            this.removeWire(newWire);
            if (this.netManager) this.netManager.onWireRemoved(newWire);
        };

        this.wireLayer.appendChild(line);
        this.wireLayer.appendChild(hitbox);

        const newWire = { from: fromNode, to: toNode, line, hitbox };
        this.wires.push(newWire);

        // NetManager ?깅줉
        if (this.netManager) {
            this.netManager.onWireCreated(newWire);
        }

        // [Smart Route] Initial Calculation (with obstacle avoidance)
        // redrawWires?먯꽌 ?ㅼ떆 洹몃┫ ?섎룄 ?덉?留?珥덇린 怨꾩궛 以묒슂
        this.updateSmartPath(newWire, false);

        if (!skipRedraw) this.redrawWires();
        if (!skipSave) this.saveState();

        return newWire;
    },

    /**
     * [Core] ??댁뼱 ?쒓굅
     */
    removeWire(wire) {
        if (!wire) return;

        // [Wire Avoidance] 寃쎈줈 ? ?댁젣
        if (wire._pathPoints) {
            SmartRouter.unregisterPath(wire._pathPoints);
        }

        wire.line.remove();
        wire.hitbox.remove();

        const idx = this.wires.indexOf(wire);
        if (idx !== -1) this.wires.splice(idx, 1);

        // NetManager ?낅뜲?댄듃
        if (this.netManager) this.netManager.onWireRemoved(wire);

        // ?곌껐??議곗씤?멸? 怨좊┰?섎㈃ ?쒓굅? (Optional)
        // ?쇰떒 ?좎?.
    },

    /**
     * [Routing] 吏곴컖 寃쎈줈 怨꾩궛 (Smart Manhattan)
     */
    updateOrthogonalPath(pathElement, x1, y1, x2, y2) {
        // 10px Grid Snap for clean lines (?쒖옉/?앹젏 ?쒖쇅??以묎컙?먮쭔)
        const grid = 10;
        const snap = (v) => Math.round(v / grid) * grid;

        let d = '';
        const dx = x2 - x1;
        const dy = y2 - y1;

        // 吏곸꽑
        if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
            d = `M ${x1} ${y1} L ${x2} ${y2}`;
        }
        else {
            // Z-Shape: 以묎컙 爰얠엫?먯쓣 洹몃━?쒖뿉 ?ㅻ깄
            const midX = snap((x1 + x2) / 2);
            d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
        }
        pathElement.setAttribute('d', d);
    },

    /**
     * [Feature] ??댁뼱 以묎컙??議곗씤???쎌엯
     */
    splitWireWithJoint(wire, event) {
        const mousePos = this.getMousePosition(event);
        // 洹몃━???ㅻ깄
        const jx = Math.round(mousePos.x / 10) * 10;
        const jy = Math.round(mousePos.y / 10) * 10;

        // 媛??議곗씤???앹꽦
        const joint = new VirtualJoint(jx, jy, this);
        if (!this.virtualJoints) this.virtualJoints = [];
        this.virtualJoints.push(joint);
        this.wireLayer.appendChild(joint.element);

        // [Feature] 議곗씤??利됱떆 ?쒕옒洹?(?꾩튂 ?섏젙 ?⑹씠??
        if (joint.startDrag) joint.startDrag(event);

        // 湲곗〈 ??댁뼱 ?쒓굅
        const { from, to } = wire;
        this.removeWire(wire);

        // ????댁뼱 2媛??앹꽦
        this.createWire(from, joint, { skipSave: true });
        this.createWire(joint, to, { skipSave: true });

        this.saveState();
    },

    /**
     * [Helper] ?몃뱶(? ?먮뒗 議곗씤?? ?꾩튂 援ы븯湲?
     */
    getNodePosition(node) {
        // 1. Virtual Joint
        if (node instanceof VirtualJoint) {
            return { x: node.x, y: node.y };
        }
        // 2. DOM Pin
        const rect = node.getBoundingClientRect();
        // Workspace scale ??낫??
        const wsRect = this.workspace.getBoundingClientRect();
        const scale = this.scale || 1;

        return {
            x: (rect.left + rect.width / 2 - wsRect.left) / scale,
            y: (rect.top + rect.height / 2 - wsRect.top) / scale
        };
    },

    /**
     * [Helper] 留덉슦???붾뱶 醫뚰몴
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
     * [Helper] ?ㅻ깄 ?寃?李얘린 (Pin + VirtualJoint)
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
                // 嫄곕━ 泥댄겕 (vj.x, vj.y???대? ?붾뱶 醫뚰몴)
                if (Math.hypot(vj.x - x, vj.y - y) < threshold) {
                    this.snappedNode = vj;
                    vj.element.classList.add('snap-target');
                    return;
                }
            }
        }
    },

    // 湲濡쒕쾶 留덉슦????
    handleGlobalWireUp(e) {
        if (!this.isWiring) return;
        if (this.snappedNode) {
            this.tryFinishWiring(this.snappedNode);
        }
        // ?대┃-?대┃ 紐⑤뱶??寃쎌슦 ?덇났 ?대┃? 臾댁떆 (怨꾩냽 諛곗꽑)
    },

    // 由щ뱶濡쒖슦
    redrawWires() {
        if (!this.workspace) return;

        // Fast Mode Check: Wiring, Panning, or Dragging
        const isFastMode = this.isWiring || this.mode === 'pan' || !!this.isDragging;

        this.wires.forEach(w => {
            // ?좏슚??泥댄겕 (DOM Pin???щ씪議뚯쑝硫??쒓굅)
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
 * ?쭬 Smart Router (A* Pathfinding Implementation)
 * 而댄룷?뚰듃 ?뚰뵾 諛?理쒖쟻 寃쎈줈 ?먯깋 (With Lead-out)
const SmartRouter = {
    gridSize: 10, // 10px 寃⑹옄
    usedCells: new Set(), // ?ъ슜??洹몃━??? 異붿쟻
    
    // ? ???앹꽦
    cellKey(x, y) {
        const gx = Math.round(x / this.gridSize) * this.gridSize;
        const gy = Math.round(y / this.gridSize) * this.gridSize;
        return `${gx},${gy}`;
    },
    
    // 寃쎈줈瑜??ъ슜???濡??깅줉
    registerPath(pathPoints) {
        if (!pathPoints) return;
        for (const pt of pathPoints) {
            this.usedCells.add(this.cellKey(pt.x, pt.y));
        }
    },
    
    // ? ?ъ슜 ?댁젣 (??댁뼱 ??젣 ??
    unregisterPath(pathPoints) {
        if (!pathPoints) return;
        for (const pt of pathPoints) {
            this.usedCells.delete(this.cellKey(pt.x, pt.y));
        }
    },
    
    // ????ъ슜 以묒씤吏 ?뺤씤
    isCellUsed(x, y) {
        return this.usedCells.has(this.cellKey(x, y));
    },
    
    // ?꾩껜 珥덇린??
    clearUsedCells() {
        this.usedCells.clear();
    },

    findPath(start, end, obstacles, startDir = null, endDir = null) {
        // [Feature] Smart Lead-out: ? 諛⑺뼢?쇰줈 20px 吏곸쭊
        const leadDist = 20;

        // 諛⑺뼢???곕Ⅸ Lead ?ъ씤??怨꾩궛
        const getDirectionalLead = (pt, dir, target) => {
            if (!dir || leadDist === 0) return { x: pt.x, y: pt.y };

            // ?ㅻ쭏???ㅽ궢: Lead-out 諛⑺뼢??紐⑹쟻吏? 諛섎?硫??ㅽ궢
            const dx = target.x - pt.x;
            const dy = target.y - pt.y;

            // ?섑룊 ?곌껐(y 鍮꾩듂)?몃뜲 ????Lead-out?대㈃ ?ㅽ궢
            if (Math.abs(dy) < 30 && (dir === 'up' || dir === 'down')) {
                return { x: pt.x, y: pt.y };
            }
            // ?섏쭅 ?곌껐(x 鍮꾩듂)?몃뜲 醫???Lead-out?대㈃ ?ㅽ궢
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

        // [Fast Path] 媛꾨떒??寃쎈줈 泥댄겕: 吏곸꽑 ?먮뒗 ?⑥닚 吏곴컖
        const trySimplePath = () => {
            const grid = this.gridSize;
            const snap = (v) => Math.round(v / grid) * grid;

            // 嫄곗쓽 ?섑룊??寃쎌슦
            if (Math.abs(start.y - end.y) < 20) {
                const midY = snap((start.y + end.y) / 2);
                // 吏곸꽑 寃쎈줈媛 ?μ븷臾쇱뿉 ??嫄몃━?붿? 泥댄겕
                const blocked = obstacles.some(obs =>
                    midY >= obs.top && midY <= obs.bottom &&
                    Math.min(start.x, end.x) < obs.right && Math.max(start.x, end.x) > obs.left
                );
                if (!blocked) {
                    return [
                        { x: start.x, y: start.y },
                        { x: end.x, y: end.y }
                    ];
                }
            }

            // 嫄곗쓽 ?섏쭅??寃쎌슦
            if (Math.abs(start.x - end.x) < 20) {
                const midX = snap((start.x + end.x) / 2);
                const blocked = obstacles.some(obs =>
                    midX >= obs.left && midX <= obs.right &&
                    Math.min(start.y, end.y) < obs.bottom && Math.max(start.y, end.y) > obs.top
                );
                if (!blocked) {
                    return [
                        { x: start.x, y: start.y },
                        { x: end.x, y: end.y }
                    ];
                }
            }

            // Z-Shape 寃쎈줈 ?쒕룄 (以묎컙?먯꽌 爰얘린)
            const midX = snap((start.x + end.x) / 2);
            const zBlocked = obstacles.some(obs => {
                // ?섑룊??泥댄겕
                const hLine1 = start.y >= obs.top && start.y <= obs.bottom &&
                    Math.min(start.x, midX) < obs.right && Math.max(start.x, midX) > obs.left;
                const hLine2 = end.y >= obs.top && end.y <= obs.bottom &&
                    Math.min(midX, end.x) < obs.right && Math.max(midX, end.x) > obs.left;
                // ?섏쭅??泥댄겕
                const vLine = midX >= obs.left && midX <= obs.right &&
                    Math.min(start.y, end.y) < obs.bottom && Math.max(start.y, end.y) > obs.top;
                return hLine1 || hLine2 || vLine;
            });

            if (!zBlocked) {
                return [
                    { x: start.x, y: start.y },
                    { x: midX, y: start.y },
                    { x: midX, y: end.y },
                    { x: end.x, y: end.y }
                ];
            }

            return null; // A* ?꾩슂
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

        path.unshift({ x: snap(startLead.x), y: snap(startLead.y) });
        path.unshift({ x: startReal.x, y: startReal.y });

        path.push({ x: snap(endLead.x), y: snap(endLead.y) });
        path.push({ x: endReal.x, y: endReal.y });

        return path;
    },

    /**
     * 寃쎈줈 ?곗씠?곕? SVG D 臾몄옄?대줈 蹂??
     */
    toPathString(path) {
        if (!path || path.length === 0) return '';

        const simplified = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const curr = path[i];
            const next = path[i + 1];

            const sameX = prev.x === curr.x && curr.x === next.x;
            const sameY = prev.y === curr.y && curr.y === next.y;

            if (!sameX && !sameY) {
                simplified.push(curr);
            }
        }
        simplified.push(path[path.length - 1]);

        let d = `M ${simplified[0].x} ${simplified[0].y}`;
        for (let i = 1; i < simplified.length; i++) {
            d += ` L ${simplified[i].x} ${simplified[i].y}`;
        }
        return d;
    }
};

// WireManager ?뺤옣??Router ?듯빀
Object.assign(CircuitSimulator.prototype, {
    // ... (湲곗〈 硫붿꽌?쒕뱾 以??쇰? ?ㅻ쾭?쇱씠???먮뒗 異붽?) ...

    /**
     * [Routing] ?ㅻ쭏??寃쎈줈 怨꾩궛 (異⑸룎 ?뚰뵾)
     */
    updateSmartPath(wire, skipObstacles = false) {
        if (!wire || !wire.from || !wire.to) return;

        const start = this.getNodePosition(wire.from);
        const end = this.getNodePosition(wire.to);

        // ?쒕옒洹?以묒씠嫄곕굹 ?듭뀡??爰쇱졇?덉쑝硫?湲곕낯 吏곴컖 ?쇱슦??(鍮좊쫫)
        if (this.isWiring || skipObstacles) {
            this.updateOrthogonalPath(wire.line, start.x, start.y, end.x, end.y);
            this.updateOrthogonalPath(wire.hitbox, start.x, start.y, end.x, end.y);
            return;
        }

        // [Smart Lead-out] ? 諛⑺뼢 怨꾩궛
        const getPinDirection = (node) => {
            // VirtualJoint??諛⑺뼢 ?놁쓬
            if (!node || !node.closest) return null;

            const comp = node.closest('.component');
            if (!comp) return null;

            const pinRect = node.getBoundingClientRect();
            const compRect = comp.getBoundingClientRect();
            const wsRect = this.workspace.getBoundingClientRect();
            const scale = this.scale || 1;

            // ? 以묒떖怨?而댄룷?뚰듃 以묒떖 (?붾뱶 醫뚰몴)
            const pinX = (pinRect.left + pinRect.width / 2 - wsRect.left) / scale;
            const pinY = (pinRect.top + pinRect.height / 2 - wsRect.top) / scale;
            const compX = (compRect.left + compRect.width / 2 - wsRect.left) / scale;
            const compY = (compRect.top + compRect.height / 2 - wsRect.top) / scale;

            const dx = pinX - compX;
            const dy = pinY - compY;

            // ????異?諛⑺뼢 ?좏깮
            if (Math.abs(dx) > Math.abs(dy)) {
                return dx > 0 ? 'right' : 'left';
            } else {
                return dy > 0 ? 'down' : 'up';
            }
        };

        const startDir = getPinDirection(wire.from);
        const endDir = getPinDirection(wire.to);

        // ?μ븷臾??섏쭛 (罹먯떛 媛??
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

        // [Wire Avoidance] 鍮꾪솢?깊솕 - ?덈Т 怨듦꺽?곸쑝濡??묐룞?섏뿬 寃쎈줈媛 蹂듭옟?댁쭚
        // TODO: ???ㅻ쭏?명븳 ?뚭퀬由ъ쬁?쇰줈 媛쒖꽑 ?꾩슂
        /*
        const wireMargin = 8;
        this.wires.forEach(otherWire => {
            if (otherWire === wire) return;
            const pathStr = otherWire.line?.getAttribute('d');
            if (!pathStr) return;
            const points = [];
            const regex = /([ML])\s*([\d.-]+)\s+([\d.-]+)/g;
            let match;
            while ((match = regex.exec(pathStr)) !== null) {
                points.push({ x: parseFloat(match[2]), y: parseFloat(match[3]) });
            }
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                obstacles.push({
                    left: Math.min(p1.x, p2.x) - wireMargin,
                    right: Math.max(p1.x, p2.x) + wireMargin,
                    top: Math.min(p1.y, p2.y) - wireMargin,
                    bottom: Math.max(p1.y, p2.y) + wireMargin
                });
            }
        });
        */

        // A* ?ㅽ뻾 (? 諛⑺뼢 ?꾨떖)
        const pathPoints = SmartRouter.findPath(start, end, obstacles, startDir, endDir);

        if (pathPoints) {
            const d = SmartRouter.toPathString(pathPoints);
            wire.line.setAttribute('d', d);
            wire.hitbox.setAttribute('d', d);

            // [Wire Avoidance] 寃쎈줈瑜??ъ슜???濡??깅줉
            SmartRouter.registerPath(pathPoints);
            wire._pathPoints = pathPoints; // ?섏쨷????젣 ???ъ슜
        } else {
            // 寃쎈줈 紐?李얠쑝硫?湲곕낯 ?쇱슦??Fallback
            this.updateOrthogonalPath(wire.line, start.x, start.y, end.x, end.y);
            this.updateOrthogonalPath(wire.hitbox, start.x, start.y, end.x, end.y);
        }
    },

    // [Fix] ?꾨씫???명꽣?숈뀡 ?몃뱾??蹂듦뎄
    handlePinDown(e, pin) {
        if (e.button !== 0) return;
        // Inverter/Gateway??input pin???대? ?곌껐???좎씠 ?덈떎硫??쒓굅 (1:1 ?곌껐)
        if (pin.classList.contains('input-pin')) {
            const existingWire = this.wires.find(w => w.to === pin);
            if (existingWire) this.removeWire(existingWire);
        }
        this.startWiring(pin);
        e.stopPropagation();
    },

    startWiring(pin) {
        this.isWiring = true;
        this.startPin = pin;
        this.startNode = pin;

        const svgNS = "http://www.w3.org/2000/svg";
        this.tempWire = document.createElementNS(svgNS, 'path');
        this.tempWire.setAttribute('class', 'wire-temp');
        this.tempWire.setAttribute('stroke', '#60a5fa');
        this.tempWire.setAttribute('stroke-width', '2');
        this.tempWire.setAttribute('fill', 'none');
        this.tempWire.setAttribute('d', '');
        this.tempWire.style.pointerEvents = 'none';

        if (this.wireLayer) this.wireLayer.appendChild(this.tempWire);

        // ?대깽??諛붿씤??
        this._wiringMoveHandler = (e) => this.handleWireMove(e);
        this._wiringUpHandler = (e) => {
            /* 罹붾쾭??鍮?怨??대┃ ??痍⑥냼??handleCanvasClick ?깆뿉??泥섎━?? 
               ?ш린?쒕뒗 ?덉쟾?μ튂濡쒕쭔 ??*/
        };

        // 二쇱쓽: InputHandler媛 ?대? mousemove瑜?泥섎━?섏뿬 handleWireMove瑜??몄텧?댁＜誘濡?
        // 蹂꾨낫??由ъ뒪?덈? 遺숈씠吏 ?딆븘???섏?留? ?덉쟾???꾪빐 硫붿꽌?쒕뒗 議댁옱?댁빞 ??
    },

    handleWireMove(e) {
        if (!this.isWiring || !this.startNode || !this.tempWire) return;
        const pos = this.getMousePosition(e);
        const startPos = this.getNodePosition(this.startNode);
        this.updateOrthogonalPath(this.tempWire, startPos.x, startPos.y, pos.x, pos.y);
    },

    stopWiring() {
        this.isWiring = false;
        this.startPin = null;
        this.startNode = null;
        if (this.tempWire) {
            this.tempWire.remove();
            this.tempWire = null;
        }
    },

    cancelWiring() {
        this.stopWiring();
    }
});
