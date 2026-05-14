
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "auth select profiles" on public.profiles for select to authenticated using (true);
create policy "auth insert profiles" on public.profiles for insert to authenticated with check (true);
create policy "auth update profiles" on public.profiles for update to authenticated using (true);
create policy "auth delete profiles" on public.profiles for delete to authenticated using (true);

-- handle_new_user trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- jobs
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null,
  location text not null,
  employment_type text not null,
  description text not null,
  requirements text not null,
  nice_to_haves text,
  salary_min integer,
  salary_max integer,
  currency text default 'INR',
  status text not null default 'Draft',
  pipeline_stages jsonb not null default '["Applied", "Screening", "Test", "Interview 1", "Interview 2", "Offer", "Hired"]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jobs enable row level security;
create policy "auth all jobs select" on public.jobs for select to authenticated using (true);
create policy "auth all jobs insert" on public.jobs for insert to authenticated with check (true);
create policy "auth all jobs update" on public.jobs for update to authenticated using (true);
create policy "auth all jobs delete" on public.jobs for delete to authenticated using (true);
-- public can read open jobs (for /apply/{id})
create policy "public read jobs" on public.jobs for select to anon using (true);

-- candidates
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  linkedin_url text,
  resume_url text,
  source text default 'Direct',
  created_at timestamptz not null default now()
);
alter table public.candidates enable row level security;
create policy "auth select candidates" on public.candidates for select to authenticated using (true);
create policy "auth insert candidates" on public.candidates for insert to authenticated with check (true);
create policy "auth update candidates" on public.candidates for update to authenticated using (true);
create policy "auth delete candidates" on public.candidates for delete to authenticated using (true);
-- public can insert/update for application form (will be done via service role through serverFn ideally; allow anon for simplicity per spec)
create policy "anon insert candidates" on public.candidates for insert to anon with check (true);
create policy "anon update candidates" on public.candidates for update to anon using (true);
create policy "anon select candidates" on public.candidates for select to anon using (true);

-- applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  current_stage text not null default 'Applied',
  ai_score integer,
  ai_summary text,
  status text not null default 'Active',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
alter table public.applications enable row level security;
create policy "auth select applications" on public.applications for select to authenticated using (true);
create policy "auth insert applications" on public.applications for insert to authenticated with check (true);
create policy "auth update applications" on public.applications for update to authenticated using (true);
create policy "auth delete applications" on public.applications for delete to authenticated using (true);
create policy "anon insert applications" on public.applications for insert to anon with check (true);
create policy "anon select applications" on public.applications for select to anon using (true);

-- stage_history
create table public.stage_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  moved_by uuid references auth.users(id),
  notes text,
  moved_at timestamptz not null default now()
);
alter table public.stage_history enable row level security;
create policy "auth select stage_history" on public.stage_history for select to authenticated using (true);
create policy "auth insert stage_history" on public.stage_history for insert to authenticated with check (true);
create policy "auth update stage_history" on public.stage_history for update to authenticated using (true);
create policy "auth delete stage_history" on public.stage_history for delete to authenticated using (true);
create policy "anon insert stage_history" on public.stage_history for insert to anon with check (true);

-- evaluation_notes
create table public.evaluation_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  stage text not null,
  content text not null,
  rating integer,
  created_at timestamptz not null default now()
);
alter table public.evaluation_notes enable row level security;
create policy "auth select evaluation_notes" on public.evaluation_notes for select to authenticated using (true);
create policy "auth insert evaluation_notes" on public.evaluation_notes for insert to authenticated with check (true);
create policy "auth update evaluation_notes" on public.evaluation_notes for update to authenticated using (true);
create policy "auth delete evaluation_notes" on public.evaluation_notes for delete to authenticated using (true);

-- Storage bucket for resumes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "Public read resumes" on storage.objects for select using (bucket_id = 'resumes');
create policy "Authenticated upload resumes" on storage.objects for insert to authenticated with check (bucket_id = 'resumes');
create policy "Anon upload resumes" on storage.objects for insert to anon with check (bucket_id = 'resumes');
create policy "Authenticated update resumes" on storage.objects for update to authenticated using (bucket_id = 'resumes');
create policy "Authenticated delete resumes" on storage.objects for delete to authenticated using (bucket_id = 'resumes');
