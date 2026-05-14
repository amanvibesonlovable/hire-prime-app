import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, Mail, Phone, Linkedin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, StageBadge, DepartmentBadge } from "@/components/StatusBadge";
import { AIScoreInline } from "@/components/AIScoreBadge";
import { relTime } from "@/lib/format";

export const Route = createFileRoute("/_app/candidates/$candidateId")({
  component: CandidateRoute,
});

function CandidateRoute() {
  const { candidateId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname.replace(/\/$/, "") !== `/candidates/${candidateId}`) return <Outlet />;

  return <CandidatePage />;
}

function CandidatePage() {
  const { candidateId } = Route.useParams();
  const navigate = useNavigate();

  const cand = useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").eq("id", candidateId).single();
      if (error) throw error;
      return data;
    },
  });

  const apps = useQuery({
    queryKey: ["candidate-apps", candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, current_stage, status, applied_at, ai_score, job:jobs(id, title, department)")
        .eq("candidate_id", candidateId)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (apps.data && apps.data.length === 1) {
      navigate({
        to: "/candidates/$candidateId/applications/$applicationId",
        params: { candidateId, applicationId: apps.data[0].id },
        replace: true,
      });
    }
  }, [apps.data, candidateId, navigate]);

  if (cand.isLoading) return <div className="skeleton h-32" />;
  if (!cand.data) return <div className="text-muted-foreground">Candidate not found.</div>;
  const c = cand.data;

  return (
    <div className="space-y-6">
      <Link to="/candidates" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to candidates
      </Link>

      <div className="bg-surface border border-border rounded-lg p-6 space-y-3">
        <h1 className="text-[24px] font-semibold">{c.first_name} {c.last_name}</h1>
        <div className="flex flex-wrap gap-4 text-[13px] text-muted-foreground">
          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="h-3.5 w-3.5" /> {c.email}</a>
          {c.phone ? (
            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="h-3.5 w-3.5" /> {c.phone}</a>
          ) : <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> —</span>}
          {c.linkedin_url ? (
            <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:text-primary-hover">
              <Linkedin className="h-3.5 w-3.5" /> LinkedIn
            </a>
          ) : <span className="inline-flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5" /> —</span>}
        </div>
        {c.source && <DepartmentBadge>{c.source}</DepartmentBadge>}
      </div>

      <section>
        <h2 className="text-[16px] font-semibold mb-3">Applications</h2>
        {apps.isLoading ? (
          <div className="space-y-2">{Array.from({length:3}).map((_,i)=><div key={i} className="skeleton h-16"/>)}</div>
        ) : (apps.data?.length ?? 0) === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">No applications yet.</div>
        ) : (
          <div className="grid gap-3">
            {apps.data!.map((a: any) => (
              <Link
                key={a.id}
                to="/candidates/$candidateId/applications/$applicationId"
                params={{ candidateId, applicationId: a.id }}
                className="bg-surface border border-border rounded-lg p-4 hover:border-border-strong transition-colors flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-[14px] font-medium text-foreground">{a.job?.title}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DepartmentBadge>{a.job?.department}</DepartmentBadge>
                    <StageBadge stage={a.current_stage} />
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                  {a.ai_score != null && <AIScoreInline score={a.ai_score} />}
                  <span>Applied {relTime(a.applied_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
