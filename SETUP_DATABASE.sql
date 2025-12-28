-- ============================================
-- LoCAD 완전한 데이터베이스 설정
-- 이 파일 하나만 실행하면 모든 테이블이 생성됩니다
-- ============================================

-- ============================================
-- STEP 1: Projects 테이블 수정 (오류 수정)
-- ============================================

DO $$ 
BEGIN
    -- data 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'data'
    ) THEN
        ALTER TABLE projects ADD COLUMN data JSONB;
    END IF;

    -- content 컬럼이 있으면 삭제 (혼동 방지)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'content'
    ) THEN
        ALTER TABLE projects DROP COLUMN content;
    END IF;
END $$;

-- ============================================
-- STEP 2: 라이브러리 공유 기본 테이블
-- ============================================

-- 프로젝트 공개 설정 확장
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS forks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_likes ON projects(likes DESC);

-- 좋아요 테이블
CREATE TABLE IF NOT EXISTS project_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_project ON project_likes(project_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON project_likes(user_id);

-- 포크 관계 테이블
CREATE TABLE IF NOT EXISTS project_forks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    forked_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forks_original ON project_forks(original_project_id);
CREATE INDEX IF NOT EXISTS idx_forks_forked ON project_forks(forked_project_id);

-- 댓글 테이블
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

-- 조회수 추적 테이블
CREATE TABLE IF NOT EXISTS project_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_project ON project_views(project_id);

-- 협업자 테이블
CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    user_name TEXT,
    role TEXT DEFAULT 'viewer',
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON project_collaborators(user_id);

-- 온라인 사용자 상태 테이블
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

-- 변경 이력 테이블
CREATE TABLE IF NOT EXISTS collaboration_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    change_type TEXT,
    change_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changes_project ON collaboration_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_changes_timestamp ON collaboration_changes(timestamp DESC);

-- ============================================
-- STEP 3: 사용자 프로필 & 협업 초대
-- ============================================

-- 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- 협업 초대 테이블
CREATE TABLE IF NOT EXISTS collaboration_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'editor',
    status TEXT DEFAULT 'pending',
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(project_id, invitee_email)
);

CREATE INDEX IF NOT EXISTS idx_invites_project ON collaboration_invites(project_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON collaboration_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invites_status ON collaboration_invites(status);

-- project_collaborators에 invite_id 추가
ALTER TABLE project_collaborators 
ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES collaboration_invites(id) ON DELETE SET NULL;

-- ============================================
-- STEP 4: RLS (Row Level Security) 정책
-- ============================================

-- projects
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

-- project_likes
ALTER TABLE project_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view likes" ON project_likes;
CREATE POLICY "Anyone can view likes"
ON project_likes FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Users can like projects" ON project_likes;
CREATE POLICY "Users can like projects"
ON project_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike projects" ON project_likes;
CREATE POLICY "Users can unlike projects"
ON project_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- project_comments
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON project_comments;
CREATE POLICY "Anyone can view comments"
ON project_comments FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Users can create comments" ON project_comments;
CREATE POLICY "Users can create comments"
ON project_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON project_comments;
CREATE POLICY "Users can update own comments"
ON project_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON project_comments;
CREATE POLICY "Users can delete own comments"
ON project_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- project_collaborators
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collaborators can view" ON project_collaborators;
CREATE POLICY "Collaborators can view"
ON project_collaborators FOR SELECT TO authenticated
USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id)
);

DROP POLICY IF EXISTS "Project owners can manage collaborators" ON project_collaborators;
CREATE POLICY "Project owners can manage collaborators"
ON project_collaborators FOR ALL TO authenticated
USING (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id));

-- collaboration_presence
ALTER TABLE collaboration_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collaborators can view presence" ON collaboration_presence;
CREATE POLICY "Collaborators can view presence"
ON collaboration_presence FOR SELECT TO authenticated
USING (
    project_id IN (
        SELECT project_id FROM project_collaborators WHERE user_id = auth.uid()
        UNION
        SELECT id FROM projects WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update own presence" ON collaboration_presence;
CREATE POLICY "Users can update own presence"
ON collaboration_presence FOR ALL TO authenticated USING (auth.uid() = user_id);

-- user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON user_profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- collaboration_invites
ALTER TABLE collaboration_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invites sent to them" ON collaboration_invites;
CREATE POLICY "Users can view invites sent to them"
ON collaboration_invites FOR SELECT TO authenticated
USING (
    auth.jwt()->>'email' = invitee_email OR
    auth.uid() = inviter_id OR
    auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id)
);

DROP POLICY IF EXISTS "Project owners can create invites" ON collaboration_invites;
CREATE POLICY "Project owners can create invites"
ON collaboration_invites FOR INSERT TO authenticated
WITH CHECK (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id));

DROP POLICY IF EXISTS "Invitees can update their invites" ON collaboration_invites;
CREATE POLICY "Invitees can update their invites"
ON collaboration_invites FOR UPDATE TO authenticated
USING (auth.jwt()->>'email' = invitee_email);

-- ============================================
-- STEP 5: 트리거 & 함수
-- ============================================

-- 좋아요 카운트 자동 업데이트
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

-- 포크 카운트 자동 업데이트
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

-- 협업 권한 체크 함수
CREATE OR REPLACE FUNCTION can_collaborate_on_project(
    target_project_id UUID,
    target_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM projects 
        WHERE id = target_project_id AND user_id = target_user_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM collaboration_invites 
        WHERE project_id = target_project_id 
        AND invitee_id = target_user_id 
        AND status = 'accepted'
    ) THEN
        RETURN TRUE;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_id = target_project_id 
        AND user_id = target_user_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 초대 수락 함수
CREATE OR REPLACE FUNCTION accept_collaboration_invite(invite_id UUID)
RETURNS VOID AS $$
DECLARE
    invite_data RECORD;
BEGIN
    SELECT * INTO invite_data 
    FROM collaboration_invites 
    WHERE id = invite_id 
    AND invitee_email = auth.jwt()->>'email';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or not authorized';
    END IF;
    
    UPDATE collaboration_invites 
    SET status = 'accepted',
        invitee_id = auth.uid(),
        responded_at = NOW()
    WHERE id = invite_id;
    
    INSERT INTO project_collaborators (
        project_id, user_id, user_email, role, invite_id
    ) VALUES (
        invite_data.project_id,
        auth.uid(),
        invite_data.invitee_email,
        invite_data.role,
        invite_id
    )
    ON CONFLICT (project_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 초대 거절 함수
CREATE OR REPLACE FUNCTION reject_collaboration_invite(invite_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE collaboration_invites 
    SET status = 'rejected',
        responded_at = NOW()
    WHERE id = invite_id 
    AND invitee_email = auth.jwt()->>'email';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 인기 프로젝트 가져오기 함수
CREATE OR REPLACE FUNCTION get_trending_projects(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID, title TEXT, description TEXT, user_id UUID,
    views INTEGER, likes INTEGER, forks INTEGER,
    created_at TIMESTAMP WITH TIME ZONE, thumbnail_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.title, p.description, p.user_id,
           p.views, p.likes, p.forks, p.created_at, p.thumbnail_url
    FROM projects p
    WHERE p.is_public = TRUE
    ORDER BY (p.likes * 3 + p.views + p.forks * 5) DESC, p.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 사용자 통계 함수
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
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE is_public = TRUE)::INTEGER,
        COALESCE(SUM(likes), 0)::INTEGER,
        COALESCE(SUM(views), 0)::INTEGER,
        COALESCE(SUM(forks), 0)::INTEGER
    FROM projects
    WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 완료!
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요
-- ============================================
