/**
 * 모듈: 탭 시스템 및 모듈 편집기 (TabManager)
 * - 메인 회로와 모듈 편집기 간 전환
 * - 팝업 없이 내부 탭으로 모듈 편집
 * - 다중 모듈 탭 지원
 */
Object.assign(CircuitSimulator.prototype, {
    // 현재 활성화된 탭 (main 또는 module_{id})
    currentTab: 'main',

    // 모듈 편집 상태 (현재 활성 탭)
    editingModule: null,
    moduleComponents: [],
    moduleWires: [],
    modulePorts: { inputs: [], outputs: [] },

    // 다중 모듈 탭 지원
    moduleTabs: {},  // { tabId: { module, components, wires, ports, tabElement } }
    moduleTabCounter: 0,

    /**
     * 탭 초기화
     */
    initTabs() {
        this.moduleWorkspace = document.getElementById('module-workspace');
        this.moduleCanvas = document.getElementById('module-canvas');
        this.moduleWireLayer = document.getElementById('module-wire-layer');
        this.moduleTab = document.getElementById('module-tab');
        this.moduleTabTitle = document.getElementById('module-tab-title');
        this.editingModuleName = document.getElementById('editing-module-name');
        this.tabBar = document.getElementById('workspace-tabs');
    },

    /**
     * 탭 전환
     */
    switchTab(tabName) {
        // 이미 해당 탭이면 무시
        if (this.currentTab === tabName) return;

        // 탭 전환 시 선택 초기화
        if (this.clearSelection) this.clearSelection();

        const prevTab = this.currentTab;
        this.currentTab = tabName;

        // 모든 탭 비활성화
        document.querySelectorAll('.workspace-tabs .tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // 모든 워크스페이스 숨김
        document.querySelectorAll('.workspace-content').forEach(ws => {
            ws.classList.remove('active');
            ws.style.display = 'none';
        });

        // 선택된 탭 활성화
        const selectedTab = document.querySelector(`.workspace-tabs .tab[data-tab="${tabName}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // 사이드바 참조
        const sidebar = document.querySelector('.sidebar');
        const workspaceWrapper = document.querySelector('.workspace-wrapper');

        // 해당 워크스페이스 표시
        if (tabName === 'main') {
            const mainWs = document.getElementById('workspace');
            if (mainWs) {
                mainWs.classList.add('active');
                mainWs.style.display = 'block';
            }
            // 메인 워크스페이스 및 와이어 레이어 복원
            this.workspace = mainWs;
            this.wireLayer = document.getElementById('wire-layer');

            // 메인 상태 복원
            if (this._savedMainWires) {
                this.wires = this._savedMainWires;
            }
            if (this._savedMainComponents) {
                this.components = this._savedMainComponents;
            }

            // [토큰 방식] 대기 중인 패키지 갱신 처리
            if (this._pendingRefreshPackages && this._pendingRefreshPackages.size > 0) {
                this._pendingRefreshPackages.forEach(pkgId => {
                    this.refreshPackageInstances(pkgId);
                });
                this._pendingRefreshPackages.clear();
            }

            // 사이드바 표시
            if (sidebar) {
                sidebar.style.display = '';
                sidebar.style.transform = '';
            }
            if (workspaceWrapper) {
                workspaceWrapper.style.marginLeft = '';
            }
        } else if (tabName === 'module') {
            // 메인에서 모듈로 전환 시 메인 상태 백업
            if (prevTab === 'main' && !this._savedMainWires) {
                this._savedMainWires = this.wires || [];
                this._savedMainComponents = this.components || [];
                this.wires = this.moduleWires || [];
                this.components = this.moduleComponents || []; // this.components도 모듈 컴포넌트로 전환
            }

            const moduleWs = document.getElementById('module-workspace');
            if (moduleWs) {
                moduleWs.classList.add('active');
                moduleWs.style.display = 'flex';
            }
            // 모듈 편집 워크스페이스로 전환
            this.workspace = this.moduleCanvas;
            this.wireLayer = this.moduleWireLayer;

            // 사이드바 숨기기 (모듈 편집 시)
            if (sidebar) {
                sidebar.style.display = 'none';
            }
            if (workspaceWrapper) {
                workspaceWrapper.style.marginLeft = '0';
            }
        }

        this.updateTransform();
    },

    /**
     * 모듈 편집 탭 열기 (다중 탭 지원)
     */
    openModuleEditor(moduleComp) {
        if (!moduleComp) return;

        const moduleType = moduleComp.getAttribute('data-type');

        // 탭 식별용 ID 생성 (인스턴스가 달라도 같은 모듈이면 같은 탭 공유)
        let moduleId;
        if (moduleType === 'PACKAGE') {
            const pkgId = moduleComp.getAttribute('data-package-id');
            moduleId = 'package_' + pkgId;
        } else {
            moduleId = 'builtin_' + moduleType;
        }

        // 사용자 모듈인 경우 실제 패키지 이름 가져오기
        let moduleName;
        if (moduleType === 'PACKAGE') {
            const pkgId = moduleComp.getAttribute('data-package-id');
            const pkg = this.userPackages && this.userPackages[parseInt(pkgId)];
            moduleName = pkg?.name || moduleComp.querySelector('.comp-label')?.textContent || '사용자 모듈';
        } else {
            moduleName = this.getModuleDisplayName(moduleType) || moduleComp.querySelector('.comp-label')?.textContent || '모듈';
        }

        // 기본 모듈인지 확인 (읽기 전용)
        const builtInModules = ['HALF_ADDER', 'FULL_ADDER', 'SR_LATCH', 'D_FLIPFLOP'];
        const isBuiltIn = builtInModules.includes(moduleType);

        // 이미 열려있는 탭인지 확인
        const existingTabId = Object.keys(this.moduleTabs).find(tabId =>
            this.moduleTabs[tabId].moduleId === moduleId
        );

        if (existingTabId) {
            // 이미 열려있으면 해당 탭으로 전환
            this.switchToModuleTab(existingTabId);
            this.showToast(`${moduleName} 탭으로 전환합니다`, 'info');
            return;
        }

        // 새 탭 생성
        this.moduleTabCounter++;
        const tabId = `module_${this.moduleTabCounter}`;

        // 현재 메인 상태 백업 (최초 전환 시에만)
        if (this.currentTab === 'main' && !this._savedMainWires) {
            this._savedMainWires = this.wires || [];
            this._savedMainComponents = this.components || [];
        }

        // 현재 모듈 탭 상태 저장 (다른 모듈 탭에서 전환하는 경우)
        if (this.currentTab.startsWith('module_')) {
            this.saveCurrentModuleTabState();
        }

        // 새 탭 요소 생성 및 추가 (기본 모듈은 🔒 아이콘 추가)
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        if (isBuiltIn) tabElement.classList.add('readonly');
        tabElement.setAttribute('data-tab', tabId);
        tabElement.innerHTML = `
            <span class="tab-icon">[M]</span>
            <span class="tab-title">${moduleName}${isBuiltIn ? ' (읽기 전용)' : ''}</span>
            <button class="tab-close" onclick="event.stopPropagation(); sim.closeModuleTabById('${tabId}')">×</button>
        `;
        tabElement.onclick = () => this.switchToModuleTab(tabId);

        // 기존 모듈 탭 숨기고 새 탭 추가
        if (this.moduleTab) {
            this.moduleTab.style.display = 'none';
        }
        this.tabBar.appendChild(tabElement);

        // 탭 상태 저장
        this.moduleTabs[tabId] = {
            moduleId: moduleId,
            moduleComp: moduleComp,
            moduleName: moduleName,
            moduleType: moduleType,
            components: [],
            wires: [],
            ports: { inputs: [], outputs: [] },
            tabElement: tabElement,
            isBuiltIn: isBuiltIn  // 읽기 전용 플래그
        };

        // 새 모듈 상태로 초기화
        this.editingModule = moduleComp;
        this.moduleComponents = [];
        this.moduleWires = [];
        this.wires = [];
        this.modulePorts = { inputs: [], outputs: [] };
        this.currentModuleTabId = tabId;
        this.isModuleReadOnly = isBuiltIn;  // 읽기 전용 상태 설정

        // 이름 필드 업데이트 (읽기 전용이면 비활성화)
        if (this.editingModuleName) {
            this.editingModuleName.value = moduleName;
            this.editingModuleName.readOnly = isBuiltIn;
            this.editingModuleName.style.opacity = isBuiltIn ? '0.7' : '1';
        }

        // 모듈 내부 구조 로드
        this.loadModuleInternals(moduleComp);

        // 로드된 컴포넌트/와이어를 탭 상태에 동기화 (깊은 복사로 참조 분리)
        this.moduleTabs[tabId].components = [...this.moduleComponents];
        this.moduleTabs[tabId].wires = [...this.moduleWires];
        this.moduleTabs[tabId].ports = {
            inputs: [...this.modulePorts.inputs],
            outputs: [...this.modulePorts.outputs]
        };
        this.wires = this.moduleWires;  // 와이어 참조 설정

        // 읽기 전용 모드일 때 컴포넌트 비활성화
        if (isBuiltIn) {
            this.setModuleReadOnly(true);
        }

        // 모듈 탭으로 전환
        this.switchToModuleTab(tabId);

        // 기본 모듈인 경우 탭 전환 후 중앙 정렬 (캔버스가 표시된 후 정확한 크기로 계산)
        if (isBuiltIn) {
            setTimeout(() => this.centerModuleComponents(), 50);
        }

        if (isBuiltIn) {
            this.showToast(`[Locked] ${moduleName} - 기본 모듈은 읽기 전용입니다. 구조를 참고하여 직접 모듈을 만들어보세요!`, 'info');
        } else {
            this.showToast(`${moduleName} 모듈을 편집합니다`, 'info');
        }
    },

    /**
     * 모듈 읽기 전용 모드 설정/해제
     */
    setModuleReadOnly(readOnly) {
        this.isModuleReadOnly = readOnly;

        // 모듈 캔버스의 모든 컴포넌트 비활성화/활성화
        if (this.moduleCanvas) {
            const components = this.moduleCanvas.querySelectorAll('.component');
            components.forEach(comp => {
                comp.style.pointerEvents = readOnly ? 'none' : 'auto';
                comp.style.opacity = readOnly ? '0.9' : '1';
            });
        }

        // 편집 버튼들 숨기기/보이기
        const saveBtn = document.querySelector('.btn-module-action.save');
        const changesBtn = document.querySelector('.btn-module-action:not(.save):not(.secondary)');
        if (saveBtn) saveBtn.style.display = readOnly ? 'none' : '';
        if (changesBtn) changesBtn.style.display = readOnly ? 'none' : '';

        // 팔레트 버튼 비활성화
        const paletteButtons = document.querySelectorAll('.module-palette .palette-btn');
        paletteButtons.forEach(btn => {
            btn.disabled = readOnly;
            btn.style.opacity = readOnly ? '0.5' : '1';
            btn.style.pointerEvents = readOnly ? 'none' : 'auto';
        });

        // I/O 패널 입력 비활성화
        const ioInputs = document.querySelectorAll('.module-io-panel input');
        ioInputs.forEach(input => {
            input.readOnly = readOnly;
            input.style.opacity = readOnly ? '0.7' : '1';
        });

        // 알림 배너 표시
        this.showReadOnlyBanner(readOnly);
    },

    /**
     * 읽기 전용 알림 배너 표시
     */
    showReadOnlyBanner(show) {
        let banner = document.getElementById('readonly-module-banner');

        if (show) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'readonly-module-banner';
                banner.style.cssText = `
                    position: relative;
                    background: linear-gradient(90deg, rgba(251, 191, 36, 0.95), rgba(245, 158, 11, 0.95));
                    color: #1a1a2e;
                    padding: 10px 16px;
                    text-align: center;
                    font-size: 13px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    flex-shrink: 0;
                `;
                banner.innerHTML = `
                    <span>🔒</span>
                    <span>기본 모듈 내부 구조입니다. 수정할 수 없지만 참고하여 새 모듈을 만들 수 있습니다.</span>
                    <button onclick="sim.startNewModule()" style="
                        background: rgba(0,0,0,0.2);
                        border: none;
                        color: inherit;
                        padding: 6px 14px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: 600;
                    ">새 모듈 만들기</button>
                `;
                // module-editor-header 앞에 삽입 (배너가 제목 위에 표시)
                const editorHeader = document.querySelector('.module-editor-header');
                if (editorHeader && editorHeader.parentElement) {
                    editorHeader.parentElement.insertBefore(banner, editorHeader);
                }
            }
        } else {
            if (banner) banner.remove();
        }
    },

    /**
     * 특정 모듈 탭으로 전환
     */
    switchToModuleTab(tabId) {
        const tabState = this.moduleTabs[tabId];
        if (!tabState) return;

        // 탭 전환 시 선택 초기화
        if (this.clearSelection) this.clearSelection();

        // 현재 탭 상태 저장
        if (this.currentTab.startsWith('module_') && this.currentTab !== tabId) {
            this.saveCurrentModuleTabState();
        }

        // 메인에서 모듈로 처음 전환 시 scale/pan 백업
        if (this.currentTab === 'main' || !this.currentTab.startsWith('module_')) {
            this._savedMainScale = this.scale;
            this._savedMainPanX = this.panX;
            this._savedMainPanY = this.panY;
        }

        // 모듈 편집기는 scale 1, pan 0으로 고정
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;

        // 모든 탭 비활성화
        document.querySelectorAll('.workspace-tabs .tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // 선택된 탭 활성화
        tabState.tabElement.classList.add('active');

        // 탭 상태 복원 (깊은 복사로 참조 분리)
        this.editingModule = tabState.moduleComp;
        this.moduleComponents = [...tabState.components];
        this.moduleWires = [...tabState.wires];
        this.modulePorts = {
            inputs: [...tabState.ports.inputs],
            outputs: [...tabState.ports.outputs]
        };
        this.wires = this.moduleWires;
        this.components = this.moduleComponents; // this.components도 해당 모듈의 컴포넌트로 전환
        this.currentModuleTabId = tabId;
        this.currentTab = tabId;
        this.isModuleReadOnly = tabState.isBuiltIn || false;  // 읽기 전용 상태 복원

        // 모듈 캔버스 정리 및 컴포넌트 복원
        if (this.moduleCanvas) {
            const existingComps = this.moduleCanvas.querySelectorAll('.component');
            existingComps.forEach(c => c.remove());

            // 저장된 컴포넌트 다시 추가
            tabState.components.forEach(comp => {
                this.moduleCanvas.appendChild(comp);
            });
        }

        // 와이어 다시 그리기
        this.redrawWires();

        // I/O 패널 및 통계 업데이트
        this.updateModuleIOPanel();
        this.updateModuleStats();

        // 워크스페이스 표시
        this.showModuleWorkspace();

        // 읽기 전용 모드 설정
        this.setModuleReadOnly(tabState.isBuiltIn || false);

        // 버튼 표시 제어: 새 모듈 vs 기존 모듈
        this.updateModuleEditorButtons(tabState);

        // 이름 필드 업데이트
        const nameInput = document.getElementById('editing-module-name');
        if (nameInput) {
            nameInput.value = tabState.moduleName || '새 모듈';
            nameInput.readOnly = tabState.isBuiltIn || false;
        }
    },

    /**
     * 모듈 편집기 버튼 표시 제어
     */
    updateModuleEditorButtons(tabState) {
        const btnSaveAsNew = document.getElementById('btn-save-as-new');
        const btnSaveChanges = document.getElementById('btn-save-changes');

        if (!btnSaveAsNew || !btnSaveChanges) return;

        // 읽기 전용이면 둘 다 숨김
        if (tabState.isBuiltIn) {
            btnSaveAsNew.style.display = 'none';
            btnSaveChanges.style.display = 'none';
            return;
        }

        // 새 모듈이면 "모듈로 저장" 표시
        // 기존 모듈이면 "변경사항 저장" 표시
        if (tabState.moduleType === 'NEW' || !tabState.moduleComp) {
            btnSaveAsNew.style.display = '';
            btnSaveChanges.style.display = 'none';
        } else {
            btnSaveAsNew.style.display = 'none';
            btnSaveChanges.style.display = '';
        }
    },

    /**
     * 현재 모듈 탭 상태 저장
     */
    saveCurrentModuleTabState() {
        if (!this.currentModuleTabId || !this.moduleTabs[this.currentModuleTabId]) return;

        const tabState = this.moduleTabs[this.currentModuleTabId];
        tabState.components = [...this.moduleComponents];
        tabState.wires = [...this.moduleWires];
        // 깊은 복사로 배열 참조 분리 (얕은 복사 버그 수정)
        tabState.ports = {
            inputs: [...this.modulePorts.inputs],
            outputs: [...this.modulePorts.outputs]
        };
    },

    /**
     * 모듈 워크스페이스 표시
     */
    showModuleWorkspace() {
        // 모든 워크스페이스 숨김
        document.querySelectorAll('.workspace-content').forEach(ws => {
            ws.classList.remove('active');
            ws.style.display = 'none';
        });

        // 모듈 워크스페이스 표시
        const moduleWs = document.getElementById('module-workspace');
        if (moduleWs) {
            moduleWs.classList.add('active');
            moduleWs.style.display = 'flex';
        }

        // 워크스페이스 참조 업데이트
        this.workspace = this.moduleCanvas;
        this.wireLayer = this.moduleWireLayer;

        // 사이드바 숨기기
        const sidebar = document.querySelector('.sidebar');
        const workspaceWrapper = document.querySelector('.workspace-wrapper');
        if (sidebar) sidebar.style.display = 'none';
        if (workspaceWrapper) workspaceWrapper.style.marginLeft = '0';

        // 모듈 편집 모드에서 미니맵 숨기기
        const minimap = document.getElementById('minimap');
        if (minimap) minimap.style.display = 'none';

        this.updateTransform();
    },

    /**
     * 특정 ID의 모듈 탭 닫기
     */
    closeModuleTabById(tabId) {
        const tabState = this.moduleTabs[tabId];
        if (!tabState) return;

        // 탭 요소 제거
        tabState.tabElement.remove();

        // 탭 상태 삭제
        delete this.moduleTabs[tabId];

        // 닫힌 탭이 현재 탭이면 다른 탭으로 전환
        if (this.currentModuleTabId === tabId) {
            const remainingTabs = Object.keys(this.moduleTabs);
            if (remainingTabs.length > 0) {
                this.switchToModuleTab(remainingTabs[remainingTabs.length - 1]);
            } else {
                // 모든 모듈 탭이 닫히면 메인으로 전환
                this.currentModuleTabId = null;
                this.restoreMainState();
            }
        }
    },

    /**
     * 메인 상태 복원
     */
    restoreMainState() {
        // 메인 상태 복원
        if (this._savedMainWires) {
            this.wires = this._savedMainWires;
            this._savedMainWires = null;
        }
        if (this._savedMainComponents) {
            this.components = this._savedMainComponents;
            this._savedMainComponents = null;
        }

        // 저장된 scale/pan 복원
        if (this._savedMainScale !== undefined) {
            this.scale = this._savedMainScale;
            this._savedMainScale = undefined;
        }
        if (this._savedMainPanX !== undefined) {
            this.panX = this._savedMainPanX;
            this._savedMainPanX = undefined;
        }
        if (this._savedMainPanY !== undefined) {
            this.panY = this._savedMainPanY;
            this._savedMainPanY = undefined;
        }

        this.editingModule = null;
        this.moduleComponents = [];
        this.moduleWires = [];

        // 모듈 캔버스 정리
        if (this.moduleCanvas) {
            const existingComps = this.moduleCanvas.querySelectorAll('.component');
            existingComps.forEach(c => c.remove());
        }
        if (this.moduleWireLayer) {
            this.moduleWireLayer.innerHTML = '';
        }

        this.switchTab('main');

        // 미니맵 다시 표시
        const minimap = document.getElementById('minimap');
        if (minimap) minimap.style.display = '';

        // 읽기 전용 배너 제거
        this.showReadOnlyBanner(false);

        // transform 업데이트
        this.updateTransform();
    },

    /**
     * 모듈 표시 이름 가져오기
     */
    getModuleDisplayName(type) {
        const names = {
            'HALF_ADDER': 'Half Adder (반가산기)',
            'FULL_ADDER': 'Full Adder (전가산기)',
            'SR_LATCH': 'SR Latch (SR 래치)',
            'D_FLIPFLOP': 'D Flip-Flop (D 플립플롭)',
            'PACKAGE': '사용자 모듈'
        };
        return names[type] || type;
    },

    /**
     * 모듈 내부 구조 로드
     */
    loadModuleInternals(moduleComp) {
        const moduleType = moduleComp.getAttribute('data-type');

        // ========== 강력한 초기화: 기존 상태 완전 정리 ==========
        // 1. 배열에 있는 컴포넌트들을 DOM에서 제거
        if (this.moduleComponents && this.moduleComponents.length > 0) {
            this.moduleComponents.forEach(c => {
                if (c && c.parentNode) c.parentNode.removeChild(c);
            });
        }
        this.moduleComponents = [];
        this.moduleWires = [];
        this.modulePorts = { inputs: [], outputs: [] };

        // 2. DOM에 혹시 남아있는 잔여 요소도 강제 제거
        if (this.moduleCanvas) {
            const existingComps = this.moduleCanvas.querySelectorAll('.component');
            existingComps.forEach(c => c.remove());
        }
        if (this.moduleWireLayer) {
            this.moduleWireLayer.innerHTML = '';
        }
        // ========== 초기화 완료 ==========

        // 모듈 정의 가져오기 (기본 모듈 또는 사용자 패키지)
        let pkgDef;
        if (moduleType === 'PACKAGE') {
            // 사용자 패키지인 경우 userPackages에서 가져오기
            const pkgId = moduleComp.getAttribute('data-package-id');
            pkgDef = this.userPackages && this.userPackages[parseInt(pkgId)];
        } else {
            pkgDef = this.getPackageDefinition(moduleType);
        }

        if (!pkgDef || !pkgDef.circuit) {
            // 회로 정의가 없으면 빈 상태로 시작
            this.moduleComponents = [];
            this.moduleWires = [];
            this.modulePorts = {
                inputs: pkgDef?.inputs || ['A', 'B'],
                outputs: pkgDef?.outputs || ['Y']
            };
            this.updateModuleIOPanel();
            return;
        }

        // 내부 회로 렌더링
        const circuit = pkgDef.circuit;
        this.moduleComponents = [];
        this.moduleWires = [];

        // 컴포넌트 위치를 캔버스 중앙으로 조정하기 위해 오프셋 계산
        let minX = Infinity, maxX = 0, minY = Infinity, maxY = 0;
        circuit.components.forEach(comp => {
            minX = Math.min(minX, comp.x || 0);
            maxX = Math.max(maxX, (comp.x || 0) + 80);
            minY = Math.min(minY, comp.y || 0);
            maxY = Math.max(maxY, (comp.y || 0) + 50);
        });
        const circuitWidth = maxX - minX;
        const circuitHeight = maxY - minY;

        // 캔버스 크기 (표시되기 전에는 clientWidth가 0일 수 있으므로 최소값 설정)
        // 모듈 캔버스는 팔레트(160px) 제외한 영역, 대략 600~800px 너비
        // clientWidth가 작으면 기본값 800 사용 (팔레트 포함된 전체)
        const rawCanvasWidth = this.moduleCanvas?.clientWidth || 0;
        const rawCanvasHeight = this.moduleCanvas?.clientHeight || 0;

        // 실제 사용 가능한 캔버스 영역 (팔레트 영역 제외하지 않음 - 이미 CSS에서 분리됨)
        const canvasWidth = Math.max(rawCanvasWidth, 600);  // .module-canvas의 실제 영역
        const canvasHeight = Math.max(rawCanvasHeight, 300);

        // 중앙 오프셋 계산
        // 단, 사용자 패키지(PACKAGE)는 저장된 절대 위치를 유지해야 하므로 중앙 정렬 하지 않음
        let offsetX = 0;
        let offsetY = 0;

        if (moduleType !== 'PACKAGE') {
            const offsetXVal = (canvasWidth - circuitWidth) / 2 - minX;
            const offsetYVal = (canvasHeight - circuitHeight) / 2 - minY;
            offsetX = offsetXVal;
            offsetY = offsetYVal;
        }

        // 컴포넌트 생성 (중복 ID 필터링 - 오염된 데이터 대응)
        const idMap = {};
        const seenIds = new Set();
        const uniqueCircuitComponents = circuit.components.filter(comp => {
            if (seenIds.has(comp.id)) return false;
            seenIds.add(comp.id);
            return true;
        });

        uniqueCircuitComponents.forEach(comp => {
            const centeredComp = {
                ...comp,
                x: (comp.x || 0) + offsetX,
                y: (comp.y || 0) + offsetY
            };
            const el = this.createInternalComponent(centeredComp);
            if (el) {
                idMap[comp.id] = el;
                this.moduleComponents.push(el);
                this.moduleCanvas.appendChild(el);
            }
        });

        // 와이어 생성 (더 명확한 스타일)
        circuit.wires.forEach(wire => {
            // 기본 모듈은 from/to, 사용자 모듈은 fromId/toId 사용
            const fromId = wire.from || wire.fromId;
            const toId = wire.to || wire.toId;
            const fromEl = idMap[fromId];
            const toEl = idMap[toId];
            if (fromEl && toEl) {
                const fromPin = fromEl.querySelector(`.${wire.fromPin}`) || fromEl.querySelector('.output') || fromEl.querySelector('.out');
                const toPin = toEl.querySelector(`.${wire.toPin}`) || toEl.querySelector('.input') || toEl.querySelector('.in-1');
                if (fromPin && toPin) {
                    this.createModuleWire(fromPin, toPin);
                }
            }
        });

        // I/O 패널 업데이트 (빈 값 및 중복 제거)
        this.modulePorts = {
            inputs: (pkgDef.inputs || []).filter((v, i, arr) => v && arr.indexOf(v) === i),
            outputs: (pkgDef.outputs || []).filter((v, i, arr) => v && arr.indexOf(v) === i)
        };
        this.updateModuleIOPanel();
    },

    /**
     * 모듈 컴포넌트를 캔버스 중앙에 정렬
     */
    centerModuleComponents() {
        if (!this.moduleCanvas || this.moduleComponents.length === 0) return;

        // 컴포넌트들의 현재 바운딩 박스 계산
        let minX = Infinity, maxX = 0, minY = Infinity, maxY = 0;
        this.moduleComponents.forEach(comp => {
            const x = parseFloat(comp.style.left) || 0;
            const y = parseFloat(comp.style.top) || 0;
            const w = comp.offsetWidth || 72;
            const h = comp.offsetHeight || 48;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x + w);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y + h);
        });

        const circuitWidth = maxX - minX;
        const circuitHeight = maxY - minY;

        // 캔버스 실제 크기
        const canvasWidth = this.moduleCanvas.clientWidth;
        const canvasHeight = this.moduleCanvas.clientHeight;

        if (canvasWidth === 0 || canvasHeight === 0) return;

        // 중앙 오프셋 계산
        const offsetX = (canvasWidth - circuitWidth) / 2 - minX;
        const offsetY = (canvasHeight - circuitHeight) / 2 - minY;

        // 컴포넌트 위치 조정
        this.moduleComponents.forEach(comp => {
            const x = parseFloat(comp.style.left) || 0;
            const y = parseFloat(comp.style.top) || 0;
            comp.style.left = (x + offsetX) + 'px';
            comp.style.top = (y + offsetY) + 'px';
        });

        // 와이어 다시 그리기
        this.redrawWires();
    },

    /**
     * 내부 컴포넌트 생성 (메인 회로와 동일한 스타일)
     */
    createInternalComponent(compDef) {
        const el = document.createElement('div');
        el.className = 'component';  // internal-comp 제거, 메인과 동일한 클래스
        el.id = 'internal_' + compDef.id;
        el.setAttribute('data-type', compDef.type);
        el.setAttribute('data-value', '0');
        el.style.left = (compDef.x || 0) + 'px';
        el.style.top = (compDef.y || 0) + 'px';

        const type = compDef.type;
        const label = document.createElement('div');
        label.className = 'comp-label';
        label.textContent = compDef.label || type;

        // 메인 회로와 동일한 SVG 심볼
        const symbols = {
            'AND': `<svg viewBox="0 0 72 48"><path d="M12 8 L36 8 A 16 20 0 0 1 36 40 L12 40 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="12" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="12" y2="32" stroke="currentColor" stroke-width="2"/><line x1="52" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
            'OR': `<svg viewBox="0 0 72 48"><path d="M8 8 Q 18 24 8 40 Q 32 40 52 24 Q 32 8 8 8 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="16" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="16" y2="32" stroke="currentColor" stroke-width="2"/><line x1="52" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
            'NOT': `<svg viewBox="0 0 56 40"><path d="M8 4 L40 20 L8 36 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="46" cy="20" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="20" x2="8" y2="20" stroke="currentColor" stroke-width="2"/><line x1="51" y1="20" x2="56" y2="20" stroke="currentColor" stroke-width="2"/></svg>`,
            'NAND': `<svg viewBox="0 0 72 48"><path d="M10 8 L30 8 A 16 20 0 0 1 30 40 L10 40 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="52" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="10" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="10" y2="32" stroke="currentColor" stroke-width="2"/><line x1="57" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
            'NOR': `<svg viewBox="0 0 72 48"><path d="M6 8 Q 16 24 6 40 Q 28 40 44 24 Q 28 8 6 8 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="52" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="14" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="14" y2="32" stroke="currentColor" stroke-width="2"/><line x1="57" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
            'XOR': `<svg viewBox="0 0 72 48"><path d="M14 8 Q 24 24 14 40 Q 36 40 54 24 Q 36 8 14 8 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6 8 Q 16 24 6 40" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="18" y2="32" stroke="currentColor" stroke-width="2"/><line x1="54" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`,
            'XNOR': `<svg viewBox="0 0 72 48"><path d="M14 8 Q 24 24 14 40 Q 34 40 48 24 Q 34 8 14 8 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6 8 Q 16 24 6 40" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="54" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="0" y1="16" x2="18" y2="16" stroke="currentColor" stroke-width="2"/><line x1="0" y1="32" x2="18" y2="32" stroke="currentColor" stroke-width="2"/><line x1="59" y1="24" x2="72" y2="24" stroke="currentColor" stroke-width="2"/></svg>`
        };

        if (['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'].includes(type)) {
            el.innerHTML = symbols[type];
            el.appendChild(label);
            this.addPin(el, 'in-1', 'input in-1');
            this.addPin(el, 'in-2', 'input in-2');
            this.addPin(el, 'out', 'output out');
        } else if (type === 'NOT') {
            el.innerHTML = symbols[type];
            el.appendChild(label);
            this.addPin(el, 'in-1', 'input center-in');
            this.addPin(el, 'out', 'output center-out');
        } else if (type === 'PORT_IN') {
            el.classList.add('port-in');
            el.style.background = 'linear-gradient(135deg, var(--accent-cyan) 0%, #0891b2 100%)';
            el.style.border = '2px solid rgba(255, 255, 255, 0.3)';
            el.style.borderRadius = '6px';
            el.style.width = '70px';
            el.style.height = '36px';
            label.style.color = 'white';
            label.style.fontWeight = '600';
            el.appendChild(label);
            this.addPin(el, 'out', 'output center');
        } else if (type === 'PORT_OUT') {
            el.classList.add('port-out');
            el.style.background = 'linear-gradient(135deg, var(--accent-orange) 0%, #d97706 100%)';
            el.style.border = '2px solid rgba(255, 255, 255, 0.3)';
            el.style.borderRadius = '6px';
            el.style.width = '70px';
            el.style.height = '36px';
            label.style.color = 'white';
            label.style.fontWeight = '600';
            el.appendChild(label);
            this.addPin(el, 'in', 'input center');
        } else {
            // 기타 타입
            el.appendChild(label);
        }

        // 드래그 핸들러 (읽기 전용이 아닐 때만)
        if (!this.isModuleReadOnly) {
            el.onmousedown = (e) => this.handleComponentMouseDown(e, el);
        }

        return el;
    },

    /**
     * 모듈 내부 와이어 생성
     */
    createModuleWire(fromPin, toPin) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // 더 명확한 와이어 스타일
        line.setAttribute('stroke', '#94a3b8');  // 밝은 색상
        line.setAttribute('stroke-width', '3');   // 더 굵게
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('stroke-linejoin', 'round');

        if (this.moduleWireLayer) {
            this.moduleWireLayer.appendChild(line);
        }

        const wire = { from: fromPin, to: toPin, line };
        this.moduleWires.push(wire);

        // 와이어 경로 업데이트
        this.updateModuleWirePath(wire);
    },

    /**
     * 모듈 와이어 경로 업데이트 (전선 겹침 방지)
     */
    updateModuleWirePath(wire) {
        const fromRect = wire.from.getBoundingClientRect();
        const toRect = wire.to.getBoundingClientRect();
        const canvasRect = this.moduleCanvas?.getBoundingClientRect() || { left: 0, top: 0 };

        const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
        const x2 = toRect.left + toRect.width / 2 - canvasRect.left;
        const y2 = toRect.top + toRect.height / 2 - canvasRect.top;

        // 각 전선에 고유한 오프셋 부여 (겹침 방지)
        const wireIndex = this.moduleWires.indexOf(wire);
        const verticalOffset = (wireIndex % 5) * 8 - 16;  // -16, -8, 0, 8, 16 순환

        // 수평-수직-수평 맨해튼 스타일 경로
        const dx = x2 - x1;
        const midX = (x1 + x2) / 2;

        // Y좌표에 오프셋을 적용한 중간점 계산
        const midY1 = y1 + verticalOffset;
        const midY2 = y2 - verticalOffset;

        if (Math.abs(dx) > 80) {
            // 수평 거리가 크면 부드러운 S자 곡선 (수직 오프셋 포함)
            wire.line.setAttribute('d',
                `M${x1},${y1} C${midX},${midY1} ${midX},${midY2} ${x2},${y2}`);
        } else if (Math.abs(y2 - y1) > 40) {
            // 수직 거리가 크면 위/아래로 우회
            const curveOffset = 60 + Math.abs(verticalOffset);
            const yMid = (y1 + y2) / 2;
            wire.line.setAttribute('d',
                `M${x1},${y1} C${x1 + curveOffset},${y1} ${x1 + curveOffset},${yMid} ${x1 + curveOffset},${yMid} ` +
                `S${x2 - curveOffset},${y2} ${x2},${y2}`);
        } else {
            // 기본 베지어 곡선
            const controlOffset = 50 + Math.abs(verticalOffset);
            wire.line.setAttribute('d',
                `M${x1},${y1} C${x1 + controlOffset},${y1} ${x2 - controlOffset},${y2} ${x2},${y2}`);
        }
    },

    /**
     * 모듈 I/O 패널 업데이트
     */
    updateModuleIOPanel() {
        const inputsContainer = document.getElementById('module-inputs');
        const outputsContainer = document.getElementById('module-outputs');

        if (inputsContainer) {
            inputsContainer.innerHTML = this.modulePorts.inputs.map((name, i) => `
                <div class="io-item">
                    <span style="color: var(--accent-cyan);">●</span>
                    <input type="text" value="${name}" onchange="sim.renameModulePort('input', ${i}, this.value)">
                    <button class="io-remove" onclick="sim.removeModulePort('input', ${i})">×</button>
                </div>
            `).join('');
        }

        if (outputsContainer) {
            outputsContainer.innerHTML = this.modulePorts.outputs.map((name, i) => `
                <div class="io-item">
                    <span style="color: var(--accent-orange);">●</span>
                    <input type="text" value="${name}" onchange="sim.renameModulePort('output', ${i}, this.value)">
                    <button class="io-remove" onclick="sim.removeModulePort('output', ${i})">×</button>
                </div>
            `).join('');
        }
    },

    /**
     * 모듈 포트 추가
     */
    addModulePort(type) {
        // 고유한 포트 이름 생성 (중복 방지)
        if (type === 'input') {
            let num = this.modulePorts.inputs.length + 1;
            let portName = `IN${num}`;
            while (this.modulePorts.inputs.includes(portName)) {
                num++;
                portName = `IN${num}`;
            }
            this.modulePorts.inputs.push(portName);
        } else {
            let num = this.modulePorts.outputs.length + 1;
            let portName = `OUT${num}`;
            while (this.modulePorts.outputs.includes(portName)) {
                num++;
                portName = `OUT${num}`;
            }
            this.modulePorts.outputs.push(portName);
        }

        this.updateModuleIOPanel();
    },

    /**
     * 모듈 포트 제거
     */
    removeModulePort(type, index) {
        if (type === 'input') {
            this.modulePorts.inputs.splice(index, 1);
        } else {
            this.modulePorts.outputs.splice(index, 1);
        }
        this.updateModuleIOPanel();
    },

    /**
     * 모듈 포트 이름 변경
     */
    renameModulePort(type, index, newName) {
        const oldName = type === 'input'
            ? this.modulePorts.inputs[index]
            : this.modulePorts.outputs[index];

        if (type === 'input') {
            this.modulePorts.inputs[index] = newName;
        } else {
            this.modulePorts.outputs[index] = newName;
        }

        // 해당 컴포넌트의 라벨도 업데이트
        const portType = type === 'input' ? 'PORT_IN' : 'PORT_OUT';
        const portComp = this.moduleComponents.find(c =>
            c.getAttribute('data-type') === portType &&
            c.querySelector('.comp-label')?.textContent === oldName
        );
        if (portComp) {
            const label = portComp.querySelector('.comp-label');
            if (label) label.textContent = newName;
        }

        // 탭 상태 즉시 동기화
        this.saveCurrentModuleTabState();
    },

    /**
     * 모듈 변경사항 저장
     */
    saveModuleChanges() {
        if (!this.editingModule) {
            this.showToast('저장할 모듈이 없습니다', 'error');
            return;
        }

        const type = this.editingModule.getAttribute('data-type');
        if (type !== 'PACKAGE') {
            this.showToast('기본 모듈은 수정할 수 없습니다', 'warning');
            return;
        }

        const pkgId = parseInt(this.editingModule.getAttribute('data-package-id'));
        if (isNaN(pkgId) || !this.userPackages || !this.userPackages[pkgId]) {
            this.showToast('원본 패키지를 찾을 수 없습니다', 'error');
            return;
        }

        // 1. 회로 데이터 수집 (중복 ID 자동 제거)
        const seenIds = new Set();
        const uniqueComponents = this.moduleComponents.filter(c => {
            if (seenIds.has(c.id)) return false;
            seenIds.add(c.id);
            return true;
        });

        const circuitData = {
            components: uniqueComponents.map(c => ({
                id: c.id,
                type: c.getAttribute('data-type'),
                x: parseFloat(c.style.left) || 0,
                y: parseFloat(c.style.top) || 0,
                label: c.querySelector('.comp-label')?.textContent || ''
            })),
            wires: this.moduleWires.map(w => ({
                fromId: w.from.closest('.component')?.id,
                toId: w.to.closest('.component')?.id,
                // [Logic] pin 클래스가 아닌 구체적인 핀 위치 클래스(in-1, out 등) 찾기
                // data-role이나 일반 클래스(input, output) 제외 필요할 수 있으나 기존 로직 준수
                fromPin: Array.from(w.from.classList).find(c => !['pin', 'input', 'output', 'center'].includes(c)) || 'out',
                toPin: Array.from(w.to.classList).find(c => !['pin', 'input', 'output', 'center'].includes(c)) || 'in-1'
            }))
        };

        // 2. 포트 목록 업데이트 (빈 값 및 중복 제거)
        const inputs = uniqueComponents
            .filter(c => c.getAttribute('data-type') === 'PORT_IN')
            .map(c => c.querySelector('.comp-label')?.textContent?.trim())
            .filter((v, i, arr) => v && arr.indexOf(v) === i);

        const outputs = uniqueComponents
            .filter(c => c.getAttribute('data-type') === 'PORT_OUT')
            .map(c => c.querySelector('.comp-label')?.textContent?.trim())
            .filter((v, i, arr) => v && arr.indexOf(v) === i);

        // 3. 패키지 데이터 업데이트
        const pkg = this.userPackages[pkgId];
        pkg.circuit = circuitData;
        pkg.inputs = inputs;
        pkg.outputs = outputs;

        // 메타데이터 업데이트 (높이 자동 확장)
        pkg.height = Math.max(pkg.height || 0, Math.max(inputs.length, outputs.length) * 30 + 40);

        // 4. 저장 및 UI 갱신
        this.saveUserPackages();
        this.updatePackageList();

        // [토큰 방식] 메인 탭으로 돌아갈 때 해당 패키지 갱신 예약
        if (!this._pendingRefreshPackages) {
            this._pendingRefreshPackages = new Set();
        }
        this._pendingRefreshPackages.add(pkgId);

        this.showToast('모듈 변경사항이 저장되었습니다 (메인 탭에서 적용됩니다)', 'success');
    },

    /**
     * 패키지 변경 시 이미 배치된 인스턴스(메인 회로 등) 즉시 갱신
     */
    refreshPackageInstances(pkgId) {
        const pkg = this.userPackages[pkgId];
        if (!pkg) return;

        // 메인 회로의 컴포넌트 목록 (모듈 편집 중이므로 백업본 사용)
        const targetComponents = this._savedMainComponents || this.components;
        const targetWires = this._savedMainWires || this.wires;

        if (!targetComponents) return;

        // 해당 패키지 인스턴스 찾기
        const instances = targetComponents.filter(c =>
            c.getAttribute('data-type') === 'PACKAGE' &&
            parseInt(c.getAttribute('data-package-id')) === pkgId
        );

        if (instances.length === 0) return;

        instances.forEach(comp => {
            // 1. 기존 와이어 연결 정보 백업
            const connections = [];
            targetWires.forEach(w => {
                if (comp.contains(w.from)) {
                    const pinId = this._getPinClassId(w.from);
                    if (pinId) connections.push({ wire: w, type: 'from', pinId });
                }
                if (comp.contains(w.to)) {
                    const pinId = this._getPinClassId(w.to);
                    if (pinId) connections.push({ wire: w, type: 'to', pinId });
                }
            });

            // 2. 기존 핀과 라벨 등 내부 요소 완벽 제거 (comp-label 제외하고 초기화)
            // 이를 통해 핀이 중복되거나 잔재가 남는 문제를 원천 차단
            Array.from(comp.children).forEach(child => {
                if (!child.classList.contains('comp-label')) {
                    child.remove();
                }
            });

            // 3. 외형 업데이트 (높이)
            const inputCount = pkg.inputs.length;
            const outputCount = pkg.outputs.length;
            const maxPins = Math.max(inputCount, outputCount, 1);
            // 저장 시 계산된 높이 사용 (기본값 재계산 보장)
            const height = Math.max(80, maxPins * 30 + 40);
            const actualHeight = pkg.height || height;
            comp.style.height = actualHeight + 'px';

            // 4. 핀 재생성 (PackageManager 로직 준수)
            if (inputCount > 0) {
                const spacing = actualHeight / (inputCount + 1);
                pkg.inputs.forEach((name, i) => {
                    const topPos = spacing * (i + 1);
                    const pinClass = `in-${i + 1}`;
                    this.addPin(comp, pinClass, 'input left', topPos);

                    const lbl = document.createElement('span');
                    lbl.className = 'pin-label left';
                    lbl.textContent = name;
                    lbl.style.top = topPos + 'px';
                    comp.appendChild(lbl);
                });
            }

            if (outputCount > 0) {
                const spacing = actualHeight / (outputCount + 1);
                pkg.outputs.forEach((name, i) => {
                    const topPos = spacing * (i + 1);
                    const pinClass = `out-${i + 1}`;
                    this.addPin(comp, pinClass, 'output right', topPos);

                    const lbl = document.createElement('span');
                    lbl.className = 'pin-label right';
                    lbl.textContent = name;
                    lbl.style.top = topPos + 'px';
                    comp.appendChild(lbl);
                });
            }

            // 5. 와이어 재연결
            connections.forEach(conn => {
                const newPin = comp.querySelector(`.${conn.pinId}`);
                if (newPin) {
                    if (conn.type === 'from') conn.wire.from = newPin;
                    else conn.wire.to = newPin;
                } else {
                    if (conn.wire.line) conn.wire.line.remove();
                }
            });

            // 6. [중요] 내부 로직(internals)도 최신 패키지 정의로 갱신
            // 이것이 없으면 모양만 바뀌고 동작은 수정 전 그대로임
            if (this.buildPackageInternals) {
                comp.internals = this.buildPackageInternals(comp, pkg);
            }
        });

        this.showToast('배치된 모듈의 외형과 내부 로직이 모두 갱신되었습니다', 'info');
    },

    _getPinClassId(el) {
        if (!el || !el.classList) return null;
        return Array.from(el.classList).find(c => /^in-\d+$/.test(c) || /^out-\d+$/.test(c));
    },

    /**
     * 모듈 탭 닫기
     */
    closeModuleTab() {
        this.editingModule = null;
        this.moduleComponents = [];
        this.moduleWires = [];

        // 모듈 탭 숨김
        if (this.moduleTab) {
            this.moduleTab.style.display = 'none';
        }

        // 모듈 캔버스 정리
        if (this.moduleCanvas) {
            const existingComps = this.moduleCanvas.querySelectorAll('.component');
            existingComps.forEach(c => c.remove());
        }
        if (this.moduleWireLayer) {
            this.moduleWireLayer.innerHTML = '';
        }

        // 힌트 다시 표시
        const hint = document.getElementById('module-canvas-hint');
        if (hint) hint.classList.remove('hidden');

        // 메인 상태 복원
        if (this._savedMainWires) {
            this.wires = this._savedMainWires;
            this._savedMainWires = null;
        }
        if (this._savedMainComponents) {
            this.components = this._savedMainComponents;
            this._savedMainComponents = null;
        }

        // 메인 탭으로 전환
        this.switchTab('main');
    },

    /**
     * 새 모듈 만들기 시작 (빈 캔버스에서 시작) - 새 탭 생성
     */
    startNewModule() {
        // 새 탭 생성
        this.moduleTabCounter++;
        const tabId = `module_${this.moduleTabCounter}`;
        const moduleName = `새 모듈 ${this.moduleTabCounter}`;

        // 현재 메인 상태 백업 (아직 백업 안 된 경우만)
        if (this.currentTab === 'main' && !this._savedMainWires) {
            this._savedMainWires = this.wires || [];
            this._savedMainComponents = this.components || [];
        }

        // 현재 모듈 탭 상태 저장 (다른 모듈 탭에서 전환하는 경우)
        if (this.currentTab.startsWith('module_')) {
            this.saveCurrentModuleTabState();
        }

        // 새 탭 요소 생성 및 추가
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.setAttribute('data-tab', tabId);
        tabElement.innerHTML = `
            <span class="tab-icon">📦</span>
            <span class="tab-title">${moduleName}</span>
            <button class="tab-close" onclick="event.stopPropagation(); sim.closeModuleTabById('${tabId}')">×</button>
        `;
        tabElement.onclick = () => this.switchToModuleTab(tabId);

        // 기존 모듈 탭 숨기고 새 탭 추가
        if (this.moduleTab) {
            this.moduleTab.style.display = 'none';
        }
        this.tabBar.appendChild(tabElement);

        // 탭 상태 저장
        this.moduleTabs[tabId] = {
            moduleId: null,  // 새 모듈은 아직 ID가 없음
            moduleComp: null,
            moduleName: moduleName,
            moduleType: 'NEW',
            components: [],
            wires: [],
            ports: { inputs: [], outputs: [] },
            tabElement: tabElement
        };

        // 새 모듈 상태로 초기화
        this.editingModule = null;
        this.moduleComponents = [];
        this.moduleWires = [];
        this.wires = [];
        this.modulePorts = { inputs: [], outputs: [] };
        this.currentModuleTabId = tabId;

        // 모듈 캔버스 정리
        if (this.moduleCanvas) {
            const existingComps = this.moduleCanvas.querySelectorAll('.component');
            existingComps.forEach(c => c.remove());
        }
        if (this.moduleWireLayer) {
            this.moduleWireLayer.innerHTML = '';
        }

        // 이름 초기화
        const nameInput = document.getElementById('editing-module-name');
        if (nameInput) {
            nameInput.value = moduleName;
        }

        // 힌트 표시
        const hint = document.getElementById('module-canvas-hint');
        if (hint) hint.classList.remove('hidden');

        // I/O 패널 초기화
        this.updateModuleIOPanel();
        this.updateModuleStats();

        // 모듈 탭으로 전환
        this.switchToModuleTab(tabId);

        this.showToast('새 모듈 편집을 시작합니다', 'info');
    },

    /**
     * 모듈 편집기에 컴포넌트 추가
     */
    addModuleComponent(type) {
        // 다중 탭 지원: module_로 시작하는 탭에서만 컴포넌트 추가 가능
        if (!this.currentTab.startsWith('module_')) {
            this.showToast('모듈 편집 탭에서만 컴포넌트를 추가할 수 있습니다', 'error');
            return;
        }

        // 힌트 숨기기
        const hint = document.getElementById('module-canvas-hint');
        if (hint) hint.classList.add('hidden');

        // 기본 위치 계산
        const offsetX = 100 + (this.moduleComponents.length % 4) * 100;
        const offsetY = 80 + Math.floor(this.moduleComponents.length / 4) * 80;

        const compDef = {
            id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type: type,
            x: offsetX,
            y: offsetY,
            label: this.getComponentLabel(type)
        };

        const el = this.createInternalComponent(compDef);
        if (el && this.moduleCanvas) {
            this.moduleCanvas.appendChild(el);
            this.moduleComponents.push(el);

            // PORT_IN/PORT_OUT은 자동으로 I/O 목록에 추가 (중복 방지)
            if (type === 'PORT_IN') {
                // 고유한 포트 이름 생성 (중복 방지)
                let num = this.modulePorts.inputs.length + 1;
                let portName = `IN${num}`;
                while (this.modulePorts.inputs.includes(portName)) {
                    num++;
                    portName = `IN${num}`;
                }
                this.modulePorts.inputs.push(portName);
                el.querySelector('.comp-label').textContent = portName;
            } else if (type === 'PORT_OUT') {
                // 고유한 포트 이름 생성 (중복 방지)
                let num = this.modulePorts.outputs.length + 1;
                let portName = `OUT${num}`;
                while (this.modulePorts.outputs.includes(portName)) {
                    num++;
                    portName = `OUT${num}`;
                }
                this.modulePorts.outputs.push(portName);
                el.querySelector('.comp-label').textContent = portName;
            }

            this.updateModuleIOPanel();
            this.updateModuleStats();

            // 탭 상태 즉시 동기화 (깊은 복사로 인해 필요)
            this.saveCurrentModuleTabState();
        }
    },

    /**
     * 컴포넌트 라벨 가져오기
     */
    getComponentLabel(type) {
        const labels = {
            'AND': 'AND',
            'OR': 'OR',
            'NOT': 'NOT',
            'NAND': 'NAND',
            'NOR': 'NOR',
            'XOR': 'XOR',
            'XNOR': 'XNOR',
            'PORT_IN': 'IN',
            'PORT_OUT': 'OUT'
        };
        return labels[type] || type;
    },

    /**
     * 모듈 통계 업데이트
     */
    updateModuleStats() {
        const inputCount = this.moduleComponents.filter(c =>
            c.getAttribute('data-type') === 'PORT_IN'
        ).length;
        const outputCount = this.moduleComponents.filter(c =>
            c.getAttribute('data-type') === 'PORT_OUT'
        ).length;
        const gateCount = this.moduleComponents.filter(c =>
            !['PORT_IN', 'PORT_OUT'].includes(c.getAttribute('data-type'))
        ).length;

        const inputEl = document.getElementById('module-input-count');
        const outputEl = document.getElementById('module-output-count');
        const gateEl = document.getElementById('module-gate-count');

        if (inputEl) inputEl.textContent = inputCount;
        if (outputEl) outputEl.textContent = outputCount;
        if (gateEl) gateEl.textContent = gateCount;
    },

    /**
     * 새 모듈로 저장
     */
    saveAsNewModule() {
        const nameInput = document.getElementById('editing-module-name');
        const moduleName = nameInput?.value?.trim() || '새 모듈';

        // 유효성 검사
        const inputs = this.moduleComponents.filter(c => c.getAttribute('data-type') === 'PORT_IN');
        const outputs = this.moduleComponents.filter(c => c.getAttribute('data-type') === 'PORT_OUT');

        if (inputs.length === 0) {
            this.showToast('최소 1개의 입력 포트가 필요합니다', 'error');
            return;
        }
        if (outputs.length === 0) {
            this.showToast('최소 1개의 출력 포트가 필요합니다', 'error');
            return;
        }

        // 회로 데이터 수집
        const circuitData = {
            components: this.moduleComponents.map(c => ({
                id: c.id,
                type: c.getAttribute('data-type'),
                x: parseFloat(c.style.left) || 0,
                y: parseFloat(c.style.top) || 0,
                label: c.querySelector('.comp-label')?.textContent || ''
            })),
            wires: this.moduleWires.map(w => ({
                fromId: w.from.closest('.component')?.id,
                toId: w.to.closest('.component')?.id,
                fromPin: Array.from(w.from.classList).find(c => c !== 'pin'),
                toPin: Array.from(w.to.classList).find(c => c !== 'pin')
            }))
        };

        // 새 패키지 생성 - 사용자 지정 크기 사용
        const widthInput = document.getElementById('module-width');
        const heightInput = document.getElementById('module-height');
        const customWidth = parseInt(widthInput?.value) || 90;
        const customHeight = parseInt(heightInput?.value) || Math.max(inputs.length, outputs.length) * 30 + 40;

        const newPackage = {
            name: moduleName,
            desc: `사용자 정의 모듈 (${inputs.length} 입력, ${outputs.length} 출력)`,
            inputs: inputs.map(c => c.querySelector('.comp-label')?.textContent || 'IN'),
            outputs: outputs.map(c => c.querySelector('.comp-label')?.textContent || 'OUT'),
            width: customWidth,
            height: customHeight,
            circuit: circuitData
        };

        // 사용자 패키지에 추가
        if (!this.userPackages) this.userPackages = [];
        this.userPackages.push(newPackage);
        this.saveUserPackages();
        this.updatePackageList();

        this.showToast(`"${moduleName}" 모듈이 생성되었습니다!`, 'success');

        // 모듈 탭 닫기
        this.closeModuleTab();
    },

    /**
     * 패키지 정의 가져오기
     */
    getPackageDefinition(type) {
        const pkgDefs = {
            'HALF_ADDER': {
                label: 'HA',
                name: 'Half Adder',
                inputs: ['A', 'B'],
                outputs: ['S', 'C'],
                circuit: {
                    components: [
                        // 입력 포트 (왼쪽)
                        { id: 'in_a', type: 'PORT_IN', x: 40, y: 40, label: 'A' },
                        { id: 'in_b', type: 'PORT_IN', x: 40, y: 150, label: 'B' },
                        // 게이트 (중앙)
                        { id: 'xor1', type: 'XOR', x: 200, y: 30, label: 'XOR' },
                        { id: 'and1', type: 'AND', x: 200, y: 140, label: 'AND' },
                        // 출력 포트 (오른쪽)
                        { id: 'out_s', type: 'PORT_OUT', x: 360, y: 40, label: 'S' },
                        { id: 'out_c', type: 'PORT_OUT', x: 360, y: 150, label: 'C' }
                    ],
                    wires: [
                        { from: 'in_a', fromPin: 'out', to: 'xor1', toPin: 'in-1' },
                        { from: 'in_b', fromPin: 'out', to: 'xor1', toPin: 'in-2' },
                        { from: 'in_a', fromPin: 'out', to: 'and1', toPin: 'in-1' },
                        { from: 'in_b', fromPin: 'out', to: 'and1', toPin: 'in-2' },
                        { from: 'xor1', fromPin: 'out', to: 'out_s', toPin: 'in' },
                        { from: 'and1', fromPin: 'out', to: 'out_c', toPin: 'in' }
                    ]
                }
            },
            'FULL_ADDER': {
                label: 'FA',
                name: 'Full Adder',
                inputs: ['A', 'B', 'Cin'],
                outputs: ['S', 'Cout'],
                circuit: {
                    components: [
                        // 입력 포트 (왼쪽)
                        { id: 'in_a', type: 'PORT_IN', x: 30, y: 30, label: 'A' },
                        { id: 'in_b', type: 'PORT_IN', x: 30, y: 100, label: 'B' },
                        { id: 'in_cin', type: 'PORT_IN', x: 30, y: 180, label: 'Cin' },
                        // 1단계 게이트
                        { id: 'xor1', type: 'XOR', x: 160, y: 20, label: 'XOR1' },
                        { id: 'and1', type: 'AND', x: 160, y: 100, label: 'AND1' },
                        // 2단계 게이트
                        { id: 'xor2', type: 'XOR', x: 290, y: 50, label: 'XOR2' },
                        { id: 'and2', type: 'AND', x: 290, y: 140, label: 'AND2' },
                        // 3단계 게이트
                        { id: 'or1', type: 'OR', x: 420, y: 120, label: 'OR' },
                        // 출력 포트 (오른쪽)
                        { id: 'out_s', type: 'PORT_OUT', x: 420, y: 50, label: 'S' },
                        { id: 'out_cout', type: 'PORT_OUT', x: 550, y: 130, label: 'Cout' }
                    ],
                    wires: [
                        { from: 'in_a', fromPin: 'out', to: 'xor1', toPin: 'in-1' },
                        { from: 'in_b', fromPin: 'out', to: 'xor1', toPin: 'in-2' },
                        { from: 'xor1', fromPin: 'out', to: 'xor2', toPin: 'in-1' },
                        { from: 'in_cin', fromPin: 'out', to: 'xor2', toPin: 'in-2' },
                        { from: 'in_a', fromPin: 'out', to: 'and1', toPin: 'in-1' },
                        { from: 'in_b', fromPin: 'out', to: 'and1', toPin: 'in-2' },
                        { from: 'xor1', fromPin: 'out', to: 'and2', toPin: 'in-1' },
                        { from: 'in_cin', fromPin: 'out', to: 'and2', toPin: 'in-2' },
                        { from: 'and1', fromPin: 'out', to: 'or1', toPin: 'in-1' },
                        { from: 'and2', fromPin: 'out', to: 'or1', toPin: 'in-2' },
                        { from: 'xor2', fromPin: 'out', to: 'out_s', toPin: 'in' },
                        { from: 'or1', fromPin: 'out', to: 'out_cout', toPin: 'in' }
                    ]
                }
            },
            'SR_LATCH': {
                label: 'SR',
                name: 'SR Latch',
                inputs: ['S', 'R'],
                outputs: ['Q', 'Q̅'],
                circuit: {
                    components: [
                        // 입력 포트 (왼쪽)
                        { id: 'in_s', type: 'PORT_IN', x: 40, y: 40, label: 'S' },
                        { id: 'in_r', type: 'PORT_IN', x: 40, y: 160, label: 'R' },
                        // NOR 게이트 (중앙) - 세로 간격 확보
                        { id: 'nor1', type: 'NOR', x: 200, y: 40, label: 'NOR1' },
                        { id: 'nor2', type: 'NOR', x: 200, y: 150, label: 'NOR2' },
                        // 출력 포트 (오른쪽)
                        { id: 'out_q', type: 'PORT_OUT', x: 360, y: 50, label: 'Q' },
                        { id: 'out_qn', type: 'PORT_OUT', x: 360, y: 160, label: 'Q̅' }
                    ],
                    wires: [
                        { from: 'in_s', fromPin: 'out', to: 'nor1', toPin: 'in-1' },
                        { from: 'nor2', fromPin: 'out', to: 'nor1', toPin: 'in-2' },
                        { from: 'in_r', fromPin: 'out', to: 'nor2', toPin: 'in-2' },
                        { from: 'nor1', fromPin: 'out', to: 'nor2', toPin: 'in-1' },
                        { from: 'nor1', fromPin: 'out', to: 'out_q', toPin: 'in' },
                        { from: 'nor2', fromPin: 'out', to: 'out_qn', toPin: 'in' }
                    ]
                }
            },
            'D_FLIPFLOP': {
                label: 'DFF',
                name: 'D Flip-Flop',
                inputs: ['D', 'CLK'],
                outputs: ['Q', 'Q̅']
            }
        };
        return pkgDefs[type];
    },

    /**
     * 모듈 컴포넌트 우클릭 컨텍스트 메뉴
     */
    // [DEPRECATED] Handled by ContextMenuManager
    showModuleContextMenu(e, component) {
        // No-op
    },

    /**
     * 컨텍스트 메뉴 숨기기
     */
    hideContextMenu() {
        if (this.contextMenuManager) {
            this.contextMenuManager.close();
        }
    },

    /**
     * 컨텍스트 메뉴에서 모듈 수정
     */
    editModuleFromContextMenu(componentId) {
        this.hideContextMenu();
        const comp = document.getElementById(componentId);
        if (comp) {
            this.openModuleEditor(comp);
        }
    },

    /**
     * 모듈 편집기 와이어 새로고침
     */
    refreshModuleWires() {
        if (!this.moduleWires || !this.moduleCanvas) return;

        this.moduleWires.forEach(wire => {
            if (!wire.from || !wire.to || !wire.line) return;
            if (!document.contains(wire.from) || !document.contains(wire.to)) return;

            const fromRect = wire.from.getBoundingClientRect();
            const toRect = wire.to.getBoundingClientRect();
            const canvasRect = this.moduleCanvas.getBoundingClientRect();

            const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
            const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
            const x2 = toRect.left + toRect.width / 2 - canvasRect.left;
            const y2 = toRect.top + toRect.height / 2 - canvasRect.top;

            const midX = (x1 + x2) / 2;
            wire.line.setAttribute('d', `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`);
        });
    }
});

