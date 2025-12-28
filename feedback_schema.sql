-- ============================================
-- 피드백 시스템 SQL
-- ============================================

-- feedback 테이블 생성
CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL, -- 'bug', 'feature', 'improvement', 'other'
    content TEXT NOT NULL,
    user_email TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);

-- RLS 정책
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 누구나 피드백 작성 가능
DROP POLICY IF EXISTS "Anyone can create feedback" ON feedback;
CREATE POLICY "Anyone can create feedback"
ON feedback FOR INSERT 
WITH CHECK (TRUE);

-- 누구나 피드백 조회 가능 (관리자용)
DROP POLICY IF EXISTS "Anyone can view feedback" ON feedback;
CREATE POLICY "Anyone can view feedback"
ON feedback FOR SELECT
USING (TRUE);

-- 관리자만 업데이트 가능 (status 변경 등)
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
CREATE POLICY "Admins can update feedback"
ON feedback FOR UPDATE
USING (auth.jwt() ->> 'email' = 'ace060408@gmail.com');

-- 완료!
-- Supabase SQL Editor에서 실행하세요.
