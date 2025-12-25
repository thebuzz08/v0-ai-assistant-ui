-- Admin roles table
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'moderator', 'viewer')),
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User analytics table for tracking usage
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  event_type TEXT NOT NULL, -- 'session_start', 'session_end', 'ai_request', 'calendar_action', etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggregated user stats (updated periodically)
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_requests INTEGER DEFAULT 0,
  total_session_time_seconds INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add is_terminated column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_terminated BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terminated_by UUID REFERENCES auth.users(id);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Admin roles policies (only admins can read, owners can modify)
CREATE POLICY "admins_can_view_roles" ON public.admin_roles 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
  );

CREATE POLICY "owners_can_insert_roles" ON public.admin_roles 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid() AND ar.role IN ('owner', 'admin'))
  );

CREATE POLICY "owners_can_update_roles" ON public.admin_roles 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid() AND ar.role IN ('owner', 'admin'))
    AND email != 'burkedonovan4@gmail.com' -- Cannot modify owner account
  );

CREATE POLICY "owners_can_delete_roles" ON public.admin_roles 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid() AND ar.role IN ('owner', 'admin'))
    AND email != 'burkedonovan4@gmail.com' -- Cannot delete owner account
  );

-- User analytics policies (users can insert their own, admins can read all)
CREATE POLICY "users_can_insert_analytics" ON public.user_analytics 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins_can_view_analytics" ON public.user_analytics 
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
  );

-- User stats policies
CREATE POLICY "users_can_view_own_stats" ON public.user_stats 
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
  );

CREATE POLICY "users_can_upsert_own_stats" ON public.user_stats 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_stats" ON public.user_stats 
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow admins to view all profiles (add policy)
CREATE POLICY "admins_can_view_all_profiles" ON public.profiles 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
  );

-- Allow admins to update profiles (for termination)
CREATE POLICY "admins_can_update_profiles" ON public.profiles 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid() AND ar.role IN ('owner', 'admin', 'moderator'))
  );

-- Insert the owner account (will link to user_id when they sign in)
INSERT INTO public.admin_roles (email, role)
VALUES ('burkedonovan4@gmail.com', 'owner')
ON CONFLICT (email) DO NOTHING;

-- Function to link admin role to user on signup/signin
CREATE OR REPLACE FUNCTION public.link_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admin_roles 
  SET user_id = NEW.id, updated_at = NOW()
  WHERE email = NEW.email AND user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_link_admin ON auth.users;

CREATE TRIGGER on_auth_user_link_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_admin_role();
