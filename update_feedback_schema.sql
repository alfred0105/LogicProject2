-- feedback 테이블에 관리자 답변 기능 추가
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_comment TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_reply_at TIMESTAMP WITH TIME ZONE;

-- (선택사항) 관리자 외에는 admin_comment를 볼 수 없게 하려면 RLS 정책 수정 필요하지만,
-- 보통 사용자가 자신의 피드백에 대한 답변을 봐야 하므로 SELECT 정책은 그대로 둠.
