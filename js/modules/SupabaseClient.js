/**
 * Supabase 클라이언트 설정
 */
(function () {
    // =========================================================================
    // [중요] 아래 두 변수에 Supabase 대시보드에서 복사한 값을 붙여넣으세요.
    // =========================================================================
    const SUPABASE_URL = 'https://vaxukhoepptadsosygya.supabase.co';
    const SUPABASE_KEY = 'sb_secret_9VjPJWwQvc3RFpvnjgABZQ_ELU5--xC';
    // =========================================================================

    // 내부 변수 (충돌 방지)
    let _supabaseClient = null;

    // CDN 로드 확인 및 초기화
    if (window.supabase && window.supabase.createClient) {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase 연결 설정됨');
    } else if (typeof createClient !== 'undefined') {
        // 구형 방식 호환
        // _supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('❌ Supabase 라이브러리가 로드되지 않았습니다.');
    }

    // 전역 노출 (필요한 것만)
    window.sb = _supabaseClient;

    /**
     * 로그인 상태 확인 및 유저 정보 반환
     */
    window.getCurrentUser = async function () {
        if (!_supabaseClient) return null;
        const { data: { user } } = await _supabaseClient.auth.getUser();
        return user;
    };

    /**
     * 구글 로그인 시작
     */
    window.signInWithGoogle = async function () {
        if (!_supabaseClient) return;
        const { data, error } = await _supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/dashboard.html'
            }
        });
        if (error) alert('로그인 오류: ' + error.message);
    };

    /**
     * 로그아웃
     */
    window.signOut = async function () {
        if (!_supabaseClient) return;
        const { error } = await _supabaseClient.auth.signOut();
        if (!error) {
            window.location.href = 'index.html';
        }
    };

    // CloudManager 자동 로드
    const script = document.createElement('script');
    script.src = 'js/modules/CloudManager.js';
    script.onload = () => {
        console.log('✅ CloudManager module loaded');
        const checkSim = setInterval(() => {
            if (window.sim && window.CloudManager) {
                clearInterval(checkSim);
                window.sim.cloud = new window.CloudManager(window.sim);
                console.log('☁️ Cloud functionality attached to Simulator');
            }
        }, 500);
    };
    document.head.appendChild(script);

})();
