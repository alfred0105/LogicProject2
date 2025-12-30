/**
 * 모듈: 중앙 집중식 컨텍스트 메뉴 관리자 (ContextMenuManager)
 * - 모든 우클릭 메뉴를 통합 관리
 * - 동적 DOM 생성 및 위치 자동 보정
 * - 서브메뉴 지원
 */
class ContextMenuManager {
    constructor(sim) {
        this.sim = sim;
        this.activeMenu = null;
        this.activeSubmenu = null; // 현재 열린 서브메뉴

        // 전역 클릭 감지 바인딩
        this._handleGlobalClick = this._handleGlobalClick.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);

        this.init();
    }

    init() {
        const oldMenus = document.querySelectorAll('.context-menu, #context-menu, #component-context-menu');
        oldMenus.forEach(el => el.remove());

        // 전역 우클릭 리스너 (Capture)
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e), true);
    }

    handleContextMenu(e) {
        if (e.shiftKey) return;
        e.preventDefault();

        const target = e.target;

        const component = target.closest('.component');
        if (component) {
            this.showComponentMenu(e, component);
            return;
        }

        const wire = target.closest('.wire-path');
        if (wire) {
            this.showWireMenu(e, wire);
            return;
        }

        if (target.closest('#workspace') || target.id === 'workspace' || target.closest('#module-canvas')) {
            this.showWorkspaceMenu(e);
            return;
        }

        this.close();
    }

    showComponentMenu(e, component) {
        const type = component.getAttribute('data-type');
        const isSelected = component.classList.contains('selected');

        if (!isSelected) {
            this.sim.selectComponent(component, false);
        }

        const selectedCount = this.sim.selectedComponents ? this.sim.selectedComponents.length : 1;
        const items = [];

        // 1. 모듈 편집
        if (type === 'PACKAGE') {
            items.push({
                label: '모듈 내부 수정',
                icon: '✏️',
                action: () => this.sim.openModuleEditor && this.sim.openModuleEditor(component)
            });
            items.push({ separator: true });
        }

        // 2. 기본 편집 (복사/붙여넣기/복제)
        items.push({
            label: '복사',
            icon: this._getIconSVG('copy'),
            shortcut: 'Ctrl+C',
            action: () => this.sim.copySelection()
        });
        items.push({
            label: '복제',
            icon: this._getIconSVG('duplicate'),
            shortcut: 'Ctrl+D',
            action: () => this.sim.duplicateSelection()
        });

        // 3. LED 색상 (서브메뉴)
        const hasLED = this.sim.selectedComponents.some(c => c.getAttribute('data-type') === 'LED');
        if (hasLED) {
            items.push({ separator: true });
            items.push({
                label: 'LED 색상',
                icon: '🎨',
                submenu: [
                    { label: '빨강 LED', icon: '🔴', action: () => this.sim.setLEDColor('red') },
                    { label: '초록 LED', icon: '🟢', action: () => this.sim.setLEDColor('green') },
                    { label: '파랑 LED', icon: '🔵', action: () => this.sim.setLEDColor('blue') },
                    { label: '노랑 LED', icon: '🟡', action: () => this.sim.setLEDColor('yellow') },
                    { label: '흰색 LED', icon: '⚪', action: () => this.sim.setLEDColor('white') }
                ]
            });
        }

        // 4. 정렬 및 배치 (다중 선택 시)
        if (selectedCount > 1) {
            items.push({ separator: true });
            items.push({
                label: '정렬',
                icon: this._getIconSVG('align'),
                submenu: [
                    { label: '수평 정렬', icon: '━', action: () => this.sim.alignSelectedHorizontal() },
                    { label: '수직 정렬', icon: '┃', action: () => this.sim.alignSelectedVertical() }
                ]
            });
            items.push({
                label: '균등 배치',
                icon: this._getIconSVG('distribute'),
                submenu: [
                    { label: '수평 균등', icon: '⬌', action: () => this.sim.distributeHorizontal() },
                    { label: '수직 균등', icon: '⬍', action: () => this.sim.distributeVertical() }
                ]
            });
        }

        items.push({ separator: true });

        // 5. 변환 (회전/반전)
        items.push({
            label: '회전',
            icon: this._getIconSVG('rotate'),
            shortcut: 'R',
            action: () => this.sim.rotateSelected()
        });
        items.push({ label: '좌우 반전', icon: '↔️', action: () => this.sim.flipHorizontal() });
        items.push({ label: '상하 반전', icon: '↕️', action: () => this.sim.flipVertical() });

        // 6. 타이밍 추적 (단일 선택)
        if (selectedCount === 1 && this.sim.addComponentToTiming) {
            items.push({ separator: true });
            items.push({ label: '📈 타이밍 추적', action: () => this.sim.addComponentToTiming(component) });
        }

        // 7. 삭제 및 정보
        items.push({ separator: true });
        items.push({
            label: '삭제',
            icon: this._getIconSVG('trash'),
            shortcut: 'Del',
            danger: true,
            action: () => this.sim.deleteSelected()
        });

        items.push({ separator: true });
        const info = this.sim.getComponentInfo(type);
        items.push({
            label: '정보 보기', // 이름이 너무 길어질 수 있으므로 고정
            icon: 'ℹ️',
            action: () => this.sim.updateComponentInfoPanel(component)
        });

        this.open(e.clientX, e.clientY, items);
    }

    showWireMenu(e, wireEl) {
        const wire = this.sim.wires.find(w => w.line === wireEl)
            || (this.sim.moduleWires && this.sim.moduleWires.find(w => w.line === wireEl));

        if (!wire) return;

        const items = [
            {
                label: '전선 삭제',
                icon: this._getIconSVG('trash'),
                danger: true,
                action: () => {
                    this.sim.removeWire(wire);
                    if (this.sim.saveCurrentModuleTabState) this.sim.saveCurrentModuleTabState();
                    if (this.sim.saveState) this.sim.saveState();
                }
            }
        ];

        this.open(e.clientX, e.clientY, items);
    }

    showWorkspaceMenu(e) {
        // 클립보드 확인
        const hasClipboard = this.sim.clipboard && this.sim.clipboard.length > 0;

        const items = [
            {
                label: '붙여넣기',
                icon: this._getIconSVG('paste'),
                shortcut: 'Ctrl+V',
                disabled: !hasClipboard,
                action: () => this.sim.pasteFromClipboard()
            },
            { separator: true },
            {
                label: '모두 선택',
                icon: this._getIconSVG('select_all'),
                shortcut: 'Ctrl+A',
                action: () => this.sim.selectAll()
            },
            {
                label: '보기 재설정',
                icon: '🔍',
                action: () => {
                    this.sim.scale = 1;
                    this.sim.panX = 0;
                    this.sim.panY = 0;
                    this.sim.updateTransform();
                }
            }
        ];

        this.open(e.clientX, e.clientY, items);
    }

    // ===========================================
    // Core Rendering
    // ===========================================

    open(x, y, items) {
        this.close();

        // 메인 메뉴 생성
        this.activeMenu = this._renderMenu(items);
        document.body.appendChild(this.activeMenu);

        // 위치 보정
        this._positionMenu(this.activeMenu, x, y);

        // 이벤트 바인딩
        setTimeout(() => {
            window.addEventListener('mousedown', this._handleGlobalClick, true);
            window.addEventListener('keydown', this._handleKeyDown, true);
        }, 0);
    }

    _renderMenu(items) {
        const menuEl = document.createElement('div');
        menuEl.className = 'cm-container';

        items.forEach(item => {
            if (item.separator) {
                const sep = document.createElement('div');
                sep.className = 'cm-separator';
                menuEl.appendChild(sep);
                return;
            }

            const itemEl = document.createElement('div');
            itemEl.className = `cm-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`;

            // Icon
            const iconEl = document.createElement('span');
            iconEl.className = 'cm-icon';
            if (item.icon && item.icon.startsWith('<svg')) {
                iconEl.innerHTML = item.icon;
            } else {
                iconEl.textContent = item.icon || '';
            }
            itemEl.appendChild(iconEl);

            // Label
            const labelEl = document.createElement('span');
            labelEl.className = 'cm-label';
            labelEl.textContent = item.label;
            itemEl.appendChild(labelEl);

            // Shortcut
            if (item.shortcut) {
                const scEl = document.createElement('span');
                scEl.className = 'cm-shortcut';
                scEl.textContent = item.shortcut;
                itemEl.appendChild(scEl);
            }

            // Submenu Indicator & Logic
            if (item.submenu) {
                const arrowEl = document.createElement('span');
                arrowEl.className = 'cm-arrow';
                arrowEl.innerHTML = '›';
                itemEl.appendChild(arrowEl);

                // Hover Event
                itemEl.addEventListener('mouseenter', () => {
                    this._openSubmenu(item.submenu, itemEl);
                });
            } else {
                // 다른 아이템 호버 시 열린 서브메뉴 닫기
                itemEl.addEventListener('mouseenter', () => {
                    this._closeSubmenu();
                });
            }

            // Click Action
            if (!item.disabled && item.action) {
                itemEl.onclick = (e) => {
                    e.stopPropagation();
                    this.close();
                    item.action();
                };
            }

            menuEl.appendChild(itemEl);
        });

        return menuEl;
    }

    _openSubmenu(items, parentItemEl) {
        this._closeSubmenu(); // 기존 서브메뉴 닫기

        const submenuEl = this._renderMenu(items);
        submenuEl.style.zIndex = '10005'; // 메인 메뉴보다 위에 표시
        document.body.appendChild(submenuEl);
        this.activeSubmenu = submenuEl;

        // 위치 계산 (부모 아이템의 오른쪽)
        const rect = parentItemEl.getBoundingClientRect();

        // 서브메뉴 너비 예측 (렌더링 후지만)
        const subRect = submenuEl.getBoundingClientRect();

        let x = rect.right + 2;
        let y = rect.top - 4;

        // 화면 오른쪽 넘어가면 왼쪽으로
        if (x + subRect.width > window.innerWidth) {
            x = rect.left - subRect.width - 2;
        }

        // 다시 정확히 보정
        this._positionMenu(submenuEl, x, y);
    }

    _closeSubmenu() {
        if (this.activeSubmenu) {
            this.activeSubmenu.remove();
            this.activeSubmenu = null;
        }
    }

    close() {
        this._closeSubmenu();
        if (this.activeMenu) {
            const menu = this.activeMenu;
            this.activeMenu = null;
            menu.classList.add('closing');
            menu.addEventListener('animationend', () => menu.remove());
        }

        window.removeEventListener('mousedown', this._handleGlobalClick, true);
        window.removeEventListener('keydown', this._handleKeyDown, true);
    }

    _positionMenu(el, x, y) {
        // 화면 밖으로 나가지 않도록 조정
        // 브라우저가 레이아웃 잡을 시간 줌? display가 이미 flex라 정보 있을듯
        const rect = el.getBoundingClientRect();
        let posX = x;
        let posY = y;

        if (posX + rect.width > window.innerWidth) {
            posX = window.innerWidth - rect.width - 10;
        }
        if (posY + rect.height > window.innerHeight) {
            posY = window.innerHeight - rect.height - 10;
        }

        // 서브메뉴가 왼쪽으로 열릴 때 처리 (간단히)
        if (posX < 0) posX = 10;

        el.style.left = `${posX}px`;
        el.style.top = `${posY}px`;
    }

    _handleGlobalClick(e) {
        // 메뉴나 서브메뉴 내부 클릭이면 무시
        if ((this.activeMenu && this.activeMenu.contains(e.target)) ||
            (this.activeSubmenu && this.activeSubmenu.contains(e.target))) {
            return;
        }
        this.close();
    }

    _handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.close();
        }
    }

    _getIconSVG(name) {
        const icons = {
            'copy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            'duplicate': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4M16.5 9.4 7.55 4.24M3.29 7 12 12 20.71 7M12 12v9"></path></svg>',
            'trash': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
            'paste': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
            'select_all': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path></svg>',
            'rotate': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2v2c4.42 0 8 3.58 8 8s-3.58 8-8 8-8-3.58-8-8H2z"></path></svg>',
            'align': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21H3M21 3H3M12 21V3"></path></svg>',
            'distribute': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2h13M8 22h13M3 6v12M21 6v12"></path></svg>'
        };
        return icons[name] || '';
    }
}

window.ContextMenuManager = ContextMenuManager;
