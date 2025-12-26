/**
 * 모듈: 실행 취소 및 재실행 (Undo/Redo)
 */
Object.assign(CircuitSimulator.prototype, {
    saveState() {
        // 모듈 모드에서도 히스토리 저장 (현재 탭의 컴포넌트/와이어 사용)

        const state = {
            components: this.components.map(comp => ({
                id: comp.id,
                type: comp.getAttribute('data-type'),
                x: parseFloat(comp.style.left),
                y: parseFloat(comp.style.top),
                value: comp.getAttribute('data-value')
            })),
            wires: this.wires.map(wire => ({
                fromId: wire.from.parentElement.id,
                fromPinClass: wire.from.classList[1],
                toId: wire.to.parentElement.id,
                toPinClass: wire.to.classList[1]
            }))
        };

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.stringify(state));
        this.historyIndex = this.history.length - 1;

        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
    },

    undo() {
        // 모듈 모드에서도 Undo 허용

        if (this.historyIndex <= 0) {
            this.showToast('더 이상 되돌릴 수 없습니다.', 'warning');
            return;
        }

        this.historyIndex--;
        this.restoreState(JSON.parse(this.history[this.historyIndex]));
        this.showToast('실행 취소', 'info');
    },

    redo() {
        // 모듈 모드에서도 Redo 허용

        if (this.historyIndex >= this.history.length - 1) {
            this.showToast('다시 실행할 내용이 없습니다.', 'warning');
            return;
        }

        this.historyIndex++;
        this.restoreState(JSON.parse(this.history[this.historyIndex]));
        this.showToast('다시 실행', 'info');
    },

    restoreState(state) {
        this.components.forEach(c => c.remove());
        this.wires.forEach(w => w.line.remove());
        this.components = [];
        this.wires = [];
        this.wireLayer.innerHTML = '';

        const compMap = {};
        state.components.forEach(cData => {
            this.addModule(cData.type, cData.x, cData.y, { skipSave: true });
            const newComp = this.components[this.components.length - 1];
            newComp.id = cData.id;
            if (cData.value) newComp.setAttribute('data-value', cData.value);

            if (cData.type === 'SWITCH') {
                const label = newComp.querySelector('.comp-label');
                if (label) label.innerText = cData.value === '1' ? 'ON' : 'OFF';
            }
            compMap[cData.id] = newComp;
        });

        state.wires.forEach(wData => {
            const fromComp = compMap[wData.fromId];
            const toComp = compMap[wData.toId];
            if (fromComp && toComp) {
                const fromPin = fromComp.querySelector(`.${wData.fromPinClass}`);
                const toPin = toComp.querySelector(`.${wData.toPinClass}`);
                if (fromPin && toPin) {
                    this.createWire(fromPin, toPin, { skipSave: true });
                }
            }
        });

        this.updateCircuit();
        this.updateStatusBar();
    }
});
