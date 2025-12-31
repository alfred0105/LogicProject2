/**
 * 오실로스코프 클래스 (Enhanced)
 * CircularBuffer 기반 효율적인 타이밍 다이어그램
 */
class Oscilloscope {
    constructor(sim) {
        this.sim = sim;
        this.canvas = document.getElementById('oscilloscope-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        // CircularBuffer 구현 (Phase 2 Enhancement)
        this.maxHistory = 1000;  // 버퍼 사이즈 확대
        this.history = [];
        this.currentTick = 0;

        // 채널별 버퍼 (High Performance)
        this.channels = new Map();

        // 색상 팔레트
        this.colors = [
            '#3b82f6', '#22c55e', '#ef4444', '#f59e0b',
            '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
        ];

        if (this.canvas) {
            this.resize();
            window.addEventListener('resize', () => this.resize());
        }
    }

    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        if (this.canvas.parentElement.style.display === 'none') return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height - 25;
    }

    update() {
        if (!this.canvas || !this.canvas.parentElement) return;
        if (this.canvas.parentElement.style.display === 'none') return;

        // 신호 스냅샷 수집
        const signalSnapshot = {};
        this.sim.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            const val = comp.getAttribute('data-value') === '1' ? 1 : 0;
            if (type === 'LED' || type === 'SWITCH' || type === 'CLOCK' || type === 'PORT_OUT') {
                signalSnapshot[comp.id] = val;

                // 채널 등록 (최초)
                if (!this.channels.has(comp.id)) {
                    this.channels.set(comp.id, {
                        label: type.substring(0, 6),
                        colorIndex: this.channels.size % this.colors.length,
                        data: []
                    });
                }

                // 채널 데이터 추가
                const channel = this.channels.get(comp.id);
                channel.data.push({ tick: this.currentTick, value: val });

                // CircularBuffer 동작: 최대 사이즈 초과 시 오래된 데이터 제거
                if (channel.data.length > this.maxHistory) {
                    channel.data.shift();
                }
            }
        });

        this.history.push(signalSnapshot);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.currentTick++;
    }

    draw() {
        if (!this.canvas || !this.ctx || !this.canvas.parentElement) return;
        if (this.canvas.parentElement.style.display === 'none') return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 배경
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);

        if (this.channels.size === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('신호가 감지되면 파형이 표시됩니다', w / 2, h / 2);
            return;
        }

        const channelHeight = h / this.channels.size;
        let channelIndex = 0;

        this.channels.forEach((channel, id) => {
            const yOffset = channelIndex * channelHeight;
            const waveHeight = channelHeight - 10;
            const color = this.colors[channel.colorIndex];

            // 라벨
            ctx.fillStyle = color;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(channel.label, 5, yOffset + 12);

            // Square Wave 렌더링
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;

            const data = channel.data;
            const stepX = w / this.maxHistory;
            const highY = yOffset + 8;
            const lowY = yOffset + waveHeight;

            for (let i = 0; i < data.length; i++) {
                const x = i * stepX;
                const y = data[i].value ? highY : lowY;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    const prevY = data[i - 1].value ? highY : lowY;
                    // Square Wave: 수직선 먼저 그리기
                    if (prevY !== y) {
                        ctx.lineTo(x, prevY);
                    }
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            // 현재 상태 표시
            const lastValue = data[data.length - 1]?.value;
            if (lastValue !== undefined) {
                ctx.fillStyle = lastValue ? '#22c55e' : '#ef4444';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(lastValue ? 'HIGH' : 'LOW', w - 5, yOffset + 12);
            }

            channelIndex++;
        });

        // Tick 표시
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Tick: ${this.currentTick}`, w - 5, h - 5);
    }

    clear() {
        this.history = [];
        this.channels.clear();
        this.currentTick = 0;
    }
}



// [Vite Export] Make globally available
if (typeof Oscilloscope !== 'undefined') { window.Oscilloscope = Oscilloscope; }
