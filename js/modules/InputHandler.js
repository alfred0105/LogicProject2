/**
 * 모듈: 입력 핸들링 (마우스, 키보드)
 */
Object.assign(CircuitSimulator.prototype, {
    initEvents() {
        // [PERFORMANCE] 쓰로틀된 마우스 이동 핸들러
        this._throttledMouseMove = rafThrottle((e) => this.onMouseMove(e));
        this._throttledPositionUpdate = rafThrottle((e) => this._updatePositionDisplay(e));

        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this._throttledMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mouseleave', () => this.resetDragState());
        window.addEventListener('blur', () => this.resetDragState());

        if (this.workspace) {
            this.workspace.addEventListener('wheel', (e) => {
                // 모듈 편집 모드에서는 줌 비활성화
                if ((this.currentTab && this.currentTab.startsWith('module')) || (e.target.closest && e.target.closest('#module-canvas'))) {
                    return;
                }
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoom(delta);
            }, { passive: false });
        }

        if (this.wireLayer) {
            this.wireLayer.style.pointerEvents = 'none';
            this.wireLayer.style.zIndex = '1';
            this.wireLayer.style.overflow = 'visible';
        }

        // [PERFORMANCE] 쓰로틀된 위치 표시 업데이트
        window.addEventListener('mousemove', (e) => this._throttledPositionUpdate(e));

        window.addEventListener('contextmenu', (e) => e.preventDefault());

        // [UI] 컨텍스트 메뉴 닫기 (강제 캡쳐링)
        // 다른 요소에서 이벤트를 막아도(stopPropagation) 메뉴가 닫히도록 함
        window.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#context-menu') && !e.target.closest('.context-menu')) {
                if (typeof this.hideAllContextMenus === 'function') {
                    this.hideAllContextMenus();
                }
            }
        }, { capture: true });

        // 클릭 시 모든 컨텍스트 메뉴 닫기 (백업)
        window.addEventListener('click', (e) => {
            // 컨텍스트 메뉴 자체를 클릭한 경우는 제외
            if (!e.target.closest('#context-menu') && !e.target.closest('.context-menu')) {
                this.hideContextMenu();
                this.hideAllContextMenus();
            }
        });
    },

    // [PERFORMANCE] 분리된 위치 표시 업데이트 함수
    _updatePositionDisplay(e) {
        if (this.workspace) {
            const rect = this.workspace.parentElement.getBoundingClientRect();
            const x = Math.round((e.clientX - rect.left - this.panX) / this.scale);
            const y = Math.round((e.clientY - rect.top - this.panY) / this.scale);
            const posEl = document.getElementById('status-position');
            if (posEl) posEl.textContent = `X: ${x}, Y: ${y}`;
        }
    },

    handleComponentMouseDown(e, target) {
        if (e.button !== 0) return;

        e.stopPropagation();

        const isAlreadySelected = this.selectedComponents.includes(target);
        this.componentWasSelected = isAlreadySelected;

        if (!e.ctrlKey && !isAlreadySelected) {
            this.clearSelection();
        }
        this.selectComponent(target, true);

        // 읽기 전용 모드일 경우 드래그 시작 안 함 -> 이동 불가 (선택만 가능)
        if (window.isReadOnlyMode) {
            return;
        }

        this.dragTarget = target;

        // 모듈 편집 모드에서는 moduleCanvas를 직접 사용 (pan/scale 미적용)
        // DOM 기반 체크를 추가하여 더욱 견고하게 판별
        const isModuleMode = (this.currentTab && this.currentTab.startsWith('module')) || (target && target.closest && !!target.closest('#module-canvas'));
        let wsRect;
        let panX = 0;
        let panY = 0;
        let scale = 1;

        if (isModuleMode) {
            // 컴포넌트의 실제 부모 컨테이너를 사용 (position: relative인 요소)
            const parentContainer = target.parentElement;
            wsRect = parentContainer ? parentContainer.getBoundingClientRect() : document.getElementById('module-canvas').getBoundingClientRect();
            // 모듈 모드에서는 pan/scale 없음
        } else {
            wsRect = this.workspace.parentElement.getBoundingClientRect();
            panX = this.panX || 0;
            panY = this.panY || 0;
            scale = this.scale || 1;
        }

        // 캔버스 기준 마우스 좌표 계산
        const mouseX = (e.clientX - wsRect.left - panX) / scale;
        const mouseY = (e.clientY - wsRect.top - panY) / scale;

        const compX = parseFloat(this.dragTarget.style.left) || 0;
        const compY = parseFloat(this.dragTarget.style.top) || 0;

        this.dragOffset.x = mouseX - compX;
        this.dragOffset.y = mouseY - compY;

        // [FIX] 드래그 시작 위치 저장 (실제 드래그 여부 판별용)
        this._dragStartX = compX;
        this._dragStartY = compY;
        this._didActuallyDrag = false;

        // [PERFORMANCE] 드래그 시작 시 GPU 최적화 활성화
        this.dragTarget.classList.add('dragging');
        this.dragTarget.style.cursor = 'grabbing';
    },

    onMouseDown(e) {
        // [터치-마우스 중복 방지] 터치 디바이스에서 ghost click 방지
        // 최근 300ms 이내에 터치 이벤트가 있었으면 마우스 이벤트 무시
        if (this.lastTouchTime && Date.now() - this.lastTouchTime < 300) {
            return;
        }

        // [FIX] UI 요소(입력 필드, 버튼 등) 클릭 시에는 기본 동작 허용
        if (e.target.closest('input, textarea, button, select, [contenteditable], #comment-panel, .modal-overlay')) {
            return; // 댓글 입력 등 UI 인터랙션 허용
        }

        // [UI] 컨텍스트 메뉴 외부 클릭 시 메뉴 닫기 (즉각 반응)
        if (!e.target.closest('#context-menu') && !e.target.closest('.context-menu')) {
            if (this.hideAllContextMenus) this.hideAllContextMenus();
        }

        // 모듈 편집 모드 감지 (DOM 기반 포함)
        const isModuleMode = (this.currentTab && this.currentTab.startsWith('module')) || (e.target.closest && !!e.target.closest('#module-canvas'));

        if ((e.button === 1 || this.mode === 'pan') && !isModuleMode) {
            e.preventDefault();
            this.isPanning = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.workspace.style.cursor = 'grabbing';
            return;
        }


        if (e.button !== 0) return;

        if (e.target.closest('.component')) {
            return;
        }

        // 모듈 캔버스도 빈 공간으로 인식
        const isOnModuleCanvas = e.target.closest('#module-canvas') || e.target.id === 'module-canvas';
        const workspaceWrapper = e.target.closest('.workspace-wrapper');
        const isOnWorkspace = e.target.id === 'workspace' || e.target === this.workspace;
        const isOnWireLayer = e.target.id === 'wire-layer' || e.target.closest('#wire-layer');
        const isNotComponent = !e.target.closest('.component') && !e.target.closest('.pin');

        // 메인 워크스페이스 또는 모듈 캔버스의 빈 공간
        const isEmptySpace = isNotComponent && (
            (workspaceWrapper && (isOnWorkspace || isOnWireLayer || e.target.closest('#workspace'))) ||
            isOnModuleCanvas
        );

        if (isEmptySpace) {
            // 모듈 모드 감지 및 올바른 wsRect 계산
            const moduleCanvas = document.getElementById('module-canvas');
            const isModuleModeActive = isOnModuleCanvas || (this.currentTab && this.currentTab.startsWith('module'));

            let wsRect, panX, panY, scale;
            if (isModuleModeActive && moduleCanvas) {
                wsRect = moduleCanvas.getBoundingClientRect();
                panX = 0;
                panY = 0;
                scale = 1;
            } else {
                wsRect = this.workspace.parentElement.getBoundingClientRect();
                panX = this.panX || 0;
                panY = this.panY || 0;
                scale = this.scale || 1;
            }

            if (this.startPin) {
                this.clearSelection();
                const mouseX = (e.clientX - wsRect.left - panX) / scale;
                const mouseY = (e.clientY - wsRect.top - panY) / scale;

                try {
                    const joint = this.addModule('JOINT', mouseX - 7, mouseY - 7);
                    if (joint) {
                        const jointPin = joint.querySelector('.pin');
                        if (jointPin) {
                            this.createWire(this.startPin, jointPin);
                            this.cancelWiring();
                            this.updateCircuit();
                        }
                    }
                } catch (err) {
                    console.error("JOINT creation error:", err);
                    this.cancelWiring();
                }
                return;
            }

            this.clearSelection();
            this.isSelecting = true;

            // 모듈 모드 정보 저장 (onMouseMove에서 사용)
            this._selectionIsModuleMode = isModuleModeActive;
            this._selectionWsRect = wsRect;
            this._selectionPanX = panX;
            this._selectionPanY = panY;
            this._selectionScale = scale;

            this.selectionStart = {
                x: (e.clientX - wsRect.left - panX) / scale,
                y: (e.clientY - wsRect.top - panY) / scale
            };
            // 선택 박스 시작 위치 저장 (position: fixed이므로 clientX/Y 사용)
            this._selectionStartClientX = e.clientX;
            this._selectionStartClientY = e.clientY;
            this.selectionBox.style.left = e.clientX + 'px';
            this.selectionBox.style.top = e.clientY + 'px';
            this.selectionBox.style.width = '0px';
            this.selectionBox.style.height = '0px';
            this.selectionBox.style.display = 'block';
        }
    },

    onMouseMove(e) {
        // 마우스 위치 저장 (설명 패널 위치 결정용)
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;

        if (this.dragTarget && e.buttons === 0) {
            this.onMouseUp(e);
            return;
        }

        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.panX += dx;
            this.panY += dy;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.updateTransform();
            return;
        }

        // 모듈 편집 모드에서는 moduleCanvas를 직접 사용 (pan/scale 미적용)
        // 드래그 중이라면 dragTarget의 위치로 판별
        const isModuleMode = (this.currentTab && this.currentTab.startsWith('module')) ||
            (this.dragTarget && this.dragTarget.closest && !!this.dragTarget.closest('#module-canvas'));
        let wsRect;
        let panX = this.panX || 0;
        let panY = this.panY || 0;
        let scale = this.scale || 1;

        if (isModuleMode) {
            // 드래그 중일 때는 드래그 타겟의 실제 부모 컨테이너를 사용
            if (this.dragTarget) {
                const parentContainer = this.dragTarget.parentElement;
                wsRect = parentContainer ? parentContainer.getBoundingClientRect() : document.getElementById('module-canvas').getBoundingClientRect();
            } else {
                wsRect = document.getElementById('module-canvas')?.getBoundingClientRect() || this.workspace.getBoundingClientRect();
            }
            panX = 0;
            panY = 0;
            scale = 1;
        } else {
            wsRect = this.workspace.parentElement.getBoundingClientRect();
        }

        const mouseX = (e.clientX - wsRect.left - panX) / scale;
        const mouseY = (e.clientY - wsRect.top - panY) / scale;

        if (this.isSelecting) {
            // position: fixed이므로 clientX/clientY를 직접 사용
            const startX = this._selectionStartClientX;
            const startY = this._selectionStartClientY;
            const currentX = e.clientX;
            const currentY = e.clientY;

            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            const left = Math.min(currentX, startX);
            const top = Math.min(currentY, startY);

            this.selectionBox.style.width = width + 'px';
            this.selectionBox.style.height = height + 'px';
            this.selectionBox.style.left = left + 'px';
            this.selectionBox.style.top = top + 'px';
            return;
        }

        if (this.dragTarget) {
            let newX = mouseX - this.dragOffset.x;
            let newY = mouseY - this.dragOffset.y;

            let snapX = this.gridSnap ? Math.round(newX / this.gridSize) * this.gridSize : newX;
            let snapY = this.gridSnap ? Math.round(newY / this.gridSize) * this.gridSize : newY;

            const compWidth = this.dragTarget.offsetWidth || 72;
            const compHeight = this.dragTarget.offsetHeight || 48;

            // 모듈 편집 모드에서는 moduleCanvas 기준, 아니면 wireLayer 기준
            let canvasWidth, canvasHeight;
            if (isModuleMode) {
                const moduleCanvas = document.getElementById('module-canvas');
                canvasWidth = moduleCanvas?.clientWidth || 800;
                canvasHeight = moduleCanvas?.clientHeight || 600;
            } else {
                canvasWidth = parseInt(this.wireLayer?.getAttribute('width')) || 6000;
                canvasHeight = parseInt(this.wireLayer?.getAttribute('height')) || 4000;
            }

            snapX = Math.max(0, Math.min(snapX, canvasWidth - compWidth));
            snapY = Math.max(0, Math.min(snapY, canvasHeight - compHeight));

            const currentX = parseFloat(this.dragTarget.style.left) || 0;
            const currentY = parseFloat(this.dragTarget.style.top) || 0;
            const deltaX = snapX - currentX;
            const deltaY = snapY - currentY;

            this.dragTarget.style.left = `${snapX}px`;
            this.dragTarget.style.top = `${snapY}px`;

            if (this.selectedComponents.length > 1 && this.selectedComponents.includes(this.dragTarget)) {
                this.selectedComponents.forEach(comp => {
                    if (comp !== this.dragTarget) {
                        let compX = parseFloat(comp.style.left) || 0;
                        let compY = parseFloat(comp.style.top) || 0;
                        compX = Math.max(0, Math.min(compX + deltaX, canvasWidth - (comp.offsetWidth || 72)));
                        compY = Math.max(0, Math.min(compY + deltaY, canvasHeight - (comp.offsetHeight || 48)));
                        comp.style.left = `${compX}px`;
                        comp.style.top = `${compY}px`;
                    }
                });
            }

            this.redrawWires();
            this.updateStatusBar();
        }

        if (this.isWiring) {
            this.handleWireMove(e);
        }
    },

    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.workspace.style.cursor = 'default';
        }

        try {
            if (this.isSelecting) {
                this.isSelecting = false;
                const rect = this.selectionBox.getBoundingClientRect();
                this.selectionBox.style.display = 'none';

                const boxWidth = rect.right - rect.left;
                const boxHeight = rect.bottom - rect.top;

                if (boxWidth > 5 && boxHeight > 5) {
                    let selectedCount = 0;
                    this.components.forEach(comp => {
                        const compRect = comp.getBoundingClientRect();
                        if (rect.left < compRect.right && rect.right > compRect.left &&
                            rect.top < compRect.bottom && rect.bottom > compRect.top) {
                            this.selectComponent(comp, true);
                            selectedCount++;
                        }
                    });

                    if (selectedCount > 0) {
                        this.showToast(`${selectedCount}개 선택됨`, 'info');
                        this.updateStatusBar();
                    }
                }
            }

            if (this.dragTarget) {
                const rawLeft = parseFloat(this.dragTarget.style.left);
                const rawTop = parseFloat(this.dragTarget.style.top);
                const snapLeft = Math.round(rawLeft / this.gridSize) * this.gridSize;
                const snapTop = Math.round(rawTop / this.gridSize) * this.gridSize;

                this.dragTarget.style.left = `${snapLeft}px`;
                this.dragTarget.style.top = `${snapTop}px`;

                this.redrawWires();
                // [PERFORMANCE] 드래그 종료 시 GPU 최적화 해제
                this.dragTarget.classList.remove('dragging');
                this.dragTarget.style.cursor = 'grab';

                // [FIX] 실제로 이동했는지 확인 (5px 이상 이동 시에만 드래그로 판정)
                const movedX = Math.abs(snapLeft - (this._dragStartX || 0));
                const movedY = Math.abs(snapTop - (this._dragStartY || 0));
                const actuallyDragged = movedX > 5 || movedY > 5;

                if (actuallyDragged) {
                    this.saveState();
                    this._justDragged = true;
                    setTimeout(() => { this._justDragged = false; }, 100);
                } else {
                    // [FIX] 드래그가 아닌 단순 클릭인 경우 - 스위치 토글 처리
                    // (dragging 클래스의 pointer-events:none으로 인해 click 이벤트가 차단되므로 여기서 처리)
                    const targetType = this.dragTarget.getAttribute('data-type');
                    if (targetType === 'SWITCH') {
                        // 핀 클릭이 아닌 경우에만 토글
                        if (!e.target.closest('.pin')) {
                            this.toggleSwitch(e, this.dragTarget);
                        }
                    }
                }
            }

            if (this.isWiring) {
                this.handleGlobalWireUp(e);
            }

        } catch (err) {
            console.error("MouseUp Error:", err);
        } finally {
            this.dragTarget = null;
        }
    },

    resetDragState() {
        if (this.dragTarget) {
            this.dragTarget.style.cursor = 'grab';
            this.dragTarget = null;
        }
        this.isPanning = false;
        if (this.isSelecting) {
            this.isSelecting = false;
            // 캐시된 선택 박스 좌표계 정보 정리
            this._selectionIsModuleMode = undefined;
            this._selectionWsRect = undefined;
            this._selectionPanX = undefined;
            this._selectionPanY = undefined;
            this._selectionScale = undefined;
            if (this.selectionBox) {
                this.selectionBox.style.display = 'none';
            }
        }
        if (this.isWiring) {
            this.cancelWiring();
        }
    },

    onKeyDown(e) {
        // [Input 방지]
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toUpperCase();

        // [읽기 전용 모드 처리] - 편집 단축키 차단, 탐색 키 허용
        if (window.isReadOnlyMode) {
            // 허용할 키: Space(패닝), Escape(선택해제/취소), H(핸드툴), 방향키, 줌(+, -)
            if (key === ' ' || key === 'H' || key === 'ESCAPE' || key.startsWith('ARROW') ||
                key === '+' || key === '-' || key === '=' || key === '_') {
                // 통과 (아래 로직 실행)
            } else {
                // 그 외(Delete, W, V, Ctrl+C/V 등)는 무시하고 함수 종료
                // 주의: 여기서preventDefault()를 부르면 F12도 막히므로 그냥 return만 함
                return;
            }
        }

        if (key === 'DELETE' || key === 'BACKSPACE') { this.deleteSelected(); e.preventDefault(); }
        if (key === 'ESCAPE') { this.clearSelection(); this.cancelWiring(); }

        if (key === 'V') this.setMode('edit');
        if (key === 'H') this.setMode('pan');
        if (key === 'W') this.setMode('wire');
        if (key === ' ') { this.setMode('pan'); e.preventDefault(); }
        if (key === 'R') { this.rotateSelected(); e.preventDefault(); }

        if (e.ctrlKey) {
            if (key === 'C') { this.copySelection(); e.preventDefault(); }
            if (key === 'V') { this.pasteFromClipboard(); e.preventDefault(); }
            if (key === 'D') { this.duplicateSelection(); e.preventDefault(); }
            if (key === 'S') { this.saveProject(); e.preventDefault(); }
            if (key === 'Z') { this.undo(); e.preventDefault(); }
            if (key === 'Y') { this.redo(); e.preventDefault(); }
            if (key === 'A') {
                this.components.forEach(c => this.selectComponent(c, true));
                e.preventDefault();
            }
        }

        for (const [sKey, sType] of Object.entries(this.shortcuts)) {
            if (key === sKey) {
                if (sType === 'DELETE') this.deleteSelected();
                else if (sType === 'ESCAPE') this.clearSelection();
                else this.addModule(sType);
            }
        }
    },

    onKeyUp(e) {
        if (e.key === ' ') {
            this.setMode('edit');
        }
    }
});
