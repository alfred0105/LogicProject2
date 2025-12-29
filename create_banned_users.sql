-- 차단된 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS banned_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_email TEXT,
    reason TEXT,
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unbanned_at TIMESTAMP WITH TIME ZONE,
    banned_by TEXT DEFAULT 'admin'
);

-- RLS 활성화
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;

-- 관리자만 차단 목록 관리 가능 (관리자 이메일 확인)
CREATE POLICY "Admin can manage banned users" ON banned_users
    FOR ALL
    USING (auth.jwt() ->> 'email' = 'ace060408@gmail.com');

-- 모든 사용자가 자신이 차단되었는지 확인 가능
CREATE POLICY "Users can check if banned" ON banned_users
    FOR SELECT
    USING (user_id = auth.uid());

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_banned_users_user_id ON banned_users(user_id);
