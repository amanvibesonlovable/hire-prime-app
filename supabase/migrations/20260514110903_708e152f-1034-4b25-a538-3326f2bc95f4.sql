-- Settings table
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  anthropic_api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own settings" ON public.settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own settings" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own settings" ON public.settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own settings" ON public.settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Applications AI columns
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ai_strengths jsonb,
  ADD COLUMN IF NOT EXISTS ai_concerns jsonb,
  ADD COLUMN IF NOT EXISTS ai_recommendation text,
  ADD COLUMN IF NOT EXISTS ai_scored_at timestamptz;