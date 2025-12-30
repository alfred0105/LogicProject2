/**
 * 모듈: 미니맵 (Minimap)
 * 전체 회로를 축소해서 보여주고 클릭으로 네비게이션
 */
Object.assign(CircuitSimulator.prototype, {

    /**
     * 미니맵 초기화
     */
    initMinimap() {
        // 중복 생성 방지
        if (this.minimapContainer && document.getElementById('minimap-container')) {
            console.log('[Minimap] Already initialized');
            return;
        }

        // 기존 미니맵 제거
        const existing = document.getElementById('minimap-container');
        if (existing) existing.remove();

        // 미니맵 컨테이너 생성
        this.minimapContainer = document.createElement('div');
        this.minimapContainer.id = 'minimap-container';
        this.minimapContainer.innerHTML = `
            <div class="minimap-header">
                <span class="minimap-title">미니맵</span>
                <button class="minimap-toggle" title="미니맵 접기/펼치기">−</button>
            </div>
            <div class="minimap-content">
                <canvas id="minimap-canvas"></canvas>
                <div class="minimap-viewport"></div>
                <div class="minimap-info">
                    <span class="minimap-zoom">100%</span>
                    <span class="minimap-count">0 부품</span>
                </div>
            </div>
        `;

        document.body.appendChild(this.minimapContainer);

        // 요소 참조
        this.minimapCanvas = this.minimapContainer.querySelector('#minimap-canvas');
        this.minimapViewport = this.minimapContainer.querySelector('.minimap-viewport');
        this.minimapZoomLabel = this.minimapContainer.querySelector('.minimap-zoom');
        this.minimapCountLabel = this.minimapContainer.querySelector('.minimap-count');
        this.minimapContent = this.minimapContainer.querySelector('.minimap-content');
        this.minimapToggleBtn = this.minimapContainer.querySelector('.minimap-toggle');

        // 캔버스 설정
        this.minimapCanvas.width = 180;
        this.minimapCanvas.height = 120;
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // 이벤트 바인딩
        this.minimapCanvas.addEventListener('click', (e) => this.onMinimapClick(e));
        this.minimapCanvas.addEventListener('mousedown', (e) => this.onMinimapDragStart(e));
        this.minimapToggleBtn.addEventListener('click', () => this.toggleMinimap());

        // 드래그 상태
        this.minimapDragging = false;

        // 접기/펼치기 상태
        this.minimapExpanded = true;

        // 초기 렌더링
        this.updateMinimap();

        // 스타일 추가 (중복 방지)
        if (!document.getElementById('minimap-styles')) {
            this.addMinimapStyles();
        }

        console.log('[Minimap] Initialized');
    },

    /**
     * 미니맵 스타일 추가
     */
    addMinimapStyles() {
        const style = document.createElement('style');
        style.id = 'minimap-styles';
        style.textContent = `
            #minimap-container {
                position: fixed;
                bottom: 40px;
                right: 20px;
                width: 200px;
                background: var(--bg-surface, #0a0a0a);
                border: 1px solid var(--border-default, rgba(255, 255, 255, 0.12));
                border-radius: var(--radius-lg, 12px);
                box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.5));
                z-index: 1000;
                overflow: hidden;
                font-family: 'Inter', sans-serif;
                transition: all var(--duration-normal, 250ms) var(--ease-out);
            }

            #minimap-container .minimap-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                background: var(--bg-elevated, #111111);
                border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
            }

            #minimap-container .minimap-title {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-secondary, #a1a1aa);
            }

            #minimap-container .minimap-toggle {
                background: var(--bg-active, #1a1a1a);
                border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                border-radius: var(--radius-xs, 4px);
                color: var(--text-secondary, #a1a1aa);
                cursor: pointer;
                font-size: 12px;
                width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all var(--duration-fast, 150ms);
            }

            #minimap-container .minimap-toggle:hover {
                background: var(--accent-blue, #3b82f6);
                color: white;
                border-color: var(--accent-blue, #3b82f6);
            }

            #minimap-container .minimap-content {
                position: relative;
                padding: 10px;
                height: 140px;
                transition: height var(--duration-normal, 250ms) var(--ease-out), 
                            opacity var(--duration-normal, 250ms) var(--ease-out);
            }

            #minimap-container.collapsed .minimap-content {
                height: 0;
                padding: 0 10px;
                opacity: 0;
                overflow: hidden;
            }

            #minimap-container #minimap-canvas {
                width: 100%;
                height: 120px;
                background: var(--bg-base, #050505);
                border-radius: var(--radius-sm, 6px);
                cursor: crosshair;
                border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
            }

            #minimap-container .minimap-viewport {
                position: absolute;
                border: 2px solid var(--accent-blue, #3b82f6);
                background: var(--accent-blue-glow, rgba(59, 130, 246, 0.15));
                border-radius: 2px;
                pointer-events: none;
                transition: all 0.1s ease;
            }

            #minimap-container .minimap-info {
                display: flex;
                justify-content: space-between;
                margin-top: 6px;
                font-size: 10px;
                color: var(--text-muted, #52525b);
            }

            #minimap-container .minimap-zoom {
                color: var(--accent-blue, #3b82f6);
                font-weight: 600;
                font-family: 'JetBrains Mono', monospace;
            }

            #minimap-container .minimap-count {
                color: var(--text-secondary, #a1a1aa);
            }

            /* 반응형 */
            @media (max-width: 768px) {
                #minimap-container {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * 미니맵 접기/펼치기
     */
    toggleMinimap() {
        this.minimapExpanded = !this.minimapExpanded;
        this.minimapContainer.classList.toggle('collapsed', !this.minimapExpanded);
        this.minimapToggleBtn.textContent = this.minimapExpanded ? '−' : '+';
    },

    /**
     * 미니맵 업데이트
     */
    updateMinimap() {
        if (!this.minimapCtx || !this.minimapCanvas) return;

        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        const width = canvas.width;
        const height = canvas.height;

        // 캔버스 클리어
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, width, height);

        // 컴포넌트가 없으면 빈 상태 표시
        if (!this.components || this.components.length === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('회로가 비어 있습니다', width / 2, height / 2);
            this.minimapCountLabel.textContent = '0 부품';
            return;
        }

        // 컴포넌트 바운딩 박스 계산
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.components.forEach(comp => {
            const x = parseFloat(comp.style.left) || 0;
            const y = parseFloat(comp.style.top) || 0;
            const w = comp.offsetWidth || 80;
            const h = comp.offsetHeight || 60;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        });

        // 여백 추가
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // 스케일 계산
        const circuitWidth = maxX - minX;
        const circuitHeight = maxY - minY;
        const scaleX = width / circuitWidth;
        const scaleY = height / circuitHeight;
        const minimapScale = Math.min(scaleX, scaleY, 0.5);  // 최대 0.5배

        // 미니맵 변환 저장 (클릭 시 좌표 변환용)
        this.minimapTransform = {
            offsetX: minX,
            offsetY: minY,
            scale: minimapScale,
            width: circuitWidth,
            height: circuitHeight
        };

        // 그리드 그리기 (약하게)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 0.5;
        const gridSize = 20 * minimapScale;
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // 와이어 그리기
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = 1;
        this.wires.forEach(wire => {
            if (!wire.from || !wire.to) return;
            const fromComp = wire.from.closest('.component');
            const toComp = wire.to.closest('.component');
            if (!fromComp || !toComp) return;

            const x1 = (parseFloat(fromComp.style.left) || 0) + (fromComp.offsetWidth || 80) / 2;
            const y1 = (parseFloat(fromComp.style.top) || 0) + (fromComp.offsetHeight || 60) / 2;
            const x2 = (parseFloat(toComp.style.left) || 0) + (toComp.offsetWidth || 80) / 2;
            const y2 = (parseFloat(toComp.style.top) || 0) + (toComp.offsetHeight || 60) / 2;

            const mx1 = (x1 - minX) * minimapScale;
            const my1 = (y1 - minY) * minimapScale;
            const mx2 = (x2 - minX) * minimapScale;
            const my2 = (y2 - minY) * minimapScale;

            ctx.beginPath();
            ctx.moveTo(mx1, my1);
            ctx.lineTo(mx2, my2);
            ctx.stroke();
        });

        // 컴포넌트 그리기
        this.components.forEach(comp => {
            const x = parseFloat(comp.style.left) || 0;
            const y = parseFloat(comp.style.top) || 0;
            const w = comp.offsetWidth || 80;
            const h = comp.offsetHeight || 60;

            const mx = (x - minX) * minimapScale;
            const my = (y - minY) * minimapScale;
            const mw = Math.max(w * minimapScale, 4);
            const mh = Math.max(h * minimapScale, 3);

            // 컴포넌트 타입별 색상
            const type = comp.getAttribute('data-type');
            let color = '#667eea';  // 기본 파란색
            if (type === 'SWITCH') color = '#22c55e';
            else if (type === 'LED') color = '#ef4444';
            else if (type === 'CLOCK') color = '#f59e0b';
            else if (type?.includes('ADDER') || type?.includes('LATCH')) color = '#8b5cf6';
            else if (type === 'PACKAGE') color = '#ec4899';
            else if (type === 'VCC') color = '#ff6b6b';
            else if (type === 'GND') color = '#4ecdc4';

            // 선택된 컴포넌트는 밝게
            if (this.selectedComponents.includes(comp)) {
                color = '#fbbf24';
            }

            ctx.fillStyle = color;
            ctx.fillRect(mx, my, mw, mh);

            // 테두리
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(mx, my, mw, mh);
        });

        // 뷰포트 표시 업데이트
        this.updateMinimapViewport();

        // 정보 업데이트
        this.minimapZoomLabel.textContent = Math.round(this.scale * 100) + '%';
        this.minimapCountLabel.textContent = `${this.components.length} 부품`;
    },

    /**
     * 미니맵 뷰포트 업데이트 (현재 보이는 영역)
     */
    updateMinimapViewport() {
        if (!this.minimapViewport || !this.minimapTransform || !this.workspace) return;

        const canvas = this.minimapCanvas;
        const transform = this.minimapTransform;

        // 현재 뷰포트 (메인 캔버스에서 보이는 영역)
        const container = this.workspace.parentElement;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const viewWidth = containerRect.width / this.scale;
        const viewHeight = containerRect.height / this.scale;
        const viewX = -this.panX / this.scale;
        const viewY = -this.panY / this.scale;

        // 미니맵 좌표로 변환
        const mvX = (viewX - transform.offsetX) * transform.scale + 10;  // +10 for padding
        const mvY = (viewY - transform.offsetY) * transform.scale + 10;
        const mvW = viewWidth * transform.scale;
        const mvH = viewHeight * transform.scale;

        // 뷰포트 위치 및 크기 설정
        this.minimapViewport.style.left = Math.max(10, Math.min(mvX, canvas.width - mvW + 10)) + 'px';
        this.minimapViewport.style.top = Math.max(10, Math.min(mvY, canvas.height - mvH + 30)) + 'px';
        this.minimapViewport.style.width = Math.min(mvW, canvas.width) + 'px';
        this.minimapViewport.style.height = Math.min(mvH, canvas.height) + 'px';
    },

    /**
     * 미니맵 클릭 시 해당 위치로 이동
     */
    onMinimapClick(e) {
        if (!this.minimapTransform) return;

        const rect = this.minimapCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // 미니맵 좌표를 실제 회로 좌표로 변환
        const transform = this.minimapTransform;
        const circuitX = clickX / transform.scale + transform.offsetX;
        const circuitY = clickY / transform.scale + transform.offsetY;

        // 뷰포트 중심을 클릭 위치로
        const container = this.workspace.parentElement;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        this.panX = -(circuitX * this.scale - containerRect.width / 2);
        this.panY = -(circuitY * this.scale - containerRect.height / 2);

        this.updateTransform();
        this.updateMinimap();
    },

    /**
     * 미니맵 드래그 시작
     */
    onMinimapDragStart(e) {
        this.minimapDragging = true;

        const onMove = (e) => {
            if (!this.minimapDragging) return;
            this.onMinimapClick(e);
        };

        const onUp = () => {
            this.minimapDragging = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    },

    /**
     * 미니맵 표시/숨기기
     */
    showMinimap() {
        if (this.minimapContainer) {
            this.minimapContainer.style.display = 'block';
        }
    },

    hideMinimap() {
        if (this.minimapContainer) {
            this.minimapContainer.style.display = 'none';
        }
    }
});

console.log('[Minimap] Module loaded');
