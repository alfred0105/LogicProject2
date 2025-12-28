-- 조회수 안전하게 증가시키는 RPC 함수
CREATE OR REPLACE FUNCTION increment_views(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts
  SET views = views + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;
