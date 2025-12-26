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
     * 현재 프로젝트를 Supabase에 저장 (Update or Insert)
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
        const title = projectName || this.sim.currentProjectName || 'Untitled Project';
        const now = new Date().toISOString();

        try {
            let data, error;

            // 이미 클라우드 ID가 있으면 업데이트 시도
            if (this.sim.currentCloudId) {
                console.log('Updating existing project:', this.sim.currentCloudId);
                const result = await window.sb
                    .from('projects')
                    .update({
                        title: title,
                        data: projectData,
                        updated_at: now
                    })
                    .eq('id', this.sim.currentCloudId)
                    .select(); // 업데이트된 데이터 반환

                data = result.data;
                error = result.error;
            } else {
                // 새 프로젝트 생성 (Insert)
                // 만약 현재 프로젝트 ID가 UUID 형식(Supabase ID)이라면 해당 ID로 Insert 시도해볼 수 있음 (복구 등)
                // 하지만 안전하게 새 ID 생성
                console.log('Creating new cloud project');
                const result = await window.sb
                    .from('projects')
                    .insert([
                        {
                            user_id: user.id,
                            title: title,
                            data: projectData,
                            created_at: now,
                            updated_at: now
                        }
                    ])
                    .select();

                data = result.data;
                error = result.error;
            }

            if (error) throw error;

            if (data && data.length > 0) {
                const savedProject = data[0];
                this.sim.currentCloudId = savedProject.id;
                this.sim.currentProjectId = savedProject.id; // 로컬 ID도 동기화
                this.sim.currentProjectName = savedProject.title;

                alert(`클라우드에 저장되었습니다! (${savedProject.title})`);
                console.log('Project saved:', savedProject);

                // URL 업데이트 (새로 만든 경우 ID 반영)
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('id', savedProject.id);
                newUrl.searchParams.delete('new'); // new 플래그 제거
                window.history.replaceState({}, '', newUrl);
            }

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

                // 클라우드 ID 설정 (중요: 다음 저장 시 업데이트로 처리됨)
                this.sim.currentCloudId = data.id;
                this.sim.currentProjectId = data.id;
                this.sim.currentProjectName = data.title;

                console.log('Project loaded from Cloud:', data.title);
                if (this.sim.showToast) this.sim.showToast(`☁️ 프로젝트 로드됨: ${data.title}`, 'success');
            }
        } catch (e) {
            console.error('Load failed:', e);
            // 로컬 스토리지에 있을 수 있으므로 조용히 실패하거나 경고
            if (!localStorage.getItem(projectId)) {
                alert('프로젝트를 불러오지 못했습니다. (클라우드/로컬 없음)');
            }
        }
    }
}

// 전역에서 접근 가능하도록 설정
window.CloudManager = CloudManager;
