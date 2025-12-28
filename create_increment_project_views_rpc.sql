-- ============================================
-- 프로젝트 조회수 증가 RPC 함수
-- ============================================

CREATE OR REPLACE FUNCTION increment_project_views(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET views = COALESCE(views, 0) + 1
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한 부여 (누구나 호출 가능)
GRANT EXECUTE ON FUNCTION increment_project_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_project_views(UUID) TO anon;
