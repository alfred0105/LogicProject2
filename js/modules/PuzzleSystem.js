/**
 * 모듈: 퍼즐 모드 (Challenge/Puzzle System)
 * 제한된 부품으로 목표 회로를 만드는 교육용 게임
 */
Object.assign(CircuitSimulator.prototype, {

    /**
     * 퍼즐 시스템 초기화
     */
    initPuzzleSystem() {
        this.puzzleData = {
            currentPuzzle: null,
            puzzles: this.getBuiltInPuzzles(),
            userSolutions: this.loadUserSolutions(),
            isActive: false
        };

        this.createPuzzlePanel();
    },

    /**
     * 기본 제공 퍼즐들
     */
    getBuiltInPuzzles() {
        return [
            // 레벨 1: 기초
            {
                id: 'xor_from_nand',
                title: 'NAND로 XOR 만들기',
                description: 'NAND 게이트만 사용해서 XOR 게이트를 구현하세요.',
                difficulty: 'easy',
                category: 'basic',
                constraints: {
                    allowedComponents: ['NAND'],
                    maxComponents: 4,
                    inputs: ['A', 'B'],
                    outputs: ['Y']
                },
                truthTable: [
                    { inputs: [0, 0], outputs: [0] },
                    { inputs: [0, 1], outputs: [1] },
                    { inputs: [1, 0], outputs: [1] },
                    { inputs: [1, 1], outputs: [0] }
                ],
                hints: [
                    'XOR = (A NAND (A NAND B)) NAND (B NAND (A NAND B))',
                    'NAND 4개로 충분합니다',
                    '먼저 A NAND B를 만들어 보세요'
                ],
                reward: { stars: 3, xp: 100 }
            },
            {
                id: 'and_from_nand',
                title: 'NAND로 AND 만들기',
                description: 'NAND 게이트만 사용해서 AND 게이트를 구현하세요.',
                difficulty: 'easy',
                category: 'basic',
                constraints: {
                    allowedComponents: ['NAND'],
                    maxComponents: 2,
                    inputs: ['A', 'B'],
                    outputs: ['Y']
                },
                truthTable: [
                    { inputs: [0, 0], outputs: [0] },
                    { inputs: [0, 1], outputs: [0] },
                    { inputs: [1, 0], outputs: [0] },
                    { inputs: [1, 1], outputs: [1] }
                ],
                hints: [
                    'AND = NOT(A NAND B)',
                    'NAND를 NOT으로 사용하려면 두 입력을 연결하세요'
                ],
                reward: { stars: 3, xp: 50 }
            },
            {
                id: 'or_from_nand',
                title: 'NAND로 OR 만들기',
                description: 'NAND 게이트만 사용해서 OR 게이트를 구현하세요.',
                difficulty: 'easy',
                category: 'basic',
                constraints: {
                    allowedComponents: ['NAND'],
                    maxComponents: 3,
                    inputs: ['A', 'B'],
                    outputs: ['Y']
                },
                truthTable: [
                    { inputs: [0, 0], outputs: [0] },
                    { inputs: [0, 1], outputs: [1] },
                    { inputs: [1, 0], outputs: [1] },
                    { inputs: [1, 1], outputs: [1] }
                ],
                hints: [
                    'OR = (A NAND A) NAND (B NAND B)',
                    '먼저 NOT A와 NOT B를 만드세요'
                ],
                reward: { stars: 3, xp: 75 }
            },

            // 레벨 2: 중급
            {
                id: 'half_adder',
                title: '반가산기 만들기',
                description: '1비트 반가산기를 구현하세요. Sum과 Carry 출력이 필요합니다.',
                difficulty: 'medium',
                category: 'arithmetic',
                constraints: {
                    allowedComponents: ['AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR'],
                    maxComponents: 5,
                    inputs: ['A', 'B'],
                    outputs: ['Sum', 'Carry']
                },
                truthTable: [
                    { inputs: [0, 0], outputs: [0, 0] },
                    { inputs: [0, 1], outputs: [1, 0] },
                    { inputs: [1, 0], outputs: [1, 0] },
                    { inputs: [1, 1], outputs: [0, 1] }
                ],
                hints: [
                    'Sum = A XOR B',
                    'Carry = A AND B',
                    '최소 2개의 게이트로 가능합니다'
                ],
                reward: { stars: 3, xp: 150 }
            },
            {
                id: 'multiplexer_2to1',
                title: '2:1 멀티플렉서',
                description: 'Sel=0이면 A를, Sel=1이면 B를 출력하는 멀티플렉서를 만드세요.',
                difficulty: 'medium',
                category: 'combinational',
                constraints: {
                    allowedComponents: ['AND', 'OR', 'NOT', 'NAND', 'NOR'],
                    maxComponents: 4,
                    inputs: ['A', 'B', 'Sel'],
                    outputs: ['Y']
                },
                truthTable: [
                    { inputs: [0, 0, 0], outputs: [0] },
                    { inputs: [0, 1, 0], outputs: [0] },
                    { inputs: [1, 0, 0], outputs: [1] },
                    { inputs: [1, 1, 0], outputs: [1] },
                    { inputs: [0, 0, 1], outputs: [0] },
                    { inputs: [0, 1, 1], outputs: [1] },
                    { inputs: [1, 0, 1], outputs: [0] },
                    { inputs: [1, 1, 1], outputs: [1] }
                ],
                hints: [
                    'Y = (A AND NOT Sel) OR (B AND Sel)',
                    'AND-OR 구조를 사용하세요'
                ],
                reward: { stars: 3, xp: 200 }
            },

            // 레벨 3: 고급
            {
                id: 'full_adder',
                title: '전가산기 만들기',
                description: 'Carry In을 포함한 1비트 전가산기를 구현하세요.',
                difficulty: 'hard',
                category: 'arithmetic',
                constraints: {
                    allowedComponents: ['AND', 'OR', 'XOR', 'NOT', 'NAND'],
                    maxComponents: 9,
                    inputs: ['A', 'B', 'Cin'],
                    outputs: ['Sum', 'Cout']
                },
                truthTable: [
                    { inputs: [0, 0, 0], outputs: [0, 0] },
                    { inputs: [0, 0, 1], outputs: [1, 0] },
                    { inputs: [0, 1, 0], outputs: [1, 0] },
                    { inputs: [0, 1, 1], outputs: [0, 1] },
                    { inputs: [1, 0, 0], outputs: [1, 0] },
                    { inputs: [1, 0, 1], outputs: [0, 1] },
                    { inputs: [1, 1, 0], outputs: [0, 1] },
                    { inputs: [1, 1, 1], outputs: [1, 1] }
                ],
                hints: [
                    'Sum = A XOR B XOR Cin',
                    'Cout = (A AND B) OR (Cin AND (A XOR B))',
                    '반가산기 2개를 연결하면 됩니다'
                ],
                reward: { stars: 3, xp: 300 }
            },
            {
                id: 'sr_latch',
                title: 'SR 래치 만들기',
                description: 'NOR 또는 NAND 게이트로 SR 래치를 구현하세요.',
                difficulty: 'hard',
                category: 'sequential',
                constraints: {
                    allowedComponents: ['NOR', 'NAND'],
                    maxComponents: 2,
                    inputs: ['S', 'R'],
                    outputs: ['Q', 'Qbar']
                },
                truthTable: 'sequential',  // 순차 회로 (별도 검증)
                hints: [
                    'NOR 래치: Q = NOR(R, Qbar), Qbar = NOR(S, Q)',
                    '두 NOR 게이트의 출력을 서로의 입력에 연결하세요',
                    '피드백 루프가 핵심입니다'
                ],
                reward: { stars: 3, xp: 400 }
            }
        ];
    },

    /**
     * 사용자 솔루션 저장/불러오기
     */
    loadUserSolutions() {
        try {
            return JSON.parse(localStorage.getItem('locad_puzzle_solutions') || '{}');
        } catch {
            return {};
        }
    },

    saveUserSolution(puzzleId, solution) {
        this.puzzleData.userSolutions[puzzleId] = solution;
        localStorage.setItem('locad_puzzle_solutions', JSON.stringify(this.puzzleData.userSolutions));
    },

    /**
     * 퍼즐 패널 UI 생성
     */
    createPuzzlePanel() {
        this.puzzlePanel = document.createElement('div');
        this.puzzlePanel.id = 'puzzle-panel';
        this.puzzlePanel.innerHTML = `
            <div class="puzzle-sidebar">
                <div class="puzzle-header">
                    <h2>🧩 퍼즐 모드</h2>
                    <button id="puzzle-close-btn" class="puzzle-close">✕</button>
                </div>
                <div class="puzzle-categories">
                    <button class="category-btn active" data-category="all">전체</button>
                    <button class="category-btn" data-category="basic">기초</button>
                    <button class="category-btn" data-category="arithmetic">산술</button>
                    <button class="category-btn" data-category="combinational">조합</button>
                    <button class="category-btn" data-category="sequential">순차</button>
                </div>
                <div class="puzzle-list" id="puzzle-list"></div>
            </div>
            <div class="puzzle-detail" id="puzzle-detail">
                <div class="puzzle-welcome">
                    <div class="puzzle-icon">🎮</div>
                    <h3>퍼즐을 선택하세요</h3>
                    <p>제한된 부품으로 목표 회로를 만들어보세요!</p>
                </div>
            </div>
        `;

        this.puzzlePanel.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-base, #050505);
            z-index: 3000;
            display: none;
            font-family: 'Inter', sans-serif;
        `;

        document.body.appendChild(this.puzzlePanel);

        // 이벤트 바인딩
        this.puzzlePanel.querySelector('#puzzle-close-btn').addEventListener('click', () => this.hidePuzzlePanel());

        this.puzzlePanel.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.puzzlePanel.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderPuzzleList(e.target.getAttribute('data-category'));
            });
        });

        this.addPuzzleStyles();
        this.renderPuzzleList('all');
    },

    /**
     * 퍼즐 스타일
     */
    addPuzzleStyles() {
        const style = document.createElement('style');
        style.id = 'puzzle-system-styles';
        style.textContent = `
            #puzzle-panel {
                display: flex;
            }

            #puzzle-panel .puzzle-sidebar {
                width: 320px;
                background: var(--bg-surface, #0a0a0a);
                border-right: 1px solid var(--border-default, rgba(255, 255, 255, 0.12));
                display: flex;
                flex-direction: column;
            }

            #puzzle-panel .puzzle-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                background: var(--bg-elevated, #111111);
            }

            #puzzle-panel .puzzle-header h2 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary, #e2e2e2);
            }

            #puzzle-panel .puzzle-close {
                background: var(--bg-active, #1a1a1a);
                border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                color: var(--text-secondary, #a1a1aa);
                width: 32px;
                height: 32px;
                border-radius: var(--radius-sm, 6px);
                cursor: pointer;
                font-size: 14px;
                transition: all var(--duration-fast, 150ms);
            }

            #puzzle-panel .puzzle-close:hover {
                background: var(--accent-red, #ef4444);
                border-color: var(--accent-red, #ef4444);
                color: white;
            }

            #puzzle-panel .puzzle-categories {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 12px 16px;
                border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
            }

            #puzzle-panel .category-btn {
                background: var(--bg-active, #1a1a1a);
                border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                color: var(--text-secondary, #a1a1aa);
                padding: 6px 12px;
                border-radius: var(--radius-md, 8px);
                font-size: 11px;
                cursor: pointer;
                transition: all var(--duration-fast, 150ms);
            }

            #puzzle-panel .category-btn:hover {
                background: var(--bg-hover, #1f1f1f);
                border-color: var(--border-default, rgba(255, 255, 255, 0.12));
            }

            #puzzle-panel .category-btn.active {
                background: var(--accent-blue, #3b82f6);
                border-color: var(--accent-blue, #3b82f6);
                color: white;
            }

            #puzzle-panel .puzzle-list {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }

            #puzzle-panel .puzzle-card {
                background: var(--bg-elevated, #111111);
                border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                border-radius: var(--radius-md, 8px);
                padding: 14px;
                margin-bottom: 10px;
                cursor: pointer;
                transition: all var(--duration-fast, 150ms) var(--ease-out);
            }

            #puzzle-panel .puzzle-card:hover {
                background: var(--bg-hover, #1f1f1f);
                border-color: var(--accent-blue, #3b82f6);
            }

            #puzzle-panel .puzzle-card.completed {
                border-color: var(--accent-green, #10b981);
            }

            #puzzle-panel .puzzle-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            #puzzle-panel .puzzle-card-title {
                font-size: 13px;
                font-weight: 600;
                color: var(--text-primary, #e2e2e2);
            }

            #puzzle-panel .puzzle-card-difficulty {
                font-size: 10px;
                padding: 2px 8px;
                border-radius: var(--radius-xs, 4px);
                font-weight: 600;
            }

            #puzzle-panel .puzzle-card-difficulty.easy {
                background: var(--accent-green, #10b981);
                color: white;
            }

            #puzzle-panel .puzzle-card-difficulty.medium {
                background: var(--accent-orange, #f59e0b);
                color: white;
            }

            #puzzle-panel .puzzle-card-difficulty.hard {
                background: var(--accent-red, #ef4444);
                color: white;
            }

            #puzzle-panel .puzzle-card-desc {
                font-size: 11px;
                color: var(--text-secondary, #a1a1aa);
                line-height: 1.5;
            }

            #puzzle-panel .puzzle-card-stars {
                margin-top: 8px;
                color: var(--accent-orange, #f59e0b);
                font-size: 12px;
            }

            #puzzle-panel .puzzle-detail {
                flex: 1;
                padding: 40px;
                overflow-y: auto;
            }

            #puzzle-panel .puzzle-welcome {
                text-align: center;
                padding: 80px 40px;
            }

            #puzzle-panel .puzzle-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }

            #puzzle-panel .puzzle-welcome h3 {
                color: white;
                font-size: 24px;
                margin-bottom: 12px;
            }

            #puzzle-panel .puzzle-welcome p {
                color: rgba(255, 255, 255, 0.6);
                font-size: 14px;
            }

            #puzzle-panel .puzzle-info {
                max-width: 600px;
            }

            #puzzle-panel .puzzle-info h2 {
                color: white;
                font-size: 28px;
                margin-bottom: 16px;
            }

            #puzzle-panel .puzzle-info-desc {
                color: rgba(255, 255, 255, 0.7);
                font-size: 15px;
                line-height: 1.6;
                margin-bottom: 24px;
            }

            #puzzle-panel .puzzle-constraints {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 24px;
            }

            #puzzle-panel .puzzle-constraints h4 {
                color: white;
                font-size: 14px;
                margin-bottom: 12px;
            }

            #puzzle-panel .constraint-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            #puzzle-panel .constraint-tag {
                background: rgba(102, 126, 234, 0.2);
                color: #667eea;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 12px;
            }

            #puzzle-panel .truth-table {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
                overflow: hidden;
                margin-bottom: 24px;
            }

            #puzzle-panel .truth-table h4 {
                color: white;
                font-size: 14px;
                padding: 12px 16px;
                background: rgba(255, 255, 255, 0.05);
            }

            #puzzle-panel .truth-table table {
                width: 100%;
                border-collapse: collapse;
            }

            #puzzle-panel .truth-table th,
            #puzzle-panel .truth-table td {
                padding: 8px 16px;
                text-align: center;
                font-size: 13px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            #puzzle-panel .truth-table th {
                color: rgba(255, 255, 255, 0.6);
                font-weight: 600;
            }

            #puzzle-panel .truth-table td {
                color: white;
                font-family: 'Consolas', monospace;
            }

            #puzzle-panel .puzzle-actions {
                display: flex;
                gap: 12px;
            }

            #puzzle-panel .puzzle-btn {
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            #puzzle-panel .puzzle-btn.primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                color: white;
            }

            #puzzle-panel .puzzle-btn.primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
            }

            #puzzle-panel .puzzle-btn.secondary {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
            }

            #puzzle-panel .hints-section {
                margin-top: 24px;
            }

            #puzzle-panel .hint-btn {
                background: rgba(251, 191, 36, 0.1);
                border: 1px solid rgba(251, 191, 36, 0.3);
                color: #fbbf24;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                margin-right: 8px;
                margin-bottom: 8px;
            }

            #puzzle-panel .hint-content {
                background: rgba(251, 191, 36, 0.1);
                border-radius: 8px;
                padding: 12px 16px;
                color: #fbbf24;
                font-size: 13px;
                margin-top: 12px;
                display: none;
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * 퍼즐 목록 렌더링
     */
    renderPuzzleList(category) {
        const list = this.puzzlePanel.querySelector('#puzzle-list');
        const puzzles = category === 'all'
            ? this.puzzleData.puzzles
            : this.puzzleData.puzzles.filter(p => p.category === category);

        list.innerHTML = puzzles.map(puzzle => {
            const completed = this.puzzleData.userSolutions[puzzle.id];
            const stars = completed ? '⭐'.repeat(completed.stars) : '☆☆☆';

            return `
                <div class="puzzle-card ${completed ? 'completed' : ''}" data-puzzle-id="${puzzle.id}">
                    <div class="puzzle-card-header">
                        <span class="puzzle-card-title">${puzzle.title}</span>
                        <span class="puzzle-card-difficulty ${puzzle.difficulty}">${puzzle.difficulty === 'easy' ? '쉬움' :
                    puzzle.difficulty === 'medium' ? '보통' : '어려움'
                }</span>
                    </div>
                    <div class="puzzle-card-desc">${puzzle.description}</div>
                    <div class="puzzle-card-stars">${stars}</div>
                </div>
            `;
        }).join('');

        // 클릭 이벤트
        list.querySelectorAll('.puzzle-card').forEach(card => {
            card.addEventListener('click', () => {
                const puzzleId = card.getAttribute('data-puzzle-id');
                this.showPuzzleDetail(puzzleId);
            });
        });
    },

    /**
     * 퍼즐 상세 표시
     */
    showPuzzleDetail(puzzleId) {
        const puzzle = this.puzzleData.puzzles.find(p => p.id === puzzleId);
        if (!puzzle) return;

        const detail = this.puzzlePanel.querySelector('#puzzle-detail');

        let truthTableHTML = '';
        if (puzzle.truthTable !== 'sequential') {
            const inputs = puzzle.constraints.inputs;
            const outputs = puzzle.constraints.outputs;

            truthTableHTML = `
                <div class="truth-table">
                    <h4>진리표 (Truth Table)</h4>
                    <table>
                        <thead>
                            <tr>
                                ${inputs.map(i => `<th>${i}</th>`).join('')}
                                <th>→</th>
                                ${outputs.map(o => `<th>${o}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${puzzle.truthTable.map(row => `
                                <tr>
                                    ${row.inputs.map(v => `<td>${v}</td>`).join('')}
                                    <td></td>
                                    ${row.outputs.map(v => `<td>${v}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        detail.innerHTML = `
            <div class="puzzle-info">
                <h2>${puzzle.title}</h2>
                <p class="puzzle-info-desc">${puzzle.description}</p>
                
                <div class="puzzle-constraints">
                    <h4>🔧 제약 조건</h4>
                    <div class="constraint-list">
                        <span class="constraint-tag">허용 부품: ${puzzle.constraints.allowedComponents.join(', ')}</span>
                        <span class="constraint-tag">최대 ${puzzle.constraints.maxComponents}개</span>
                        <span class="constraint-tag">입력: ${puzzle.constraints.inputs.join(', ')}</span>
                        <span class="constraint-tag">출력: ${puzzle.constraints.outputs.join(', ')}</span>
                    </div>
                </div>

                ${truthTableHTML}

                <div class="puzzle-actions">
                    <button class="puzzle-btn primary" id="start-puzzle-btn">🎮 도전 시작</button>
                    <button class="puzzle-btn secondary" id="show-hints-btn">💡 힌트 보기</button>
                </div>

                <div class="hints-section">
                    ${puzzle.hints.map((hint, i) => `
                        <button class="hint-btn" data-hint="${i}">힌트 ${i + 1}</button>
                    `).join('')}
                    <div class="hint-content" id="hint-content"></div>
                </div>
            </div>
        `;

        // 이벤트 바인딩
        detail.querySelector('#start-puzzle-btn').addEventListener('click', () => {
            this.startPuzzle(puzzle);
        });

        detail.querySelectorAll('.hint-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const hintIndex = parseInt(btn.getAttribute('data-hint'));
                const hintContent = detail.querySelector('#hint-content');
                hintContent.textContent = puzzle.hints[hintIndex];
                hintContent.style.display = 'block';
            });
        });
    },

    /**
     * 퍼즐 시작
     */
    startPuzzle(puzzle) {
        this.puzzleData.currentPuzzle = puzzle;
        this.puzzleData.isActive = true;
        this.hidePuzzlePanel();

        // 캔버스 초기화 (모든 컴포넌트/와이어 삭제)
        this.components.slice().forEach(comp => {
            if (comp && comp.parentElement) comp.remove();
        });
        this.components = [];
        this.wires.forEach(wire => {
            if (wire.path && wire.path.parentElement) wire.path.remove();
        });
        this.wires = [];
        this.selectedComponents = [];

        // 입력 스위치 자동 배치
        puzzle.constraints.inputs.forEach((inputName, i) => {
            const sw = this.addModule('SWITCH', 100, 100 + i * 80);
            if (sw) {
                const label = sw.querySelector('.comp-label');
                if (label) label.textContent = inputName;
                sw.setAttribute('data-puzzle-input', inputName);
            }
        });

        // 출력 LED 자동 배치
        puzzle.constraints.outputs.forEach((outputName, i) => {
            const led = this.addModule('LED', 500, 100 + i * 80);
            if (led) {
                led.setAttribute('data-puzzle-output', outputName);
                // LED 위에 라벨 추가
                const labelDiv = document.createElement('div');
                labelDiv.className = 'puzzle-output-label';
                labelDiv.textContent = outputName;
                labelDiv.style.cssText = `
                    position: absolute;
                    top: -20px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 12px;
                    font-weight: bold;
                    color: white;
                    background: rgba(0,0,0,0.5);
                    padding: 2px 6px;
                    border-radius: 4px;
                `;
                led.appendChild(labelDiv);
            }
        });

        // 퍼즐 모드 UI 표시
        this.showPuzzleModeUI(puzzle);
        this.showToast(`퍼즐 시작: ${puzzle.title}`, 'info');
    },

    /**
     * 퍼즐 모드 UI
     */
    showPuzzleModeUI(puzzle) {
        // 상단 바
        const puzzleBar = document.createElement('div');
        puzzleBar.id = 'puzzle-mode-bar';
        puzzleBar.innerHTML = `
            <div class="puzzle-bar-left">
                <span class="puzzle-bar-icon">🧩</span>
                <span class="puzzle-bar-title">${puzzle.title}</span>
            </div>
            <div class="puzzle-bar-center">
                <span class="puzzle-allowed">허용: ${puzzle.constraints.allowedComponents.join(', ')}</span>
                <span class="puzzle-count" id="puzzle-comp-count">사용: 0 / ${puzzle.constraints.maxComponents}</span>
            </div>
            <div class="puzzle-bar-right">
                <button id="puzzle-verify-btn" class="puzzle-verify-btn">✓ 검증</button>
                <button id="puzzle-quit-btn" class="puzzle-quit-btn">✕ 포기</button>
            </div>
        `;
        puzzleBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 50px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            z-index: 2500;
            font-family: 'Inter', sans-serif;
            color: white;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        document.body.appendChild(puzzleBar);

        // 스타일 추가
        const style = document.createElement('style');
        style.id = 'puzzle-mode-styles';
        style.textContent = `
            #puzzle-mode-bar .puzzle-bar-left {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            #puzzle-mode-bar .puzzle-bar-icon { font-size: 20px; }
            #puzzle-mode-bar .puzzle-bar-title { font-weight: 600; font-size: 14px; }
            #puzzle-mode-bar .puzzle-bar-center {
                display: flex;
                gap: 20px;
                font-size: 12px;
            }
            #puzzle-mode-bar .puzzle-allowed { opacity: 0.8; }
            #puzzle-mode-bar .puzzle-count { font-weight: 600; }
            #puzzle-mode-bar .puzzle-verify-btn {
                background: rgba(255
                ,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.4);
                color: white;
                padding: 8px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                margin-right: 10px;
            }
            #puzzle-mode-bar .puzzle-quit-btn {
                background: rgba(239, 68, 68, 0.3);
                border: 1px solid rgba(239, 68, 68, 0.5);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);

        // 이벤트
        document.getElementById('puzzle-verify-btn').addEventListener('click', () => this.verifyPuzzle());
        document.getElementById('puzzle-quit-btn').addEventListener('click', () => this.quitPuzzle());
    },

    /**
     * 퍼즐 검증
     */
    verifyPuzzle() {
        const puzzle = this.puzzleData.currentPuzzle;
        if (!puzzle) return;

        // 사용된 컴포넌트 수 확인
        const usedCount = this.components.filter(c => {
            const type = c.getAttribute('data-type');
            return !['SWITCH', 'LED'].includes(type);
        }).length;

        if (usedCount > puzzle.constraints.maxComponents) {
            this.showToast(`❌ 너무 많은 부품 사용 (${usedCount}/${puzzle.constraints.maxComponents})`, 'error');
            return;
        }

        // 허용된 부품만 사용했는지 확인
        const invalidComps = this.components.filter(c => {
            const type = c.getAttribute('data-type');
            return !['SWITCH', 'LED'].includes(type) &&
                !puzzle.constraints.allowedComponents.includes(type);
        });

        if (invalidComps.length > 0) {
            this.showToast('❌ 허용되지 않은 부품이 사용되었습니다', 'error');
            return;
        }

        // 진리표 검증
        if (puzzle.truthTable === 'sequential') {
            this.showToast('순차 회로는 수동 검증이 필요합니다', 'info');
            return;
        }

        let allPassed = true;
        const inputSwitches = this.components.filter(c => c.hasAttribute('data-puzzle-input'));
        const outputLEDs = this.components.filter(c => c.hasAttribute('data-puzzle-output'));

        for (const row of puzzle.truthTable) {
            // 입력 설정
            row.inputs.forEach((val, i) => {
                if (inputSwitches[i]) {
                    inputSwitches[i].setAttribute('data-value', val ? '1' : '0');
                }
            });

            // 회로 업데이트 (여러 번 반복하여 안정화)
            for (let i = 0; i < 20; i++) {
                this.updateCircuit();
            }

            // 출력 확인
            row.outputs.forEach((expected, i) => {
                if (outputLEDs[i]) {
                    const actual = outputLEDs[i].getAttribute('data-value') === '1' ? 1 : 0;
                    if (actual !== expected) {
                        allPassed = false;
                    }
                }
            });

            if (!allPassed) break;
        }

        if (allPassed) {
            this.puzzleSuccess(puzzle, usedCount);
        } else {
            this.showToast('❌ 진리표가 일치하지 않습니다. 다시 확인해보세요.', 'error');
        }
    },

    /**
     * 퍼즐 성공
     */
    puzzleSuccess(puzzle, usedCount) {
        // 별점 계산 (사용한 부품 수에 따라)
        let stars = 1;
        if (usedCount <= puzzle.constraints.maxComponents * 0.5) stars = 3;
        else if (usedCount <= puzzle.constraints.maxComponents * 0.75) stars = 2;

        // 저장
        this.saveUserSolution(puzzle.id, { stars, usedCount, timestamp: Date.now() });

        // 성공 모달
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:4000;">
                <div style="background:linear-gradient(135deg,#1a1a2e,#0f0f1a);padding:40px;border-radius:20px;text-align:center;max-width:400px;">
                    <div style="font-size:64px;margin-bottom:20px;">🎉</div>
                    <h2 style="color:white;margin-bottom:10px;">퍼즐 완료!</h2>
                    <p style="color:rgba(255,255,255,0.7);margin-bottom:20px;">${puzzle.title}</p>
                    <div style="font-size:32px;color:#fbbf24;margin-bottom:20px;">${'⭐'.repeat(stars)}</div>
                    <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:30px;">
                        사용한 부품: ${usedCount}개<br>
                        획득 XP: ${puzzle.reward.xp}
                    </p>
                    <button id="puzzle-success-close" style="background:linear-gradient(135deg,#667eea,#764ba2);
                        border:none;color:white;padding:12px 30px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
                        계속하기
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#puzzle-success-close').addEventListener('click', () => {
            modal.remove();
            this.quitPuzzle();
            this.showPuzzlePanel();
        });
    },

    /**
     * 퍼즐 포기
     */
    quitPuzzle() {
        this.puzzleData.currentPuzzle = null;
        this.puzzleData.isActive = false;

        // UI 제거
        const bar = document.getElementById('puzzle-mode-bar');
        if (bar) bar.remove();
        const styles = document.getElementById('puzzle-mode-styles');
        if (styles) styles.remove();

        // 캔버스 초기화 (모든 컴포넌트/와이어 삭제)
        this.components.slice().forEach(comp => {
            if (comp && comp.parentElement) comp.remove();
        });
        this.components = [];
        this.wires.forEach(wire => {
            if (wire.path && wire.path.parentElement) wire.path.remove();
        });
        this.wires = [];
        this.selectedComponents = [];
    },

    /**
     * 퍼즐 패널 표시/숨기기
     */
    showPuzzlePanel() {
        this.puzzlePanel.style.display = 'flex';
    },

    hidePuzzlePanel() {
        this.puzzlePanel.style.display = 'none';
    }
});
