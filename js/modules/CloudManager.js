/**
 * CloudManager.js
 * Supabase와 연동하여 프로젝트를 저장하고 불러오는 역할을 합니다.
 */

class CloudManager {
    constructor(simulator) {
        this.sim = simulator;
        this.checkLoginStatus();
    }

    async checkLoginStatus() {
        if (!window.sb) return; // SupabaseClient.js가 로드되지 않음

        try {
            const { data: { user } } = await window.sb.auth.getUser();
            this.user = user;
            if (user) {
                console.log('Cloud: Logged in as', user.email);
            }
        } catch (e) {
            console.error('Cloud: Auth check failed', e);
        }
    }

    /**
     * 현재 프로젝트를 Supabase에 저장
     */
    async saveProjectToCloud(projectName) {
        if (!window.sb) {
            alert('오류: Supabase가 연결되지 않았습니다.');
            return;
        }

        // 로그인 확인
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) {
            if (confirm('로그인이 필요한 기능입니다. 로그인 페이지로 이동하시겠습니까?')) {
                window.location.href = 'login.html';
            }
            return;
        }

        // 저장할 데이터 준비
        const projectData = this.sim.exportProjectData(); // 시뮬레이터에서 JSON 데이터 추출

        // Supabase에 저장 (Upsert: 기존 ID가 있으면 업데이트, 없으면 생성)
        // 현재는 간단하게 항상 새 프로젝트로 가정하거나, 로컬스토리지에 저장된 cloud_id가 있는지 확인해야 함.
        // 여기서는 단순 Insert 구현

        try {
            const { data, error } = await window.sb
                .from('projects')
                .insert([
                    {
                        user_id: user.id,
                        title: projectName || 'Untitled Project',
                        data: projectData,
                        created_at: new Date().toISOString()
                    }
                ])
                .select();

            if (error) throw error;

            alert('클라우드에 저장되었습니다!');
            console.log('Project saved:', data);
        } catch (e) {
            console.error('Save failed:', e);
            alert('저장 실패: ' + e.message);
        }
    }

    /**
     * 프로젝트 불러오기 (index.html?id=... 로 진입했을 때 사용)
     */
    async loadProjectFromCloud(projectId) {
        if (!window.sb) return;

        try {
            const { data, error } = await window.sb
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (error) throw error;

            if (data && data.data) {
                this.sim.importProjectData(data.data); // 시뮬레이터에 데이터 로드
                console.log('Project loaded:', data.title);
            }
        } catch (e) {
            console.error('Load failed:', e);
            alert('프로젝트를 불러오지 못했습니다.');
        }
    }
}

// 전역에서 접근 가능하도록 설정
window.CloudManager = CloudManager;
