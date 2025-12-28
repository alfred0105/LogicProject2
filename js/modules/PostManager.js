/**
 * PostManager - 게시글 관리 시스템
 */

class PostManager {
    constructor() {
        this.currentUser = null;
    }

    /**
     * 사용자 정보 가져오기
     */
    async getCurrentUser() {
        if (this.currentUser) return this.currentUser;

        const { data: { user } } = await window.sb.auth.getUser();
        if (user) {
            const { data: profile } = await window.sb
                .from('user_profiles')
                .select('username, display_name')
                .eq('id', user.id)
                .single();

            this.currentUser = {
                id: user.id,
                email: user.email,
                name: profile?.display_name || profile?.username || user.email.split('@')[0]
            };
        }
        return this.currentUser;
    }

    /**
     * 게시글 작성
     */
    async createPost(title, content, category = 'general', tags = [], projectId = null) {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('로그인이 필요합니다');

        const { data, error } = await window.sb
            .from('posts')
            .insert({
                user_id: user.id,
                user_email: user.email,
                user_name: user.name,
                title: title,
                content: content,
                category: category,
                tags: tags,
                project_id: projectId, // 회로 첨부
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * 게시글 목록 가져오기
     */
    async getPosts(category = null, page = 1, limit = 10) {
        let query = window.sb
            .from('posts')
            .select('*, projects(id, title)') // 프로젝트 정보 포함
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    /**
     * 게시글 상세 보기
     */
    async getPost(postId) {
        const { data, error } = await window.sb
            .from('posts')
            .select('*')
            .eq('id', postId)
            .single();

        if (error) throw error;

        // 조회수 증가
        await this.incrementViews(postId);

        return data;
    }

    /**
     * 게시글 수정
     */
    async updatePost(postId, updates) {
        const { data, error } = await window.sb
            .from('posts')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', postId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * 게시글 삭제
     */
    async deletePost(postId) {
        const { error } = await window.sb
            .from('posts')
            .delete()
            .eq('id', postId);

        if (error) throw error;
    }

    /**
     * 조회수 증가
     */
    async incrementViews(postId) {
        const { error } = await window.sb.rpc('increment', {
            table_name: 'posts',
            row_id: postId,
            column_name: 'views'
        }).catch(() => {
            // Fallback if RPC doesn't exist
            window.sb
                .from('posts')
                .update({ views: window.sb.sql`views + 1` })
                .eq('id', postId);
        });
    }

    /**
     * 좋아요 토글
     */
    async toggleLike(postId) {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('로그인이 필요합니다');

        // 이미 좋아요 했는지 확인
        const { data: existing } = await window.sb
            .from('post_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .single();

        if (existing) {
            // 좋아요 취소
            await window.sb
                .from('post_likes')
                .delete()
                .eq('id', existing.id);
            return { liked: false };
        } else {
            // 좋아요
            await window.sb
                .from('post_likes')
                .insert({
                    post_id: postId,
                    user_id: user.id
                });
            return { liked: true };
        }
    }

    /**
     * 좋아요 여부 확인
     */
    async isLiked(postId) {
        const user = await this.getCurrentUser();
        if (!user) return false;

        const { data } = await window.sb
            .from('post_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .single();

        return !!data;
    }

    /**
     * 댓글 작성
     */
    async addComment(postId, content) {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('로그인이 필요합니다');

        const { data, error } = await window.sb
            .from('post_comments')
            .insert({
                post_id: postId,
                user_id: user.id,
                user_email: user.email,
                user_name: user.name,
                content: content,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * 댓글 목록 가져오기
     */
    async getComments(postId) {
        const { data, error } = await window.sb
            .from('post_comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * 댓글 삭제
     */
    async deleteComment(commentId) {
        const { error } = await window.sb
            .from('post_comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;
    }

    /**
     * 인기 게시글 가져오기
     */
    async getTrendingPosts(limit = 5) {
        const { data, error } = await window.sb
            .from('posts')
            .select('*, projects(id, title)')
            .order('likes', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * 최신 게시글 가져오기 (메인 페이지용)
     */
    async getRecentPosts(limit = 4) {
        const { data, error } = await window.sb
            .from('posts')
            .select('*, projects(id, title)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }
}

// 전역 등록
if (typeof window !== 'undefined') {
    window.PostManager = PostManager;
}
