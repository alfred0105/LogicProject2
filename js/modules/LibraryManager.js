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

        // 조회 기록 추가
        const { data: { user } } = await window.sb.auth.getUser();

        await window.sb
            .from('project_views')
            .insert({
                project_id: projectId,
                user_id: user?.id || null,
                ip_address: null // 클라이언트 측에서는 IP를 알 수 없음
            });

        // 조회수 증가
        const { error } = await window.sb
            .from('projects')
            .update({ views: window.sb.raw('views + 1') })
            .eq('id', projectId);

        if (error) console.error('Failed to increment views:', error);
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
}

// 전역 등록
window.LibraryManager = LibraryManager;
