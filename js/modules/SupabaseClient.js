/**
 * Supabase 클라이언트 설정
 * 작성된 URL과 KEY를 본인의 Supabase 프로젝트 정보로 교체하세요.
 */

// =========================================================================
// [중요] 아래 두 변수에 Supabase 대시보드에서 복사한 값을 붙여넣으세요.
// =========================================================================
const SUPABASE_URL = 'https://vaxukhoepptadsosygya.supabase.co';
const SUPABASE_KEY = 'sb_secret_9VjPJWwQvc3RFpvnjgABZQ_ELU5--xC';
// =========================================================================

// Supabase 클라이언트 초기화
let supabase;

if (typeof createClient !== 'undefined') {
    // CDN 방식 (구형)
    // supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
}

// @supabase/supabase-js@2 CDN 사용 시 전역 객체 이름은 'supabase' 객체 내의 createClient입니다.
if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase 연결 설정됨');
} else {
    console.error('❌ Supabase 라이브러리가 로드되지 않았습니다. HTML <head>를 확인하세요.');
}

// 전역에서 사용할 수 있도록 설정
window.sb = supabase;

/**
 * 로그인 상태 확인 및 유저 정보 반환
 */
async function getCurrentUser() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * 구글 로그인 시작
 */
async function signInWithGoogle() {
    if (!supabase) return;
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/dashboard.html' // 로그인 후 대시보드로 이동
        }
    });
    if (error) alert('로그인 오류: ' + error.message);
}

/**
 * 로그아웃
 */
async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (!error) {
        window.location.href = 'index.html'; // 메인으로 이동
    }
}

// =========================================================
// CloudManager 자동 로드 및 연결
// =========================================================
(function loadCloudManager() {
    const script = document.createElement('script');
    script.src = 'js/modules/CloudManager.js';
    script.onload = () => {
        console.log('✅ CloudManager module loaded');

        // 시뮬레이터 인스턴스(window.sim)가 준비되면 CloudManager 연결
        const checkSim = setInterval(() => {
            if (window.sim && window.CloudManager) {
                clearInterval(checkSim);
                window.sim.cloud = new window.CloudManager(window.sim);
                console.log('☁️ Cloud functionality attached to Simulator');

                // UI '저장' 버튼 동작 가로채기 (선택 사항)
                // 기존 저장 버튼이 있다면 클릭 이벤트를 수정할 수 있습니다.
            }
        }, 500);
    };
    document.head.appendChild(script);
})();
