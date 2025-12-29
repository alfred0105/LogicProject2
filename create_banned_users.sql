-- 차단된 사용자 테이블 (이메일 기반)
-- 기존 테이블이 있으면 삭제하고 다시 생성
DROP TABLE IF EXISTS banned_users;

CREATE TABLE banned_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL UNIQUE,  -- 이메일 기반 (UUID 대신)
    reason TEXT,
    ban_type TEXT DEFAULT 'permanent', -- 'permanent' 또는 'temporary'
    ban_until TIMESTAMP WITH TIME ZONE,  -- 임시 정지 종료일
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    banned_by TEXT DEFAULT 'admin'
);

-- RLS 활성화
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;

-- 관리자만 차단 목록 관리 가능
CREATE POLICY "Admin can manage banned users" ON banned_users
    FOR ALL
    USING (auth.jwt() ->> 'email' = 'ace060408@gmail.com');

-- 모든 사용자가 자신이 차단되었는지 확인 가능
CREATE POLICY "Users can check if banned" ON banned_users
    FOR SELECT
    USING (user_email = auth.jwt() ->> 'email');

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_banned_users_email ON banned_users(user_email);
