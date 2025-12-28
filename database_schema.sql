-- ============================================
-- Supabase 데이터베이스 스키마 정의
-- 회로 라이브러리 공유 및 실시간 협업 기능
-- ============================================

-- 1. 프로젝트 공개 설정 확장 (기존 projects 테이블 수정)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS forks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_likes ON projects(likes DESC);

-- 2. 좋아요 테이블
CREATE TABLE IF NOT EXISTS project_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_project ON project_likes(project_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON project_likes(user_id);

-- 3. 포크 관계 테이블
CREATE TABLE IF NOT EXISTS project_forks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    forked_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forks_original ON project_forks(original_project_id);
CREATE INDEX IF NOT EXISTS idx_forks_forked ON project_forks(forked_project_id);

-- 4. 댓글 테이블
CREATE TABLE IF NOT EXISTS project_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    user_name TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON project_comments(user_id);

-- 5. 프로젝트 조회수 추적
CREATE TABLE IF NOT EXISTS project_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_project ON project_views(project_id);

-- 6. 실시간 협업 - 협업자 테이블
CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    user_name TEXT,
    role TEXT DEFAULT 'viewer', -- 'owner', 'editor', 'viewer'
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON project_collaborators(user_id);

-- 7. 실시간 협업 - 온라인 사용자 상태
CREATE TABLE IF NOT EXISTS collaboration_presence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    user_name TEXT,
    cursor_x FLOAT,
    cursor_y FLOAT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_project ON collaboration_presence(project_id);

-- 8. 실시간 협업 - 변경 이력 (충돌 방지용)
CREATE TABLE IF NOT EXISTS collaboration_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    change_type TEXT, -- 'add_component', 'move_component', 'add_wire', etc.
    change_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changes_project ON collaboration_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_changes_timestamp ON collaboration_changes(timestamp DESC);

-- 9. Row Level Security (RLS) 정책

-- projects 테이블: 공개 프로젝트는 모두 읽기 가능
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public projects are viewable by everyone" ON projects;
CREATE POLICY "Public projects are viewable by everyone"
ON projects FOR SELECT
USING (is_public = TRUE OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
CREATE POLICY "Users can insert own projects"
ON projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own projects"
ON projects FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can delete own projects"
ON projects FOR DELETE
USING (auth.uid() = user_id);

-- project_likes: 인증된 사용자만 좋아요 가능
ALTER TABLE project_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view likes" ON project_likes;
CREATE POLICY "Anyone can view likes"
ON project_likes FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Users can like projects" ON project_likes;
CREATE POLICY "Users can like projects"
ON project_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike projects" ON project_likes;
CREATE POLICY "Users can unlike projects"
ON project_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- project_comments: 인증된 사용자만 댓글 작성
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON project_comments;
CREATE POLICY "Anyone can view comments"
ON project_comments FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Users can create comments" ON project_comments;
CREATE POLICY "Users can create comments"
ON project_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON project_comments;
CREATE POLICY "Users can update own comments"
ON project_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON project_comments;
CREATE POLICY "Users can delete own comments"
ON project_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- project_collaborators: 프로젝트 소유자와 협업자만 접근
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collaborators can view" ON project_collaborators;
CREATE POLICY "Collaborators can view"
ON project_collaborators FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id)
);

DROP POLICY IF EXISTS "Project owners can manage collaborators" ON project_collaborators;
CREATE POLICY "Project owners can manage collaborators"
ON project_collaborators FOR ALL
TO authenticated
USING (
    auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id)
);

-- collaboration_presence: 협업자만 접근
ALTER TABLE collaboration_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collaborators can view presence" ON collaboration_presence;
CREATE POLICY "Collaborators can view presence"
ON collaboration_presence FOR SELECT
TO authenticated
USING (
    project_id IN (
        SELECT project_id FROM project_collaborators WHERE user_id = auth.uid()
        UNION
        SELECT id FROM projects WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update own presence" ON collaboration_presence;
CREATE POLICY "Users can update own presence"
ON collaboration_presence FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- 10. 트리거: 자동 좋아요 카운트 업데이트
CREATE OR REPLACE FUNCTION update_project_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE projects SET likes = likes + 1 WHERE id = NEW.project_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE projects SET likes = likes - 1 WHERE id = OLD.project_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_likes ON project_likes;
CREATE TRIGGER trigger_update_likes
AFTER INSERT OR DELETE ON project_likes
FOR EACH ROW EXECUTE FUNCTION update_project_likes_count();

-- 11. 트리거: 자동 포크 카운트 업데이트
CREATE OR REPLACE FUNCTION update_project_forks_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE projects SET forks = forks + 1 WHERE id = NEW.original_project_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_forks ON project_forks;
CREATE TRIGGER trigger_update_forks
AFTER INSERT ON project_forks
FOR EACH ROW EXECUTE FUNCTION update_project_forks_count();

-- 12. 함수: 인기 프로젝트 가져오기
CREATE OR REPLACE FUNCTION get_trending_projects(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    user_id UUID,
    views INTEGER,
    likes INTEGER,
    forks INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    thumbnail_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description,
        p.user_id,
        p.views,
        p.likes,
        p.forks,
        p.created_at,
        p.thumbnail_url
    FROM projects p
    WHERE p.is_public = TRUE
    ORDER BY 
        (p.likes * 3 + p.views + p.forks * 5) DESC,
        p.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 13. 함수: 사용자별 통계
CREATE OR REPLACE FUNCTION get_user_stats(target_user_id UUID)
RETURNS TABLE (
    total_projects INTEGER,
    total_public_projects INTEGER,
    total_likes INTEGER,
    total_views INTEGER,
    total_forks INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_projects,
        COUNT(*) FILTER (WHERE is_public = TRUE)::INTEGER as total_public_projects,
        COALESCE(SUM(likes), 0)::INTEGER as total_likes,
        COALESCE(SUM(views), 0)::INTEGER as total_views,
        COALESCE(SUM(forks), 0)::INTEGER as total_forks
    FROM projects
    WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- 완료!
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요.
