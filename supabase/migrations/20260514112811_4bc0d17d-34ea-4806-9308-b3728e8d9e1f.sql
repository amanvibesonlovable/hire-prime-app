
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Allow inserts from anon (public application page) and authenticated users; trigger validates.
CREATE POLICY "anyone insert notifications" ON public.notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_current_stage ON public.applications(current_stage);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_stage_history_application_id ON public.stage_history(application_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_notes_application_id ON public.evaluation_notes(application_id);

-- Trigger: when an application is inserted, fan out a notification to every profile.
CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_last text;
  v_job_title text;
BEGIN
  SELECT first_name, last_name INTO v_first, v_last FROM public.candidates WHERE id = NEW.candidate_id;
  SELECT title INTO v_job_title FROM public.jobs WHERE id = NEW.job_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT
    p.id,
    'new_application',
    'New Application',
    coalesce(v_first, '') || ' ' || coalesce(v_last, '') || ' applied for ' || coalesce(v_job_title, 'a position'),
    '/candidates/' || NEW.candidate_id || '/applications/' || NEW.id
  FROM public.profiles p;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_application
AFTER INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.notify_new_application();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
