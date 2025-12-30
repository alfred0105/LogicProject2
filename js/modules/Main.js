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

    // 회로 검증 도구 초기화
    if (window.CircuitValidator) {
        window.sim.validator = new CircuitValidator(window.sim);
    }

    // 라이브러리 관리자 초기화
    if (window.LibraryManager) {
        window.library = new LibraryManager();
    }

    // 협업 관리자 초기화
    if (window.CollaborationManager) {
        window.sim.collaboration = new CollaborationManager(window.sim);

        // URL에 협업 파라미터가 있으면 자동 시작
        const urlParams = new URLSearchParams(window.location.search);
        const collaborateId = urlParams.get('collaborate');
        if (collaborateId && window.sim.currentProjectId) {
            setTimeout(() => {
                window.sim.collaboration.startCollaboration(window.sim.currentProjectId);
            }, 2000); // 2초 대기 후 시작
        }
    }

    // ===== 새 기능 초기화 =====

    // 미니맵 초기화
    if (window.sim.initMinimap) {
        setTimeout(() => {
            window.sim.initMinimap();
        }, 500);
    }

    // 타이밍 분석기 초기화
    if (window.sim.initTimingAnalyzer) {
        window.sim.initTimingAnalyzer();
    }

    // 퍼즐 시스템 초기화
    if (window.sim.initPuzzleSystem) {
        window.sim.initPuzzleSystem();
    }

    // 메인 루프 실행
    function animate() {
        if (window.sim) {
            window.sim.loop();
            if (window.sim.oscilloscope) {
                window.sim.oscilloscope.draw();
            }

            // 고급 컴포넌트 업데이트
            if (window.sim.updateAdvancedComponents) {
                window.sim.updateAdvancedComponents();
            }

            // 미니맵 업데이트 (5프레임마다)
            if (window.sim.updateMinimap && window.sim._minimapCounter === undefined) {
                window.sim._minimapCounter = 0;
            }
            if (window.sim._minimapCounter !== undefined) {
                window.sim._minimapCounter++;
                if (window.sim._minimapCounter >= 10) {
                    window.sim._minimapCounter = 0;
                    if (window.sim.updateMinimap) {
                        window.sim.updateMinimap();
                    }
                }
            }

            // 자동 검증 모드인 경우
            if (window.autoValidateEnabled && window.sim.validator) {
                // 변경사항이 있을 때만 검증 (debounce 적용)
                clearTimeout(window.autoValidateTimer);
                window.autoValidateTimer = setTimeout(() => {
                    if (window.sim.validator) {
                        const results = window.sim.validator.validateCircuit();
                        if (window.updateValidationStats) {
                            window.updateValidationStats(results);
                        }
                    }
                }, 2000); // 2초 후 검증
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

