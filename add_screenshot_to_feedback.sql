-- 피드백 테이블에 스크린샷 컬럼 추가
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- 인덱스 필요 없음 (텍스트 데이터가 크므로)
