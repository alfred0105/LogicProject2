-- ============================================
-- 사용자 프로필 및 협업 권한 강화 스키마
-- ============================================

-- 1. 사용자 프로필 테이블 (공개 정보)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL, -- 고유한 사용자 ID
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- RLS 정책
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON user_profiles FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (auth.uid() = id);

-- 2. 협업 초대 테이블
CREATE TABLE IF NOT EXISTS collaboration_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'editor', -- 'owner', 'editor', 'viewer'
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(project_id, invitee_email)
);

CREATE INDEX IF NOT EXISTS idx_invites_project ON collaboration_invites(project_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON collaboration_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invites_status ON collaboration_invites(status);

-- RLS 정책
ALTER TABLE collaboration_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invites sent to them" ON collaboration_invites;
CREATE POLICY "Users can view invites sent to them"
ON collaboration_invites FOR SELECT
TO authenticated
USING (
    auth.jwt()->>'email' = invitee_email OR
    auth.uid() = inviter_id OR
    auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id)
);

DROP POLICY IF EXISTS "Project owners can create invites" ON collaboration_invites;
CREATE POLICY "Project owners can create invites"
ON collaboration_invites FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id)
);

DROP POLICY IF EXISTS "Invitees can update their invites" ON collaboration_invites;
CREATE POLICY "Invitees can update their invites"
ON collaboration_invites FOR UPDATE
TO authenticated
USING (auth.jwt()->>'email' = invitee_email);

-- 3. project_collaborators 테이블 수정 (invited_by 추가)
ALTER TABLE project_collaborators 
ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES collaboration_invites(id) ON DELETE SET NULL;

-- 4. 협업 권한 체크 함수
CREATE OR REPLACE FUNCTION can_collaborate_on_project(
    target_project_id UUID,
    target_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 프로젝트 소유자인지 확인
    IF EXISTS (
        SELECT 1 FROM projects 
        WHERE id = target_project_id AND user_id = target_user_id
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- 초대를 수락했는지 확인
    IF EXISTS (
        SELECT 1 FROM collaboration_invites 
        WHERE project_id = target_project_id 
        AND invitee_id = target_user_id 
        AND status = 'accepted'
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- 협업자 목록에 있는지 확인
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

-- 5. 초대 수락 함수
CREATE OR REPLACE FUNCTION accept_collaboration_invite(invite_id UUID)
RETURNS VOID AS $$
DECLARE
    invite_data RECORD;
BEGIN
    -- 초대 정보 가져오기
    SELECT * INTO invite_data 
    FROM collaboration_invites 
    WHERE id = invite_id 
    AND invitee_email = auth.jwt()->>'email';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or not authorized';
    END IF;
    
    -- 초대 상태 업데이트
    UPDATE collaboration_invites 
    SET status = 'accepted',
        invitee_id = auth.uid(),
        responded_at = NOW()
    WHERE id = invite_id;
    
    -- 협업자 목록에 추가
    INSERT INTO project_collaborators (
        project_id, 
        user_id, 
        user_email, 
        role,
        invite_id
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

-- 6. 초대 거절 함수
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

-- 7. 사용자명 중복 체크 함수
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM user_profiles WHERE username = check_username
    );
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거: 초대 수락 시 자동으로 협업자 추가
CREATE OR REPLACE FUNCTION auto_add_collaborator_on_accept()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        INSERT INTO project_collaborators (
            project_id, 
            user_id, 
            user_email,
            user_name,
            role,
            invite_id
        )
        SELECT 
            NEW.project_id,
            NEW.invitee_id,
            NEW.invitee_email,
            COALESCE(up.display_name, up.username),
            NEW.role,
            NEW.id
        FROM user_profiles up
        WHERE up.id = NEW.invitee_id
        ON CONFLICT (project_id, user_id) DO UPDATE
        SET role = EXCLUDED.role;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_add_collaborator ON collaboration_invites;
CREATE TRIGGER trigger_auto_add_collaborator
AFTER UPDATE ON collaboration_invites
FOR EACH ROW EXECUTE FUNCTION auto_add_collaborator_on_accept();

-- 완료!
-- 이 스키마를 Supabase SQL Editor에서 실행하세요.
