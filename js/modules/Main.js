/**
 * 메인 엔트리 포인트
 */
document.addEventListener('DOMContentLoaded', () => {
    // 시뮬레이터 인스턴스 생성
    window.sim = new CircuitSimulator();

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

    // 로딩 화면 숨기기 (초기화 완료 후)
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            // 애니메이션 완료 후 DOM에서 제거
            setTimeout(() => loadingScreen.remove(), 500);
        }
    }, 1500); // 로딩 애니메이션이 자연스럽게 완료되도록 지연
});
