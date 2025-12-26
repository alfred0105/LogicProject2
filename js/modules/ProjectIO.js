/**
 * 모듈: 프로젝트 저장/로드 및 내보내기
 */
Object.assign(CircuitSimulator.prototype, {
    initProject() {
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('id');
        const isNew = params.get('new');

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

        if (isNew === 'true') {
            const modal = document.getElementById('new-project-modal');
            if (modal) modal.classList.add('show');
        } else if (projectId) {
            // URL 파라미터에 ID가 있으면 로컬 스토리지 또는 Cloud에서 로드 시도
            if (window.sim && window.sim.cloud && window.sim.cloud.loadProjectFromCloud) {
                // Supabase 로딩을 기다려야 할 수도 있음.
                // 1. 로컬 스토리지에 있으면 먼저 로드 (빠른 반응)
                if (localStorage.getItem(projectId)) {
                    this.loadProject(projectId);
                }

                // 2. 클라우드 로드 시도 (최신 데이터 동기화)
                // CloudManager가 로드되면 실행
                const tryCloudLoad = () => {
                    if (window.sim.cloud) {
                        window.sim.cloud.loadProjectFromCloud(projectId);
                    } else {
                        setTimeout(tryCloudLoad, 500);
                    }
                };
                tryCloudLoad();
            } else {
                this.loadProject(projectId);
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
                value: comp.getAttribute('data-value')
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

        return projectData;
    },

    /**
     * 로컬 스토리지에 저장
     */
    saveProject(silent = false) {
        if (!this.currentProjectId) return;

        const projectData = this.exportProjectData();
        localStorage.setItem(this.currentProjectId, JSON.stringify(projectData));

        let projectIndex = JSON.parse(localStorage.getItem('logic_sim_projects_index')) || [];
        if (!projectIndex.includes(this.currentProjectId)) {
            projectIndex.push(this.currentProjectId);
            localStorage.setItem('logic_sim_projects_index', JSON.stringify(projectIndex));
        }

        if (!silent) this.showToast(`✓ 프로젝트 저장됨 (로컬)`, 'success');

        // 클라우드 자동 저장 트리거
        if (this.cloud) this.cloud.triggerAutoSave();
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
        if (projectData.components) {
            projectData.components.forEach(cData => {
                this.addModule(cData.type, cData.x, cData.y);
                const newComp = this.components[this.components.length - 1];

                newComp.id = cData.id;
                if (cData.value) newComp.setAttribute('data-value', cData.value);

                if (cData.type === 'SWITCH') {
                    const label = newComp.querySelector('.comp-label');
                    if (label) label.innerText = cData.value === '1' ? 'ON' : 'OFF';
                    newComp.style.background = cData.value === '1' ? '#2ecc71' : '#27ae60';
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
                    ⚠️ 스위치와 LED가 필요합니다.<br>
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
