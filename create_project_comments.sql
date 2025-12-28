-- ============================================
-- 프로젝트(라이브러리) 댓글 시스템
-- ============================================

-- 1. 프로젝트 댓글 테이블
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

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_created ON project_comments(created_at DESC);

-- 2. RLS 정책
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능
DROP POLICY IF EXISTS "Anyone can view project comments" ON project_comments;
CREATE POLICY "Anyone can view project comments"
ON project_comments FOR SELECT
USING (TRUE);

-- 로그인 사용자만 작성 가능
DROP POLICY IF EXISTS "Users can create project comments" ON project_comments;
CREATE POLICY "Users can create project comments"
ON project_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 작성자만 수정 가능
DROP POLICY IF EXISTS "Users can update own project comments" ON project_comments;
CREATE POLICY "Users can update own project comments"
ON project_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 작성자만 삭제 가능
DROP POLICY IF EXISTS "Users can delete own project comments" ON project_comments;
CREATE POLICY "Users can delete own project comments"
ON project_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
