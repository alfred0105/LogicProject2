/**
 * 모듈: UI 관리 (토스트, 모달, 모드 전환, 줌, 툴팁, 미니맵, 모드 설정)
 */
Object.assign(CircuitSimulator.prototype, {
    showToast(message, type = 'info') {
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✕' : 'ℹ'}</span>
            <span class="toast-message">${message}</span>
        `;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    openShortcutModal() {
        const list = document.getElementById('shortcut-list');
        list.innerHTML = '';
        for (const [key, type] of Object.entries(this.shortcuts)) {
            const row = document.createElement('div');
            row.className = 'key-row';
            row.innerHTML = `<span>${type}</span><input type="text" class="key-input" value="${key}" data-type="${type}" maxlength="1">`;
            list.appendChild(row);
        }
        document.getElementById('shortcut-modal').style.display = 'flex';
    },

    closeShortcutModal() {
        const inputs = document.querySelectorAll('.key-input');
        const newShortcuts = {};
        inputs.forEach(input => {
            if (input.value.trim()) {
                newShortcuts[input.value.toUpperCase()] = input.getAttribute('data-type');
            }
        });
        this.shortcuts = newShortcuts;
        document.getElementById('shortcut-modal').style.display = 'none';
        alert(this.dict.shortcutSaved);
    },

    setLanguage(lang) {
        if (!TRANSLATIONS[lang]) return;
        this.currentLang = lang;
        this.dict = TRANSLATIONS[lang];
        this.updateUIText();
    },

    updateUIText() {
        const t = this.dict;
        if (!t) return;

        const header = document.querySelector('#toolbox h2');
        if (header) header.innerText = t.component;

        const btnSave = document.getElementById('btn-save');
        if (btnSave) btnSave.innerHTML = t.save;

        const btnExit = document.getElementById('btn-exit');
        if (btnExit) btnExit.innerHTML = t.exit;

        const btnEdit = document.getElementById('btn-edit');
        if (btnEdit) btnEdit.innerHTML = t.edit;

        const btnPan = document.getElementById('btn-pan');
        if (btnPan) btnPan.innerHTML = t.pan;

        const zoomBtns = document.querySelectorAll('.zoom-controls button');
        if (zoomBtns[0]) zoomBtns[0].innerText = t.zoomOut;
        if (zoomBtns[1]) zoomBtns[1].innerText = t.zoomIn;

        const cats = document.querySelectorAll('.category');
        if (cats.length >= 4) {
            if (cats[0]) cats[0].innerText = t.inputOutput;
            if (cats[1]) cats[1].innerText = t.logicGates;
            if (cats[cats.length - 1]) cats[cats.length - 1].innerText = t.settings;
        }

        const modeBtn = document.getElementById('btn-mode');
        if (modeBtn) {
            if (this.userMode === 'expert') {
                modeBtn.innerText = t.modeExpert;
            } else {
                modeBtn.innerText = t.modeEasy;
            }
        }

        const btnMap = {
            "'SWITCH'": t.gateSwitch, "'LED'": t.gateLed, "'CLOCK'": t.gateClock,
            "'AND'": t.gateAnd, "'OR'": t.gateOr, "'NOT'": t.gateNot,
            "'XOR'": t.gateXor, "'NAND'": t.gateNand, "'NOR'": t.gateNor,
            "'XNOR'": t.gateXnor, "'TRANSISTOR'": t.gateTr, "'PMOS'": t.gatePmos,
            "'VCC'": t.gateVcc, "'GND'": t.gateGnd
        };

        const buttons = document.querySelectorAll('.tool-btn');
        buttons.forEach(btn => {
            const onClick = btn.getAttribute('onclick');
            if (!onClick) return;
            for (const [key, text] of Object.entries(btnMap)) {
                if (onClick.includes(key)) {
                    const parts = btn.innerText.split(' ');
                    const icon = parts[0];
                    let isEmoji = false;
                    try {
                        isEmoji = icon && /\p{Emoji}/u.test(icon);
                    } catch (e) {
                        isEmoji = icon && icon.charCodeAt(0) > 255;
                    }

                    if (isEmoji) {
                        btn.innerText = icon + " " + text;
                    } else {
                        btn.innerText = text;
                    }
                }
            }
        });
    },

    setUserMode(mode) {
        this.userMode = mode;
        if (mode === 'expert') {
            document.body.classList.add('expert-mode');
        } else {
            document.body.classList.remove('expert-mode');
        }
        this.updateModeButton();
    },

    toggleUserMode() {
        // Toggle user mode (Easy <-> Expert)
        const newMode = this.userMode === 'expert' ? 'easy' : 'expert';
        this.setUserMode(newMode);
        this.showToast(newMode === 'expert' ? '전문가 모드 활성화' : '이지 모드 활성화', 'info');
    },

    updateModeButton() {
        const btn = document.getElementById('btn-mode');
        if (!btn) return;
        if (this.userMode === 'expert') {
            btn.innerHTML = 'Expert';
            btn.classList.add('active');
        } else {
            btn.innerHTML = '🎓 Easy';
            btn.classList.remove('active');
        }
    },

    openPropertyModal(comp) {
        if (!comp) return;
        this.currentEditComp = comp;

        let modal = document.getElementById('property-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'property-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-window">
                    <div class="modal-header">Properties</div>
                    <div class="key-row">
                        <span>Type</span> <span id="prop-type">AND</span>
                    </div>
                    <div class="key-row">
                        <span>Delay (ms)</span> <input type="number" id="prop-delay" class="key-input" style="width: 80px;">
                    </div>
                    <div class="key-row">
                        <span>Transistors</span> <input type="number" id="prop-transistors" class="key-input" style="width: 80px;">
                    </div>
                    <button class="modal-btn" onclick="sim.saveProperties()">저장 (Save)</button>
                    <button class="modal-btn" style="background:#95a5a6; margin-top:5px;" onclick="document.getElementById('property-modal').style.display='none'">닫기 (Close)</button>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const type = comp.getAttribute('data-type');
        document.getElementById('prop-type').innerText = type;
        document.getElementById('prop-delay').value = comp.getAttribute('data-delay') || '10';
        document.getElementById('prop-transistors').value = comp.getAttribute('data-transistors') || '0';

        modal.style.display = 'flex';
    },

    saveProperties() {
        if (!this.currentEditComp) return;

        const delay = document.getElementById('prop-delay').value;
        const transistors = document.getElementById('prop-transistors').value;

        this.currentEditComp.setAttribute('data-delay', delay);
        this.currentEditComp.setAttribute('data-transistors', transistors);

        document.getElementById('property-modal').style.display = 'none';
        this.currentEditComp = null;
    },

    setMode(mode) {
        this.mode = mode;

        if (this.workspace) {
            this.workspace.classList.remove('mode-pan', 'mode-wire');
            if (mode === 'pan') this.workspace.classList.add('mode-pan');
            if (mode === 'wire') this.workspace.classList.add('mode-wire');
        }

        const btnSelect = document.getElementById('btn-select');
        const btnPan = document.getElementById('btn-pan');
        const btnWire = document.getElementById('btn-wire');

        if (btnSelect) btnSelect.classList.toggle('active', mode === 'edit');
        if (btnPan) btnPan.classList.toggle('active', mode === 'pan');
        if (btnWire) btnWire.classList.toggle('active', mode === 'wire');
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            document.body.classList.toggle('sidebar-collapsed', sidebar.classList.contains('collapsed'));
            setTimeout(() => this.resizeCanvas(), 300);
        }
    },

    toggleSection(id) {
        const section = document.getElementById(id);
        if (section) {
            section.classList.toggle('collapsed');
        }
    },

    zoom(amount) {
        // 모듈 편집 모드에서는 줌 비활성화
        if (this.currentTab && this.currentTab.startsWith('module_')) {
            return;
        }
        this.scale += amount;
        if (this.scale < 0.5) this.scale = 0.5;
        if (this.scale > 2.0) this.scale = 2.0;
        this.updateTransform();
    },

    updateTransform() {
        if (!this.workspace) return;

        const wrapper = this.workspace.parentElement;
        if (wrapper) {
            const viewWidth = wrapper.clientWidth;
            const viewHeight = wrapper.clientHeight;

            const baseWidth = parseInt(this.wireLayer?.getAttribute('width')) || 6000;
            const baseHeight = parseInt(this.wireLayer?.getAttribute('height')) || 4000;

            const scaledWidth = baseWidth * this.scale;
            const scaledHeight = baseHeight * this.scale;

            if (scaledWidth > viewWidth) {
                const minX = viewWidth - scaledWidth;
                const maxX = 0;
                this.panX = Math.min(maxX, Math.max(this.panX, minX));
            } else {
                this.panX = 0;
            }

            if (scaledHeight > viewHeight) {
                const minY = viewHeight - scaledHeight;
                const maxY = 0;
                this.panY = Math.min(maxY, Math.max(this.panY, minY));
            } else {
                this.panY = 0;
            }
        }

        this.workspace.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
        const zoomEl = document.getElementById('zoom-level');
        if (zoomEl) zoomEl.innerText = Math.round(this.scale * 100) + '%';
        this.redrawWires();
        this.updateMinimap();
    },

    updateMinimap() {
        const minimap = document.getElementById('minimap');
        const viewport = document.getElementById('minimap-viewport');
        if (!minimap || !viewport) return;

        const wrapper = this.workspace.parentElement;
        if (!wrapper) return;

        const wVal = this.wireLayer ? (this.wireLayer.getAttribute('width') || window.getComputedStyle(this.wireLayer).width) : '6000';
        const hVal = this.wireLayer ? (this.wireLayer.getAttribute('height') || window.getComputedStyle(this.wireLayer).height) : '4000';
        const canvasWidth = parseInt(wVal) || 6000;
        const canvasHeight = parseInt(hVal) || 4000;

        const mapWidth = minimap.clientWidth;
        const desiredHeight = mapWidth * (canvasHeight / canvasWidth);

        if (Math.abs(minimap.clientHeight - desiredHeight) > 1) {
            minimap.style.height = desiredHeight + 'px';
        }

        const scaleX = mapWidth / canvasWidth;
        const scaleY = desiredHeight / canvasHeight;

        let canvas = minimap.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.style.left = '0';
            canvas.style.top = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.zIndex = '0';
            canvas.style.pointerEvents = 'none';
            minimap.insertBefore(canvas, viewport);
        }

        if (canvas.width !== mapWidth || canvas.height !== desiredHeight) {
            canvas.width = mapWidth;
            canvas.height = desiredHeight;
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (this.components) {
            this.components.forEach(comp => {
                const x = parseFloat(comp.style.left) * scaleX;
                const y = parseFloat(comp.style.top) * scaleY;
                const size = 30 * scaleX;

                ctx.fillStyle = '#666';
                const type = comp.getAttribute('data-type');
                if (type === 'LED') ctx.fillStyle = comp.classList.contains('led-on') ? '#eab308' : '#444';
                if (type === 'SWITCH') ctx.fillStyle = '#2ecc71';

                ctx.fillRect(x, y, size, size);
            });
        }

        const visibleW = wrapper.clientWidth;
        const visibleH = wrapper.clientHeight;

        const viewX = (-this.panX) * scaleX;
        const viewY = (-this.panY) * scaleY;
        const viewW = (visibleW / this.scale) * scaleX;
        const viewH = (visibleH / this.scale) * scaleY;

        viewport.style.left = viewX + 'px';
        viewport.style.top = viewY + 'px';
        viewport.style.width = viewW + 'px';
        viewport.style.height = viewH + 'px';
    },

    resizeCanvas(w, h) {
        const width = w || this.wireLayer?.getAttribute('width') || 6000;
        const height = h || this.wireLayer?.getAttribute('height') || 4000;

        if (this.wireLayer) {
            this.wireLayer.setAttribute('width', width);
            this.wireLayer.setAttribute('height', height);
            this.wireLayer.style.width = width + 'px';
            this.wireLayer.style.height = height + 'px';
        }

        this.updateMinimap();
    },

    showTooltip(type, event) {
        const info = this.getComponentInfo(type);
        if (!info) return;

        const panel = document.getElementById('component-info-panel');
        if (!panel) return;

        const iconEl = panel.querySelector('.info-type-icon');
        const nameEl = panel.querySelector('.info-type-name');
        if (iconEl) iconEl.textContent = info.icon;
        if (nameEl) nameEl.textContent = info.name;

        const descEl = panel.querySelector('.info-description');
        if (descEl) descEl.textContent = info.description;

        // Animation 영역 업데이트
        const animationEl = document.getElementById('info-animation');
        if (animationEl) {
            if (info.animation) {
                animationEl.innerHTML = info.animation;
                animationEl.style.display = 'flex';
            } else {
                animationEl.innerHTML = '';
                animationEl.style.display = 'none';
            }
        }

        // Usage 영역 업데이트
        const usageEl = document.getElementById('info-usage');
        const usageSection = document.getElementById('info-usage-section');
        if (usageEl && usageSection) {
            if (info.usage) {
                usageEl.textContent = info.usage;
                usageSection.style.display = 'block';
            } else {
                usageEl.textContent = '';
                usageSection.style.display = 'none';
            }
        }

        const inputsEl = document.getElementById('info-inputs');
        const outputsEl = document.getElementById('info-outputs');
        if (inputsEl) inputsEl.textContent = info.inputs;
        if (outputsEl) outputsEl.textContent = info.outputs;

        // 진리표 표시
        const truthTableSection = document.getElementById('info-truth-table');
        const truthTableEl = truthTableSection?.querySelector('.truth-table');
        if (truthTableSection && truthTableEl) {
            if (info.truthTable && info.truthTable.headers && info.truthTable.rows) {
                // 테이블 생성
                let tableHTML = '<thead><tr>';
                info.truthTable.headers.forEach(h => {
                    tableHTML += `<th>${h}</th>`;
                });
                tableHTML += '</tr></thead><tbody>';
                info.truthTable.rows.forEach(row => {
                    tableHTML += '<tr>';
                    row.forEach((cell, idx) => {
                        const isOutput = idx >= info.truthTable.headers.length - (info.outputs || 1);
                        const cellClass = cell === '1' ? 'high' : (cell === '0' ? 'low' : '');
                        tableHTML += `<td class="${cellClass}">${cell}</td>`;
                    });
                    tableHTML += '</tr>';
                });
                tableHTML += '</tbody>';
                truthTableEl.innerHTML = tableHTML;
                truthTableSection.style.display = 'block';
            } else {
                truthTableEl.innerHTML = '';
                truthTableSection.style.display = 'none';
            }
        }

        // 패널 위치 결정 (마우스 위치 기반)
        this.updateTooltipPosition();

        panel.classList.remove('hidden');
    },

    // 패널 위치 업데이트 (현재 마우스 위치 기반)
    updateTooltipPosition() {
        const panel = document.getElementById('component-info-panel');
        if (!panel) return;

        // 현재 마우스 위치 (mousemove 이벤트에서 저장된 값 사용)
        const mouseX = this._lastMouseX || 0;
        const mouseY = this._lastMouseY || 0;

        // 화면 크기
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 사이드바 너비 동적 감지 (접혔을 때는 60px, 펼쳤을 때는 실제 너비)
        const sidebar = document.querySelector('.sidebar');
        let sidebarWidth = 20; // 기본 마진
        if (sidebar) {
            const isCollapsed = sidebar.classList.contains('collapsed');
            sidebarWidth = isCollapsed ? 60 : sidebar.offsetWidth || 250;
        }

        const workspaceCenterX = sidebarWidth + (viewportWidth - sidebarWidth) / 2;
        const workspaceCenterY = viewportHeight / 2;

        const margin = 20;

        // 패널 위치 클래스 제거
        panel.classList.remove('position-top-left', 'position-top-right', 'position-bottom-left', 'position-bottom-right');

        // 마우스가 워크스페이스 기준으로 어느 쪽에 있는지 확인
        const isInSidebar = mouseX < sidebarWidth;
        const isRight = mouseX > workspaceCenterX;
        const isBottom = mouseY > workspaceCenterY;

        // 사이드바 내부에서 호버하는 경우 → 패널은 우측에 표시
        if (isInSidebar) {
            if (isBottom) {
                // 사이드바 하단 → 패널은 우상단
                panel.style.left = 'auto';
                panel.style.right = margin + 'px';
                panel.style.top = (margin + 60) + 'px';
                panel.style.bottom = 'auto';
                panel.classList.add('position-top-right');
            } else {
                // 사이드바 상단 → 패널은 우하단
                panel.style.left = 'auto';
                panel.style.right = margin + 'px';
                panel.style.top = 'auto';
                panel.style.bottom = margin + 'px';
                panel.classList.add('position-bottom-right');
            }
        } else if (isRight && isBottom) {
            // 마우스가 우하단 → 패널은 좌상단
            panel.style.left = (sidebarWidth + margin) + 'px';
            panel.style.right = 'auto';
            panel.style.top = (margin + 60) + 'px';
            panel.style.bottom = 'auto';
            panel.classList.add('position-top-left');
        } else if (!isRight && isBottom) {
            // 마우스가 좌하단 (워크스페이스 내) → 패널은 우상단
            panel.style.left = 'auto';
            panel.style.right = margin + 'px';
            panel.style.top = (margin + 60) + 'px';
            panel.style.bottom = 'auto';
            panel.classList.add('position-top-right');
        } else if (isRight && !isBottom) {
            // 마우스가 우상단 → 패널은 좌하단
            panel.style.left = (sidebarWidth + margin) + 'px';
            panel.style.right = 'auto';
            panel.style.top = 'auto';
            panel.style.bottom = margin + 'px';
            panel.classList.add('position-bottom-left');
        } else {
            // 마우스가 좌상단 (워크스페이스 내) → 패널은 우하단
            panel.style.left = 'auto';
            panel.style.right = margin + 'px';
            panel.style.top = 'auto';
            panel.style.bottom = margin + 'px';
            panel.classList.add('position-bottom-right');
        }
    },

    hideTooltip() {
        const panel = document.getElementById('component-info-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    },

    positionTooltip(event) {
        // 이벤트가 있으면 마우스 위치 업데이트
        if (event && event.clientX !== undefined) {
            this._lastMouseX = event.clientX;
            this._lastMouseY = event.clientY;
        }
        this.updateTooltipPosition();
    },

    updateStatusBar() {
        const compCount = document.getElementById('status-components');
        const wireCount = document.getElementById('status-wires');

        if (compCount) compCount.textContent = '부품: ' + this.components.length;
        if (wireCount) wireCount.textContent = '전선: ' + this.wires.length;
    },

    updateSpeedLabel(speed) {
        this.simulationSpeed = Math.max(0.1, Math.min(10, speed));
        const label = document.getElementById('speed-value');
        if (label) label.textContent = `${this.simulationSpeed.toFixed(1)}x`;
    },

    setSimulationSpeed(speed, showNotification = false) {
        this.simulationSpeed = Math.max(0.1, Math.min(10, speed));
        const label = document.getElementById('speed-value');
        if (label) label.textContent = `${this.simulationSpeed.toFixed(1)}x`;

        if (showNotification) {
            this.showToast(`시뮬레이션 속도: ${this.simulationSpeed.toFixed(1)}x`, 'info');
        }
    },

    toggleGridSnap() {
        this.gridSnap = !this.gridSnap;
        const btn = document.getElementById('btn-grid-snap');
        if (btn) btn.classList.toggle('active', this.gridSnap);
        this.showToast(this.gridSnap ? '그리드 스냅 ON' : '그리드 스냅 OFF', 'info');
    },

    toggleWireMode() {
        this.wireMode = this.wireMode === 'pin' ? 'grid' : 'pin';
        const btn = document.getElementById('btn-wire-mode');
        if (btn) {
            // Pin Mode가 활성 상태(켜짐)로 표시
            btn.classList.toggle('active', this.wireMode === 'pin');
        }
        this.showToast(this.wireMode === 'pin' ? '핀 직접 연결 모드 (자동)' : '격자 기준 연결 모드 (수동)', 'info');
    },

    // 도움말 표시
    showHelp() {
        const helpContent = `
            <div class="modal-overlay show" id="help-modal-overlay">
                <div class="modal" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 class="modal-title">📖 도움말</h2>
                        <button class="modal-close" onclick="document.getElementById('help-modal-overlay').remove()">
                            <svg width="16" height="16"><use href="#icon-close" /></svg>
                        </button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <h3>🎮 기본 조작</h3>
                        <ul>
                            <li><strong>컴포넌트 추가:</strong> 좌측 사이드바에서 버튼 클릭</li>
                            <li><strong>와이어 연결:</strong> 핀에서 핀으로 드래그</li>
                            <li><strong>선택:</strong> 클릭 또는 드래그로 다중 선택</li>
                            <li><strong>삭제:</strong> Delete 또는 Backspace 키</li>
                            <li><strong>이동:</strong> 마우스 휠 버튼 드래그 또는 Space+드래그</li>
                            <li><strong>확대/축소:</strong> Ctrl + 마우스 휠</li>
                        </ul>
                        
                        <h3>⌨️ 단축키</h3>
                        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>A</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">AND 게이트</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>O</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">OR 게이트</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>N</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">NOT 게이트</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>X</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">XOR 게이트</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>S</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">스위치</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>L</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">LED</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>C</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">클럭</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>Ctrl+Z</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">실행 취소</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>Ctrl+Y</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">다시 실행</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>Ctrl+C</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">복사</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>Ctrl+V</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">붙여넣기</td></tr>
                            <tr><td style="padding: 4px; border: 1px solid var(--border-subtle);"><strong>Ctrl+A</strong></td><td style="padding: 4px; border: 1px solid var(--border-subtle);">전체 선택</td></tr>
                        </table>
                        
                        <h3>Tip</h3>
                        <ul>
                            <li>스위치를 클릭하면 ON/OFF가 전환됩니다</li>
                            <li>컴포넌트 우클릭으로 옵션 메뉴를 열 수 있습니다</li>
                            <li>와이어 위에서 클릭하면 연결점이 자동 생성됩니다</li>
                        </ul>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="document.getElementById('help-modal-overlay').remove()">닫기</button>
                    </div>
                </div>
            </div>
        `;

        // 기존 모달 제거
        const existing = document.getElementById('help-modal-overlay');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', helpContent);
    },

    // 진리표 생성기 표시
    showTruthTable() {
        // DOM에서 직접 입력/출력 소자 찾기
        const inputElements = document.querySelectorAll('.component[data-type="SWITCH"], .component[data-type="CLOCK"]');
        const outputElements = document.querySelectorAll('.component[data-type="LED"]');

        const inputs = Array.from(inputElements);
        const outputs = Array.from(outputElements);

        let tableHTML = '';

        if (inputs.length === 0 || outputs.length === 0) {
            tableHTML = '<p style="color: var(--text-secondary);">스위치(입력)와 LED(출력)를 추가하면 진리표를 자동 생성할 수 있습니다.</p>';
        } else if (inputs.length > 6) {
            tableHTML = '<p style="color: var(--text-secondary);">입력이 너무 많습니다 (최대 6개). 스위치 개수를 줄여주세요.</p>';
        } else {
            // 현재 상태 저장
            const savedStates = inputs.map(inp => inp.getAttribute('data-value'));

            // 진리표 생성
            const numInputs = inputs.length;
            const numCombinations = Math.pow(2, numInputs);

            // 헤더 생성
            tableHTML = '<table class="truth-table-generated"><thead><tr>';
            inputs.forEach((inp, i) => {
                const label = inp.querySelector('.comp-label')?.innerText || `IN${i + 1}`;
                tableHTML += `<th>${label}</th>`;
            });
            outputs.forEach((out, i) => {
                const label = out.querySelector('.comp-label')?.innerText || `OUT${i + 1}`;
                tableHTML += `<th style="background: var(--accent-blue-glow);">${label}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';

            // 모든 조합 시뮬레이션
            for (let combo = 0; combo < numCombinations; combo++) {
                tableHTML += '<tr>';

                // 입력 설정
                inputs.forEach((inp, i) => {
                    const bitValue = (combo >> (numInputs - 1 - i)) & 1;
                    inp.setAttribute('data-value', bitValue ? '1' : '0');
                    const cellClass = bitValue ? 'high' : 'low';
                    tableHTML += `<td class="${cellClass}">${bitValue}</td>`;
                });

                // 시뮬레이션 실행 (여러 번 반복하여 안정화)
                for (let j = 0; j < 10; j++) {
                    this.updateCircuit();
                }

                // 출력 읽기
                outputs.forEach(out => {
                    const outValue = out.getAttribute('data-value') === '1' ? 1 : 0;
                    const cellClass = outValue ? 'high' : 'low';
                    tableHTML += `<td class="${cellClass}">${outValue}</td>`;
                });

                tableHTML += '</tr>';
            }

            tableHTML += '</tbody></table>';

            // 원래 상태 복원
            inputs.forEach((inp, i) => {
                inp.setAttribute('data-value', savedStates[i] || '0');
            });
            this.updateCircuit();
        }

        const modalContent = `
            <div class="modal-overlay show" id="truthtable-modal-overlay">
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 class="modal-title">📊 진리표 생성기</h2>
                        <button class="modal-close" onclick="document.getElementById('truthtable-modal-overlay').remove()">
                            <svg width="16" height="16"><use href="#icon-close" /></svg>
                        </button>
                    </div>
                    <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                        <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 12px;">
                            입력: <strong>${inputs.length}</strong>개 (스위치) | 출력: <strong>${outputs.length}</strong>개 (LED)
                        </p>
                        ${tableHTML}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="document.getElementById('truthtable-modal-overlay').remove()">닫기</button>
                    </div>
                </div>
            </div>
        `;

        // 기존 모달 제거
        const existing = document.getElementById('truthtable-modal-overlay');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', modalContent);
    }
});
