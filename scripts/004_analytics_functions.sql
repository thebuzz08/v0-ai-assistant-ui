-- Function to increment user requests
CREATE OR REPLACE FUNCTION increment_user_requests(uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, total_requests, last_active_at, updated_at)
  VALUES (uid, 1, NOW(), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_requests = user_stats.total_requests + 1,
    last_active_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Function to increment user sessions
CREATE OR REPLACE FUNCTION increment_user_sessions(uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, total_sessions, last_active_at, updated_at)
  VALUES (uid, 1, NOW(), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_sessions = user_stats.total_sessions + 1,
    last_active_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Function to add session time
CREATE OR REPLACE FUNCTION add_session_time(uid UUID, seconds INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, total_session_time_seconds, last_active_at, updated_at)
  VALUES (uid, seconds, NOW(), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_session_time_seconds = user_stats.total_session_time_seconds + seconds,
    last_active_at = NOW(),
    updated_at = NOW();
END;
$$;
