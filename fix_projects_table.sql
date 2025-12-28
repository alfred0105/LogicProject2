-- ============================================
-- Projects 테이블 오류 수정
-- content 컬럼을 data로 변경
-- ============================================

-- 기존 projects 테이블이 있다면 컬럼 확인 및 수정
-- data 컬럼이 있는지 확인
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

-- 완료!
-- Supabase SQL Editor에서 실행하세요.
