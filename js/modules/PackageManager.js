/**
 * 모듈: 패키지 시스템 (Package, Module, Sub-circuits)
 */
Object.assign(CircuitSimulator.prototype, {
    addPackage(pkgType) {
        const pkgDefs = {
            'HALF_ADDER': {
                label: 'HA',
                name: 'Half Adder',
                description: '반가산기(Half Adder)는 두 개의 1비트 이진수를 더하는 조합 논리 회로입니다. XOR 게이트로 합(Sum)을, AND 게이트로 자리올림(Carry)을 계산합니다.',
                inputs: ['A', 'B'],
                outputs: ['S', 'C'],
                color: '#16a085',
                circuit: {
                    components: [
                        { id: 'xor1', type: 'XOR', x: 60, y: 20, label: 'XOR' },
                        { id: 'and1', type: 'AND', x: 60, y: 80, label: 'AND' },
                        { id: 'in_a', type: 'PORT_IN', x: 10, y: 30, label: 'A' },
                        { id: 'in_b', type: 'PORT_IN', x: 10, y: 70, label: 'B' },
                        { id: 'out_s', type: 'PORT_OUT', x: 140, y: 30, label: 'S' },
                        { id: 'out_c', type: 'PORT_OUT', x: 140, y: 90, label: 'C' }
                    ],
                    wires: [
                        { from: 'in_a', fromPin: 'out', to: 'xor1', toPin: 'in-1' },
                        { from: 'in_b', fromPin: 'out', to: 'xor1', toPin: 'in-2' },
                        { from: 'in_a', fromPin: 'out', to: 'and1', toPin: 'in-1' },
                        { from: 'in_b', fromPin: 'out', to: 'and1', toPin: 'in-2' },
                        { from: 'xor1', fromPin: 'out', to: 'out_s', toPin: 'in' },
                        { from: 'and1', fromPin: 'out', to: 'out_c', toPin: 'in' }
                    ]
                },
                logic: (inputs) => {
                    const a = inputs[0], b = inputs[1];
                    return { S: a !== b ? 1 : 0, C: (a && b) ? 1 : 0 };
                }
            },
            'FULL_ADDER': {
                label: 'FA',
                name: 'Full Adder',
                description: '전가산기(Full Adder)는 두 개의 1비트 이진수와 이전 자리올림(Carry In)을 더하는 조합 논리 회로입니다. 두 개의 반가산기를 연결하여 구성됩니다.',
                inputs: ['A', 'B', 'Cin'],
                outputs: ['S', 'Cout'],
                color: '#27ae60',
                circuit: {
                    components: [
                        { id: 'xor1', type: 'XOR', x: 50, y: 20, label: 'XOR1' },
                        { id: 'xor2', type: 'XOR', x: 120, y: 30, label: 'XOR2' },
                        { id: 'and1', type: 'AND', x: 50, y: 80, label: 'AND1' },
                        { id: 'and2', type: 'AND', x: 120, y: 100, label: 'AND2' },
                        { id: 'or1', type: 'OR', x: 190, y: 90, label: 'OR' },
                        { id: 'in_a', type: 'PORT_IN', x: 10, y: 20, label: 'A' },
                        { id: 'in_b', type: 'PORT_IN', x: 10, y: 60, label: 'B' },
                        { id: 'in_cin', type: 'PORT_IN', x: 10, y: 100, label: 'Cin' },
                        { id: 'out_s', type: 'PORT_OUT', x: 200, y: 30, label: 'S' },
                        { id: 'out_cout', type: 'PORT_OUT', x: 260, y: 90, label: 'Cout' }
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
                },
                logic: (inputs) => {
                    const a = inputs[0], b = inputs[1], cin = inputs[2];
                    const sum = (a ? 1 : 0) + (b ? 1 : 0) + (cin ? 1 : 0);
                    return { S: sum % 2, Cout: sum >= 2 ? 1 : 0 };
                }
            },
            'SR_LATCH': {
                label: 'SR',
                name: 'SR Latch',
                description: 'SR 래치는 Set(S)와 Reset(R) 두 입력을 갖는 가장 기본적인 기억 소자입니다. 크로스-커플 NOR 게이트로 구성되며, 1비트를 저장할 수 있습니다.',
                inputs: ['S', 'R'],
                outputs: ['Q', 'Q̅'],
                color: '#2980b9',
                circuit: {
                    components: [
                        { id: 'nor1', type: 'NOR', x: 60, y: 20, label: 'NOR1' },
                        { id: 'nor2', type: 'NOR', x: 60, y: 80, label: 'NOR2' },
                        { id: 'in_s', type: 'PORT_IN', x: 10, y: 20, label: 'S' },
                        { id: 'in_r', type: 'PORT_IN', x: 10, y: 80, label: 'R' },
                        { id: 'out_q', type: 'PORT_OUT', x: 140, y: 20, label: 'Q' },
                        { id: 'out_qn', type: 'PORT_OUT', x: 140, y: 80, label: 'Q̅' }
                    ],
                    wires: [
                        { from: 'in_s', fromPin: 'out', to: 'nor1', toPin: 'in-1' },
                        { from: 'nor2', fromPin: 'out', to: 'nor1', toPin: 'in-2' },
                        { from: 'in_r', fromPin: 'out', to: 'nor2', toPin: 'in-2' },
                        { from: 'nor1', fromPin: 'out', to: 'nor2', toPin: 'in-1' },
                        { from: 'nor1', fromPin: 'out', to: 'out_q', toPin: 'in' },
                        { from: 'nor2', fromPin: 'out', to: 'out_qn', toPin: 'in' }
                    ]
                },
                logic: (inputs, state) => ({ Q: state?.Q || 0, 'Q̅': state?.['Q̅'] || 1 })
            },
            'D_FLIPFLOP': {
                label: 'DFF',
                name: 'D Flip-Flop',
                description: 'D 플립플롭은 클럭 신호의 상승 에지에서 D 입력을 Q 출력으로 전달하는 에지 트리거 기억 소자입니다. 데이터 래치라고도 불리며, 순차 회로의 기본 구성 요소입니다.',
                inputs: ['D', 'CLK'],
                outputs: ['Q', 'Q̅'],
                color: '#8e44ad',
                circuit: {
                    components: [
                        // D Flip-Flop은 NAND 게이트 6개로 구현
                        { id: 'nand1', type: 'NAND', x: 40, y: 20, label: 'NAND1' },
                        { id: 'nand2', type: 'NAND', x: 40, y: 80, label: 'NAND2' },
                        { id: 'nand3', type: 'NAND', x: 100, y: 20, label: 'NAND3' },
                        { id: 'nand4', type: 'NAND', x: 100, y: 80, label: 'NAND4' },
                        { id: 'nand5', type: 'NAND', x: 160, y: 30, label: 'NAND5' },
                        { id: 'nand6', type: 'NAND', x: 160, y: 70, label: 'NAND6' },
                        { id: 'not1', type: 'NOT', x: 10, y: 80, label: 'NOT' },
                        { id: 'in_d', type: 'PORT_IN', x: 5, y: 20, label: 'D' },
                        { id: 'in_clk', type: 'PORT_IN', x: 5, y: 50, label: 'CLK' },
                        { id: 'out_q', type: 'PORT_OUT', x: 220, y: 30, label: 'Q' },
                        { id: 'out_qn', type: 'PORT_OUT', x: 220, y: 70, label: 'Q̅' }
                    ],
                    wires: [
                        { from: 'in_d', fromPin: 'out', to: 'nand1', toPin: 'in-1' },
                        { from: 'in_d', fromPin: 'out', to: 'not1', toPin: 'in' },
                        { from: 'in_clk', fromPin: 'out', to: 'nand1', toPin: 'in-2' },
                        { from: 'in_clk', fromPin: 'out', to: 'nand2', toPin: 'in-1' },
                        { from: 'not1', fromPin: 'out', to: 'nand2', toPin: 'in-2' },
                        { from: 'nand1', fromPin: 'out', to: 'nand3', toPin: 'in-1' },
                        { from: 'nand4', fromPin: 'out', to: 'nand3', toPin: 'in-2' },
                        { from: 'nand3', fromPin: 'out', to: 'nand4', toPin: 'in-1' },
                        { from: 'nand2', fromPin: 'out', to: 'nand4', toPin: 'in-2' },
                        { from: 'nand3', fromPin: 'out', to: 'nand5', toPin: 'in-1' },
                        { from: 'nand6', fromPin: 'out', to: 'nand5', toPin: 'in-2' },
                        { from: 'nand5', fromPin: 'out', to: 'nand6', toPin: 'in-1' },
                        { from: 'nand4', fromPin: 'out', to: 'nand6', toPin: 'in-2' },
                        { from: 'nand5', fromPin: 'out', to: 'out_q', toPin: 'in' },
                        { from: 'nand6', fromPin: 'out', to: 'out_qn', toPin: 'in' }
                    ]
                },
                logic: (inputs, state) => {
                    return { Q: state?.Q || 0, 'Q̅': state?.Q ? 0 : 1 };
                }
            }
        };

        const pkg = pkgDefs[pkgType];
        if (!pkg) {
            alert('알 수 없는 패키지: ' + pkgType);
            return;
        }

        const el = document.createElement('div');
        el.classList.add('component', 'package-comp');
        el.id = 'pkg_' + Date.now() + Math.random().toString(36).substr(2, 5);
        el.setAttribute('data-type', pkgType);
        el.setAttribute('data-value', '0');

        el.onmouseenter = () => this.showTooltip(pkg.name);
        el.onmouseleave = () => this.hideTooltip();

        el.onmousedown = (e) => this.handleComponentMouseDown(e, el);

        el.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.selectedComponents.includes(el)) {
                this.selectComponent(el, false);
            }
            this.showContextMenu(e.clientX, e.clientY);
        };

        const label = document.createElement('div');
        label.classList.add('comp-label');
        label.innerText = pkg.label;
        el.appendChild(label);

        const inputCount = pkg.inputs.length;
        const outputCount = pkg.outputs.length;
        const height = Math.max(inputCount, outputCount) * 30 + 30;

        const scale = this.scale || 1.0;
        const panX = this.panX || 0;
        const panY = this.panY || 0;
        const spawnX = (-panX + 300) / scale;
        const spawnY = (-panY + 200) / scale;

        el.style.left = spawnX + 'px';
        el.style.top = spawnY + 'px';
        el.style.width = '90px';
        el.style.height = height + 'px';

        // 입력 핀 및 라벨 추가
        pkg.inputs.forEach((inLabel, i) => {
            const spacing = height / (inputCount + 1);
            const topPos = spacing * (i + 1);
            this.addPin(el, `in-${i + 1}`, `input left`, topPos);

            // 핀 라벨 추가
            const pinLabel = document.createElement('span');
            pinLabel.className = 'pin-label left';
            pinLabel.textContent = inLabel;
            pinLabel.style.top = topPos + 'px';
            el.appendChild(pinLabel);
        });

        // 출력 핀 및 라벨 추가
        pkg.outputs.forEach((outLabel, i) => {
            const spacing = height / (outputCount + 1);
            const topPos = spacing * (i + 1);
            this.addPin(el, `out-${i + 1}`, `output right`, topPos);

            // 핀 라벨 추가
            const pinLabel = document.createElement('span');
            pinLabel.className = 'pin-label right';
            pinLabel.textContent = outLabel;
            pinLabel.style.top = topPos + 'px';
            el.appendChild(pinLabel);
        });

        // 더블클릭 시 모듈 편집기 열기
        el.ondblclick = (e) => {
            e.stopPropagation();
            if (this.openModuleEditor) {
                this.openModuleEditor(el);
            }
        };

        // 우클릭 시 컨텍스트 메뉴 표시
        el.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.showModuleContextMenu) {
                this.showModuleContextMenu(e, el);
            }
        };

        if (this.workspace) {
            this.workspace.appendChild(el);
            this.components.push(el);
        }

        this.saveState();
        return el;
    },

    openPackageDesigner() {
        // 회로 데이터 구성
        let minX = Infinity, minY = Infinity;
        const internalWires = [];
        const internalComps = [];
        const externalInputs = [];
        const externalOutputs = [];

        // 선택된 영역의 최소 좌표 찾기 (정규화)
        this.selectedComponents.forEach(c => {
            const x = parseFloat(c.style.left);
            const y = parseFloat(c.style.top);
            if (x < minX) minX = x;
            if (y < minY) minY = y;
        });

        // 선택된 컴포넌트 내의 전선만 필터링
        this.wires.forEach(w => {
            const fromComp = w.from.closest('.component');
            const toComp = w.to.closest('.component');
            if (this.selectedComponents.includes(fromComp) && this.selectedComponents.includes(toComp)) {
                internalWires.push({
                    fromId: fromComp.id,
                    toId: toComp.id,
                    fromPin: w.from.classList[1], // 클래스 이름으로 핀 식별
                    toPin: w.to.classList[1]
                });
            }
        });

        const circuitData = {
            components: this.selectedComponents.map(c => ({
                id: c.id,
                type: c.getAttribute('data-type'),
                value: c.getAttribute('data-value') || '0',
                x: parseFloat(c.style.left) - minX,
                y: parseFloat(c.style.top) - minY,
                width: parseFloat(c.style.width) || 80,
                height: parseFloat(c.style.height) || 56
            })),
            wires: internalWires,
            inputs: externalInputs,
            outputs: externalOutputs
        };

        const designerWindow = window.open(
            'package-designer.html',
            'PackageDesigner',
            'width=1200,height=800,menubar=no,toolbar=no,location=no'
        );

        const self = this;
        const messageHandler = (event) => {
            if (event.data.type === 'DESIGNER_READY') {
                setTimeout(() => {
                    designerWindow.postMessage({
                        type: 'CIRCUIT_DATA',
                        data: circuitData
                    }, '*');
                }, 100);
            } else if (event.data.type === 'PACKAGE_CREATED') {
                self.onPackageCreated(event.data.data);
                window.removeEventListener('message', messageHandler);
            }
        };
        window.addEventListener('message', messageHandler);
    },

    onPackageCreated(pkgData) {
        this.userPackages.push(pkgData);
        this.saveUserPackages();
        this.updatePackageList();
        this.showToast(`패키지 "${pkgData.name}"가 생성되었습니다!`, 'success');
    },

    loadUserPackages() {
        try {
            const saved = localStorage.getItem('logic_sim_user_packages');
            if (saved) {
                this.userPackages = JSON.parse(saved);
                console.log(`✅ ${this.userPackages.length}개의 사용자 패키지 로드됨`);
                setTimeout(() => this.updatePackageList(), 0);
            }
        } catch (e) {
            console.warn('패키지 로드 실패:', e);
            this.userPackages = [];
        }
    },

    saveUserPackages() {
        try {
            const serializable = this.userPackages.map(pkg => ({
                name: pkg.name,
                desc: pkg.desc || '',
                inputs: pkg.inputs,
                outputs: pkg.outputs,
                width: pkg.width,
                height: pkg.height,
                circuit: pkg.circuit ? {
                    components: pkg.circuit.components,
                    wires: pkg.circuit.wires?.map(w => ({
                        fromId: w.fromId,
                        toId: w.toId,
                        fromPin: w.fromPin,
                        toPin: w.toPin
                    })) || []
                } : null
            }));
            localStorage.setItem('logic_sim_user_packages', JSON.stringify(serializable));
            console.log(`💾 ${this.userPackages.length}개의 패키지 저장됨`);
        } catch (e) {
            console.warn('패키지 저장 실패:', e);
        }
    },

    updatePackageList() {
        const container = document.getElementById('user-packages');
        if (!container) return;

        if (this.userPackages.length === 0) {
            container.innerHTML = '';
        } else {
            container.innerHTML = this.userPackages.map((pkg, i) =>
                `<div class="package-item">
                    <button class="comp-btn package wide" onclick="sim.addUserPackage(${i})" 
                        onmouseenter="sim.showTooltip('PACKAGE'); sim.positionTooltip(event)"
                        onmouseleave="sim.hideTooltip()">
                        <div class="icon"><svg><use href="#icon-package" /></svg></div>
                        <span class="name">${pkg.name}</span>
                        <span class="pkg-info">${pkg.inputs.length}→${pkg.outputs.length}</span>
                    </button>
                    <button class="pkg-delete-btn" onclick="event.stopPropagation(); sim.deleteUserPackage(${i})" title="모듈 삭제">×</button>
                </div>`
            ).join('');
        }
    },

    /**
     * 사용자 패키지 삭제
     */
    deleteUserPackage(index) {
        if (!this.userPackages || !this.userPackages[index]) return;

        const pkg = this.userPackages[index];
        const confirmed = confirm(`"${pkg.name}" 모듈을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);

        if (confirmed) {
            this.userPackages.splice(index, 1);
            this.saveUserPackages();
            this.updatePackageList();
            this.showToast(`🗑️ "${pkg.name}" 모듈이 삭제되었습니다`, 'info');
        }
    },

    addUserPackage(index) {
        const pkg = this.userPackages[index];
        if (!pkg) return;

        const scale = this.scale || 1.0;
        const panX = this.panX || 0;
        const panY = this.panY || 0;
        const x = (-panX + 300) / scale;
        const y = (-panY + 200) / scale;

        const el = document.createElement('div');
        el.className = 'component module package-component';
        el.setAttribute('data-type', 'PACKAGE');
        el.setAttribute('data-package-id', String(index));
        el.setAttribute('data-value', '0');
        el.id = 'pkg_' + Date.now() + Math.random().toString(36).substr(2, 5);

        const inputCount = pkg.inputs?.length || 0;
        const outputCount = pkg.outputs?.length || 0;
        const maxPins = Math.max(inputCount, outputCount, 1);
        const width = Math.max(120, pkg.width || 120);
        const height = Math.max(80, maxPins * 30 + 40);

        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = width + 'px';
        el.style.height = height + 'px';
        el.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        el.style.border = '2px solid rgba(255,255,255,0.3)';
        el.style.borderRadius = '8px';
        el.style.position = 'absolute';
        el.style.cursor = 'move';
        el.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';

        const label = document.createElement('div');
        label.className = 'comp-label';
        label.innerText = pkg.name || 'Package';
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        label.style.color = 'white';
        label.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
        el.appendChild(label);

        // 실제로 사용할 높이 (사용자 지정 또는 자동 계산)
        const actualHeight = pkg.height || height;

        if (pkg.inputs && pkg.inputs.length > 0) {
            const inputSpacing = actualHeight / (pkg.inputs.length + 1);
            pkg.inputs.forEach((input, i) => {
                const topPos = inputSpacing * (i + 1);
                this.addPin(el, `in-${i + 1}`, `input left`, topPos);

                // 핀 라벨 추가
                const pinLabel = document.createElement('span');
                pinLabel.className = 'pin-label left';
                pinLabel.textContent = input;
                pinLabel.style.top = topPos + 'px';
                el.appendChild(pinLabel);
            });
        }

        if (pkg.outputs && pkg.outputs.length > 0) {
            const outputSpacing = actualHeight / (pkg.outputs.length + 1);
            pkg.outputs.forEach((output, i) => {
                const topPos = outputSpacing * (i + 1);
                this.addPin(el, `out-${i + 1}`, `output right`, topPos);

                // 핀 라벨 추가
                const pinLabel = document.createElement('span');
                pinLabel.className = 'pin-label right';
                pinLabel.textContent = output;
                pinLabel.style.top = topPos + 'px';
                el.appendChild(pinLabel);
            });
        }

        el.onmousedown = (e) => this.handleComponentMouseDown(e, el);
        el.onmouseenter = () => this.showTooltip('PACKAGE');
        el.onmouseleave = () => this.hideTooltip();

        // 더블클릭 시 모듈 편집기 열기
        el.ondblclick = (e) => {
            e.stopPropagation();
            if (this.openModuleEditor) {
                this.openModuleEditor(el);
            }
        };

        // 우클릭 시 컨텍스트 메뉴 표시 (모듈 편집 포함)
        el.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.showModuleContextMenu) {
                this.showModuleContextMenu(e, el);
            }
        };

        // package-comp 클래스 추가 (모듈 편집 인식용)
        el.classList.add('package-comp');

        if (this.workspace) {
            this.workspace.appendChild(el);
            this.components.push(el);
        }

        this.saveState();
        return el;
    },

    // 색상 어둡게 (간단 버전)
    darkenColorSimple(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    },

    // 패키지 내부 회로 빌드
    buildPackageInternals(parentComp, pkg) {
        if (!pkg.circuit) return null;

        const internals = { components: [], wires: [] };
        const idMap = {};

        pkg.circuit.components.forEach(part => {
            const el = document.createElement('div');
            el.classList.add('component');
            el.id = parentComp.id + '_' + part.id;
            el.setAttribute('data-type', part.type);
            el.setAttribute('data-value', '0');
            el.style.left = part.x + 'px';
            el.style.top = part.y + 'px';

            const label = document.createElement('div');
            label.classList.add('comp-label');
            label.innerText = part.label || part.type;
            el.appendChild(label);

            // 핀 추가
            if (['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(part.type)) {
                this.addPin(el, 'in-1', 'input in-1');
                this.addPin(el, 'in-2', 'input in-2');
                this.addPin(el, 'out', 'output center');
            } else if (part.type === 'NOT') {
                this.addPin(el, 'in-1', 'input center');
                this.addPin(el, 'out', 'output center');
            } else if (part.type === 'PORT_IN') {
                this.addPin(el, 'out', 'output center');
            } else if (part.type === 'PORT_OUT') {
                this.addPin(el, 'in', 'input center');
            }

            idMap[part.id] = el;
            internals.components.push(el);
        });

        // 와이어 생성 (line SVG 요소 포함)
        pkg.circuit.wires.forEach(wire => {
            const fromEl = idMap[wire.from];
            const toEl = idMap[wire.to];
            if (fromEl && toEl) {
                const fromPin = fromEl.querySelector(`.${wire.fromPin}`) || fromEl.querySelector('.output') || fromEl.querySelector('.out');
                const toPin = toEl.querySelector(`.${wire.toPin}`) || toEl.querySelector('.input') || toEl.querySelector('.in');
                if (fromPin && toPin) {
                    // SVG 라인 요소 생성
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    line.setAttribute('stroke', '#64748b');
                    line.setAttribute('stroke-width', '2');
                    line.setAttribute('fill', 'none');
                    internals.wires.push({ from: fromPin, to: toPin, fromEl, toEl, line });
                }
            }
        });

        return internals;
    },

    // 기본 스키매틱 내부 회로 빌드
    buildInternals(parentComp, schematic) {
        parentComp.internals = { components: [], wires: [] };
        const idMap = {};

        schematic.parts.forEach(part => {
            const el = document.createElement('div');
            el.classList.add('component');
            el.id = parentComp.id + '_' + part.id;
            el.setAttribute('data-type', part.type);
            el.setAttribute('data-value', '0');
            el.style.left = part.x + 'px';
            el.style.top = part.y + 'px';

            const label = document.createElement('div');
            label.classList.add('comp-label');
            label.innerText = part.label || part.type;
            el.appendChild(label);

            const type = part.type;
            if (type === 'TRANSISTOR' || type === 'PMOS') {
                this.addPin(el, 'base', 'input base');
                this.addPin(el, 'col', 'input col');
                this.addPin(el, 'emit', 'output emit');
            } else if (type === 'VCC' || type === 'GND' || type === 'PORT_IN') {
                if (type === 'VCC') el.setAttribute('data-value', '1');
                if (type === 'GND') el.setAttribute('data-value', '0');
                this.addPin(el, 'out', 'output center');
            } else if (type === 'PORT_OUT') {
                this.addPin(el, 'in', 'input center');
            }

            if (part.id) idMap[part.id] = el;
            parentComp.internals.components.push(el);
        });

        // Wires
        schematic.wires.forEach(w => {
            const [fromId, fromPinCls] = w.from.split('.');
            const [toId, toPinCls] = w.to.split('.');

            const fromComp = idMap[fromId];
            const toComp = idMap[toId];

            if (fromComp && toComp) {
                const fromPin = fromComp.querySelector('.' + fromPinCls);
                const toPin = toComp.querySelector('.' + toPinCls);
                if (fromPin && toPin) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    parentComp.internals.wires.push({ from: fromPin, to: toPin, line: line });
                }
            }
        });
    },

    // 컴포넌트 내부로 진입 (보기 전용)
    enterComponent(comp) {
        if (!this.internalModal || !this.internalWorkspace) {
            console.log('Internal editor not available in this layout');
            alert('내부 구조 보기 기능은 현재 사용할 수 없습니다.');
            return;
        }

        if (!comp.internals) {
            comp.internals = { components: [], wires: [] };
        }

        // 1. Save Current State (Main Scope)
        this.scopeStack.push({
            components: this.components,
            wires: this.wires,
            scopeComp: this.currentScopeComp,
            panX: this.panX,
            panY: this.panY,
            scale: this.scale
        });

        // 2. Switch Context to Internal Editor (View-Only Mode)
        this.internalModal.style.display = 'flex';
        this.workspace = this.internalWorkspace;
        this.wireLayer = this.internalWireLayer;

        const compType = comp.getAttribute('data-type');
        if (this.internalTitle) {
            this.internalTitle.innerText = `🔍 ${compType} 내부 구조 (보기 전용)`;
        }

        this.currentScopeComp = comp;
        this.components = comp.internals.components;
        this.wires = comp.internals.wires;

        // 3. Render Internals (Clone for view-only to prevent accidental edits)
        if (this.workspace) {
            this.components.forEach(c => {
                c.style.pointerEvents = 'none';
                this.workspace.appendChild(c);
            });
        }
        if (this.wireLayer) {
            this.wires.forEach(w => this.wireLayer.appendChild(w.line));
        }

        // 4. Reset View for Editor
        this.panX = 0;
        this.panY = 0;
        this.scale = 1.0;
        this.updateTransform();

        // Hide Main Selection Box if active
        if (this.selectionBox) this.selectionBox.style.display = 'none';
    },

    // 컴포넌트 내부에서 나가기
    exitComponent() {
        if (this.scopeStack.length === 0) return;

        // 1. Detach Internals (Save to memory object)
        this.components.forEach(c => c.remove());
        this.wires.forEach(w => w.line.remove());

        // 2. Restore Parent State
        const savedState = this.scopeStack.pop();

        this.components = savedState.components;
        this.wires = savedState.wires;

        // 3. Restore Context
        if (this.internalModal) this.internalModal.style.display = 'none';
        this.workspace = this.mainWorkspace;
        this.wireLayer = this.mainWireLayer;

        this.panX = savedState.panX;
        this.panY = savedState.panY;
        this.scale = savedState.scale;

        // Restore `currentScopeComp`
        this.currentScopeComp = savedState.scopeComp;

        // Re-append components and wires to the main workspace/wireLayer
        if (this.workspace) {
            this.components.forEach(comp => {
                this.workspace.appendChild(comp);
            });
        }
        if (this.wireLayer) {
            this.wires.forEach(wire => {
                this.wireLayer.appendChild(wire.line);
            });
        }

        this.updateTransform();

        // Update UI - Hide Back Button if no more parents
        if (this.scopeStack.length === 0) {
            const backBtn = document.getElementById('btn-back-parent');
            if (backBtn) backBtn.style.display = 'none';
        }
    },

    // 패키지 생성 (선택된 컴포넌트들을 모듈로 변환)
    createPackage() {
        if (this.selectedComponents.length === 0) {
            alert('패키지로 만들 부품들을 먼저 선택해주세요.\n(Ctrl+클릭 또는 드래그로 다중 선택)');
            return;
        }

        // 1. 선택된 컴포넌트들의 ID 수집
        const selectedIds = new Set(this.selectedComponents.map(c => c.id));

        // 2. 내부/외부 전선 분류
        const internalWires = [];
        const externalInputs = [];
        const externalOutputs = [];

        this.wires.forEach(wire => {
            const fromComp = wire.from.closest('.component');
            const toComp = wire.to.closest('.component');
            const fromId = fromComp?.id;
            const toId = toComp?.id;
            const fromInside = selectedIds.has(fromId);
            const toInside = selectedIds.has(toId);

            if (fromInside && toInside) {
                internalWires.push({ fromId, toId, fromPin: wire.from.className, toPin: wire.to.className });
            } else if (!fromInside && toInside) {
                externalInputs.push({ targetId: toId, targetPin: wire.to.className, label: `IN${externalInputs.length + 1}` });
            } else if (fromInside && !toInside) {
                externalOutputs.push({ sourceId: fromId, sourcePin: wire.from.className, label: `OUT${externalOutputs.length + 1}` });
            }
        });

        // 3. 위치 정규화
        let minX = Infinity, minY = Infinity;
        this.selectedComponents.forEach(c => {
            minX = Math.min(minX, parseFloat(c.style.left));
            minY = Math.min(minY, parseFloat(c.style.top));
        });

        // 4. 회로 데이터 구성
        const circuitData = {
            components: this.selectedComponents.map(c => ({
                id: c.id,
                type: c.getAttribute('data-type'),
                value: c.getAttribute('data-value') || '0',
                x: parseFloat(c.style.left) - minX,
                y: parseFloat(c.style.top) - minY,
                width: parseFloat(c.style.width) || 80,
                height: parseFloat(c.style.height) || 56
            })),
            wires: internalWires,
            inputs: externalInputs,
            outputs: externalOutputs
        };

        // 5. 패키지 디자이너 창 열기
        const designerWindow = window.open(
            'package-designer.html',
            'PackageDesigner',
            'width=1200,height=800,menubar=no,toolbar=no,location=no'
        );

        // 6. 메시지 핸들러 설정
        const self = this;
        const messageHandler = (event) => {
            if (event.data.type === 'DESIGNER_READY') {
                setTimeout(() => {
                    designerWindow.postMessage({
                        type: 'CIRCUIT_DATA',
                        data: circuitData
                    }, '*');
                }, 100);
            } else if (event.data.type === 'PACKAGE_CREATED') {
                self.onPackageCreated(event.data.data);
                window.removeEventListener('message', messageHandler);
            }
        };
        window.addEventListener('message', messageHandler);
    }
});
