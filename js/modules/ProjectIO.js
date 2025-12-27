/**
 * 모듈: 프로젝트 저장/로드 및 내보내기
 */
Object.assign(CircuitSimulator.prototype, {
    initProject() {
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('id');
        const isNew = params.get('new');
        const tutorialId = params.get('tutorial');

        if (projectId) {
            this.currentProjectId = projectId;
            // 만약 ID가 UUID 형식(Supabase ID)이라면 Cloud ID로도 설정
            // (UUID는 보통 36자)
            if (projectId.length > 30) {
                this.currentCloudId = projectId;
                console.log('Detected Cloud Project ID via URL:', this.currentCloudId);
            }
        } else {
            this.currentProjectId = 'temp_' + Date.now();
        }

        // 튜토리얼 모드: 모달 스킵하고 프로젝트 이름 자동 설정
        if (tutorialId) {
            // 프로젝트 이름 입력창이 보이면 기본값 설정
            const nameInput = document.getElementById('project-name-input');
            if (nameInput) {
                nameInput.value = '튜토리얼';
            }
            // 모달 표시하지 않음 - TutorialSystem.js가 자동 시작함
        } else if (isNew === 'true') {
            const modal = document.getElementById('new-project-modal');
            if (modal) modal.classList.add('show');
        } else if (projectId) {
            // URL 파라미터에 ID가 있으면 클라우드 우선 로드
            // [FIX] 클라우드 우선 로딩 - 최신 데이터 보장
            const tryCloudLoad = async () => {
                if (window.sim && window.sim.cloud) {
                    try {
                        await window.sim.cloud.loadProjectFromCloud(projectId);
                        console.log('Cloud load completed');
                    } catch (e) {
                        console.warn('Cloud load failed, falling back to local:', e);
                        // 클라우드 로드 실패 시에만 로컬에서 로드
                        if (localStorage.getItem(projectId)) {
                            this.loadProject(projectId);
                        }
                    }
                } else {
                    setTimeout(tryCloudLoad, 300);
                }
            };

            // Supabase가 없거나 로컬 전용 프로젝트인 경우
            if (!window.sb) {
                // 로컬 스토리지에서 로드
                if (localStorage.getItem(projectId)) {
                    this.loadProject(projectId);
                }
            } else {
                // 클라우드 우선 로드 시도
                tryCloudLoad();
            }
        }

        this.setMode('edit');
        this.setUserMode('easy');
    },

    confirmNewProject() {
        const nameInput = document.getElementById('new-proj-name');
        const widthInput = document.getElementById('new-proj-width');
        const heightInput = document.getElementById('new-proj-height');

        const name = nameInput?.value?.trim() || "Untitled Project";
        const w = widthInput ? parseInt(widthInput.value) || 3000 : 3000;
        const h = heightInput ? parseInt(heightInput.value) || 2000 : 2000;

        // 항상 전문가 모드로 설정
        if (this.setUserMode) {
            this.setUserMode('expert');
        } else {
            this.userMode = 'expert';
            document.body.classList.add('expert-mode');
        }

        if (typeof this.resizeCanvas === 'function') {
            this.resizeCanvas(w, h);
        }

        this.updateProjectName(name);

        const modal = document.getElementById('new-project-modal');
        if (modal) modal.classList.remove('show');
    },

    /**
     * 프로젝트 이름 업데이트 (UI 반영용 헬퍼)
     */
    updateProjectNameUI(name) {
        if (!name) return;
        const nameInput = document.getElementById('project-name-input');
        if (nameInput) {
            nameInput.value = name;
        }
    },

    /**
     * 프로젝트 이름 업데이트 (UI에서 호출 + Cloud 동기화)
     */
    updateProjectName(newName) {
        this.currentProjectName = newName || "Untitled Project";
        this.updateProjectNameUI(this.currentProjectName);

        // "Logic Sim"은 기본값이므로 저장 트리거 안 할 수도 있지만
        // 사용자가 명시적으로 입력했다면 저장해야 함.
        if (this.cloud) this.cloud.triggerAutoSave();
    },

    /**
     * 프로젝트 데이터를 JSON 객체로 반환 (중요: CloudManager에서 사용)
     */
    exportProjectData() {
        const componentsData = this.components.map(comp => {
            const data = {
                id: comp.id,
                type: comp.getAttribute('data-type'),
                x: parseFloat(comp.style.left),
                y: parseFloat(comp.style.top),
                value: comp.getAttribute('data-value'),
                // [FIX] 패키지인 경우 package-id도 저장
                packageId: comp.getAttribute('data-package-id'),
                width: parseFloat(comp.style.width) || null,
                height: parseFloat(comp.style.height) || null
            };

            if (comp.internals) {
                data.internals = {
                    components: comp.internals.components.map(c => ({
                        id: c.id,
                        type: c.getAttribute('data-type'),
                        x: parseFloat(c.style.left),
                        y: parseFloat(c.style.top),
                        value: c.getAttribute('data-value'),
                        label: c.querySelector('.comp-label')?.innerText
                    })),
                    wires: comp.internals.wires.map(w => ({
                        fromCompId: w.from.parentElement.id,
                        fromPinClass: w.from.classList[1],
                        toCompId: w.to.parentElement.id,
                        toPinClass: w.to.classList[1]
                    }))
                };
            }
            return data;
        });

        const wiresData = this.wires.map(wire => {
            const fromComp = wire.from.closest('.component');
            const toComp = wire.to.closest('.component');

            if (!fromComp || !toComp) return null;

            return {
                fromCompId: fromComp.id,
                fromPinClass: wire.from.classList[1],
                toCompId: toComp.id,
                toPinClass: wire.to.classList[1]
            };
        }).filter(w => w !== null);

        const projectData = {
            name: this.currentProjectName,
            lastModified: new Date().toLocaleString(),
            components: componentsData,
            wires: wiresData,
            packages: this.userPackages || []
        };

        if (this.currentThumbnail) {
            projectData.thumbnail = this.currentThumbnail;
            this.currentThumbnail = null;
        }

        return projectData;
    },

    /**
     * 로컬 스토리지에 저장
     */
    async captureThumbnail() {
        if (typeof html2canvas === 'undefined') return null;
        const workspace = document.getElementById('workspace');
        if (!workspace) return null;

        try {
            // 현재 화면에 보이는 부분만 캡처하기 위해 windowWidth 등을 제한하거나
            // 전체 캔버스를 축소 캡처
            // 워크스페이스가 6000px로 잡혀있어 메모리 부하가 클 수 있음 -> scale 대폭 축소
            // 또는 현재 뷰포트 중심의 스크린샷만 찍는 것이 나음 (simulator-container 기준)

            // 더 안전한 방법: simulator-container 캡처 (보이는 부분만)
            const container = document.querySelector('.workspace-wrapper');

            const canvas = await html2canvas(container || workspace, {
                scale: 0.5, // 해상도 50%
                logging: false,
                useCORS: true,
                ignoreElements: (el) => el.classList.contains('grid-layer') || el.classList.contains('component-ui')
            });

            return canvas.toDataURL('image/jpeg', 0.5); // JPEG 50% 품질
        } catch (e) {
            console.error('Thumbnail capture error:', e);
            return null;
        }
    },

    /**
     * 로컬 스토리지 및 클라우드 저장
     */
    async saveProject(silent = false) {
        if (!this.currentProjectId) return;

        // 명시적 저장(버튼 클릭)일 때만 썸네일 캡처 시도
        if (!silent) {
            try {
                this.currentThumbnail = await this.captureThumbnail();
            } catch (e) { console.warn('Thumbnail skipped'); }
        }

        const projectData = this.exportProjectData();
        localStorage.setItem(this.currentProjectId, JSON.stringify(projectData));

        let projectIndex = JSON.parse(localStorage.getItem('logic_sim_projects_index')) || [];
        if (!projectIndex.includes(this.currentProjectId)) {
            projectIndex.push(this.currentProjectId);
            localStorage.setItem('logic_sim_projects_index', JSON.stringify(projectIndex));
        }

        if (!silent) this.showToast(`✓ 프로젝트 저장됨`, 'success');

        const statusEl = document.getElementById('save-status');
        if (statusEl) {
            statusEl.textContent = '저장됨';
            statusEl.style.opacity = '1';
            setTimeout(() => { statusEl.style.opacity = '0'; }, 2000);
        }

        if (this.cloud) {
            // UI 블로킹 방지를 위해 비동기 호출
            this.cloud.saveProjectToCloud(this.currentProjectName, silent).catch(err => console.error(err));
        }
    },

    /**
     * 프로젝트 불러오기 (데이터 주입)
     */
    importProjectData(projectData) {
        if (!projectData) return;

        this.currentProjectName = projectData.name || "Untitled";
        this.updateProjectNameUI(this.currentProjectName); // UI 업데이트

        // 패키지 로드 (프로젝트 종속)
        this.userPackages = projectData.packages || [];
        if (this.updatePackageList) this.updatePackageList();

        this.components.forEach(c => c.remove());
        this.components = [];
        this.wires.forEach(w => w.line.remove());
        this.wires = [];
        this.wireLayer.innerHTML = '';

        const compMap = {};
        // 내장 패키지 타입 목록
        const builtInPackages = ['HALF_ADDER', 'FULL_ADDER', 'SR_LATCH', 'D_FLIPFLOP'];

        if (projectData.components) {
            projectData.components.forEach(cData => {
                let newComp;

                // [FIX] PACKAGE 타입 또는 내장 패키지 처리
                if (cData.type === 'PACKAGE' && cData.packageId !== null && cData.packageId !== undefined) {
                    // 사용자 정의 패키지 - userPackages에서 복원
                    const pkgIndex = parseInt(cData.packageId);
                    if (this.userPackages && this.userPackages[pkgIndex]) {
                        newComp = this.addUserPackage(pkgIndex);
                        if (newComp) {
                            newComp.style.left = cData.x + 'px';
                            newComp.style.top = cData.y + 'px';
                        }
                    } else {
                        // 패키지를 찾을 수 없으면 기본 모듈로 추가
                        this.addModule(cData.type, cData.x, cData.y);
                        newComp = this.components[this.components.length - 1];
                    }
                } else if (builtInPackages.includes(cData.type)) {
                    // 내장 패키지 (D_FLIPFLOP 등) - addPackage 함수 사용
                    if (this.addPackage) {
                        newComp = this.addPackage(cData.type);
                        if (newComp) {
                            newComp.style.left = cData.x + 'px';
                            newComp.style.top = cData.y + 'px';
                        }
                    } else {
                        // addPackage가 없으면 기본 모듈로 추가
                        this.addModule(cData.type, cData.x, cData.y);
                        newComp = this.components[this.components.length - 1];
                    }
                } else {
                    // 일반 컴포넌트
                    this.addModule(cData.type, cData.x, cData.y);
                    newComp = this.components[this.components.length - 1];
                }

                if (!newComp) return;

                newComp.id = cData.id;
                if (cData.value) newComp.setAttribute('data-value', cData.value);
                if (cData.packageId) newComp.setAttribute('data-package-id', cData.packageId);
                if (cData.width) newComp.style.width = cData.width + 'px';
                if (cData.height) newComp.style.height = cData.height + 'px';

                if (cData.type === 'SWITCH') {
                    const label = newComp.querySelector('.comp-label');
                    if (label) label.innerText = cData.value === '1' ? 'ON' : 'OFF';
                    // [FIX] background 스타일 대신 클래스 토글 (SVG 충돌 방지)
                    if (cData.value === '1') {
                        newComp.classList.add('switch-on');
                    } else {
                        newComp.classList.remove('switch-on');
                    }
                }

                compMap[cData.id] = newComp;

                if (cData.internals && this.restoreInternals) {
                    this.restoreInternals(newComp, cData.internals);
                }
            });
        }

        if (projectData.wires) {
            projectData.wires.forEach(wData => {
                const fromComp = compMap[wData.fromCompId];
                const toComp = compMap[wData.toCompId];

                if (fromComp && toComp) {
                    const fromPin = fromComp.querySelector(`.${wData.fromPinClass}`);
                    const toPin = toComp.querySelector(`.${wData.toPinClass}`);

                    if (fromPin && toPin) {
                        this.createWire(fromPin, toPin);
                    }
                }
            });
        }

        this.updateCircuit();
    },

    loadProject(projectId) {
        const json = localStorage.getItem(projectId);
        if (!json) {
            // 로컬에 없으면 조용히 리턴 (initProject에서 처리)
            return;
        }
        const projectData = JSON.parse(json);
        this.importProjectData(projectData);
        this.showToast(`✓ 프로젝트 불러옴: ${projectData.name}`, 'info');
    },

    exportProject() {
        const projectData = this.exportProjectData();
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (this.currentProjectName || 'circuit') + '.json';
        a.click();
        URL.revokeObjectURL(url);
    },

    generateTruthTable() {
        // ... (이전과 동일)
        const switches = this.components.filter(c => c.getAttribute('data-type') === 'SWITCH');
        const leds = this.components.filter(c => c.getAttribute('data-type') === 'LED');

        if (switches.length === 0 || leds.length === 0) {
            document.getElementById('truth-table-content').innerHTML = `
                <p style="color: var(--accent-yellow); text-align: center; padding: 40px;">
                    스위치와 LED가 필요합니다.<br>
                    회로를 먼저 구성해주세요.
                </p>
            `;
            return;
        }

        const numInputs = switches.length;
        const rows = Math.pow(2, numInputs);

        let html = '<table class="truth-table"><thead><tr>';
        switches.forEach((s, i) => {
            html += `<th>IN${i + 1}</th>`;
        });
        leds.forEach((l, i) => {
            html += `<th>OUT${i + 1}</th>`;
        });
        html += '</tr></thead><tbody>';

        const originalStates = switches.map(s => s.getAttribute('data-value'));

        for (let row = 0; row < rows; row++) {
            html += '<tr>';

            for (let i = 0; i < numInputs; i++) {
                const bit = (row >> (numInputs - 1 - i)) & 1;
                switches[i].setAttribute('data-value', bit ? '1' : '0');
                html += `<td class="val-${bit}">${bit}</td>`;
            }

            this.updateCircuit();

            leds.forEach(led => {
                const val = led.getAttribute('data-value') === '1' ? 1 : 0;
                html += `<td class="val-${val}">${val}</td>`;
            });

            html += '</tr>';
        }

        html += '</tbody></table>';

        switches.forEach((s, i) => {
            s.setAttribute('data-value', originalStates[i]);
        });
        this.updateCircuit();

        document.getElementById('truth-table-content').innerHTML = html;
    },

    exportTruthTable() {
        // ... (이전과 동일)
        const table = document.querySelector('#truth-table-content .truth-table');
        if (!table) {
            alert('먼저 진리표를 생성해주세요.');
            return;
        }

        let csv = '';
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            const rowData = Array.from(cells).map(c => c.textContent);
            csv += rowData.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'truth_table.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
});
