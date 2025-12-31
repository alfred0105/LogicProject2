/**
 * PostManager - 게시글 관리 시스템
 */

// 중복 로드 방지
if (window.PostManager) {
    console.log('[PostManager] Already loaded, skipping...');
} else {

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
         * 회로를 첨부할 경우 스냅샷으로 저장 (원본 프로젝트 변경 시 영향 없음)
         */
        async createPost(title, content, category = 'general', tags = [], projectId = null) {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('로그인이 필요합니다');

            let circuitSnapshot = null;
            let circuitTitle = null;

            // 프로젝트가 선택된 경우 스냅샷 생성
            if (projectId) {
                const { data: project, error: projError } = await window.sb
                    .from('projects')
                    .select('title, description, data')
                    .eq('id', projectId)
                    .single();

                if (!projError && project) {
                    circuitTitle = project.title;
                    circuitSnapshot = project.data; // 회로 데이터 스냅샷
                }
            }

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
                    project_id: projectId, // 레거시 호환성 (참조용)
                    circuit_snapshot: circuitSnapshot, // 스냅샷 데이터
                    circuit_title: circuitTitle, // 회로 제목
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
            // 조회수 증가 (먼저 실행하여 최신 조회수 반영)
            await this.incrementViews(postId);

            const { data, error } = await window.sb
                .from('posts')
                .select('*')
                .eq('id', postId)
                .single();

            if (error) throw error;

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
            // 중복 방지: 로컬 스토리지 확인 (1시간)
            const storageKey = `viewed_post_${postId}`;
            const lastViewed = localStorage.getItem(storageKey);
            const now = Date.now();

            if (lastViewed && (now - parseInt(lastViewed) < 3600000)) {
                return; // 1시간 내 재방문 시 증가 안 함
            }

            // RPC 호출 (increment_views 함수가 DB에 있어야 함)
            const { error } = await window.sb.rpc('increment_views', { row_id: postId });

            if (!error) {
                localStorage.setItem(storageKey, now.toString());
            } else {
                console.warn('Failed to increment views (RPC missing?):', error);
            }
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

        /**
         * 내가 작성한 게시글 가져오기
         */
        async getMyPosts(limit = 10) {
            const user = await this.getCurrentUser();
            if (!user) return [];

            const { data, error } = await window.sb
                .from('posts')
                .select('*, projects(id, title)')
                .eq('user_id', user.id)
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
}
