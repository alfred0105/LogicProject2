/**
 * LoCAD - Logic Circuit Design Tool
 * Oscilloscope System (ESM)
 * 
 * @description 디지털 파형을 기록하고 시각화하는 오실로스코프 시스템입니다.
 *              CircularBuffer를 사용하여 효율적인 타이밍 다이어그램을 제공합니다.
 */

import { CircularBuffer, eventBus } from '../utils/Helpers.js';
import { CONFIG } from '../utils/Constants.js';

/**
 * 향상된 오실로스코프 클래스
 * - CircularBuffer 기반 효율적인 데이터 저장
 * - Canvas API를 사용한 고성능 렌더링
 * - 줌/팬 지원
 * - 채널별 색상 및 라벨
 */
export class Oscilloscope {
    /**
     * @param {Object} options - 설정 옵션
     * @param {string} options.canvasId - 캔버스 요소 ID
     * @param {number} options.bufferSize - 버퍼 크기 (기본: 1000)
     */
    constructor(options = {}) {
        const { canvasId = 'oscilloscope-canvas', bufferSize = CONFIG.OSCILLOSCOPE_BUFFER_SIZE } = options;

        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas?.getContext('2d');

        /** @type {Map<string, CircularBuffer>} */
        this.channels = new Map();

        /** @type {number} */
        this.bufferSize = bufferSize;

        /** @type {number} */
        this.currentTick = 0;

        /** @type {boolean} */
        this.isEnabled = true;

        /** @type {Object} */
        this.viewState = {
            offsetX: 0,
            zoom: 1.0,
            isDragging: false,
            lastMouseX: 0
        };

        // 채널 색상 팔레트
        this.colorPalette = [
            '#3b82f6', // Blue
            '#22c55e', // Green  
            '#ef4444', // Red
            '#f59e0b', // Orange
            '#8b5cf6', // Purple
            '#ec4899', // Pink
            '#06b6d4', // Cyan
            '#84cc16', // Lime
        ];

        // 이벤트 초기화
        this.initEvents();
    }

    /**
     * 이벤트 초기화
     */
    initEvents() {
        if (!this.canvas) return;

        // 캔버스 리사이즈
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // 마우스 이벤트 (줌/팬)
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

        // 이벤트 버스 구독
        eventBus.on('oscilloscope:clear', () => this.clear());
        eventBus.on('oscilloscope:toggle', (enabled) => this.isEnabled = enabled);
    }

    /**
     * 캔버스 리사이즈
     */
    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        if (this.canvas.parentElement.style.display === 'none') return;

        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height - 30; // 헤더 높이 제외
    }

    /**
     * 채널 등록
     * @param {string} channelId - 채널 ID
     * @param {string} label - 표시 라벨
     */
    registerChannel(channelId, label = channelId) {
        if (!this.channels.has(channelId)) {
            const buffer = new CircularBuffer(this.bufferSize);
            buffer.label = label;
            buffer.colorIndex = this.channels.size % this.colorPalette.length;
            this.channels.set(channelId, buffer);
        }
    }

    /**
     * 채널 제거
     * @param {string} channelId 
     */
    unregisterChannel(channelId) {
        this.channels.delete(channelId);
    }

    /**
     * 신호 값 기록
     * @param {string} channelId - 채널 ID
     * @param {number} value - 0 또는 1
     */
    recordValue(channelId, value) {
        if (!this.isEnabled) return;

        // 채널이 없으면 자동 등록
        if (!this.channels.has(channelId)) {
            this.registerChannel(channelId);
        }

        const buffer = this.channels.get(channelId);
        buffer.push({
            tick: this.currentTick,
            value: value ? 1 : 0,
            timestamp: performance.now()
        });
    }

    /**
     * 시뮬레이터 상태에서 신호 수집
     * @param {Array<HTMLElement>} components - 컴포넌트 배열
     */
    update(components = []) {
        if (!this.isEnabled || !this.canvas) return;
        if (this.canvas.parentElement?.style.display === 'none') return;

        // LED, SWITCH, CLOCK, PORT_OUT의 상태 수집
        const targetTypes = ['LED', 'SWITCH', 'CLOCK', 'PORT_OUT'];

        components.forEach(comp => {
            const type = comp.getAttribute('data-type');
            if (targetTypes.includes(type)) {
                const value = comp.getAttribute('data-value') === '1' ? 1 : 0;
                this.recordValue(comp.id, value);
            }
        });

        this.currentTick++;
    }

    /**
     * 디지털 파형 그리기
     */
    draw() {
        if (!this.ctx || !this.canvas) return;
        if (this.canvas.parentElement?.style.display === 'none') return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 배경 클리어
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);

        // 채널이 없으면 안내 메시지
        if (this.channels.size === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('신호가 감지되면 파형이 표시됩니다', w / 2, h / 2);
            return;
        }

        // 그리드 그리기
        this.drawGrid(ctx, w, h);

        // 채널별 파형 그리기
        const channelHeight = h / this.channels.size;
        let channelIndex = 0;

        this.channels.forEach((buffer, channelId) => {
            const yOffset = channelIndex * channelHeight + 10;
            const waveHeight = channelHeight - 20;

            this.drawChannelWaveform(ctx, buffer, channelId, w, yOffset, waveHeight);
            channelIndex++;
        });

        // 커서 위치 표시 (Tick 번호)
        this.drawCursor(ctx, w, h);
    }

    /**
     * 그리드 그리기
     */
    drawGrid(ctx, w, h) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        // 수직선 (시간)
        const timeStep = 50 * this.viewState.zoom;
        const startX = (this.viewState.offsetX % timeStep);

        for (let x = startX; x < w; x += timeStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // 채널 구분선
        const channelHeight = h / Math.max(1, this.channels.size);
        for (let i = 1; i < this.channels.size; i++) {
            const y = i * channelHeight;
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    /**
     * 개별 채널 파형 그리기
     */
    drawChannelWaveform(ctx, buffer, channelId, width, yOffset, height) {
        const color = this.colorPalette[buffer.colorIndex || 0];
        const data = buffer.toArray();

        if (data.length === 0) return;

        // 라벨 그리기
        ctx.fillStyle = color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        const labelText = buffer.label || channelId.substring(0, 12);
        ctx.fillText(labelText, 5, yOffset + 12);

        // 파형 그리기 (Square Wave)
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        const stepX = (width * this.viewState.zoom) / this.bufferSize;
        const highY = yOffset + 8;  // High 레벨
        const lowY = yOffset + height - 2;  // Low 레벨

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (!item) continue;

            const x = (i * stepX) + this.viewState.offsetX;
            if (x < 0 || x > width) continue;

            const y = item.value ? highY : lowY;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevItem = data[i - 1];
                const prevY = prevItem?.value ? highY : lowY;

                // 값이 변경되면 수직선 먼저 그리기 (Square Wave 효과)
                if (prevY !== y) {
                    ctx.lineTo(x, prevY);
                }
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // 현재 값 표시
        const lastValue = data[data.length - 1]?.value;
        if (lastValue !== undefined) {
            ctx.fillStyle = lastValue ? '#22c55e' : '#ef4444';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(lastValue ? 'HIGH' : 'LOW', width - 5, yOffset + 12);
        }
    }

    /**
     * 커서 그리기
     */
    drawCursor(ctx, w, h) {
        // Tick 표시
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Tick: ${this.currentTick}`, w - 5, h - 5);
    }

    /**
     * 마우스 휠 핸들러 (줌)
     */
    handleWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.viewState.zoom = Math.max(0.1, Math.min(5.0, this.viewState.zoom * zoomFactor));
    }

    /**
     * 마우스 다운 핸들러 (팬 시작)
     */
    handleMouseDown(e) {
        this.viewState.isDragging = true;
        this.viewState.lastMouseX = e.clientX;
    }

    /**
     * 마우스 이동 핸들러 (팬)
     */
    handleMouseMove(e) {
        if (!this.viewState.isDragging) return;

        const deltaX = e.clientX - this.viewState.lastMouseX;
        this.viewState.offsetX += deltaX;
        this.viewState.lastMouseX = e.clientX;
    }

    /**
     * 마우스 업 핸들러 (팬 종료)
     */
    handleMouseUp() {
        this.viewState.isDragging = false;
    }

    /**
     * 모든 채널 데이터 초기화
     */
    clear() {
        this.channels.forEach(buffer => buffer.clear());
        this.currentTick = 0;
        this.viewState.offsetX = 0;
        this.viewState.zoom = 1.0;
    }

    /**
     * 데이터 내보내기 (JSON)
     * @returns {Object}
     */
    exportData() {
        const result = {
            tick: this.currentTick,
            channels: {}
        };

        this.channels.forEach((buffer, channelId) => {
            result.channels[channelId] = {
                label: buffer.label,
                data: buffer.toArray()
            };
        });

        return result;
    }

    /**
     * CSV 내보내기
     * @returns {string}
     */
    exportCSV() {
        const channelIds = Array.from(this.channels.keys());
        const headers = ['Tick', ...channelIds];
        const rows = [headers.join(',')];

        // 가장 긴 채널 기준
        const maxLength = Math.max(...Array.from(this.channels.values()).map(b => b.length));

        for (let i = 0; i < maxLength; i++) {
            const row = [i.toString()];
            channelIds.forEach(id => {
                const buffer = this.channels.get(id);
                const item = buffer.get(i);
                row.push(item?.value ?? '');
            });
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }
}

// 싱글톤 인스턴스
export const oscilloscope = new Oscilloscope();
