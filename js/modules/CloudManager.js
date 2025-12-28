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

        // 썸네일 생성 (제거됨: 정적 로고 사용)
        let thumbnail = null;

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

                if (!silent && this.sim.showToast) {
                    this.sim.showToast('저장되었습니다!', 'success');
                } else if (!silent) {
                    // Fallback if toast not available
                    console.log('Save success (Toast missing)');
                }
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
            // 1. 프로젝트 데이터 로드
            const { data: projectData, error } = await window.sb
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (error) throw error;

            if (projectData && projectData.data) {
                // 2. 데이터 가져오기 (컴포넌트, 와이어 등)
                this.sim.importProjectData(projectData.data);

                this.sim.currentCloudId = projectData.id;
                this.sim.currentProjectId = projectData.id;
                this.sim.currentProjectName = projectData.title;

                // 3. UI 업데이트
                const nameInput = document.getElementById('project-name-input');
                if (nameInput) nameInput.value = projectData.title;

                this.updateSaveStatusUI('saved', '불러오기 완료');
                console.log('Project loaded from Cloud:', projectData.title);

                // 4. [보안] 권한 체크 및 읽기 모드 강제 적용
                const { data: { user } } = await window.sb.auth.getUser();
                const currentUserId = user ? user.id : null;
                const ownerId = projectData.user_id;

                // 이미 URL로 읽기 모드이거나, 주인이 아닌 경우
                // (ownerId가 없으면 로컬 프로젝트일 수 있으므로 건드리지 않음. 하지만 클라우드에서 왔다면 ownerId는 있음)
                const isOwner = currentUserId && ownerId && (currentUserId === ownerId);

                if (window.isReadOnlyMode || (ownerId && !isOwner)) {
                    console.log(`🔒 Read-only enforced. Owner: ${ownerId}, You: ${currentUserId}`);

                    // 상태 강제 설정
                    window.isReadOnlyMode = true;
                    this.sim.isReadOnly = true;
                    if (this.sim.setMode) {
                        this.sim.setMode('pan');
                    }

                    // CSS 방어막 가동
                    document.body.classList.add('readonly-mode');

                    // 배너가 없으면 추가 (simulator.html의 로직 복사)
                    if (!document.getElementById('readonly-banner')) {
                        const banner = document.createElement('div');
                        banner.id = 'readonly-banner'; // 중복 방지 ID
                        banner.className = 'readonly-banner-dynamic';
                        banner.style.cssText = `
                            width: 100%;
                            height: 40px;
                            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 14px;
                            font-weight: 600;
                            z-index: 900;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                            font-family: 'Inter', sans-serif;
                            flex-shrink: 0;
                        `;
                        banner.innerHTML = '<span>👀 <b>읽기 전용 모드</b> - 회로를 수정할 수 없습니다. (편집 권한 없음)</span>';

                        // workspace-wrapper 찾기
                        const wrapper = document.querySelector('.workspace-wrapper');
                        if (wrapper) {
                            wrapper.insertBefore(banner, wrapper.firstChild);
                        } else {
                            banner.style.position = 'fixed';
                            banner.style.top = '50px'; // 헤더 높이에 맞춤
                            document.body.appendChild(banner);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Load failed:', e);
            this.updateSaveStatusUI('error', '불러오기 실패');
        }
    }
}

// 전역에서 접근 가능하도록 설정
window.CloudManager = CloudManager;
