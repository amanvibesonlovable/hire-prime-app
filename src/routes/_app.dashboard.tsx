import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Users, FileText, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { greeting, relTime } from "@/lib/format";
import { StatusBadge, DepartmentBadge, StageBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { AIScoreInline } from "@/components/AIScoreBadge";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  const firstName = (profile?.full_name || "").split(" ")[0] || "there";

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [openJobs, candidates, activeApps, allActive] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "Open"),
        supabase.from("candidates").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("applications").select("applied_at").eq("status", "Active"),
      ]);
      const now = Date.now();
      const days = (allActive.data || []).map((a) => (now - new Date(a.applied_at).getTime()) / 86400000);
      const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
      return {
        openJobs: openJobs.count ?? 0,
        candidates: candidates.count ?? 0,
        activeApps: activeApps.count ?? 0,
        avgDays: avg,
      };
    },
  });

  const recent = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, current_stage, status, applied_at, ai_score, job:jobs(title, department), candidate:candidates(first_name, last_name)")
        .order("applied_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[28px] font-semibold text-foreground">
          {greeting()}, {firstName}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Here's your hiring overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Jobs" value={stats.data?.openJobs} icon={Briefcase} loading={stats.isLoading} />
        <StatCard label="Total Candidates" value={stats.data?.candidates} icon={Users} loading={stats.isLoading} />
        <StatCard label="Active Applications" value={stats.data?.activeApps} icon={FileText} loading={stats.isLoading} />
        <StatCard label="Avg. Days in Pipeline" value={stats.data?.avgDays} icon={Clock} loading={stats.isLoading} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-semibold">Recent Applications</h3>
          <Link to="/candidates" className="text-[13px] text-primary hover:text-primary-hover">View all →</Link>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {recent.isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10" />)}
            </div>
          ) : (recent.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title="No applications yet"
              description="Create a job and share the application link to start receiving applications."
            />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="font-medium px-5 py-3">Candidate</th>
                  <th className="font-medium px-5 py-3">Job</th>
                  <th className="font-medium px-5 py-3">Department</th>
                  <th className="font-medium px-5 py-3">Stage</th>
                  <th className="font-medium px-5 py-3">AI Score</th>
                  <th className="font-medium px-5 py-3">Applied</th>
                  <th className="font-medium px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.data!.map((row: any) => (
                  <tr key={row.id} className="border-t border-border hover:bg-surface-hover transition-colors">
                    <td className="px-5 py-3 text-foreground">
                      {row.candidate?.first_name} {row.candidate?.last_name}
                    </td>
                    <td className="px-5 py-3 text-foreground">{row.job?.title}</td>
                    <td className="px-5 py-3"><DepartmentBadge>{row.job?.department}</DepartmentBadge></td>
                    <td className="px-5 py-3"><StageBadge stage={row.current_stage} /></td>
                    <td className="px-5 py-3">{row.ai_score != null ? <AIScoreInline score={row.ai_score} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-5 py-3 text-muted-foreground">{relTime(row.applied_at)}</td>
                    <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
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

function StatCard({
  label, value, icon: Icon, loading,
}: { label: string; value?: number; icon: any; loading: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 hover:border-border-strong transition-colors">
      <div className="flex justify-between items-start">
        <div>
          {loading ? <div className="skeleton h-8 w-16 mb-2" /> : (
            <div className="text-[28px] font-mono font-semibold text-foreground leading-none">{value ?? 0}</div>
          )}
          <div className="text-[12px] text-muted-foreground mt-2 uppercase tracking-wide">{label}</div>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
