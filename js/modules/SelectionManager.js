/**
 * 모듈: 선택, 그룹 조작, 컨텍스트 메뉴, 컴포넌트 정보
 */
Object.assign(CircuitSimulator.prototype, {
    // ===================================
    // 1. Basic Selection
    // ===================================
    selectComponent(el, keepOthers) {
        if (!keepOthers) this.clearSelection();
        if (!this.selectedComponents.includes(el)) {
            this.selectedComponents.push(el);
            el.classList.add('selected');
        }
        this.updateSelectionIndicator();
        this.hideComponentInfoPanel();
    },

    clearSelection() {
        this.selectedComponents.forEach(el => el.classList.remove('selected'));
        this.selectedComponents = [];
        this.updateSelectionIndicator();
        this.hideComponentInfoPanel();
    },

    selectAll() {
        this.clearSelection();
        this.components.forEach(comp => this.selectComponent(comp, true));
        this.showToast(`${this.components.length}개 전체 선택됨`, 'info');
        this.updateSelectionIndicator();
    },

    updateSelectionIndicator() {
        const indicator = document.getElementById('selection-count');
        if (indicator) {
            if (this.selectedComponents.length > 0) {
                indicator.textContent = `선택: ${this.selectedComponents.length}개`;
                indicator.style.display = 'inline-block';
            } else {
                indicator.style.display = 'none';
            }
        }
    },

    // ===================================
    // 2. Context Menu & Info
    // ===================================
    showContextMenu(x, y) {
        if (!this.contextMenu) {
            this.contextMenu = document.getElementById('context-menu');
        }
        if (!this.contextMenu) return;

        // [구조적 개선] 투명 오버레이 생성 (확실한 닫기 처리용)
        let overlay = document.getElementById('context-menu-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'context-menu-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.zIndex = '99998'; // 메뉴 바로 아래
            overlay.style.cursor = 'default';
            // 오버레이 클릭 시 닫기
            overlay.onclick = (e) => {
                e.stopPropagation();
                this.hideContextMenu();
            };
            // 오버레이네 우클릭 방지 (브라우저 기본 메뉴 방지)
            overlay.oncontextmenu = (e) => {
                e.preventDefault();
                this.hideContextMenu();
            };
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';

        // LED Color Options Visibility
        const hasLED = this.selectedComponents.some(comp =>
            comp.getAttribute('data-type') === 'LED'
        );
        this.contextMenu.querySelectorAll('.ctx-led-only').forEach(el => {
            el.style.display = hasLED ? '' : 'none';
        });

        this.contextMenu.style.display = 'block';
        this.contextMenu.style.zIndex = '99999'; // 오버레이보다 위
        this.contextMenu.style.top = y + 'px';

        const menuRect = this.contextMenu.getBoundingClientRect();
        if (x + menuRect.width > window.innerWidth) {
            this.contextMenu.style.left = (x - menuRect.width) + 'px';
        } else {
            this.contextMenu.style.left = x + 'px';
        }

        // 기존 리스너 방식 제거 (오버레이가 처리하므로 불필요)
        if (this._ctxMenuHandler) {
            document.removeEventListener('mousedown', this._ctxMenuHandler);
            this._ctxMenuHandler = null;
        }
    },

    hideContextMenu() {
        // 오버레이 숨기기
        const overlay = document.getElementById('context-menu-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        if (!this.contextMenu) {
            this.contextMenu = document.getElementById('context-menu');
        }
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }

        // TabManager 등 다른 메뉴도 같이 닫기
        const dynamicMenu = document.getElementById('component-context-menu');
        if (dynamicMenu) {
            dynamicMenu.classList.remove('visible');
            setTimeout(() => dynamicMenu.remove(), 100);
        }
    },

    // 모든 동적 생성 컨텍스트 메뉴 닫기 (TabManager 포함)
    hideAllContextMenus() {
        // 메인 컨텍스트 메뉴 닫기
        this.hideContextMenu();

        // TabManager에서 생성한 컨텍스트 메뉴
        const dynamicMenu = document.getElementById('component-context-menu');
        if (dynamicMenu) {
            dynamicMenu.classList.remove('visible');
            setTimeout(() => dynamicMenu.remove(), 150);
        }

        // 기타 동적 context-menu 클래스 메뉴들
        document.querySelectorAll('.context-menu.visible').forEach(menu => {
            menu.classList.remove('visible');
            setTimeout(() => menu.remove(), 150);
        });
    },

    getComponentInfo(type) {
        // 직관적인 신호 흐름 애니메이션 (입력 → 게이트 → 출력)
        // 신호 HIGH: #ff4e42, LOW: #6b7280, 게이트: #475569
        const componentData = {
            'AND': {
                icon: '⊗',
                name: 'AND 게이트',
                description: '두 입력이 모두 HIGH일 때만 출력이 HIGH가 됩니다.',
                inputs: 2,
                outputs: 1,
                usage: '두 스위치를 모두 ON → LED 켜짐',
                truthTable: { headers: ['A', 'B', 'Y'], rows: [['0', '0', '0'], ['0', '1', '0'], ['1', '0', '0'], ['1', '1', '1']] },
                animation: `<svg viewBox="0 0 120 60"><rect x="0" y="0" width="120" height="60" fill="#0a0c10"/><path d="M35 10 L55 10 A 16 20 0 0 1 55 50 L35 50 Z" fill="#475569" stroke="#64748b" stroke-width="1.5"/><line x1="8" y1="20" x2="35" y2="20" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><line x1="8" y1="40" x2="35" y2="40" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><line x1="71" y1="30" x2="112" y2="30" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="20" r="4" fill="#ff4e42"/><circle cx="8" cy="40" r="4" fill="#ff4e42"/><circle cx="112" cy="30" r="4" fill="#ff4e42"/><text x="45" y="34" fill="#94a3b8" font-size="12" font-family="Inter" font-weight="600">&amp;</text></svg>`
            },
            'OR': {
                icon: '⊕',
                name: 'OR 게이트',
                description: '입력 중 하나라도 HIGH이면 출력이 HIGH가 됩니다.',
                inputs: 2,
                outputs: 1,
                usage: '스위치 하나만 ON → LED 켜짐',
                truthTable: { headers: ['A', 'B', 'Y'], rows: [['0', '0', '0'], ['0', '1', '1'], ['1', '0', '1'], ['1', '1', '1']] },
                animation: `<svg viewBox="0 0 120 60"><rect x="0" y="0" width="120" height="60" fill="#0a0c10"/><path d="M28 10 Q 38 30 28 50 Q 52 50 70 30 Q 52 10 28 10 Z" fill="#475569" stroke="#64748b" stroke-width="1.5"/><line x1="8" y1="20" x2="36" y2="20" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><line x1="8" y1="40" x2="36" y2="40" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><line x1="70" y1="30" x2="112" y2="30" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="20" r="4" fill="#ff4e42"/><circle cx="8" cy="40" r="4" fill="#6b7280"/><circle cx="112" cy="30" r="4" fill="#ff4e42"/><text x="46" y="34" fill="#94a3b8" font-size="11" font-family="Inter" font-weight="600">≥1</text></svg>`
            },
            'NOT': {
                icon: '¬',
                name: 'NOT 게이트',
                description: '입력 신호를 반전시킵니다. HIGH→LOW, LOW→HIGH',
                inputs: 1,
                outputs: 1,
                usage: 'OFF 입력 → ON 출력',
                truthTable: { headers: ['A', 'Y'], rows: [['0', '1'], ['1', '0']] },
                animation: `<svg viewBox="0 0 100 50"><rect x="0" y="0" width="100" height="50" fill="#0a0c10"/><path d="M25 8 L55 25 L25 42 Z" fill="#475569" stroke="#64748b" stroke-width="1.5"/><circle cx="60" cy="25" r="5" fill="#1a1e25" stroke="#64748b" stroke-width="1.5"/><line x1="8" y1="25" x2="25" y2="25" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="25" x2="92" y2="25" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="25" r="4" fill="#6b7280"/><circle cx="92" cy="25" r="4" fill="#ff4e42"/></svg>`
            },
            'XOR': {
                icon: '⊻',
                name: 'XOR 게이트',
                description: '두 입력이 서로 다를 때만 출력이 HIGH가 됩니다.',
                inputs: 2,
                outputs: 1,
                usage: '입력이 다르면 → LED 켜짐',
                truthTable: { headers: ['A', 'B', 'Y'], rows: [['0', '0', '0'], ['0', '1', '1'], ['1', '0', '1'], ['1', '1', '0']] },
                animation: `<svg viewBox="0 0 120 60"><rect x="0" y="0" width="120" height="60" fill="#0a0c10"/><path d="M35 10 Q 45 30 35 50 Q 58 50 75 30 Q 58 10 35 10 Z" fill="#475569" stroke="#64748b" stroke-width="1.5"/><path d="M28 10 Q 38 30 28 50" fill="none" stroke="#64748b" stroke-width="1.5"/><line x1="8" y1="20" x2="40" y2="20" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><line x1="8" y1="40" x2="40" y2="40" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><line x1="75" y1="30" x2="112" y2="30" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="20" r="4" fill="#ff4e42"/><circle cx="8" cy="40" r="4" fill="#6b7280"/><circle cx="112" cy="30" r="4" fill="#ff4e42"/><text x="50" y="34" fill="#94a3b8" font-size="11" font-family="Inter" font-weight="600">=1</text></svg>`
            },
            'NAND': {
                icon: '⊼',
                name: 'NAND 게이트',
                description: 'AND의 반대. 둘 다 HIGH가 아니면 출력 HIGH.',
                inputs: 2,
                outputs: 1,
                usage: '하나라도 OFF → LED 켜짐',
                truthTable: { headers: ['A', 'B', 'Y'], rows: [['0', '0', '1'], ['0', '1', '1'], ['1', '0', '1'], ['1', '1', '0']] },
                animation: `<svg viewBox="0 0 120 60"><rect x="0" y="0" width="120" height="60" fill="#0a0c10"/><path d="M30 10 L50 10 A 16 20 0 0 1 50 50 L30 50 Z" fill="#475569" stroke="#64748b" stroke-width="1.5"/><circle cx="66" cy="30" r="5" fill="#1a1e25" stroke="#64748b" stroke-width="1.5"/><line x1="8" y1="20" x2="30" y2="20" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><line x1="8" y1="40" x2="30" y2="40" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><line x1="71" y1="30" x2="112" y2="30" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="20" r="4" fill="#ff4e42"/><circle cx="8" cy="40" r="4" fill="#6b7280"/><circle cx="112" cy="30" r="4" fill="#ff4e42"/></svg>`
            },
            'NOR': {
                icon: '⊽',
                name: 'NOR 게이트',
                description: 'OR의 반대. 둘 다 LOW일 때만 출력 HIGH.',
                inputs: 2,
                outputs: 1,
                usage: '둘 다 OFF → LED 켜짐',
                truthTable: { headers: ['A', 'B', 'Y'], rows: [['0', '0', '1'], ['0', '1', '0'], ['1', '0', '0'], ['1', '1', '0']] },
                animation: `<svg viewBox="0 0 120 60"><rect x="0" y="0" width="120" height="60" fill="#0a0c10"/><path d="M28 10 Q 38 30 28 50 Q 50 50 65 30 Q 50 10 28 10 Z" fill="#475569" stroke="#64748b" stroke-width="1.5"/><circle cx="72" cy="30" r="5" fill="#1a1e25" stroke="#64748b" stroke-width="1.5"/><line x1="8" y1="20" x2="36" y2="20" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><line x1="8" y1="40" x2="36" y2="40" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><line x1="77" y1="30" x2="112" y2="30" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="20" r="4" fill="#6b7280"/><circle cx="8" cy="40" r="4" fill="#6b7280"/><circle cx="112" cy="30" r="4" fill="#ff4e42"/></svg>`
            },
            'XNOR': {
                icon: '⊙',
                name: 'XNOR 게이트',
                description: 'XOR의 반대. 입력이 같으면 출력 HIGH.',
                inputs: 2,
                outputs: 1,
                usage: '입력이 같으면 → LED 켜짐',
                truthTable: { headers: ['A', 'B', 'Y'], rows: [['0', '0', '1'], ['0', '1', '0'], ['1', '0', '0'], ['1', '1', '1']] },
                animation: `<svg viewBox="0 0 120 60"><rect x="0" y="0" width="120" height="60" fill="#0a0c10"/><path d="M35 10 Q 45 30 35 50 Q 55 50 68 30 Q 55 10 35 10 Z" fill="#475569" stroke="#64748b" stroke-width="1.5"/><path d="M28 10 Q 38 30 28 50" fill="none" stroke="#64748b" stroke-width="1.5"/><circle cx="75" cy="30" r="5" fill="#1a1e25" stroke="#64748b" stroke-width="1.5"/><line x1="8" y1="20" x2="40" y2="20" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><line x1="8" y1="40" x2="40" y2="40" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><line x1="80" y1="30" x2="112" y2="30" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="20" r="4" fill="#ff4e42"/><circle cx="8" cy="40" r="4" fill="#ff4e42"/><circle cx="112" cy="30" r="4" fill="#ff4e42"/></svg>`
            },
            'SWITCH': {
                icon: '🔘',
                name: '스위치',
                description: '클릭하여 ON/OFF를 전환합니다.',
                inputs: 0,
                outputs: 1,
                usage: '클릭하면 상태가 바뀜',
                truthTable: null,
                animation: `<svg viewBox="0 0 80 50"><rect x="0" y="0" width="80" height="50" fill="#0a0c10"/><circle cx="30" cy="25" r="18" fill="#1a1e25" stroke="#ff4e42" stroke-width="2"/><line x1="30" y1="10" x2="30" y2="25" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><line x1="48" y1="25" x2="72" y2="25" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="72" cy="25" r="4" fill="#ff4e42"/><text x="30" y="40" text-anchor="middle" fill="#10b981" font-size="9" font-family="Inter" font-weight="600">ON</text></svg>`
            },
            'LED': {
                icon: '',
                name: 'LED',
                description: 'HIGH 입력 시 불이 켜집니다.',
                inputs: 1,
                outputs: 0,
                usage: 'HIGH 신호 → 불 켜짐',
                truthTable: null,
                animation: `<svg viewBox="0 0 70 50"><rect x="0" y="0" width="70" height="50" fill="#0a0c10"/><line x1="8" y1="25" x2="22" y2="25" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="25" r="4" fill="#ff4e42"/><circle cx="42" cy="25" r="16" fill="#ef4444" stroke="#fca5a5" stroke-width="2"/><circle cx="42" cy="25" r="10" fill="#fef08a" opacity="0.8"/></svg>`
            },
            'CLOCK': {
                icon: '⏰',
                name: '클럭',
                description: '주기적으로 HIGH/LOW를 반복합니다.',
                inputs: 0,
                outputs: 1,
                usage: '자동으로 신호 토글',
                truthTable: null,
                animation: `<svg viewBox="0 0 100 50"><rect x="0" y="0" width="100" height="50" fill="#0a0c10"/><rect x="8" y="8" width="55" height="34" rx="4" fill="#1a1e25" stroke="#64748b" stroke-width="1.5"/><polyline points="14,32 14,18 24,18 24,32 34,32 34,18 44,18 44,32 54,32 54,18" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="63" y1="25" x2="92" y2="25" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="92" cy="25" r="4" fill="#ff4e42"/></svg>`
            },
            'JOINT': {
                icon: '⚫',
                name: '연결점',
                description: '전선을 분기하는 지점입니다.',
                inputs: 1,
                outputs: 1,
                usage: '전선 분기에 사용',
                truthTable: null,
                animation: `<svg viewBox="0 0 60 50"><rect x="0" y="0" width="60" height="50" fill="#0a0c10"/><line x1="8" y1="25" x2="22" y2="25" stroke="#ff4e42" stroke-width="2"/><line x1="38" y1="25" x2="52" y2="25" stroke="#ff4e42" stroke-width="2"/><line x1="30" y1="8" x2="30" y2="22" stroke="#ff4e42" stroke-width="2"/><line x1="30" y1="38" x2="30" y2="28" stroke="#ff4e42" stroke-width="2"/><circle cx="30" cy="25" r="6" fill="#ff4e42"/></svg>`
            },
            'TRANSISTOR': {
                icon: '📍',
                name: 'NMOS 트랜지스터',
                description: 'Gate HIGH → Drain-Source 연결',
                inputs: 2,
                outputs: 1,
                usage: 'Gate ON → 전류 흐름',
                truthTable: { headers: ['G', 'D→S'], rows: [['0', '차단'], ['1', '연결']] },
                animation: `<svg viewBox="0 0 70 70"><rect x="0" y="0" width="70" height="70" fill="#0a0c10"/><circle cx="35" cy="35" r="26" fill="#1a1e25" stroke="#64748b" stroke-width="1.5"/><line x1="28" y1="16" x2="28" y2="54" stroke="#64748b" stroke-width="3"/><line x1="5" y1="35" x2="28" y2="35" stroke="#ff4e42" stroke-width="2.5"/><circle cx="5" cy="35" r="3" fill="#ff4e42"/><text x="12" y="30" fill="#94a3b8" font-size="7" font-family="Inter">G</text><line x1="28" y1="24" x2="48" y2="10" stroke="#64748b" stroke-width="2"/><line x1="48" y1="10" x2="48" y2="3" stroke="#6b7280" stroke-width="2"/><text x="52" y="10" fill="#94a3b8" font-size="7" font-family="Inter">D</text><line x1="28" y1="46" x2="48" y2="60" stroke="#64748b" stroke-width="2"/><line x1="48" y1="60" x2="48" y2="67" stroke="#ff4e42" stroke-width="2"/><text x="52" y="63" fill="#94a3b8" font-size="7" font-family="Inter">S</text><polygon points="42,55 48,60 44,62" fill="#64748b"/></svg>`
            },
            'PMOS': {
                icon: '📌',
                name: 'PMOS 트랜지스터',
                description: 'Gate LOW → Drain-Source 연결',
                inputs: 2,
                outputs: 1,
                usage: 'Gate OFF → 전류 흐름',
                truthTable: { headers: ['G', 'D→S'], rows: [['0', '연결'], ['1', '차단']] },
                animation: `<svg viewBox="0 0 70 70"><rect x="0" y="0" width="70" height="70" fill="#0a0c10"/><circle cx="35" cy="35" r="26" fill="#1a1e25" stroke="#64748b" stroke-width="1.5"/><line x1="28" y1="16" x2="28" y2="54" stroke="#64748b" stroke-width="3"/><circle cx="24" cy="35" r="3" fill="#1a1e25" stroke="#64748b" stroke-width="1.5"/><line x1="5" y1="35" x2="21" y2="35" stroke="#6b7280" stroke-width="2.5"/><circle cx="5" cy="35" r="3" fill="#6b7280"/><text x="10" y="30" fill="#94a3b8" font-size="7" font-family="Inter">G</text><line x1="28" y1="24" x2="48" y2="10" stroke="#64748b" stroke-width="2"/><line x1="48" y1="10" x2="48" y2="3" stroke="#ff4e42" stroke-width="2"/><text x="52" y="10" fill="#94a3b8" font-size="7" font-family="Inter">D</text><line x1="28" y1="46" x2="48" y2="60" stroke="#64748b" stroke-width="2"/><line x1="48" y1="60" x2="48" y2="67" stroke="#ff4e42" stroke-width="2"/><text x="52" y="63" fill="#94a3b8" font-size="7" font-family="Inter">S</text></svg>`
            },
            'VCC': {
                icon: '⬆️',
                name: 'VCC (전원)',
                description: '항상 HIGH(1) 신호를 출력',
                inputs: 0,
                outputs: 1,
                usage: '전원 공급',
                truthTable: null,
                animation: `<svg viewBox="0 0 50 50"><rect x="0" y="0" width="50" height="50" fill="#0a0c10"/><polygon points="15,22 35,22 25,8" fill="#ff4e42"/><line x1="25" y1="22" x2="25" y2="42" stroke="#ff4e42" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="42" r="4" fill="#ff4e42"/><text x="25" y="48" text-anchor="middle" fill="#94a3b8" font-size="6" font-family="Inter">HIGH</text></svg>`
            },
            'GND': {
                icon: '⬇️',
                name: 'GND (접지)',
                description: '항상 LOW(0) 신호를 출력',
                inputs: 0,
                outputs: 1,
                usage: '접지',
                truthTable: null,
                animation: `<svg viewBox="0 0 50 50"><rect x="0" y="0" width="50" height="50" fill="#0a0c10"/><line x1="25" y1="8" x2="25" y2="20" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="8" r="4" fill="#6b7280"/><line x1="12" y1="20" x2="38" y2="20" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/><line x1="16" y1="26" x2="34" y2="26" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/><line x1="20" y1="32" x2="30" y2="32" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/><text x="25" y="44" text-anchor="middle" fill="#94a3b8" font-size="6" font-family="Inter">LOW</text></svg>`
            },
            'HALF_ADDER': {
                icon: '➕',
                name: 'Half Adder (반가산기)',
                description: '반가산기는 두 개의 1비트 이진수를 더하는 조합 논리 회로입니다. XOR 게이트로 합(Sum)을 계산하고, AND 게이트로 자리올림(Carry)을 계산합니다. 다만 이전 자리올림을 처리하지 못하므로 "반"가산기라 부릅니다.',
                inputs: 2,
                outputs: 2,
                usage: 'A XOR B = Sum, A AND B = Carry',
                truthTable: { headers: ['A', 'B', 'Sum', 'Carry'], rows: [['0', '0', '0', '0'], ['0', '1', '1', '0'], ['1', '0', '1', '0'], ['1', '1', '0', '1']] },
                animation: `<svg viewBox="0 0 180 80"><rect x="0" y="0" width="180" height="80" fill="#0a0c10"/>
                    <rect x="60" y="8" width="60" height="30" rx="4" fill="#16a085" stroke="#1abc9c" stroke-width="1.5"/>
                    <text x="90" y="28" text-anchor="middle" fill="white" font-size="12" font-family="Inter" font-weight="600">XOR</text>
                    <rect x="60" y="42" width="60" height="30" rx="4" fill="#16a085" stroke="#1abc9c" stroke-width="1.5"/>
                    <text x="90" y="62" text-anchor="middle" fill="white" font-size="12" font-family="Inter" font-weight="600">AND</text>
                    <line x1="10" y1="23" x2="60" y2="23" stroke="#ff4e42" stroke-width="2"/><text x="8" y="27" fill="#94a3b8" font-size="9">A</text>
                    <line x1="10" y1="57" x2="60" y2="57" stroke="#ff4e42" stroke-width="2"/><text x="8" y="61" fill="#94a3b8" font-size="9">B</text>
                    <line x1="120" y1="23" x2="170" y2="23" stroke="#10b981" stroke-width="2"/><text x="158" y="27" fill="#10b981" font-size="9">S</text>
                    <line x1="120" y1="57" x2="170" y2="57" stroke="#f59e0b" stroke-width="2"/><text x="158" y="61" fill="#f59e0b" font-size="9">C</text>
                </svg>`
            },
            'FULL_ADDER': {
                icon: '➕',
                name: 'Full Adder (전가산기)',
                description: '전가산기는 두 개의 1비트 이진수와 이전 자리올림(Carry In)을 더하는 조합 논리 회로입니다. 두 개의 반가산기를 연결하거나 XOR, AND, OR 게이트를 조합하여 구성합니다. n비트 가산기는 n개의 전가산기를 직렬 연결하여 만듭니다.',
                inputs: 3,
                outputs: 2,
                usage: 'S = A⊕B⊕Cin, Cout = (A·B) + (Cin·(A⊕B))',
                truthTable: {
                    headers: ['A', 'B', 'Cin', 'S', 'Cout'], rows: [
                        ['0', '0', '0', '0', '0'], ['0', '0', '1', '1', '0'], ['0', '1', '0', '1', '0'], ['0', '1', '1', '0', '1'],
                        ['1', '0', '0', '1', '0'], ['1', '0', '1', '0', '1'], ['1', '1', '0', '0', '1'], ['1', '1', '1', '1', '1']
                    ]
                },
                animation: `<svg viewBox="0 0 200 100"><rect x="0" y="0" width="200" height="100" fill="#0a0c10"/>
                    <rect x="45" y="10" width="45" height="25" rx="3" fill="#27ae60" stroke="#2ecc71" stroke-width="1"/>
                    <text x="67" y="27" text-anchor="middle" fill="white" font-size="10">XOR</text>
                    <rect x="100" y="10" width="45" height="25" rx="3" fill="#27ae60" stroke="#2ecc71" stroke-width="1"/>
                    <text x="122" y="27" text-anchor="middle" fill="white" font-size="10">XOR</text>
                    <rect x="45" y="45" width="45" height="25" rx="3" fill="#27ae60" stroke="#2ecc71" stroke-width="1"/>
                    <text x="67" y="62" text-anchor="middle" fill="white" font-size="10">AND</text>
                    <rect x="100" y="45" width="45" height="25" rx="3" fill="#27ae60" stroke="#2ecc71" stroke-width="1"/>
                    <text x="122" y="62" text-anchor="middle" fill="white" font-size="10">AND</text>
                    <rect x="155" y="45" width="35" height="25" rx="3" fill="#27ae60" stroke="#2ecc71" stroke-width="1"/>
                    <text x="172" y="62" text-anchor="middle" fill="white" font-size="10">OR</text>
                    <text x="8" y="20" fill="#94a3b8" font-size="9">A</text><text x="8" y="50" fill="#94a3b8" font-size="9">B</text><text x="8" y="80" fill="#94a3b8" font-size="9">Cin</text>
                    <text x="180" y="27" fill="#10b981" font-size="9">S</text><text x="180" y="90" fill="#f59e0b" font-size="9">Cout</text>
                </svg>`
            },
            'SR_LATCH': {
                icon: '',
                name: 'SR Latch (SR 래치)',
                description: 'SR 래치는 Set(S)과 Reset(R) 두 입력을 갖는 가장 기본적인 기억 소자입니다. 두 개의 크로스-커플 NOR(또는 NAND) 게이트로 구성됩니다. S=1이면 Q=1로 설정(Set), R=1이면 Q=0으로 리셋(Reset)됩니다. S=R=1은 금지 상태입니다.',
                inputs: 2,
                outputs: 2,
                usage: 'S=1→저장(Q=1), R=1→리셋(Q=0)',
                truthTable: {
                    headers: ['S', 'R', 'Q', 'Q̅', '상태'], rows: [
                        ['0', '0', 'Q', 'Q̅', '유지'],
                        ['0', '1', '0', '1', '리셋'],
                        ['1', '0', '1', '0', '세트'],
                        ['1', '1', '?', '?', '금지']
                    ]
                },
                animation: `<svg viewBox="0 0 160 90"><rect x="0" y="0" width="160" height="90" fill="#0a0c10"/>
                    <rect x="50" y="10" width="50" height="28" rx="4" fill="#2980b9" stroke="#3498db" stroke-width="1.5"/>
                    <text x="75" y="29" text-anchor="middle" fill="white" font-size="11">NOR</text>
                    <rect x="50" y="52" width="50" height="28" rx="4" fill="#2980b9" stroke="#3498db" stroke-width="1.5"/>
                    <text x="75" y="71" text-anchor="middle" fill="white" font-size="11">NOR</text>
                    <text x="8" y="28" fill="#ff4e42" font-size="10">S</text><text x="8" y="70" fill="#ff4e42" font-size="10">R</text>
                    <text x="145" y="28" fill="#10b981" font-size="10">Q</text><text x="145" y="70" fill="#6b7280" font-size="10">Q̅</text>
                    <path d="M100,24 L125,24 L125,66 L100,66" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="3"/>
                    <path d="M100,66 L115,66 L115,24 L100,24" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="3"/>
                    <text x="120" y="50" fill="#8b5cf6" font-size="7">피드백</text>
                </svg>`
            },
            'D_FLIPFLOP': {
                icon: '',
                name: 'D Flip-Flop (D 플립플롭)',
                description: 'D 플립플롭은 클럭 신호의 상승 에지(↑)에서 D 입력값을 Q 출력으로 전달하는 에지 트리거 기억 소자입니다. "데이터 래치"라고도 불리며, 레지스터, 카운터 등 순차 회로의 기본 구성 요소입니다.',
                inputs: 2,
                outputs: 2,
                usage: 'CLK↑일 때 D값을 Q로 저장',
                truthTable: {
                    headers: ['CLK', 'D', 'Q(다음)'], rows: [
                        ['↑', '0', '0'],
                        ['↑', '1', '1'],
                        ['0/1', 'X', 'Q(유지)']
                    ]
                },
                animation: `<svg viewBox="0 0 120 80"><rect x="0" y="0" width="120" height="80" fill="#0a0c10"/>
                    <rect x="30" y="10" width="60" height="60" rx="5" fill="#8e44ad" stroke="#9b59b6" stroke-width="1.5"/>
                    <text x="60" y="35" text-anchor="middle" fill="white" font-size="12" font-weight="600">D-FF</text>
                    <text x="60" y="55" text-anchor="middle" fill="#d8b4fe" font-size="8">Edge Trigger</text>
                    <text x="8" y="28" fill="#ff4e42" font-size="9">D</text>
                    <text x="8" y="58" fill="#8b5cf6" font-size="9">CLK</text>
                    <polygon points="30,52 38,58 30,64" fill="#8b5cf6"/>
                    <text x="102" y="28" fill="#10b981" font-size="9">Q</text>
                    <text x="102" y="58" fill="#6b7280" font-size="9">Q̅</text>
                </svg>`
            }
        };

        return componentData[type] || {
            icon: '',
            name: type,
            description: '사용자 정의 컴포넌트입니다.',
            inputs: '?',
            outputs: '?',
            usage: '',
            animation: '',
            truthTable: null
        };
    },

    updateComponentInfoPanel(el) {
        const type = el.getAttribute('data-type');
        this.showTooltip(type);
    },

    hideComponentInfoPanel() {
        const panel = document.getElementById('component-info-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    },

    // ===================================
    // 3. Manipulation (Delete, Copy, Paste, Duplicate)
    // ===================================
    deleteSelected() {
        if (this.selectedComponents.length === 0) return;
        this.selectedComponents.forEach(el => this.deleteComponent(el));
        this.selectedComponents = [];
        this.hideContextMenu();
        this.saveState();
        this.showToast('삭제됨', 'info');
    },

    deleteComponent(elOrId) {
        // ID 문자열인 경우 DOM 요소로 변환
        let el = elOrId;
        if (typeof elOrId === 'string') {
            el = document.getElementById(elOrId);
            if (!el) {
                console.warn('deleteComponent: Element not found for ID:', elOrId);
                return;
            }
        }

        // 유효한 DOM 요소인지 확인
        if (!el || !el.parentNode) {
            console.warn('deleteComponent: Invalid element or already removed');
            return;
        }

        // [Module Mode Support] 포트 컴포넌트 삭제 시 메타데이터 동기화
        if (this.currentTab && this.currentTab.startsWith('module_')) {
            const type = el.getAttribute('data-type');
            if (type === 'PORT_IN' || type === 'PORT_OUT') {
                const label = el.querySelector('.comp-label')?.textContent;
                if (label) {
                    if (type === 'PORT_IN') {
                        this.modulePorts.inputs = this.modulePorts.inputs.filter(n => n !== label);
                    } else {
                        this.modulePorts.outputs = this.modulePorts.outputs.filter(n => n !== label);
                    }
                    // UI 및 통계 업데이트
                    if (this.updateModuleIOPanel) this.updateModuleIOPanel();
                    if (this.updateModuleStats) this.updateModuleStats();
                }
            }

            // moduleComponents 배열에서도 제거
            this.moduleComponents = this.moduleComponents.filter(c => c !== el);

            // 탭 상태 즉시 동기화 (깊은 복사로 인해 필요)
            if (this.saveCurrentModuleTabState) {
                this.saveCurrentModuleTabState();
            }
        }

        // 관련된 전선 제거
        const wiresToRemove = this.wires.filter(wire =>
            el.contains(wire.from) || el.contains(wire.to)
        );
        wiresToRemove.forEach(wire => this.removeWire(wire));

        // [드래그 상태 정리] 삭제되는 컴포넌트가 드래그 중이면 정리
        if (this.dragTarget === el) {
            this.dragTarget = null;
            this.resetDragState?.();
        }

        // [선택 상태 정리] 선택된 컴포넌트 배열에서도 제거
        this.selectedComponents = this.selectedComponents.filter(c => c !== el);

        // DOM에서 제거
        el.parentNode.removeChild(el);

        // 배열에서 제거
        this.components = this.components.filter(c => c !== el);

        // 상태 표시줄 업데이트
        if (this.updateStatusBar) this.updateStatusBar();

        this.hideTooltip();
    },

    copySelection() {
        if (this.selectedComponents.length === 0) {
            this.showToast('복사할 컴포넌트를 선택하세요', 'warning');
            return;
        }

        this.clipboard = this.selectedComponents.map(comp => ({
            type: comp.getAttribute('data-type'),
            x: parseFloat(comp.style.left) || 0,
            y: parseFloat(comp.style.top) || 0,
            color: comp.getAttribute('data-color'),
            rotation: comp.getAttribute('data-rotation')
        }));

        this.hideContextMenu();
        this.showToast(`${this.clipboard.length}개 복사됨`, 'success');
    },

    pasteFromClipboard() {
        if (!this.clipboard || this.clipboard.length === 0) {
            this.showToast('붙여넣을 내용이 없습니다', 'warning');
            return;
        }

        const offset = 40;
        const newComponents = [];

        this.clearSelection(); // 기존 선택 해제

        this.clipboard.forEach(item => {
            // [Module Mode Bug Fix] 모듈 편집 시 포트 붙여넣기(복제) 방지
            if (this.currentTab && this.currentTab.startsWith('module_')) {
                if (item.type === 'PORT_IN' || item.type === 'PORT_OUT') return;
            }

            const newComp = this.addModule(item.type, item.x + offset, item.y + offset);
            if (newComp) {
                if (item.color) newComp.setAttribute('data-color', item.color);
                if (item.rotation) {
                    newComp.setAttribute('data-rotation', item.rotation);
                    newComp.style.transform = `rotate(${item.rotation}deg)`;
                }
                newComponents.push(newComp);
                this.selectComponent(newComp, true); // 새 항목 선택
            }
        });

        this.hideContextMenu();
        this.saveState();
        this.showToast(`${newComponents.length}개 붙여넣기됨`, 'success');
    },

    duplicateSelection() {
        if (this.selectedComponents.length === 0) {
            this.showToast('복제할 컴포넌트를 선택하세요', 'warning');
            return;
        }

        const newComponents = [];
        const offset = 30;

        // 현재 선택된 것들을 백업
        const targets = [...this.selectedComponents];
        this.clearSelection();

        targets.forEach(comp => {
            const type = comp.getAttribute('data-type');

            // [Module Mode Bug Fix] 모듈 편집 시 포트 복제 방지
            // 사용자가 "OUT 포트가 복사되는 버그"라고 지칭한 현상 수정
            if (this.currentTab && this.currentTab.startsWith('module_')) {
                if (type === 'PORT_IN' || type === 'PORT_OUT') return;
            }

            const x = (parseFloat(comp.style.left) || 0) + offset;
            const y = (parseFloat(comp.style.top) || 0) + offset;

            const newComp = this.addModule(type, x, y);
            if (newComp) {
                const color = comp.getAttribute('data-color');
                if (color) newComp.setAttribute('data-color', color);

                const rotation = comp.getAttribute('data-rotation');
                if (rotation) {
                    newComp.setAttribute('data-rotation', rotation);
                    newComp.style.transform = `rotate(${rotation}deg)`;
                }

                newComponents.push(newComp);
                this.selectComponent(newComp, true);
            }
        });

        this.hideContextMenu();
        this.saveState();
        this.showToast(`${newComponents.length}개 복제됨`, 'success');
    },

    // ===================================
    // 4. Alignment & Transform
    // ===================================
    alignSelectedHorizontal() {
        if (this.selectedComponents.length < 2) {
            this.showToast('2개 이상 선택하세요', 'warning');
            return;
        }
        const avgY = this.selectedComponents.reduce((sum, c) =>
            sum + parseFloat(c.style.top), 0) / this.selectedComponents.length;
        this.selectedComponents.forEach(c => {
            c.style.top = avgY + 'px';
        });
        this.redrawWires();
        this.saveState();
    },

    alignSelectedVertical() {
        if (this.selectedComponents.length < 2) {
            this.showToast('2개 이상 선택하세요', 'warning');
            return;
        }
        const avgX = this.selectedComponents.reduce((sum, c) =>
            sum + parseFloat(c.style.left), 0) / this.selectedComponents.length;
        this.selectedComponents.forEach(c => {
            c.style.left = avgX + 'px';
        });
        this.redrawWires();
        this.saveState();
    },

    distributeHorizontal() {
        if (this.selectedComponents.length < 3) return;

        const sorted = [...this.selectedComponents].sort((a, b) =>
            parseFloat(a.style.left) - parseFloat(b.style.left)
        );
        const minX = parseFloat(sorted[0].style.left);
        const maxX = parseFloat(sorted[sorted.length - 1].style.left);
        const spacing = (maxX - minX) / (sorted.length - 1);

        sorted.forEach((comp, i) => {
            comp.style.left = (minX + i * spacing) + 'px';
        });
        this.redrawWires();
        this.saveState();
    },

    distributeVertical() {
        if (this.selectedComponents.length < 3) return;

        const sorted = [...this.selectedComponents].sort((a, b) =>
            parseFloat(a.style.top) - parseFloat(b.style.top)
        );
        const minY = parseFloat(sorted[0].style.top);
        const maxY = parseFloat(sorted[sorted.length - 1].style.top);
        const spacing = (maxY - minY) / (sorted.length - 1);

        sorted.forEach((comp, i) => {
            comp.style.top = (minY + i * spacing) + 'px';
        });
        this.redrawWires();
        this.saveState();
    },

    rotateSelected() {
        this.selectedComponents.forEach(comp => {
            const currentRotation = parseInt(comp.getAttribute('data-rotation') || '0');
            const newRotation = (currentRotation + 90) % 360;
            comp.setAttribute('data-rotation', newRotation);
            comp.style.transform = `rotate(${newRotation}deg)`;

            // 라벨 역회전 (항상 정방향 유지)
            const label = comp.querySelector('.comp-label');
            if (label) {
                // 원래의 translateX(-50%)를 유지하면서 역회전 적용
                label.style.transform = `translateX(-50%) rotate(${-newRotation}deg)`;
            }
        });
        this.redrawWires();
        this.saveState();
    },

    flipHorizontal() {
        if (this.selectedComponents.length < 2) return;
        let minX = Infinity, maxX = -Infinity;
        this.selectedComponents.forEach(comp => {
            const x = parseFloat(comp.style.left);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
        });
        const centerX = (minX + maxX) / 2;
        this.selectedComponents.forEach(comp => {
            const x = parseFloat(comp.style.left);
            comp.style.left = (2 * centerX - x) + 'px';
        });
        this.redrawWires();
        this.saveState();
    },

    flipVertical() {
        if (this.selectedComponents.length < 2) return;
        let minY = Infinity, maxY = -Infinity;
        this.selectedComponents.forEach(comp => {
            const y = parseFloat(comp.style.top);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });
        const centerY = (minY + maxY) / 2;
        this.selectedComponents.forEach(comp => {
            const y = parseFloat(comp.style.top);
            comp.style.top = (2 * centerY - y) + 'px';
        });
        this.redrawWires();
        this.saveState();
    },

    lockSelection() {
        this.selectedComponents.forEach(comp => {
            comp.classList.toggle('locked');
        });
        this.showToast('선택 항목 잠금 토글', 'info');
    },

    setLEDColor(color) {
        const validColors = ['red', 'green', 'blue', 'yellow', 'white'];
        if (!validColors.includes(color)) return;
        this.selectedComponents.forEach(comp => {
            if (comp.getAttribute('data-type') === 'LED') {
                comp.setAttribute('data-color', color);
                this.showToast(`LED 색상: ${color}`, 'info');
            }
        });
        this.saveState();
        this.hideContextMenu();
    },

    // Alias for compatibility with HTML inline calls
    alignHorizontal() {
        this.alignSelectedHorizontal();
    },

    alignVertical() {
        this.alignSelectedVertical();
    }
});
