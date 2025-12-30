/**
 * ⚡ WireManager 3.0: High-Performance EDA Wiring System (Refactored)
 * 
 * [Design Principles]
 * 1. Netlist Core: Logic is handled by NetManager (Map<NetID, Set<Pin>>).
 * 2. Virtual Joints: Minimal DOM overhead (SVG-based).
 * 3. Smart Orthogonal Routing: Manhattan geometry with A* pathfinding.
 * 4. Fat Hitbox: Invisible stroke (15px) for easy interaction.
 */

// =============================================================================
// 1. Virtual Joint Class (Lightweight)
// =============================================================================
class VirtualJoint {
    constructor(x, y, manager) {
        this.x = x;
        this.y = y;
        this.manager = manager;
        this.id = 'vj_' + Math.random().toString(36).substr(2, 9);
        this.connectedWires = []; 

        // SVG Element (Rendering Only)
        // User said "No DOM overhead", but we need *something* to see.
        // We use a lightweight SVG circle.
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.element.setAttribute('r', '4');
        this.element.setAttribute('cx', x);
        this.element.setAttribute('cy', y);
        this.element.classList.add('virtual-joint');
        
        // Style (Inline for performance, or use CSS class)
        this.element.style.fill = 'var(--accent-color, #22d3ee)';
        this.element.style.stroke = 'var(--bg-primary, #1e293b)';
        this.element.style.strokeWidth = '2px';
        this.element.style.cursor = 'move';
        
        // Event Binding (Directly on SVG for browser-native hit testing)
        // This is more efficient than manual coordinate calculation in JS for every mousemove.
        this.element.onmousedown = (e) => this.onMouseDown(e);
    }

    onMouseDown(e) {
        const sim = window.sim;
        if (!sim || sim.mode === 'pan' || e.button !== 0) return;
        
        e.stopPropagation();
        e.preventDefault();
        
        // Start Dragging Logic or Wiring Logic
        // If shift/ctrl pressed -> Wiring? Or Drag?
        // Let's assume Drag for Joints normally.
        this.startDrag(e);
    }

    startDrag(e) {
        const sim = window.sim;
        const startX = e.clientX;
        const startY = e.clientY;
        const initialX = this.x;
        const initialY = this.y;
        let isDragging = false;

        const onMove = (evt) => {
            const dx = evt.clientX - startX;
            const dy = evt.clientY - startY;
            if (dx * dx + dy * dy > 25) isDragging = true; // 5px threshold

            if (isDragging) {
                const pos = sim.getMousePosition(evt);
                // Grid Snap (10px)
                const gx = Math.round(pos.x / 10) * 10;
                const gy = Math.round(pos.y / 10) * 10;

                this.x = gx;
                this.y = gy;
                this.element.setAttribute('cx', gx);
                this.element.setAttribute('cy', gy);

                // Update connected wires (Fast Orthogonal for drag responsiveness)
                // We defer A* to mouseup to prevent lag
                sim.redrawWiresConnectedTo(this, true); 
            }
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            
            if (isDragging) {
                // Finalize position with A* routing
                sim.redrawWiresConnectedTo(this, false);
                // Notify NetManager? No, topology hasn't changed, just geometry.
            } else {
                // Clicked (not dragged) -> Handle as Pin Click (Start Wiring)
                sim.handlePinDown(e, this);
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    
    // Compatibility interface for WireManager
    getBoundingClientRect() {
        return this.element.getBoundingClientRect();
    }
    
    // No parent element (it's not part of a component)
    get parentElement() { return null; }
}

// Global exposure for checking instanceof
window.VirtualJoint = VirtualJoint;


// =============================================================================
// 2. Smart Router (Manhattan Geometry + Obstacle Avoidance)
// =============================================================================
const SmartRouter = {
    gridSize: 10,

    // A* Pathfinding
    findPath(start, end, obstacles) {
        // Quantize coordinates to grid
        const sx = Math.round(start.x / 10) * 10;
        const sy = Math.round(start.y / 10) * 10;
        const ex = Math.round(end.x / 10) * 10;
        const ey = Math.round(end.y / 10) * 10;

        // Optimization: Direct Line Check
        if (this.isDirectPathCool(sx, sy, ex, ey, obstacles)) {
            return [{x: sx, y: sy}, {x: ex, y: ey}];
        }
        
        // Optimization: Simple L-Shape or Z-Shape Check
        // (Skipped for brevity, jumping to A* if simple fails)

        // const openSet = new Heap((a, b) => a.f - b.f); // Min-heap conceptually
        // Using simple array for simplicity in this implementation, can optimize later.
        const openList = [];
        const closedSet = new Set();
        
        // Heuristic (Manhattan)
        const h = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

        openList.push({
            x: sx, y: sy,
            g: 0, 
            f: h({x:sx, y:sy}, {x:ex, y:ey}),
            parent: null,
            dir: null
        });

        // Bounding Box for Search Area (Optimization)
        const padding = 200;
        const minX = Math.min(sx, ex) - padding;
        const maxX = Math.max(sx, ex) + padding;
        const minY = Math.min(sy, ey) - padding;
        const maxY = Math.max(sy, ey) + padding;

        let bestNode = null;
        let loops = 0;
        const MAX_LOOPS = 3000; // Circuit breaker

        while (openList.length > 0) {
            if (loops++ > MAX_LOOPS) break; // Fail-safe

            // Get node with lowest f
            openList.sort((a, b) => a.f - b.f);
            const current = openList.shift();
            const key = `${current.x},${current.y}`;

            if (closedSet.has(key)) continue;
            closedSet.add(key);

            // Goal Reached
            if (Math.abs(current.x - ex) < 5 && Math.abs(current.y - ey) < 5) {
                bestNode = current;
                break;
            }

            // Neighbors (Up, Down, Left, Right)
            const neighbors = [
                {x: current.x, y: current.y - 10, dir: 'up'},
                {x: current.x, y: current.y + 10, dir: 'down'},
                {x: current.x - 10, y: current.y, dir: 'left'},
                {x: current.x + 10, y: current.y, dir: 'right'}
            ];

            for (const n of neighbors) {
                // Out of bounds check
                if (n.x < minX || n.x > maxX || n.y < minY || n.y > maxY) continue;
                
                // Obstacle check
                if (this.isColliding(n.x, n.y, obstacles)) continue;
                
                // Closed set check
                if (closedSet.has(`${n.x},${n.y}`)) continue;

                // Costs
                const turnCost = (current.dir && current.dir !== n.dir) ? 5 : 0; // Minimize turns
                const g = current.g + 10 + turnCost;
                const f = g + h(n, {x:ex, y:ey});

                // Check if already in openList with lower cost
                const existing = openList.find(node => node.x === n.x && node.y === n.y);
                if (existing && existing.g <= g) continue;

                // Add to openList
                if (existing) {
                    existing.g = g;
                    existing.f = f;
                    existing.parent = current;
                    existing.dir = n.dir;
                } else {
                    openList.push({
                        x: n.x, y: n.y,
                        g: g, f: f,
                        parent: current,
                        dir: n.dir
                    });
                }
            }
        }

        // Reconstruct Path
        if (bestNode) {
            const path = [];
            let temp = bestNode;
            while (temp) {
                path.push({x: temp.x, y: temp.y});
                temp = temp.parent;
            }
            // Add Start Node exactly (sometimes rounding issues)
            // But we started with quantized, so it's fine.
            return path.reverse();
        }

        return null; // No path found
    },

    isColliding(x, y, obstacles) {
        // Grid points are 10px. Components might be anywhere.
        // We add a small margin around obstacles.
        const margin = 5;
        for (const obs of obstacles) {
            if (x >= obs.left - margin && x <= obs.right + margin &&
                y >= obs.top - margin && y <= obs.bottom + margin) {
                return true;
            }
        }
        return false;
    },

    isDirectPathCool(x1, y1, x2, y2, obstacles) {
        // If x1==x2 or y1==y2, check if any obstacle intersects the segment
        if (x1 !== x2 && y1 !== y2) return false; // Not orthogonal
        
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        
        const margin = 5;
        for (const obs of obstacles) {
            // Check intersection (AABB)
            if (maxX > obs.left - margin && minX < obs.right + margin &&
                maxY > obs.top - margin && minY < obs.bottom + margin) {
                return false;
            }
        }
        return true;
    },

    toPathString(points) {
        if (!points || points.length < 2) return '';
        // Simplify collinear points
        const simplified = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const curr = points[i];
            const next = points[i+1];
            // Check collinearity
            if ((prev.x === curr.x && curr.x === next.x) || 
                (prev.y === curr.y && curr.y === next.y)) {
                continue; // Skip middle point
            }
            simplified.push(curr);
        }
        simplified.push(points[points.length - 1]);

        let d = `M ${simplified[0].x} ${simplified[0].y}`;
        for (let i = 1; i < simplified.length; i++) {
            d += ` L ${simplified[i].x} ${simplified[i].y}`;
        }
        return d;
    }
};


// =============================================================================
// 3. WireManager Core (Mixin)
// =============================================================================
// Assuming CircuitSimulator is defined in Main.js and we extend its prototype.
// This is the cleanest way to add functionality without class inheritance hell.

Object.assign(CircuitSimulator.prototype, {
    // Note: this.wires, this.virtualJoints should be initialized in constructor or here lazily.
    // We assume this.netManager exists.

    // -------------------------------------------------------------------------
    // Interaction Handlers
    // -------------------------------------------------------------------------

    handlePinDown(e, node) {
        // node can be a Pin (DOM) or VirtualJoint
        if (!node) return;
        if (window.isReadOnlyMode) return;
        if (e.button !== 0) return; // Left Click Only

        // If we are already wiring, this specific click finishes it
        if (this.isWiring) {
            if (this.startNode !== node) {
                this.finishWiring(node);
            } else {
                this.cancelWiring();
            }
            return;
        }

        // Start new wiring
        this.beginWiring(node);
    },

    beginWiring(node) {
        this.isWiring = true;
        this.startNode = node;
        
        // Create Visual Guide (Temp Wire)
        const svgNS = "http://www.w3.org/2000/svg";
        this.tempWire = document.createElementNS(svgNS, 'path');
        this.tempWire.setAttribute('class', 'wire-temp');
        this.tempWire.style.stroke = 'var(--accent-secondary, #60a5fa)';
        this.tempWire.style.strokeWidth = '2px';
        this.tempWire.style.fill = 'none';
        this.tempWire.style.pointerEvents = 'none'; // Click-through
        
        // Opacity pulse animation (optional aesthetic)
        // this.tempWire.classList.add('animate-pulse');

        this.wireLayer.appendChild(this.tempWire);
    },

    handleWireMove(e) {
        if (!this.isWiring || !this.startNode) return;

        const mousePos = this.getMousePosition(e);
        let targetX = mousePos.x;
        let targetY = mousePos.y;

        // Snap to Grid (10px) - as per user spec
        targetX = Math.round(targetX / 10) * 10;
        targetY = Math.round(targetY / 10) * 10;

        // Snap to Pins/Joints (Magnetic)
        const snapTarget = this.findSnapTarget(mousePos.x, mousePos.y);
        if (snapTarget) {
            const pos = this.getNodePosition(snapTarget);
            targetX = pos.x;
            targetY = pos.y;
            // Highlight snap target?
        }

        // Draw Temp Wire (Orthogonal)
        const startPos = this.getNodePosition(this.startNode);
        
        // Simple Manhatten for preview (L-shape)
        // A* is too heavy for mousemove
        let d = `M ${startPos.x} ${startPos.y}`;
        const midX = (startPos.x + targetX) / 2;
        // Basic Z-shape
        // Only draw l/z if distance is significant
        if (Math.abs(startPos.x - targetX) < 1 || Math.abs(startPos.y - targetY) < 1) {
            d = `M ${startPos.x} ${startPos.y} L ${targetX} ${targetY}`;
        } else {
             // Z-shape snapping
            const snapMidX = Math.round(midX / 10) * 10;
             d += ` L ${snapMidX} ${startPos.y} L ${snapMidX} ${targetY} L ${targetX} ${targetY}`;
        }
        
        this.tempWire.setAttribute('d', d);
    },

    finishWiring(endNode) {
        // Validate
        if (!this.startNode || !endNode) return;
        if (this.startNode === endNode) return;
        
        // Create Wire
        this.createWire(this.startNode, endNode);
        
        // Reset
        this.cancelWiring();
    },

    cancelWiring() {
        this.isWiring = false;
        this.startNode = null;
        if (this.tempWire) {
            this.tempWire.remove();
            this.tempWire = null;
        }
    },

    // -------------------------------------------------------------------------
    // Core Wiring Logic
    // -------------------------------------------------------------------------

    createWire(from, to, options = {}) {
        // Data Structure
        const wire = { 
            from: from, 
            to: to,
            id: 'w_' + Math.random().toString(36).substr(2, 9)
        };

        // 1. Create Visual Elements
        this.renderWire(wire);

        // 2. Add to List
        if (!this.wires) this.wires = [];
        this.wires.push(wire);

        // 3. Integrate with NetManager (Netlist)
        if (this.netManager) {
            this.netManager.onWireCreated(wire); // O(1) magic happens here
        }

        // 4. Update Path (Smart Routing)
        if (!options.skipRoute) {
            this.updateWirePath(wire);
        }
    },

    renderWire(wire) {
        const svgNS = "http://www.w3.org/2000/svg";
        
        // A. Visible Line (2px)
        const line = document.createElementNS(svgNS, 'path');
        line.classList.add('wire-line');
        line.style.stroke = 'var(--accent-color, #22d3ee)';
        line.style.strokeWidth = '2px';
        line.style.fill = 'none';
        line.style.strokeLinecap = 'round';
        line.style.strokeLinejoin = 'round';
        line.style.pointerEvents = 'none'; // Pass events to hitbox

        // B. Fat Hitbox (15px) - Invisible
        const hitbox = document.createElementNS(svgNS, 'path');
        hitbox.classList.add('wire-hitbox');
        hitbox.style.stroke = 'transparent'; // Invisible
        hitbox.style.strokeWidth = '15px';   // Fat
        hitbox.style.fill = 'none';
        hitbox.style.cursor = 'pointer';
        hitbox.style.pointerEvents = 'stroke';

        // Events on Hitbox
        hitbox.addEventListener('click', (e) => {
            if (this.mode === 'delete' || e.button === 2) { 
                // Context menu or delete mode handled by context menu generally
            } else {
                // Determine split point?
                if (!e.shiftKey) this.selectWire(wire);
                else this.splitWireAt(wire, e);
            }
        });
        
        hitbox.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.removeWire(wire);
        });

        // Append to DOM
        this.wireLayer.appendChild(hitbox); // Hitbox first? No, doesn't matter for events if pointer-events set.
        // Actually, hitbox should be *above* line if both were visible, but here one is invisible.
        // It's safer to put hitbox *after* line so it's on top in Z-order.
        this.wireLayer.appendChild(line);
        this.wireLayer.appendChild(hitbox);

        wire.line = line;
        wire.hitbox = hitbox;
    },

    removeWire(wire) {
        if (!wire) return;
        
        // 1. Visual Cleanup
        if (wire.line) wire.line.remove();
        if (wire.hitbox) wire.hitbox.remove();
        
        // 2. Data Cleanup
        this.wires = this.wires.filter(w => w !== wire);
        
        // 3. Netlist Cleanup
        if (this.netManager) {
            this.netManager.onWireRemoved(wire);
        }
    },
    
    // Select wire helper
    selectWire(wire) {
        // Optional: Highlight wire
        console.log('Selected wire', wire);
    },

    // -------------------------------------------------------------------------
    // Routing & Helpers
    // -------------------------------------------------------------------------

    updateWirePath(wire) {
        const start = this.getNodePosition(wire.from);
        const end = this.getNodePosition(wire.to);
        
        // Collect Obstacles (Components)
        const obstacles = [];
        document.querySelectorAll('.component').forEach(el => {
            // Ignore connected components? No, wires shouldn't pass through ANY component usually.
            // But maybe the one we are connecting to? 
            // A* heuristic handles start/end being inside obstacle by allowing it but penalizing?
            // Simple approach: Get rects relative to workspace
            const r = this.getRelativeRect(el);
            obstacles.push(r);
        });

        // Pathfinding
        const path = SmartRouter.findPath(start, end, obstacles);
        
        // Apply to SVG
        if (path) {
            const d = SmartRouter.toPathString(path);
            wire.line.setAttribute('d', d);
            wire.hitbox.setAttribute('d', d);
        }
    },

    updateAllWires() {
        if (!this.wires) return;
        this.wires.forEach(w => this.updateWirePath(w));
    },

    redrawWiresConnectedTo(node, fastMode = false) {
        if (!this.wires) return;
        this.wires.forEach(w => {
            if (w.from === node || w.to === node) {
                 if (fastMode) {
                     // Simple L-shape for performance
                     const s = this.getNodePosition(w.from);
                     const e = this.getNodePosition(w.to);
                     const d = `M ${s.x} ${s.y} L ${e.x} ${s.y} L ${e.x} ${e.y}`;
                     w.line.setAttribute('d', d);
                     w.hitbox.setAttribute('d', d);
                 } else {
                     this.updateWirePath(w);
                 }
            }
        });
    },

    splitWireAt(wire, e) {
        // Create Virtual Joint at click position
        const pos = this.getMousePosition(e);
        const gx = Math.round(pos.x / 10) * 10;
        const gy = Math.round(pos.y / 10) * 10;

        const joint = new VirtualJoint(gx, gy, this);
        if (!this.virtualJoints) this.virtualJoints = [];
        this.virtualJoints.push(joint);
        this.wireLayer.appendChild(joint.element);

        // Split wire
        const { from, to } = wire;
        this.removeWire(wire);
        
        this.createWire(from, joint);
        this.createWire(joint, to);
    },

    // Utility: Node Logic
    getNodePosition(node) {
        if (node instanceof VirtualJoint) {
            return { x: node.x, y: node.y };
        }
        // DOM Element (Pin)
        return this.getCenter(node);
    },

    getCenter(element) {
        const rect = element.getBoundingClientRect();
        const wsRect = this.workspace.getBoundingClientRect(); // Cached?
        const scale = this.scale || 1; 
        
        // Relative to Workspace (0,0)
        return {
            x: (rect.left + rect.width / 2 - wsRect.left) / scale,
            y: (rect.top + rect.height / 2 - wsRect.top) / scale
        };
    },
    
    getRelativeRect(element) {
        const rect = element.getBoundingClientRect();
        const wsRect = this.workspace.getBoundingClientRect();
        const scale = this.scale || 1; 
        return {
            left: (rect.left - wsRect.left) / scale,
            top: (rect.top - wsRect.top) / scale,
            right: (rect.right - wsRect.left) / scale,
            bottom: (rect.bottom - wsRect.top) / scale
        };
    },
    
    getMousePosition(e) {
        const wsRect = this.workspace.getBoundingClientRect();
        const scale = this.scale || 1;
        return {
            x: (e.clientX - wsRect.left) / scale,
            y: (e.clientY - wsRect.top) / scale
        };
    },

    findSnapTarget(x, y) {
        const threshold = 15;
        // Check VJs
        if (this.virtualJoints) {
            for (const vj of this.virtualJoints) {
                const dist = Math.hypot(vj.x - x, vj.y - y);
                if (dist < threshold) return vj;
            }
        }
        // Check Pins (Expensive DOM query? Optimize later)
        // Ideally we should have a list of all pins.
        // For now, let's trust InputHandler handles component snapping or iterate pins.
        const pins = document.querySelectorAll('.pin');
        for (const pin of pins) {
            const pos = this.getCenter(pin);
            const dist = Math.hypot(pos.x - x, pos.y - y);
            if (dist < threshold) return pin;
        }
        return null;
    }
});
