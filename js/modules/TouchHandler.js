/**
 * 📱 Touch Handler Module for LoCAD
 * 터치스크린 완전 지원 모듈
 * - 컴포넌트 드래그 (터치)
 * - 핀 연결 (터치)
 * - 캔버스 패닝 (한 손가락 빈 영역)
 * - 핀치 투 줌 (두 손가락)
 * - 스위치 토글 (탭)
 */

Object.assign(CircuitSimulator.prototype, {
    /**
     * 터치 이벤트 초기화
     */
    initTouchEvents() {
        const workspace = this.workspace;
        if (!workspace) return;

        // 터치 상태 추적
        this.touchState = {
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            isDragging: false,
            isPanning: false,
            isPinching: false,
            startDistance: 0,
            startScale: 1,
            touchStartTime: 0,
            touchTarget: null,
            longPressTimer: null
        };

        // 터치 이벤트 리스너 등록
        workspace.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        workspace.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        workspace.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        workspace.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });

        // 모듈 캔버스에도 터치 이벤트 적용
        const moduleCanvas = document.getElementById('module-canvas');
        if (moduleCanvas) {
            moduleCanvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
            moduleCanvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            moduleCanvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
            moduleCanvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
        }

        console.log('📱 Touch events initialized');
    },

    /**
     * 터치 시작
     */
    onTouchStart(e) {
        const touches = e.touches;

        // 두 손가락: 핀치 줌
        if (touches.length === 2) {
            e.preventDefault();
            this.touchState.isPinching = true;
            this.touchState.isPanning = false;
            this.touchState.isDragging = false;
            this.touchState.startDistance = this.getTouchDistance(touches[0], touches[1]);
            this.touchState.startScale = this.scale;
            return;
        }

        // 한 손가락
        if (touches.length === 1) {
            const touch = touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);

            this.touchState.startX = touch.clientX;
            this.touchState.startY = touch.clientY;
            this.touchState.lastX = touch.clientX;
            this.touchState.lastY = touch.clientY;
            this.touchState.touchStartTime = Date.now();
            this.touchState.touchTarget = target;

            // 컴포넌트 또는 핀 터치 확인
            const component = target?.closest('.component');
            const pin = target?.closest('.pin');

            if (pin) {
                // 핀 터치 - 와이어 연결 시작
                e.preventDefault();
                this.handlePinDown(e, pin);
                return;
            }

            if (component) {
                e.preventDefault();
                this.touchState.isDragging = true;

                // 선택 및 드래그 준비
                if (!this.selectedComponents.includes(component)) {
                    this.clearSelection();
                }
                this.selectComponent(component, true);
                this.dragTarget = component;

                // 드래그 오프셋 계산
                const wsRect = this.workspace.parentElement.getBoundingClientRect();
                const scale = this.scale || 1;
                const panX = this.panX || 0;
                const panY = this.panY || 0;

                const mouseX = (touch.clientX - wsRect.left - panX) / scale;
                const mouseY = (touch.clientY - wsRect.top - panY) / scale;

                const compX = parseFloat(component.style.left) || 0;
                const compY = parseFloat(component.style.top) || 0;

                this.dragOffset = {
                    x: mouseX - compX,
                    y: mouseY - compY
                };

                component.classList.add('dragging');
                return;
            }

            // 빈 영역 터치 - 패닝 시작
            if (target === this.workspace || target?.id === 'canvas' || target?.closest('.workspace-content')) {
                this.touchState.isPanning = true;
                this.touchState.isDragging = false;
            }
        }
    },

    /**
     * 터치 이동
     */
    onTouchMove(e) {
        const touches = e.touches;

        // 핀치 줌
        if (this.touchState.isPinching && touches.length === 2) {
            e.preventDefault();
            const currentDistance = this.getTouchDistance(touches[0], touches[1]);
            const scaleFactor = currentDistance / this.touchState.startDistance;
            const newScale = Math.min(Math.max(this.touchState.startScale * scaleFactor, 0.25), 3);

            // 줌 중심점 계산
            const centerX = (touches[0].clientX + touches[1].clientX) / 2;
            const centerY = (touches[0].clientY + touches[1].clientY) / 2;

            this.scale = newScale;
            this.updateTransform();
            return;
        }

        if (touches.length !== 1) return;
        const touch = touches[0];

        // 컴포넌트 드래그
        if (this.touchState.isDragging && this.dragTarget) {
            e.preventDefault();

            const wsRect = this.workspace.parentElement.getBoundingClientRect();
            const scale = this.scale || 1;
            const panX = this.panX || 0;
            const panY = this.panY || 0;

            const mouseX = (touch.clientX - wsRect.left - panX) / scale;
            const mouseY = (touch.clientY - wsRect.top - panY) / scale;

            const newX = mouseX - this.dragOffset.x;
            const newY = mouseY - this.dragOffset.y;

            // 그리드 스냅
            const gridSize = this.gridSize || 10;
            const snappedX = Math.round(newX / gridSize) * gridSize;
            const snappedY = Math.round(newY / gridSize) * gridSize;

            // 선택된 모든 컴포넌트 이동
            const deltaX = snappedX - (parseFloat(this.dragTarget.style.left) || 0);
            const deltaY = snappedY - (parseFloat(this.dragTarget.style.top) || 0);

            this.selectedComponents.forEach(comp => {
                const currX = parseFloat(comp.style.left) || 0;
                const currY = parseFloat(comp.style.top) || 0;
                comp.style.left = (currX + deltaX) + 'px';
                comp.style.top = (currY + deltaY) + 'px';
            });

            // 튜토리얼 드래그 감지
            this.componentMoved = true;

            // 와이어 업데이트
            this.redrawWires();
            return;
        }

        // 캔버스 패닝
        if (this.touchState.isPanning) {
            e.preventDefault();
            const deltaX = touch.clientX - this.touchState.lastX;
            const deltaY = touch.clientY - this.touchState.lastY;

            this.panX += deltaX;
            this.panY += deltaY;

            this.touchState.lastX = touch.clientX;
            this.touchState.lastY = touch.clientY;

            this.updateTransform();
            return;
        }

        // 와이어 드로잉 중이면 업데이트
        if (this.isWiring && this.tempWire) {
            e.preventDefault();
            // 임시 와이어 위치 업데이트를 위해 마우스 이벤트 시뮬레이션
            const fakeMouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                target: document.elementFromPoint(touch.clientX, touch.clientY)
            };
            this.onMouseMove(fakeMouseEvent);
        }
    },

    /**
     * 터치 종료
     */
    onTouchEnd(e) {
        const touchDuration = Date.now() - this.touchState.touchStartTime;
        const target = this.touchState.touchTarget;

        // 드래그 정리
        if (this.touchState.isDragging && this.dragTarget) {
            this.dragTarget.classList.remove('dragging');

            // 히스토리 저장
            if (this.saveState) this.saveState();
        }

        // 짧은 탭 (300ms 미만) - 클릭으로 처리
        if (touchDuration < 300 && !this.touchState.isPanning && !this.touchState.isPinching) {
            const component = target?.closest('.component');
            const pin = target?.closest('.pin');

            // 핀 탭 - 와이어 연결
            if (pin && this.isWiring) {
                this.handlePinUp(e, pin);
            }
            // 스위치 토글
            else if (component && component.getAttribute('data-type') === 'SWITCH') {
                const touchMoved = Math.abs(e.changedTouches[0]?.clientX - this.touchState.startX) < 10 &&
                    Math.abs(e.changedTouches[0]?.clientY - this.touchState.startY) < 10;
                if (touchMoved) {
                    this.toggleSwitch(e, component);
                }
            }
        }

        // 상태 초기화
        this.touchState.isDragging = false;
        this.touchState.isPanning = false;
        this.touchState.isPinching = false;
        this.touchState.touchTarget = null;
        this.dragTarget = null;

        // 롱 프레스 타이머 정리
        if (this.touchState.longPressTimer) {
            clearTimeout(this.touchState.longPressTimer);
            this.touchState.longPressTimer = null;
        }
    },

    /**
     * 두 터치 포인트 사이의 거리 계산
     */
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
});

// DOM 로드 후 터치 이벤트 초기화
document.addEventListener('DOMContentLoaded', () => {
    // sim 객체가 준비될 때까지 대기
    const initTouch = () => {
        if (window.sim && window.sim.workspace) {
            window.sim.initTouchEvents();
        } else {
            setTimeout(initTouch, 100);
        }
    };
    setTimeout(initTouch, 500);
});

// 터치 디바이스에서 더블탭 줌 방지
document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// iOS Safari에서 bounce 스크롤 방지
document.body.addEventListener('touchmove', function (e) {
    if (e.target.closest('.workspace-content') || e.target.closest('#module-canvas')) {
        // 워크스페이스 내에서만 기본 동작 방지
        if (e.touches.length === 1) {
            e.preventDefault();
        }
    }
}, { passive: false });
