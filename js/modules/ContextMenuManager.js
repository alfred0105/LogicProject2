/**
 * 모듈: 중앙 집중식 컨텍스트 메뉴 관리자 (ContextMenuManager)
 * - 모든 우클릭 메뉴를 통합 관리
 * - 동적 DOM 생성 및 위치 자동 보정
 * - 키보드 네비게이션 지원
 * - 애니메이션 및 글래스모피즘 스타일
 */
class ContextMenuManager {
    constructor(sim) {
        this.sim = sim;
        this.activeMenu = null;
        this.overlay = null;

        // 전역 클릭 감지 바인딩
        this._handleGlobalClick = this._handleGlobalClick.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);

        this.init();
    }

    init() {
        // 기존 메뉴들 제거 (청소)
        const oldMenus = document.querySelectorAll('.context-menu, #context-menu, #component-context-menu');
        oldMenus.forEach(el => el.remove());

        // 전역 우클릭 리스너 등록 (Capture 단계)
        // 기존 컴포넌트들의 stopPropagation을 무시하고 최우선으로 처리하기 위해 true 사용
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e), true);
    }

    /**
     * 우클릭 이벤트 핸들링 (진입점)
     */
    handleContextMenu(e) {
        // Shift 키를 누르면 브라우저 기본 메뉴 허용 (디버깅용)
        if (e.shiftKey) return;

        e.preventDefault();

        // 대상 식별
        const target = e.target;

        // 1. 컴포넌트 클릭
        const component = target.closest('.component');
        if (component) {
            this.showComponentMenu(e, component);
            return;
        }

        // 2. 와이어 클릭
        const wire = target.closest('.wire-path');
        if (wire) {
            this.showWireMenu(e, wire);
            return;
        }

        // 3. 빈 공간 클릭 (워크스페이스)
        if (target.closest('#workspace') || target.id === 'workspace' || target.closest('#module-canvas')) {
            this.showWorkspaceMenu(e);
            return;
        }

        // 그 외 영역은 메뉴 닫기
        this.close();
    }

    /**
     * 컴포넌트 메뉴 항목 정의 및 표시
     */
    showComponentMenu(e, component) {
        const type = component.getAttribute('data-type');
        const isSelected = component.classList.contains('selected');

        // 선택되지 않은 상태에서 우클릭 시, 해당 컴포넌트만 선택 (또는 추가 선택 로직)
        if (!isSelected) {
            this.sim.selectComponent(component, false);
        }

        const items = [];

        // 1. 모듈 편집 (패키지인 경우)
        if (type === 'PACKAGE') {
            items.push({
                label: '모듈 내부 수정',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
                action: () => this.sim.openModuleEditor ? this.sim.openModuleEditor(component) : null
            });
            items.push({ separator: true });
        }

        // 2. LED 색상 변경 (LED인 경우)
        if (type === 'LED') {
            items.push({
                label: '색상 변경',
                icon: '🎨',
                submenu: [
                    { label: 'Red', action: () => this.sim.setLEDColor('red'), icon: '🔴' },
                    { label: 'Green', action: () => this.sim.setLEDColor('green'), icon: '🟢' },
                    { label: 'Blue', action: () => this.sim.setLEDColor('blue'), icon: '🔵' },
                    { label: 'Yellow', action: () => this.sim.setLEDColor('yellow'), icon: '🟡' },
                    { label: 'White', action: () => this.sim.setLEDColor('white'), icon: '⚪' }
                ]
            });
            items.push({ separator: true });
        }

        // 3. 기본 편집기능
        items.push({
            label: '복사',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            shortcut: 'Ctrl+C',
            action: () => this.sim.copySelection()
        });

        items.push({
            label: '복제',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            shortcut: 'Ctrl+D',
            action: () => this.sim.duplicateSelection()
        });

        items.push({ separator: true });

        items.push({
            label: '삭제',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
            shortcut: 'Del',
            danger: true,
            action: () => this.sim.deleteSelected()
        });

        // 4. 정보 보기 (마지막)
        items.push({ separator: true });
        const info = this.sim.getComponentInfo(type);
        items.push({
            label: `${info.name || type} 정보`,
            icon: 'info', // TODO: SVG로 교체 가능
            action: () => this.sim.updateComponentInfoPanel(component)
        });

        this.open(e.clientX, e.clientY, items);
    }

    /**
     * 와이어 메뉴
     */
    showWireMenu(e, wireEl) {
        // 와이어 객체 찾기
        const wire = this.sim.wires.find(w => w.line === wireEl)
            || (this.sim.moduleWires && this.sim.moduleWires.find(w => w.line === wireEl));

        if (!wire) return;

        const items = [
            {
                label: '전선 삭제',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>',
                danger: true,
                action: () => {
                    this.sim.removeWire(wire);
                    // 모듈 모드일 때는 저장 처리 추가 필요
                    if (this.sim.saveCurrentModuleTabState) this.sim.saveCurrentModuleTabState();
                    if (this.sim.saveState) this.sim.saveState();
                }
            },
            {
                label: 'Joint 추가',
                icon: '⚫',
                action: () => {
                    // WireManager에 insertJointOnWire가 구현되어 있어야 함
                    // 좌표 계산 필요 (복잡하므로 단순히 기능이 있다고 가정하거나, WireManager의 기능을 호출)
                    // 여기서는 일단 패스하거나 추후 구현
                }
            }
        ];

        this.open(e.clientX, e.clientY, items);
    }

    /**
     * 빈 공간(Workspace) 메뉴
     */
    showWorkspaceMenu(e) {
        const items = [
            {
                label: '붙여넣기',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
                shortcut: 'Ctrl+V',
                disabled: !this.sim.clipboard || this.sim.clipboard.length === 0,
                action: () => this.sim.pasteFromClipboard()
            },
            { separator: true },
            {
                label: '모두 선택',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>',
                shortcut: 'Ctrl+A',
                action: () => this.sim.selectAll()
            },
            {
                label: '보기 재설정',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
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
    // Core Rendering & Logic
    // ===========================================

    open(x, y, items) {
        this.close(); // 기존 메뉴 닫기

        // DOM 생성
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

            // Submenu Indicator
            if (item.submenu) {
                const arrowEl = document.createElement('span');
                arrowEl.className = 'cm-arrow';
                arrowEl.innerHTML = '›'; // SVG로 교체 권장
                itemEl.appendChild(arrowEl);
            }

            // Click Action
            if (!item.disabled && item.action) {
                itemEl.onclick = (e) => {
                    e.stopPropagation();
                    this.close();
                    item.action();
                };
            }

            // Hover for Submenu (구현 생략 - 심플함을 위해, 필요시 추가)
            if (item.submenu) {
                // TODO: 서브메뉴 구현
                // 마우스 오버 시 서브메뉴 컨테이너 생성 및 표시
            }

            menuEl.appendChild(itemEl);
        });

        document.body.appendChild(menuEl);
        this.activeMenu = menuEl;

        // 위치 잡기 (화면 벗어남 방지)
        // 일단 display: block 상태여야 크기 계산 가능
        // css class에서 animation 처리

        const rect = menuEl.getBoundingClientRect();
        let posX = x;
        let posY = y;

        if (posX + rect.width > window.innerWidth) {
            posX = window.innerWidth - rect.width - 10;
        }
        if (posY + rect.height > window.innerHeight) {
            posY = window.innerHeight - rect.height - 10;
        }

        menuEl.style.left = `${posX}px`;
        menuEl.style.top = `${posY}px`;

        // 이벤트 바인딩 (닫기용)
        // setTimeout으로 바인딩을 미뤄서, 메뉴 여는 클릭이 즉시 닫기 이벤트를 유발하지 않게 함
        setTimeout(() => {
            window.addEventListener('mousedown', this._handleGlobalClick, true);
            window.addEventListener('keydown', this._handleKeyDown, true);
        }, 0);
    }

    close() {
        if (this.activeMenu) {
            const menu = this.activeMenu;
            this.activeMenu = null;

            // Fade out animation
            menu.classList.add('closing');
            menu.addEventListener('animationend', () => menu.remove());
        }

        // 리스너 해제
        window.removeEventListener('mousedown', this._handleGlobalClick, true);
        window.removeEventListener('keydown', this._handleKeyDown, true);
    }

    _handleGlobalClick(e) {
        // 메뉴 내부 클릭이면 무시
        if (this.activeMenu && this.activeMenu.contains(e.target)) {
            return;
        }
        this.close();
    }

    _handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.close();
        }
    }
}

// 전역 모듈로 등록 (CircuitSimulator 확장이 아님, 별도 클래스)
window.ContextMenuManager = ContextMenuManager;
