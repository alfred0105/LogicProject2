/**
 * Supabase 클라이언트 설정
 */
(function () {
    // =========================================================================
    // [중요] 아래 두 변수에 Supabase 대시보드에서 복사한 값을 붙여넣으세요.
    // =========================================================================
    const SUPABASE_URL = 'https://vaxukhoepptadsosygya.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZheHVraG9lcHB0YWRzb3N5Z3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NTM5MjMsImV4cCI6MjA4MjMyOTkyM30.mQ1QBkjDqFaCgcW4CnWbvs-M5Qnsi5boukx68aa6Ubg';
    // =========================================================================

    // 내부 변수 (충돌 방지)
    let _supabaseClient = null;

    // CDN 로드 확인 및 초기화
    if (window.supabase && window.supabase.createClient) {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        console.log('✅ Supabase 연결 설정됨 (옵션 적용)');
    } else if (typeof createClient !== 'undefined') {
        // 구형 방식 호환
        // _supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('❌ Supabase 라이브러리가 로드되지 않았습니다.');
    }

    // 전역 노출 (필요한 것만)
    window.sb = _supabaseClient;
    window.currentUser = null; // 현재 로그인한 유저 정보 캐싱

    /**
     * 로그인 상태 확인 및 유저 정보 반환 (개선됨)
     */
    window.getCurrentUser = async function () {
        if (!_supabaseClient) return null;
        const { data: { session } } = await _supabaseClient.auth.getSession();
        if (session && session.user) {
            window.currentUser = session.user;
            return session.user;
        }
        return null;
    };

    /**
     * 구글 로그인 시작
     */
    window.signInWithGoogle = async function () {
        if (!_supabaseClient) return;
        const { data, error } = await _supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
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
            window.currentUser = null;
            window.location.href = 'index.html';
        }
    };

    /**
     * UI 업데이트 헬퍼 (각 페이지에서 호출)
     */
    window.updateProfileUI = function (user) {
        if (!user) return;

        // 공통: 사용자 이름 가져오기 (메타데이터 우선)
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
        const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;

        // 1. Simulator.html 사이드바 업데이트
        const accountName = document.getElementById('account-name');
        const accountAvatar = document.querySelector('.account-avatar');

        if (accountName) accountName.textContent = name;
        if (accountAvatar) {
            if (avatar) {
                accountAvatar.innerHTML = `<img src="${avatar}" style="width:100%; height:100%; border-radius:50%;">`;
            } else {
                accountAvatar.textContent = name.charAt(0).toUpperCase();
            }
        }

        // 2. Dashboard.html 프로필 업데이트
        const dashName = document.getElementById('user-name');
        const dashEmail = document.getElementById('user-email');
        const dashAvatar = document.getElementById('user-avatar-img'); // 이미지 태그 ID 가정

        if (dashName) dashName.textContent = name;
        if (dashEmail) dashEmail.textContent = user.email;
        if (dashAvatar && avatar) dashAvatar.src = avatar;
    };

    // 초기화 시 세션 리스너 등록
    if (_supabaseClient) {
        _supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                window.currentUser = session.user;
                console.log('👤 로그인 감지:', session.user.email);
                window.updateProfileUI(session.user);
            } else if (event === 'SIGNED_OUT') {
                window.currentUser = null;
                console.log('👋 로그아웃');
            }
        });
    }

    // CloudManager 자동 로드
    const script = document.createElement('script');
    script.src = 'js/modules/CloudManager.js?v=9';
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
