/**
 * 모듈: 타이밍 다이어그램 (Timing Diagram)
 * 여러 신호의 시간에 따른 변화를 시각화
 * 글리치 감지 및 스텝 실행 지원
 */
Object.assign(CircuitSimulator.prototype, {

    /**
     * 타이밍 분석기 초기화
     */
    initTimingAnalyzer() {
        this.timingData = {
            signals: [],          // 추적할 신호들 { name, component, pin, history: [] }
            maxSamples: 200,      // 최대 샘플 수
            sampleCount: 0,       // 현재 샘플 수
            timePerSample: 50,    // 샘플당 시간 (ms)
            isRecording: false,   // 녹화 중
            isPaused: false,      // 일시정지
            glitches: []          // 감지된 글리치들
        };

        this.createTimingPanel();
        console.log('[TimingAnalyzer] Initialized');
    },

    /**
     * 타이밍 패널 UI 생성
     */
    createTimingPanel() {
        // 메인 패널
        this.timingPanel = document.createElement('div');
        this.timingPanel.id = 'timing-panel';
        this.timingPanel.innerHTML = `
            <div class="timing-header">
                <div class="timing-title">
                    <span class="timing-icon">📊</span>
                    <span>타이밍 다이어그램</span>
                </div>
                <div class="timing-controls">
                    <button id="timing-record-btn" class="timing-btn" title="녹화 시작/중지">
                        <span class="record-dot">●</span> REC
                    </button>
                    <button id="timing-pause-btn" class="timing-btn" title="일시정지">
                        ⏸️ PAUSE
                    </button>
                    <button id="timing-step-btn" class="timing-btn" title="스텝 실행">
                        ⏭️ STEP
                    </button>
                    <button id="timing-clear-btn" class="timing-btn" title="초기화">
                        🗑️ CLEAR
                    </button>
                    <button id="timing-close-btn" class="timing-btn close" title="닫기">✕</button>
                </div>
            </div>
            <div class="timing-body">
                <div class="timing-signals">
                    <div class="signals-header">
                        <span>신호 추적</span>
                        <button id="add-signal-btn" class="add-signal-btn" title="신호 추가">+ 추가</button>
                    </div>
                    <div id="signal-list" class="signal-list">
                        <div class="empty-signals">추적할 신호가 없습니다.<br>컴포넌트를 우클릭하여 '타이밍 추적' 선택</div>
                    </div>
                </div>
                <div class="timing-canvas-container">
                    <canvas id="timing-canvas"></canvas>
                    <div class="timing-cursor"></div>
                    <div class="timing-scale">
                        <span class="timing-time">0ms</span>
                        <span class="timing-time" style="left: 25%">2.5s</span>
                        <span class="timing-time" style="left: 50%">5s</span>
                        <span class="timing-time" style="left: 75%">7.5s</span>
                        <span class="timing-time" style="right: 0">10s</span>
                    </div>
                </div>
            </div>
            <div class="timing-footer">
                <div class="glitch-indicator">
                    <span class="glitch-icon">⚡</span>
                    <span id="glitch-count">글리치: 0개</span>
                </div>
                <div class="timing-info">
                    <span id="sample-count">샘플: 0/200</span>
                </div>
            </div>
        `;

        this.timingPanel.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 300px;
            background: var(--bg-surface, #0a0a0a);
            border-top: 1px solid var(--accent-blue, #3b82f6);
            z-index: 2000;
            display: none;
            flex-direction: column;
            font-family: 'Inter', sans-serif;
            transform: translateY(100%);
            transition: transform var(--duration-normal, 250ms) var(--ease-out);
        `;

        document.body.appendChild(this.timingPanel);

        // 캔버스 설정
        this.timingCanvas = this.timingPanel.querySelector('#timing-canvas');
        const container = this.timingPanel.querySelector('.timing-canvas-container');
        this.timingCanvas.width = 800;
        this.timingCanvas.height = 200;
        this.timingCtx = this.timingCanvas.getContext('2d');

        // 이벤트 바인딩
        this.timingPanel.querySelector('#timing-record-btn').addEventListener('click', () => this.toggleTimingRecord());
        this.timingPanel.querySelector('#timing-pause-btn').addEventListener('click', () => this.toggleTimingPause());
        this.timingPanel.querySelector('#timing-step-btn').addEventListener('click', () => this.stepTiming());
        this.timingPanel.querySelector('#timing-clear-btn').addEventListener('click', () => this.clearTiming());
        this.timingPanel.querySelector('#timing-close-btn').addEventListener('click', () => this.hideTimingPanel());
        this.timingPanel.querySelector('#add-signal-btn').addEventListener('click', () => this.showSignalPicker());

        // 스타일 추가
        this.addTimingStyles();
    },

    /**
     * 타이밍 패널 스타일
     */
    addTimingStyles() {
        const style = document.createElement('style');
        style.id = 'timing-analyzer-styles';
        style.textContent = `
            #timing-panel .timing-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 16px;
                background: var(--bg-elevated, #111111);
                border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
            }

            #timing-panel .timing-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                font-weight: 600;
                color: var(--text-primary, #e2e2e2);
            }

            #timing-panel .timing-icon {
                font-size: 14px;
            }

            #timing-panel .timing-controls {
                display: flex;
                gap: 6px;
            }

            #timing-panel .timing-btn {
                background: var(--bg-active, #1a1a1a);
                border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                border-radius: var(--radius-sm, 6px);
                color: var(--text-secondary, #a1a1aa);
                padding: 6px 12px;
                font-size: 11px;
                cursor: pointer;
                transition: all var(--duration-fast, 150ms) var(--ease-out);
                display: flex;
                align-items: center;
                gap: 4px;
            }

            #timing-panel .timing-btn:hover {
                background: var(--bg-hover, #1f1f1f);
                color: var(--text-primary, #e2e2e2);
                border-color: var(--border-default, rgba(255, 255, 255, 0.12));
            }

            #timing-panel .timing-btn.active {
                background: var(--accent-red, #ef4444);
                border-color: var(--accent-red, #ef4444);
                color: white;
            }

            #timing-panel .timing-btn.close {
                background: transparent;
                border-color: var(--accent-red, #ef4444);
                color: var(--accent-red, #ef4444);
            }

            #timing-panel .timing-btn.close:hover {
                background: var(--accent-red, #ef4444);
                color: white;
            }

            #timing-panel .timing-btn .record-dot {
                color: var(--accent-red, #ef4444);
                font-size: 8px;
            }

            #timing-panel .timing-btn.active .record-dot {
                color: white;
                animation: pulse 1s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }

            #timing-panel .timing-body {
                display: flex;
                flex: 1;
                min-height: 0;
            }

            #timing-panel .timing-signals {
                width: 150px;
                background: var(--bg-elevated, #111111);
                border-right: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                display: flex;
                flex-direction: column;
            }

            #timing-panel .signals-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-secondary, #a1a1aa);
                border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
            }

            #timing-panel .add-signal-btn {
                background: var(--accent-blue, #3b82f6);
                border: none;
                border-radius: var(--radius-xs, 4px);
                color: white;
                padding: 4px 8px;
                font-size: 10px;
                cursor: pointer;
                transition: all var(--duration-fast, 150ms);
            }

            #timing-panel .add-signal-btn:hover {
                background: #2563eb;
            }

            #timing-panel .signal-list {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }

            #timing-panel .empty-signals {
                color: var(--text-muted, #52525b);
                font-size: 10px;
                text-align: center;
                padding: 20px 10px;
                line-height: 1.6;
            }

            #timing-panel .signal-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                background: var(--bg-active, #1a1a1a);
                border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                border-radius: var(--radius-xs, 4px);
                margin-bottom: 4px;
                font-size: 11px;
                color: var(--text-primary, #e2e2e2);
            }

            #timing-panel .signal-color {
                width: 10px;
                height: 10px;
                border-radius: 2px;
            }

            #timing-panel .signal-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-family: 'JetBrains Mono', monospace;
                font-size: 10px;
            }

            #timing-panel .signal-remove {
                background: none;
                border: none;
                color: var(--text-muted, #52525b);
                cursor: pointer;
                padding: 2px;
                font-size: 10px;
            }

            #timing-panel .signal-remove:hover {
                color: var(--accent-red, #ef4444);
            }

            #timing-panel .timing-canvas-container {
                flex: 1;
                position: relative;
                padding: 10px;
            }

            #timing-panel #timing-canvas {
                width: 100%;
                height: 100%;
                background: var(--bg-base, #050505);
                border-radius: var(--radius-sm, 6px);
                border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
            }

            #timing-panel .timing-cursor {
                position: absolute;
                top: 10px;
                width: 2px;
                height: calc(100% - 40px);
                background: var(--accent-orange, #f59e0b);
                pointer-events: none;
                display: none;
            }

            #timing-panel .timing-scale {
                position: absolute;
                bottom: 5px;
                left: 10px;
                right: 10px;
                height: 20px;
                display: flex;
                justify-content: space-between;
            }

            #timing-panel .timing-time {
                font-size: 9px;
                color: var(--text-muted, #52525b);
                font-family: 'JetBrains Mono', monospace;
            }

            #timing-panel .timing-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 16px;
                background: var(--bg-elevated, #111111);
                border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
                font-size: 11px;
                color: var(--text-secondary, #a1a1aa);
            }

            #timing-panel .glitch-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            #timing-panel .glitch-icon {
                color: var(--accent-orange, #f59e0b);
            }

            #timing-panel.has-glitches .glitch-indicator {
                color: var(--accent-orange, #f59e0b);
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * 타이밍 패널 표시
     */
    showTimingPanel() {
        this.timingPanel.style.display = 'flex';
        requestAnimationFrame(() => {
            this.timingPanel.style.transform = 'translateY(0)';
        });
        this.resizeTimingCanvas();
    },

    /**
     * 타이밍 패널 숨기기
     */
    hideTimingPanel() {
        this.timingPanel.style.transform = 'translateY(100%)';
        setTimeout(() => {
            this.timingPanel.style.display = 'none';
        }, 300);
    },

    /**
     * 캔버스 크기 조정
     */
    resizeTimingCanvas() {
        const container = this.timingPanel.querySelector('.timing-canvas-container');
        if (container && this.timingCanvas) {
            this.timingCanvas.width = container.clientWidth - 20;
            this.timingCanvas.height = container.clientHeight - 30;
            this.drawTimingDiagram();
        }
    },

    /**
     * 녹화 토글
     */
    toggleTimingRecord() {
        this.timingData.isRecording = !this.timingData.isRecording;
        const btn = this.timingPanel.querySelector('#timing-record-btn');
        btn.classList.toggle('active', this.timingData.isRecording);

        if (this.timingData.isRecording) {
            this.startTimingRecord();
        } else {
            this.stopTimingRecord();
        }
    },

    /**
     * 녹화 시작
     */
    startTimingRecord() {
        this.timingRecordInterval = setInterval(() => {
            if (!this.timingData.isPaused) {
                this.sampleSignals();
                this.drawTimingDiagram();
            }
        }, this.timingData.timePerSample);
    },

    /**
     * 녹화 중지
     */
    stopTimingRecord() {
        if (this.timingRecordInterval) {
            clearInterval(this.timingRecordInterval);
            this.timingRecordInterval = null;
        }
    },

    /**
     * 일시정지 토글
     */
    toggleTimingPause() {
        this.timingData.isPaused = !this.timingData.isPaused;
        const btn = this.timingPanel.querySelector('#timing-pause-btn');
        btn.textContent = this.timingData.isPaused ? '▶️ PLAY' : '⏸️ PAUSE';
        btn.classList.toggle('active', this.timingData.isPaused);

        // 시뮬레이션도 일시정지
        if (this.timingData.isPaused) {
            this.isRunning = false;
        } else {
            this.isRunning = true;
        }
    },

    /**
     * 스텝 실행 (1 클럭 사이클)
     */
    stepTiming() {
        // 일시정지 상태에서만 동작
        if (!this.timingData.isPaused) {
            this.timingData.isPaused = true;
            this.isRunning = false;
            const btn = this.timingPanel.querySelector('#timing-pause-btn');
            btn.textContent = '▶️ PLAY';
            btn.classList.add('active');
        }

        // 1 스텝 실행
        this.doClockTick();
        this.sampleSignals();
        this.drawTimingDiagram();
        this.showToast('1 스텝 실행됨', 'info');
    },

    /**
     * 초기화
     */
    clearTiming() {
        this.timingData.signals.forEach(sig => sig.history = []);
        this.timingData.sampleCount = 0;
        this.timingData.glitches = [];
        this.drawTimingDiagram();
        this.updateTimingInfo();
    },

    /**
     * 신호 추가
     */
    addTimingSignal(component, pinSelector, name, color) {
        // 중복 체크
        const exists = this.timingData.signals.find(s =>
            s.component === component && s.pinSelector === pinSelector
        );
        if (exists) return;

        const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
        const signalColor = color || colors[this.timingData.signals.length % colors.length];

        this.timingData.signals.push({
            name: name,
            component: component,
            pinSelector: pinSelector,
            color: signalColor,
            history: []
        });

        this.updateSignalList();
    },

    /**
     * 신호 제거
     */
    removeTimingSignal(index) {
        this.timingData.signals.splice(index, 1);
        this.updateSignalList();
        this.drawTimingDiagram();
    },

    /**
     * 신호 목록 UI 업데이트
     */
    updateSignalList() {
        const list = this.timingPanel.querySelector('#signal-list');
        if (this.timingData.signals.length === 0) {
            list.innerHTML = '<div class="empty-signals">추적할 신호가 없습니다.<br>컴포넌트를 우클릭하여 \'타이밍 추적\' 선택</div>';
            return;
        }

        list.innerHTML = this.timingData.signals.map((sig, i) => `
            <div class="signal-item">
                <div class="signal-color" style="background: ${sig.color}"></div>
                <span class="signal-name" title="${sig.name}">${sig.name}</span>
                <button class="signal-remove" data-index="${i}">✕</button>
            </div>
        `).join('');

        // 삭제 버튼 이벤트
        list.querySelectorAll('.signal-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeTimingSignal(parseInt(btn.getAttribute('data-index')));
            });
        });
    },

    /**
     * 신호 샘플링
     */
    sampleSignals() {
        let glitchDetected = false;

        this.timingData.signals.forEach(sig => {
            let value = 0;

            if (sig.pinSelector) {
                // 특정 핀 추적
                const pin = sig.component.querySelector(sig.pinSelector);
                if (pin) {
                    value = (pin.getAttribute('data-signal') === '1' ||
                        pin.getAttribute('data-output-signal') === '1') ? 1 : 0;
                }
            } else {
                // 컴포넌트 출력 값
                value = sig.component.getAttribute('data-value') === '1' ? 1 : 0;
            }

            // 글리치 감지: 짧은 시간 안에 0→1→0 또는 1→0→1
            const history = sig.history;
            if (history.length >= 2) {
                const prev2 = history[history.length - 2];
                const prev1 = history[history.length - 1];
                if (prev2 === value && prev1 !== value) {
                    // 글리치!
                    glitchDetected = true;
                    this.timingData.glitches.push({
                        signal: sig.name,
                        time: this.timingData.sampleCount,
                        value: prev1
                    });
                }
            }

            // 히스토리에 추가
            sig.history.push(value);

            // 최대 샘플 수 제한
            if (sig.history.length > this.timingData.maxSamples) {
                sig.history.shift();
            }
        });

        this.timingData.sampleCount++;
        if (this.timingData.sampleCount > this.timingData.maxSamples) {
            this.timingData.sampleCount = this.timingData.maxSamples;
        }

        this.updateTimingInfo();

        if (glitchDetected) {
            this.timingPanel.classList.add('has-glitches');
        }
    },

    /**
     * 정보 업데이트
     */
    updateTimingInfo() {
        const sampleLabel = this.timingPanel.querySelector('#sample-count');
        const glitchLabel = this.timingPanel.querySelector('#glitch-count');

        if (sampleLabel) {
            sampleLabel.textContent = `샘플: ${this.timingData.sampleCount}/${this.timingData.maxSamples}`;
        }
        if (glitchLabel) {
            glitchLabel.textContent = `글리치: ${this.timingData.glitches.length}개`;
        }
    },

    /**
     * 타이밍 다이어그램 그리기
     */
    drawTimingDiagram() {
        if (!this.timingCtx || !this.timingCanvas) return;

        const ctx = this.timingCtx;
        const canvas = this.timingCanvas;
        const width = canvas.width;
        const height = canvas.height;
        const signals = this.timingData.signals;

        // 배경
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);

        if (signals.length === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('신호를 추가하세요', width / 2, height / 2);
            return;
        }

        const signalHeight = Math.min(height / signals.length, 50);
        const margin = 10;
        const waveHeight = signalHeight - 20;

        // 그리드 그리기
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // 각 신호 파형 그리기
        signals.forEach((sig, index) => {
            const y = index * signalHeight + margin;
            const history = sig.history;

            if (history.length === 0) return;

            // 신호 라벨
            ctx.fillStyle = sig.color;
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'left';
            // ctx.fillText(sig.name, 5, y + signalHeight / 2);

            // 파형 그리기
            ctx.strokeStyle = sig.color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            const xStep = width / this.timingData.maxSamples;
            const highY = y + 10;
            const lowY = y + waveHeight;

            history.forEach((value, i) => {
                const x = i * xStep;
                const currentY = value ? highY : lowY;

                if (i === 0) {
                    ctx.moveTo(x, currentY);
                } else {
                    const prevValue = history[i - 1];
                    const prevY = prevValue ? highY : lowY;

                    // 수직선 (값 변경 시)
                    if (prevValue !== value) {
                        ctx.lineTo(x, prevY);
                        ctx.lineTo(x, currentY);
                    }
                    ctx.lineTo(x + xStep, currentY);
                }
            });

            ctx.stroke();

            // 구분선
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y + signalHeight);
            ctx.lineTo(width, y + signalHeight);
            ctx.stroke();
        });

        // 글리치 마커 (빨간 세로선)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        this.timingData.glitches.forEach(glitch => {
            const x = (glitch.time / this.timingData.maxSamples) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // 글리치 레이블
            ctx.fillStyle = '#ef4444';
            ctx.font = '8px Inter';
            ctx.fillText('⚡', x - 4, 10);
        });
    },

    /**
     * 컴포넌트를 타이밍 추적에 추가 (컨텍스트 메뉴에서 호출)
     */
    addComponentToTiming(component) {
        const type = component.getAttribute('data-type');
        const id = component.id;
        const shortId = id.substring(0, 10);

        // 타입에 따라 적절한 핀 선택
        if (type === 'SWITCH' || type === 'CLOCK' || type === 'VCC') {
            this.addTimingSignal(component, '.output, .out', `${type} (${shortId})`, null);
        } else if (type === 'LED') {
            this.addTimingSignal(component, '.input, .in-1', `LED (${shortId})`, null);
        } else if (['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(type)) {
            this.addTimingSignal(component, '.output, .out', `${type} Out (${shortId})`, null);
        } else if (type === 'PACKAGE' || component.classList.contains('package-comp')) {
            // 패키지는 모든 출력 핀 추가
            const outputPins = component.querySelectorAll('.pin.output');
            outputPins.forEach((pin, i) => {
                const pinClass = Array.from(pin.classList).find(c => c.startsWith('out-'));
                this.addTimingSignal(component, `.${pinClass}`, `PKG Out${i + 1} (${shortId})`, null);
            });
        } else {
            // 기본: 전체 컴포넌트 값
            this.addTimingSignal(component, null, `${type} (${shortId})`, null);
        }

        this.showTimingPanel();
        this.showToast(`"${type}" 타이밍 추적 추가됨`, 'success');
    }
});

console.log('[TimingAnalyzer] Module loaded');
