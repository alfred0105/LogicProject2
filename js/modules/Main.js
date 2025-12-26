/**
 * 메인 엔트리 포인트
 */
document.addEventListener('DOMContentLoaded', () => {
    // 시뮬레이터 인스턴스 생성
    window.sim = new CircuitSimulator();
    if (window.sim.initProject) {
        window.sim.initProject();
    }

    // 탭 시스템 초기화
    if (window.sim.initTabs) {
        window.sim.initTabs();
    }

    // 메인 루프 실행
    function animate() {
        if (window.sim) {
            window.sim.loop();
            if (window.sim.oscilloscope) {
                window.sim.oscilloscope.draw();
            }
        }
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
});
