-- 게시글 테이블에 회로 스냅샷 컬럼 추가
-- 기존 project_id 참조 대신 회로 데이터를 직접 저장

ALTER TABLE posts ADD COLUMN IF NOT EXISTS circuit_snapshot JSONB;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS circuit_title TEXT;

-- 기존 project_id 컬럼은 유지하지만, 새 게시글은 스냅샷 사용
COMMENT ON COLUMN posts.circuit_snapshot IS '게시글 작성 시점의 회로 데이터 스냅샷';
COMMENT ON COLUMN posts.circuit_title IS '첨부된 회로의 제목';
