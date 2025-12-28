-- posts 테이블에 project_id 컬럼 추가
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- 외래키 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_posts_project_id ON posts(project_id);

-- 기존 쿼리가 잘 작동하도록 권한 확인 (이미 RLS가 posts에 걸려있으므로 OK)
