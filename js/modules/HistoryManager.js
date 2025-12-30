/**
 * 모듈: 실행 취소 및 재실행 (Undo/Redo)
 * 메모리 관리 강화: 스냅샷 크기 제한, 쓰로틀링, 자동 정리
 */
Object.assign(CircuitSimulator.prototype, {
    // 히스토리 설정
    _historyThrottleDelay: 300,  // 연속 저장 방지 딜레이 (ms)
    _maxSnapshotSize: 500000,     // 개별 스냅샷 최대 크기 (bytes, ~500KB)
    _lastSaveTime: 0,
    _pendingSave: null,

    saveState() {
        // 모듈 모드에서도 히스토리 저장 (현재 탭의 컴포넌트/와이어 사용)

        // [쓰로틀링] 연속적인 저장 요청 방지 (드래그 중 과도한 저장 방지)
        const now = Date.now();
        if (now - this._lastSaveTime < this._historyThrottleDelay) {
            // 지연된 저장 스케줄링
            if (this._pendingSave) clearTimeout(this._pendingSave);
            this._pendingSave = setTimeout(() => this.saveState(), this._historyThrottleDelay);
            return;
        }
        this._lastSaveTime = now;
        if (this._pendingSave) {
            clearTimeout(this._pendingSave);
            this._pendingSave = null;
        }

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

        const stateStr = JSON.stringify(state);

        // [메모리 보호] 스냅샷 크기 체크
        if (stateStr.length > this._maxSnapshotSize) {
            console.warn(`[HistoryManager] 스냅샷 크기(${(stateStr.length / 1024).toFixed(1)}KB)가 제한(${(this._maxSnapshotSize / 1024).toFixed(0)}KB)을 초과. 히스토리 저장 건너뜀.`);
            // 대신 가장 오래된 히스토리 제거해서 공간 확보
            if (this.history.length > 5) {
                this.history.splice(0, Math.floor(this.history.length / 2));
                this.historyIndex = Math.min(this.historyIndex, this.history.length - 1);
            }
            return;
        }

        // [중복 방지] 직전 상태와 동일하면 저장 안 함
        if (this.history.length > 0 && this.history[this.historyIndex] === stateStr) {
            return;
        }

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(stateStr);
        this.historyIndex = this.history.length - 1;

        // [메모리 관리] 최대 개수 초과 시 오래된 것 제거
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }

        // [메모리 모니터링] 전체 히스토리 크기 체크 (대략적)
        const totalSize = this.history.reduce((sum, s) => sum + s.length, 0);
        if (totalSize > 5000000) { // 5MB 초과 시 경고
            console.warn(`[HistoryManager] 전체 히스토리 크기(${(totalSize / 1024 / 1024).toFixed(1)}MB) 경고. 오래된 히스토리 정리 중...`);
            // 절반 제거
            const removeCount = Math.floor(this.history.length / 2);
            this.history.splice(0, removeCount);
            this.historyIndex = Math.max(0, this.historyIndex - removeCount);
        }

        // 상태 변경 시 자동 저장 트리거
        if (this.cloud) this.cloud.triggerAutoSave();
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

        // Undo 시 자동 저장 트리거
        if (this.cloud) this.cloud.triggerAutoSave();
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

        // Redo 시 자동 저장 트리거
        if (this.cloud) this.cloud.triggerAutoSave();
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
