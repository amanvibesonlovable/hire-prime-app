import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Mail, Phone, Linkedin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, StageBadge } from "@/components/StatusBadge";
import { relTime } from "@/lib/format";

export const Route = createFileRoute("/_app/candidates/$candidateId")({
  component: CandidateDetail,
});

function CandidateDetail() {
  const { candidateId } = Route.useParams();
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
        .select("id, current_stage, status, applied_at, job:jobs(id, title)")
        .eq("candidate_id", candidateId)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

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
          <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {c.email}</span>
          {c.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {c.phone}</span>}
          {c.linkedin_url && (
            <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:text-primary-hover">
              <Linkedin className="h-3.5 w-3.5" /> LinkedIn
            </a>
          )}
        </div>
        {c.resume_url && (
          <a href={c.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:text-primary-hover">
            <Download className="h-3.5 w-3.5" /> Download resume
          </a>
        )}
      </div>

      <section>
        <h2 className="text-[16px] font-semibold mb-3">Applications</h2>
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {apps.isLoading ? (
            <div className="p-4 space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="skeleton h-10"/>)}</div>
          ) : (apps.data?.length ?? 0) === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No applications yet.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="font-medium px-5 py-3">Job</th>
                  <th className="font-medium px-5 py-3">Stage</th>
                  <th className="font-medium px-5 py-3">Status</th>
                  <th className="font-medium px-5 py-3">Applied</th>
                </tr>
              </thead>
              <tbody>
                {apps.data!.map((a: any) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      <Link to="/jobs/$jobId" params={{ jobId: a.job?.id }} className="text-primary hover:text-primary-hover">{a.job?.title}</Link>
                    </td>
                    <td className="px-5 py-3"><StageBadge stage={a.current_stage} /></td>
                    <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{relTime(a.applied_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
