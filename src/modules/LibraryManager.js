/**
 * LibraryManager.js
 * 회로 라이브러리 공유 기능 관리
 */

class LibraryManager {
    constructor() {
        this.currentFilter = 'trending'; // 'trending', 'latest', 'most_liked'
        this.currentProjects = [];
        this.currentPage = 1;
        this.projectsPerPage = 12;
    }

    /**
     * 공개 프로젝트 목록 가져오기
     */
    async getPublicProjects(filter = 'trending', page = 1) {
        if (!window.sb) {
            throw new Error('Supabase not initialized');
        }

        const limit = this.projectsPerPage;
        const offset = (page - 1) * limit;

        let query = window.sb
            .from('projects')
            .select('*')
            .eq('is_public', true)
            .range(offset, offset + limit - 1);

        // 필터 적용
        switch (filter) {
            case 'trending':
                // 인기순: 좋아요 * 3 + 조회수 + 포크 * 5
                query = query.order('likes', { ascending: false });
                break;
            case 'latest':
                query = query.order('created_at', { ascending: false });
                break;
            case 'most_liked':
                query = query.order('likes', { ascending: false });
                break;
            case 'most_viewed':
                query = query.order('views', { ascending: false });
                break;
        }

        const { data, error } = await query;

        if (error) throw error;

        this.currentProjects = data || [];
        return this.currentProjects;
    }

    /**
     * 프로젝트를 공개로 설정
     */
    async makeProjectPublic(projectId, description = '', tags = []) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await window.sb
            .from('projects')
            .update({
                is_public: true,
                description: description,
                tags: tags,
                updated_at: new Date().toISOString()
            })
            .eq('id', projectId)
            .eq('user_id', user.id)
            .select();

        if (error) throw error;

        return data[0];
    }

    /**
     * 프로젝트를 비공개로 설정
     */
    async makeProjectPrivate(projectId) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await window.sb
            .from('projects')
            .update({
                is_public: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', projectId)
            .eq('user_id', user.id)
            .select();

        if (error) throw error;

        return data[0];
    }

    /**
     * 프로젝트 좋아요
     */
    async likeProject(projectId) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) throw new Error('Please login to like projects');

        // 이미 좋아요 했는지 확인
        const { data: existing } = await window.sb
            .from('project_likes')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .single();

        if (existing) {
            // 좋아요 취소
            const { error } = await window.sb
                .from('project_likes')
                .delete()
                .eq('project_id', projectId)
                .eq('user_id', user.id);

            if (error) throw error;
            return { liked: false };
        } else {
            // 좋아요 추가
            const { error } = await window.sb
                .from('project_likes')
                .insert({
                    project_id: projectId,
                    user_id: user.id
                });

            if (error) throw error;
            return { liked: true };
        }
    }

    /**
     * 프로젝트가 좋아요 되어있는지 확인
     */
    async isProjectLiked(projectId) {
        if (!window.sb) return false;

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) return false;

        const { data } = await window.sb
            .from('project_likes')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .single();

        return !!data;
    }

    /**
     * 프로젝트 포크 (복사)
     */
    async forkProject(originalProjectId) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) throw new Error('Please login to fork projects');

        // 원본 프로젝트 가져오기
        const { data: original, error: fetchError } = await window.sb
            .from('projects')
            .select('*')
            .eq('id', originalProjectId)
            .single();

        if (fetchError) throw fetchError;

        // 새 프로젝트 생성
        const forkedData = {
            user_id: user.id,
            title: original.title + ' (Fork)',
            data: original.data,
            is_public: false, // 포크는 기본적으로 비공개
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: forked, error: createError } = await window.sb
            .from('projects')
            .insert(forkedData)
            .select()
            .single();

        if (createError) throw createError;

        // 포크 관계 기록
        const { error: forkError } = await window.sb
            .from('project_forks')
            .insert({
                original_project_id: originalProjectId,
                forked_project_id: forked.id,
                user_id: user.id
            });

        if (forkError) throw forkError;

        return forked;
    }

    /**
     * 댓글 추가
     */
    async addComment(projectId, content) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) throw new Error('Please login to comment');

        const userName = user.user_metadata?.full_name || user.email.split('@')[0];

        const { data, error } = await window.sb
            .from('project_comments')
            .insert({
                project_id: projectId,
                user_id: user.id,
                user_email: user.email,
                user_name: userName,
                content: content
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    /**
     * 댓글 목록 가져오기
     */
    async getComments(projectId) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data, error } = await window.sb
            .from('project_comments')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data || [];
    }

    /**
     * 댓글 삭제
     */
    async deleteComment(commentId) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await window.sb
            .from('project_comments')
            .delete()
            .eq('id', commentId)
            .eq('user_id', user.id);

        if (error) throw error;
    }

    /**
     * 프로젝트 조회수 증가
     */
    async incrementViews(projectId) {
        if (!window.sb) return;

        try {
            // RPC가 있으면 사용, 없으면 그냥 스킵 (조회수는 선택적 기능)
            await window.sb.rpc('increment_project_views', { p_id: projectId }).catch(() => {
                // RPC가 없으면 무시
            });
        } catch (e) {
            // 조회수 증가 실패해도 진행
            console.warn('[LibraryManager] incrementViews failed (non-critical):', e);
        }
    }

    /**
     * 검색
     */
    async searchProjects(query) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data, error } = await window.sb
            .from('projects')
            .select('*')
            .eq('is_public', true)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .order('likes', { ascending: false })
            .limit(20);

        if (error) throw error;

        return data || [];
    }

    /**
     * 태그로 필터링
     */
    async getProjectsByTag(tag) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data, error } = await window.sb
            .from('projects')
            .select('*')
            .eq('is_public', true)
            .contains('tags', [tag])
            .order('likes', { ascending: false });

        if (error) throw error;

        return data || [];
    }

    /**
     * 사용자 통계 가져오기
     */
    async getUserStats(userId) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data, error } = await window.sb
            .rpc('get_user_stats', { target_user_id: userId });

        if (error) throw error;

        return data[0];
    }

    /**
     * [UI] 트렌딩 프로젝트 로드 및 렌더링
     */
    async loadTrendingProjects() {
        const grid = document.getElementById('trending-grid');
        if (!grid) return;

        try {
            grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>불러오는 중...</p></div>';
            const projects = await this.getPublicProjects('trending');
            this.renderProjectGrid(projects, grid);
        } catch (error) {
            console.error('Failed to load trending projects:', error);
            grid.innerHTML = `<div class="error-message">프로젝트를 불러오지 못했습니다.<br>${error.message}</div>`;
        }
    }

    /**
     * [UI] 최신 프로젝트 로드 및 렌더링
     */
    async loadLatestProjects() {
        const grid = document.getElementById('latest-grid');
        if (!grid) return;

        try {
            grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            const projects = await this.getPublicProjects('latest');
            this.renderProjectGrid(projects, grid);
        } catch (error) {
            console.error('Failed to load latest projects:', error);
            grid.innerHTML = `<div class="error-message">오류 발생</div>`;
        }
    }

    /**
     * [UI] 프로젝트 그리드 렌더링
     */
    renderProjectGrid(projects, container) {
        if (!projects || projects.length === 0) {
            container.innerHTML = '<div class="empty-state">프로젝트가 없습니다.</div>';
            return;
        }

        container.innerHTML = projects.map(p => this.createProjectCardHTML(p)).join('');
    }

    createProjectCardHTML(project) {
        const title = project.title || 'Untitled Project';
        const author = project.author_name || 'Anonymous';
        const likes = project.likes || 0;
        const views = project.views || 0;
        const desc = project.description || '';
        const thumbnail = project.thumbnail_url
            ? `<img src="${project.thumbnail_url}" alt="${title}">`
            : `<div class="thumbnail-placeholder" style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;color:#333;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;

        return `
            <div class="project-card" onclick="location.href='simulator.html?project=${project.id}'">
                <div class="card-thumbnail">
                    ${thumbnail}
                </div>
                <div class="card-body">
                    <div class="card-header">
                        <div class="author-avatar">${(author[0] || 'A').toUpperCase()}</div>
                        <div class="author-info">
                            <div class="author-name">${author}</div>
                            <div class="project-date">${new Date(project.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="card-title">${title}</div>
                    <div class="card-description">${desc}</div>
                    <div class="card-footer">
                        <div class="card-stats">
                            <div class="stat">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                ${likes}
                            </div>
                            <div class="stat">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                ${views}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// 전역 등록
window.LibraryManager = LibraryManager;
