/**
 * CloudManager.js
 * Supabase와 연동하여 프로젝트를 저장하고 불러오는 역할을 합니다.
 */

class CloudManager {
    constructor(simulator) {
        this.sim = simulator;
        this.autoSaveTimer = null;
        this.lastSavedTime = null;
        this.checkLoginStatus();
    }

    async checkLoginStatus() {
        if (!window.sb) return; // SupabaseClient.js가 로드되지 않음

        try {
            const { data: { user } } = await window.sb.auth.getUser();
            this.user = user;
            if (user) {
                console.log('Cloud: Logged in as', user.email);
                this.updateSaveStatusUI('ready', '저장 준비됨');
            } else {
                this.updateSaveStatusUI('offline', '오프라인 (로그인 필요)');
            }
        } catch (e) {
            console.error('Cloud: Auth check failed', e);
        }
    }

    /**
     * 자동 저장 트리거 (Debounce)
     * 변경 사항이 발생했을 때 호출
     */
    async triggerAutoSave() {
        // 로그인 상태 백그라운드 확인
        if (!this.user) {
            this.checkLoginStatus().catch(() => { });
        }

        // 사전 차단 제거: saveProjectToCloud 내부에서 최종 확인하므로 여기서는 진행시킴
        // if (!this.user) return; (Deleted)

        // console.log('Auto-save triggered...'); 
        this.updateSaveStatusUI('pending', '변경사항 저장 대기 중...');

        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // 3초 후 저장
        this.autoSaveTimer = setTimeout(() => {
            this.saveProjectToCloud(null, true); // silent=true
        }, 3000);
    }

    /**
     * 저장 상태 UI 업데이트
     */
    updateSaveStatusUI(status, message) {
        const statusEl = document.getElementById('save-status');
        if (!statusEl) return;

        statusEl.textContent = message;

        switch (status) {
            case 'saving':
                statusEl.style.color = '#facc15'; // Yellow
                break;
            case 'saved':
                statusEl.style.color = '#4ade80'; // Green
                break;
            case 'error':
                statusEl.style.color = '#f87171'; // Red
                break;
            case 'pending':
                statusEl.style.color = '#94a3b8'; // Gray
                break;
            default:
                statusEl.style.color = '#94a3b8';
        }
    }

    /**
     * 현재 프로젝트를 Supabase에 저장 (Update or Insert)
     * @param {string} [projectName] - 프로젝트 이름 (생략 시 현재 이름)
     * @param {boolean} [silent] - 알림창 표시 여부 (true면 표시 안 함)
     */
    async saveProjectToCloud(projectName, silent = false) {
        if (!window.sb) {
            if (!silent) alert('오류: Supabase가 연결되지 않았습니다.');
            return;
        }

        // 로그인 확인
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) {
            this.updateSaveStatusUI('error', '로그인 필요');
            if (!silent && confirm('로그인이 필요한 기능입니다. 로그인 페이지로 이동하시겠습니까?')) {
                window.location.href = 'login.html';
            }
            return;
        }

        this.updateSaveStatusUI('saving', '저장 중...');

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
                    .select();

                data = result.data;
                error = result.error;
            } else {
                // 새 프로젝트 생성 (Insert)
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
                this.sim.currentProjectId = savedProject.id;
                this.sim.currentProjectName = savedProject.title;

                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                this.lastSavedTime = timeStr;
                this.updateSaveStatusUI('saved', `저장됨 (${timeStr})`);

                if (!silent) alert(`저장되었습니다!`);
                console.log('Project saved:', savedProject);

                // URL 업데이트
                const newUrl = new URL(window.location.href);
                if (newUrl.searchParams.get('id') !== savedProject.id) {
                    newUrl.searchParams.set('id', savedProject.id);
                    newUrl.searchParams.delete('new');
                    window.history.replaceState({}, '', newUrl);
                }
            }

        } catch (e) {
            console.error('Save failed:', e);
            this.updateSaveStatusUI('error', '저장 실패');
            if (!silent) alert('저장 실패: ' + e.message);
        }
    }

    /**
     * 프로젝트 불러오기
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
                this.sim.importProjectData(data.data);

                this.sim.currentCloudId = data.id;
                this.sim.currentProjectId = data.id;
                this.sim.currentProjectName = data.title;

                // UI 업데이트
                const nameInput = document.getElementById('project-name-input');
                if (nameInput) nameInput.value = data.title;

                this.updateSaveStatusUI('saved', '불러오기 완료');
                console.log('Project loaded from Cloud:', data.title);
            }
        } catch (e) {
            console.error('Load failed:', e);
            this.updateSaveStatusUI('error', '불러오기 실패');
        }
    }
}

// 전역에서 접근 가능하도록 설정
window.CloudManager = CloudManager;
