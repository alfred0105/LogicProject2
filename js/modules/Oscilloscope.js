/**
 * 오실로스코프 클래스
 */
class Oscilloscope {
    constructor(sim) {
        this.sim = sim;
        this.canvas = document.getElementById('oscilloscope-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.history = []; // { time: 0, signals: { id: val, ... } }
        this.maxHistory = 500;

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
        this.canvas.height = rect.height - 25; // header height
    }

    update() {
        if (!this.canvas || !this.canvas.parentElement) return;
        if (this.canvas.parentElement.style.display === 'none') return;

        // Collect Output Signals (LEDs and Final Outputs)
        const signalSnapshot = {};
        this.sim.components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            const val = comp.getAttribute('data-value') === '1' ? 1 : 0;
            if (type === 'LED' || type === 'SWITCH' || type === 'CLOCK' || type === 'PORT_OUT') {
                signalSnapshot[comp.id] = val;
            }
        });

        this.history.push(signalSnapshot);
        if (this.history.length > this.maxHistory) this.history.shift();
    }

    draw() {
        if (!this.canvas || !this.ctx || !this.canvas.parentElement) return;
        if (this.canvas.parentElement.style.display === 'none') return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const signals = Object.keys(this.history[0] || {});
        if (signals.length === 0) return;

        const rowHeight = h / signals.length;
        const stepX = w / this.maxHistory;

        signals.forEach((id, index) => {
            const yBase = index * rowHeight + rowHeight * 0.8;
            const amplitude = rowHeight * 0.6;

            ctx.beginPath();
            ctx.strokeStyle = `hsl(${index * 60}, 70%, 50%)`;
            ctx.lineWidth = 2;

            ctx.fillStyle = "#aaa";
            ctx.font = "10px monospace";
            ctx.fillText(id.substr(0, 8), 5, yBase - amplitude - 5);

            for (let i = 0; i < this.history.length; i++) {
                const val = this.history[i][id];
                const x = i * stepX;
                const y = yBase - (val * amplitude);

                if (i === 0) ctx.moveTo(x, y);
                else {
                    const prevVal = this.history[i - 1][id];
                    const prevY = yBase - (prevVal * amplitude);
                    ctx.lineTo(x, prevY);
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        });
    }
}
