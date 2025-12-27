/**
 * 📚 Interactive Tutorial System for LoCAD
 * 게임 스타일 단계별 튜토리얼
 * - 터치스크린 지원
 * - 다음 튜토리얼 버튼
 * - 소자 드래그 단계 포함
 */

Object.assign(CircuitSimulator.prototype, {
    // 튜토리얼 상태
    tutorialActive: false,
    tutorialStep: 0,
    tutorialData: null,
    currentTutorialId: null,
    componentMoved: false,  // 소자 이동 감지용

    /**
     * 튜토리얼 순서 정의
     */
    tutorialOrder: ['basics', 'gates'],

    /**
     * 튜토리얼 목록 정의
     */
    tutorials: {
        'basics': {
            title: '시작하기: 첫 번째 회로',
            description: 'LoCAD의 기본 사용법을 배워봅시다!',
            nextTutorial: 'gates',
            steps: [
                {
                    title: '스위치 추가하기',
                    instruction: '왼쪽 사이드바에서 **스위치**를 클릭하거나 터치하여 캔버스에 추가하세요.',
                    highlight: '.comp-btn.io:first-child',
                    condition: () => window.sim?.components?.some(c => c.getAttribute('data-type') === 'SWITCH'),
                    position: 'right'
                },
                {
                    title: '소자 이동하기',
                    instruction: '방금 추가한 스위치를 **드래그**하여 원하는 위치로 이동해보세요. (터치: 길게 누른 후 이동)',
                    highlight: '#workspace',
                    condition: () => window.sim?.componentMoved === true,
                    position: 'center'
                },
                {
                    title: 'LED 추가하기',
                    instruction: '이제 **LED**를 추가해서 출력을 확인할 수 있게 해봅시다.',
                    highlight: '.comp-btn.io:nth-child(2)',
                    condition: () => window.sim?.components?.some(c => c.getAttribute('data-type') === 'LED'),
                    position: 'right'
                },
                {
                    title: '연결하기',
                    instruction: '스위치의 **출력 핀(오른쪽 점)**을 클릭/터치한 뒤, LED의 **입력 핀(왼쪽 점)**을 클릭/터치하여 연결하세요.',
                    highlight: '#workspace',
                    condition: () => window.sim?.wires?.length > 0,
                    position: 'center'
                },
                {
                    title: '스위치 작동시키기!',
                    instruction: '스위치를 **클릭/터치**하여 ON/OFF를 전환해보세요. LED가 켜지는지 확인하세요!',
                    highlight: null,
                    condition: () => {
                        const sw = window.sim?.components?.find(c => c.getAttribute('data-type') === 'SWITCH');
                        return sw && sw.getAttribute('data-value') === '1';
                    },
                    position: 'center'
                }
            ]
        },
        'gates': {
            title: 'AND 게이트 만들기',
            description: '논리 게이트를 사용해 봅시다!',
            nextTutorial: null,
            steps: [
                {
                    title: '스위치 2개 추가',
                    instruction: '**스위치 2개**를 캔버스에 추가하세요. 이것이 AND 게이트의 입력이 됩니다.',
                    highlight: '.comp-btn.io:first-child',
                    condition: () => window.sim?.components?.filter(c => c.getAttribute('data-type') === 'SWITCH').length >= 2,
                    position: 'right'
                },
                {
                    title: 'AND 게이트 추가',
                    instruction: '**논리 게이트** 섹션을 열고 **AND 게이트**를 추가하세요.',
                    highlight: '#sec-gates',
                    condition: () => window.sim?.components?.some(c => c.getAttribute('data-type') === 'AND'),
                    position: 'right'
                },
                {
                    title: 'LED 추가',
                    instruction: '출력을 확인할 **LED**를 추가하세요.',
                    highlight: '.comp-btn.io:nth-child(2)',
                    condition: () => window.sim?.components?.some(c => c.getAttribute('data-type') === 'LED'),
                    position: 'right'
                },
                {
                    title: '모두 연결하기',
                    instruction: '스위치 → AND 입력, AND 출력 → LED로 연결하세요. **(총 3개 와이어)**',
                    highlight: '#workspace',
                    condition: () => window.sim?.wires?.length >= 3,
                    position: 'center'
                },
                {
                    title: 'AND 게이트 테스트!',
                    instruction: '**두 스위치를 모두 ON**으로 해보세요. AND = 모든 입력 1 → 출력 1!',
                    highlight: null,
                    condition: () => {
                        const led = window.sim?.components?.find(c => c.getAttribute('data-type') === 'LED');
                        return led && led.getAttribute('data-value') === '1';
                    },
                    position: 'center'
                }
            ]
        }
    },

    /**
     * 튜토리얼 시작
     */
    startInteractiveTutorial(tutorialId) {
        const tutorial = this.tutorials[tutorialId];
        if (!tutorial) {
            this.showToast('알 수 없는 튜토리얼입니다', 'error');
            return;
        }

        // 프로젝트 이름을 "튜토리얼"로 고정
        const nameInput = document.getElementById('project-name-input');
        if (nameInput) {
            nameInput.value = '튜토리얼: ' + tutorial.title;
        }

        this.tutorialActive = true;
        this.tutorialStep = 0;
        this.tutorialData = tutorial;
        this.currentTutorialId = tutorialId;
        this.componentMoved = false;

        // 컴포넌트 이동 감지 이벤트 등록
        this.setupDragDetection();

        // 튜토리얼 UI 생성
        this.createTutorialUI();
        this.showTutorialStep();

        // 단계 완료 감지 시작
        this.startTutorialWatcher();
    },

    /**
     * 컴포넌트 드래그 감지 설정
     */
    setupDragDetection() {
        const self = this;
        const workspace = document.getElementById('workspace');
        if (!workspace) return;

        // 기존 리스너 제거 방지를 위한 플래그
        if (this._dragDetectionSetup) return;
        this._dragDetectionSetup = true;

        ['mouseup', 'touchend'].forEach(eventType => {
            workspace.addEventListener(eventType, function (e) {
                if (self.tutorialActive && self.isDragging) {
                    self.componentMoved = true;
                }
            }, { passive: true });
        });
    },

    /**
     * 튜토리얼 UI 생성
     */
    createTutorialUI() {
        // 기존 UI 제거
        const existing = document.getElementById('tutorial-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-spotlight"></div>
            <div class="tutorial-panel">
                <div class="tutorial-header">
                    <span class="tutorial-badge">🎮 튜토리얼</span>
                    <span class="tutorial-progress">1 / ${this.tutorialData.steps.length}</span>
                    <button class="tutorial-skip" onclick="sim.endTutorial()">건너뛰기 ✕</button>
                </div>
                <h3 class="tutorial-title"></h3>
                <p class="tutorial-instruction"></p>
                <div class="tutorial-footer">
                    <div class="tutorial-progress-bar">
                        <div class="tutorial-progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 터치 지원을 위한 터치 이벤트 패스스루
        overlay.addEventListener('touchstart', this.handleTutorialTouch.bind(this), { passive: false });

        // 스타일 추가
        if (!document.getElementById('tutorial-styles')) {
            const style = document.createElement('style');
            style.id = 'tutorial-styles';
            style.textContent = `
                #tutorial-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    pointer-events: none;
                    touch-action: none;
                }
                .tutorial-backdrop {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    pointer-events: auto;
                }
                .tutorial-spotlight {
                    position: absolute;
                    border-radius: 12px;
                    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
                    border: 3px solid #3b82f6;
                    transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
                    pointer-events: none;
                    animation: spotlightPulse 2s infinite;
                }
                @keyframes spotlightPulse {
                    0%, 100% { border-color: #3b82f6; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 20px rgba(59, 130, 246, 0.5); }
                    50% { border-color: #60a5fa; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 30px rgba(59, 130, 246, 0.8); }
                }
                .tutorial-panel {
                    position: fixed;
                    bottom: 32px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 90%;
                    max-width: 500px;
                    background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                    pointer-events: auto;
                    animation: tutorialSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    touch-action: auto;
                }
                @keyframes tutorialSlideUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(30px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                .tutorial-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .tutorial-badge {
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 700;
                    color: white;
                }
                .tutorial-progress {
                    font-size: 13px;
                    color: #94a3b8;
                }
                .tutorial-skip {
                    margin-left: auto;
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.2);
                    color: #94a3b8;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                    touch-action: manipulation;
                }
                .tutorial-skip:hover, .tutorial-skip:active {
                    border-color: #ef4444;
                    color: #ef4444;
                }
                .tutorial-title {
                    margin: 0 0 10px;
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: white;
                }
                .tutorial-instruction {
                    margin: 0;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #cbd5e1;
                }
                .tutorial-instruction strong {
                    color: #60a5fa;
                    font-weight: 600;
                }
                .tutorial-footer {
                    margin-top: 20px;
                }
                .tutorial-progress-bar {
                    height: 6px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .tutorial-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }
                .tutorial-complete {
                    text-align: center;
                    padding: 30px 20px;
                }
                .tutorial-complete h3 {
                    font-size: 1.5rem;
                    margin-bottom: 12px;
                    color: #4ade80;
                }
                .tutorial-complete p {
                    color: #94a3b8;
                    margin-bottom: 24px;
                }
                .tutorial-btn-group {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .tutorial-complete-btn {
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    border: none;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    touch-action: manipulation;
                }
                .tutorial-complete-btn:hover, .tutorial-complete-btn:active {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(34, 197, 94, 0.4);
                }
                .tutorial-next-btn {
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    border: none;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    touch-action: manipulation;
                }
                .tutorial-next-btn:hover, .tutorial-next-btn:active {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
                }
                
                /* 하이라이트된 요소는 클릭/터치 가능하게 */
                .tutorial-highlighted {
                    position: relative;
                    z-index: 10000 !important;
                    pointer-events: auto !important;
                    touch-action: auto !important;
                }
                
                /* 터치 피드백 */
                @media (pointer: coarse) {
                    .tutorial-skip, .tutorial-complete-btn, .tutorial-next-btn {
                        min-height: 44px;
                        min-width: 44px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    },

    /**
     * 터치 이벤트 처리 (하이라이트된 영역으로 터치 전달)
     */
    handleTutorialTouch(e) {
        const spotlight = document.querySelector('.tutorial-spotlight');
        if (!spotlight || spotlight.style.display === 'none') return;

        const touch = e.touches[0];
        const rect = spotlight.getBoundingClientRect();

        // 스포트라이트 영역 내에서 터치가 발생했는지 확인
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            // 터치를 하이라이트된 요소로 전달
            const highlighted = document.querySelector('.tutorial-highlighted');
            if (highlighted) {
                // 이벤트가 패널이 아닌 경우에만 통과
                if (!e.target.closest('.tutorial-panel')) {
                    // 터치 통과 허용
                }
            }
        }
    },

    /**
     * 현재 튜토리얼 단계 표시
     */
    showTutorialStep() {
        if (!this.tutorialActive || !this.tutorialData) return;

        const step = this.tutorialData.steps[this.tutorialStep];
        if (!step) {
            this.completeTutorial();
            return;
        }

        const panel = document.querySelector('.tutorial-panel');
        const spotlight = document.querySelector('.tutorial-spotlight');
        const backdrop = document.querySelector('.tutorial-backdrop');

        // 내용 업데이트
        panel.querySelector('.tutorial-progress').textContent =
            `${this.tutorialStep + 1} / ${this.tutorialData.steps.length}`;
        panel.querySelector('.tutorial-title').textContent = step.title;
        panel.querySelector('.tutorial-instruction').innerHTML =
            step.instruction.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // 프로그레스 바
        const progress = ((this.tutorialStep) / this.tutorialData.steps.length) * 100;
        panel.querySelector('.tutorial-progress-fill').style.width = progress + '%';

        // 하이라이트
        this.clearHighlight();

        if (step.highlight) {
            const target = document.querySelector(step.highlight);
            if (target) {
                const rect = target.getBoundingClientRect();
                spotlight.style.display = 'block';
                spotlight.style.left = (rect.left - 8) + 'px';
                spotlight.style.top = (rect.top - 8) + 'px';
                spotlight.style.width = (rect.width + 16) + 'px';
                spotlight.style.height = (rect.height + 16) + 'px';

                target.classList.add('tutorial-highlighted');
                backdrop.style.pointerEvents = 'none';
            }
        } else {
            spotlight.style.display = 'none';
            backdrop.style.pointerEvents = 'none';
        }
    },

    /**
     * 하이라이트 제거
     */
    clearHighlight() {
        document.querySelectorAll('.tutorial-highlighted').forEach(el => {
            el.classList.remove('tutorial-highlighted');
        });
    },

    /**
     * 단계 완료 감지 (폴링)
     */
    startTutorialWatcher() {
        if (this.tutorialWatcherId) {
            clearInterval(this.tutorialWatcherId);
        }

        this.tutorialWatcherId = setInterval(() => {
            if (!this.tutorialActive) {
                clearInterval(this.tutorialWatcherId);
                return;
            }

            const step = this.tutorialData.steps[this.tutorialStep];
            if (step && step.condition && step.condition()) {
                // 단계 완료!
                this.tutorialStep++;

                if (this.tutorialStep >= this.tutorialData.steps.length) {
                    this.completeTutorial();
                } else {
                    this.showToast('잘했어요! 다음 단계로...', 'success');
                    setTimeout(() => this.showTutorialStep(), 500);
                }
            }
        }, 500);
    },

    /**
     * 튜토리얼 완료
     */
    completeTutorial() {
        clearInterval(this.tutorialWatcherId);
        this.clearHighlight();

        const nextTutorial = this.tutorialData.nextTutorial;
        const nextTutorialData = nextTutorial ? this.tutorials[nextTutorial] : null;

        const panel = document.querySelector('.tutorial-panel');
        if (panel) {
            let buttonsHtml = `
                <button class="tutorial-complete-btn" onclick="sim.endTutorial()">
                    자유롭게 사용하기
                </button>
            `;

            if (nextTutorialData) {
                buttonsHtml += `
                    <button class="tutorial-next-btn" onclick="sim.goToNextTutorial('${nextTutorial}')">
                        다음: ${nextTutorialData.title} →
                    </button>
                `;
            }

            panel.innerHTML = `
                <div class="tutorial-complete">
                    <h3>튜토리얼 완료!</h3>
                    <p>${this.tutorialData.title}을(를) 성공적으로 완료했습니다!</p>
                    <div class="tutorial-btn-group">
                        ${buttonsHtml}
                    </div>
                </div>
            `;
        }
    },

    /**
     * 다음 튜토리얼로 이동
     */
    goToNextTutorial(tutorialId) {
        // 현재 회로 초기화
        if (this.components) {
            this.components.forEach(c => c.remove());
            this.components = [];
        }
        if (this.wires) {
            this.wires.forEach(w => w.line?.remove());
            this.wires = [];
        }

        // 상태 초기화
        this.componentMoved = false;

        // 다음 튜토리얼 시작
        this.startInteractiveTutorial(tutorialId);
    },

    /**
     * 튜토리얼 종료
     */
    endTutorial() {
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.tutorialData = null;
        this.currentTutorialId = null;

        clearInterval(this.tutorialWatcherId);
        this.clearHighlight();

        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';
            setTimeout(() => overlay.remove(), 300);
        }

        // 프로젝트 이름 리셋
        const nameInput = document.getElementById('project-name-input');
        if (nameInput && nameInput.value.startsWith('튜토리얼:')) {
            nameInput.value = '새 프로젝트';
        }

        this.showToast('튜토리얼을 종료했습니다. 자유롭게 회로를 설계해보세요!', 'info');
    }
});

// URL 파라미터로 튜토리얼 자동 시작
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        const tutorialId = params.get('tutorial');
        if (tutorialId && window.sim && window.sim.tutorials[tutorialId]) {
            window.sim.startInteractiveTutorial(tutorialId);
        }
    }, 1000);
});
