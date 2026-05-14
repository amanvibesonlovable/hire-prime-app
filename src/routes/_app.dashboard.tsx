import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, Users, FileText, Clock, Workflow, Sparkles, BarChart3,
  FileUp, Search, ClipboardCheck, UserCheck, Mail, CheckCircle, ChevronRight,
} from "lucide-react";
import { XAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { greeting, relTime, initials } from "@/lib/format";
import { StatusBadge, DepartmentBadge, StageBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const STAGES = [
  { name: "Applied", icon: FileUp, color: "#3B82F6" },
  { name: "Screening", icon: Search, color: "#6366F1" },
  { name: "Test", icon: ClipboardCheck, color: "#8B5CF6" },
  { name: "Interview 1", icon: Users, color: "#3B82F6" },
  { name: "Interview 2", icon: UserCheck, color: "#3B82F6" },
  { name: "Offer", icon: Mail, color: "#F59E0B" },
  { name: "Hired", icon: CheckCircle, color: "#22C55E" },
];

function scoreColors(score: number) {
  if (score >= 8) return { bg: "#22C55E15", color: "#22C55E" };
  if (score >= 5) return { bg: "#EAB30815", color: "#EAB308" };
  return { bg: "#EF444415", color: "#EF4444" };
}

function recBadge(rec: string | null) {
  if (rec === "Strong Yes") return { bg: "#22C55E15", color: "#22C55E", label: "Strong Hire" };
  if (rec === "Yes") return { bg: "#3B82F615", color: "#3B82F6", label: "Top Match" };
  if (rec === "Maybe") return { bg: "#F59E0B15", color: "#F59E0B", label: "Potential" };
  if (rec === "No") return { bg: "#EF444415", color: "#EF4444", label: "Not a Match" };
  return null;
}

function Dashboard() {
  useDocumentTitle("Dashboard — Meridian");
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = (profile?.full_name || "").split(" ")[0] || "there";

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const now = Date.now();
      const d30 = new Date(now - 30 * 86400000).toISOString();
      const d60 = new Date(now - 60 * 86400000).toISOString();

      const [openJobs, candidates, activeApps, allActive,
        openJobsPrev, openJobsCur, candPrev, candCur, appsPrev, appsCur] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "Open"),
        supabase.from("candidates").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("applications").select("applied_at").eq("status", "Active"),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "Open").gte("created_at", d60).lt("created_at", d30),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "Open").gte("created_at", d30),
        supabase.from("candidates").select("id", { count: "exact", head: true }).gte("created_at", d60).lt("created_at", d30),
        supabase.from("candidates").select("id", { count: "exact", head: true }).gte("created_at", d30),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Active").gte("applied_at", d60).lt("applied_at", d30),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Active").gte("applied_at", d30),
      ]);
      const days = (allActive.data || []).map((a) => (now - new Date(a.applied_at).getTime()) / 86400000);
      const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
      const trend = (cur: number, prev: number) => prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
      return {
        openJobs: openJobs.count ?? 0,
        candidates: candidates.count ?? 0,
        activeApps: activeApps.count ?? 0,
        avgDays: avg,
        openJobsTrend: trend(openJobsCur.count ?? 0, openJobsPrev.count ?? 0),
        candidatesTrend: trend(candCur.count ?? 0, candPrev.count ?? 0),
        appsTrend: trend(appsCur.count ?? 0, appsPrev.count ?? 0),
      };
    },
  });

  const recent = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, current_stage, status, applied_at, ai_score, job:jobs(title, department), candidate:candidates(id, first_name, last_name, email)")
        .order("applied_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const pipeline = useQuery({
    queryKey: ["dashboard-pipeline"],
    queryFn: async () => {
      const { data: openJobs } = await supabase.from("jobs").select("id").eq("status", "Open");
      const ids = (openJobs || []).map((j) => j.id);
      if (ids.length === 0) return { counts: {} as Record<string, number>, total: 0 };
      const { data } = await supabase
        .from("applications")
        .select("current_stage")
        .eq("status", "Active")
        .in("job_id", ids);
      const counts: Record<string, number> = {};
      (data || []).forEach((a) => { counts[a.current_stage] = (counts[a.current_stage] || 0) + 1; });
      const total = STAGES.reduce((s, st) => s + (counts[st.name] || 0), 0);
      return { counts, total };
    },
  });

  const aiRecs = useQuery({
    queryKey: ["dashboard-ai-recs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, ai_score, ai_recommendation, candidate:candidates(id, first_name, last_name), job:jobs(title)")
        .eq("status", "Active")
        .not("ai_score", "is", null)
        .order("ai_score", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const analytics = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: apps }, { data: history }] = await Promise.all([
        supabase.from("applications").select("applied_at").gte("applied_at", since),
        supabase.from("stage_history").select("application_id, from_stage, to_stage, moved_at").order("moved_at", { ascending: true }),
      ]);
      // Per-day counts
      const days: { date: string; count: number; label: string }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        days.push({ date: key, label, count: 0 });
      }
      (apps || []).forEach((a) => {
        const key = new Date(a.applied_at).toISOString().slice(0, 10);
        const d = days.find((x) => x.date === key);
        if (d) d.count++;
      });

      // Bottleneck: avg time spent in each stage based on stage_history transitions
      const byApp: Record<string, { stage: string; at: number }[]> = {};
      (history || []).forEach((h) => {
        if (!byApp[h.application_id]) byApp[h.application_id] = [];
        byApp[h.application_id].push({ stage: h.to_stage, at: new Date(h.moved_at).getTime() });
      });
      const stageDur: Record<string, number[]> = {};
      Object.values(byApp).forEach((arr) => {
        for (let i = 0; i < arr.length - 1; i++) {
          const dur = (arr[i + 1].at - arr[i].at) / 86400000;
          if (!stageDur[arr[i].stage]) stageDur[arr[i].stage] = [];
          stageDur[arr[i].stage].push(dur);
        }
      });
      let bottleneck = null as null | { stage: string; avg: number };
      Object.entries(stageDur).forEach(([stage, arr]) => {
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        const cur: { stage: string; avg: number } | null = bottleneck;
        if (!cur || avg > cur.avg) bottleneck = { stage, avg };
      });
      return { days, bottleneck };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[28px] font-semibold text-foreground">{greeting()}, {firstName}</h2>
        <p className="text-sm text-muted-foreground mt-1">Here's your hiring overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Jobs" value={stats.data?.openJobs} icon={Briefcase} color="#3B82F6" trend={stats.data?.openJobsTrend} loading={stats.isLoading} />
        <StatCard label="Total Candidates" value={stats.data?.candidates} icon={Users} color="#22C55E" trend={stats.data?.candidatesTrend} loading={stats.isLoading} />
        <StatCard label="Active Applications" value={stats.data?.activeApps} icon={FileText} color="#8B5CF6" trend={stats.data?.appsTrend} loading={stats.isLoading} />
        <StatCard label="Avg. Days in Pipeline" value={stats.data?.avgDays} icon={Clock} color="#F59E0B" trend={null} loading={stats.isLoading} />
      </div>

      {/* Pipeline overview */}
      <section className="rounded-xl border border-[#1E1E22] bg-[#141416] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Workflow className="h-4 w-4 text-[#3B82F6]" />
          <h3 className="text-[16px] font-medium text-foreground">Hiring Pipeline Overview</h3>
        </div>
        {pipeline.isLoading ? (
          <div className="flex gap-3">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton h-24 flex-1" />)}</div>
        ) : (
          <div className="flex items-start gap-2 overflow-x-auto pb-2">
            {STAGES.map((s, i) => {
              const count = pipeline.data?.counts[s.name] || 0;
              const pct = pipeline.data?.total ? Math.round((count / pipeline.data.total) * 100) : 0;
              const Icon = s.icon;
              return (
                <div key={s.name} className="flex items-start gap-2 shrink-0">
                  <div className="flex flex-col items-center text-center min-w-[88px]">
                    <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, background: s.color + "26" }}>
                      <Icon className="h-5 w-5" style={{ color: s.color }} />
                    </div>
                    <div className="mt-2 text-[13px] font-medium text-foreground">{s.name}</div>
                    <div className="mt-1 text-[24px] font-mono font-semibold text-foreground leading-none">{count}</div>
                    <div className="mt-1 text-[12px] text-[#71717A]">{pct}%</div>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className="hidden sm:flex items-center h-12 px-1">
                      <svg width="32" height="10" viewBox="0 0 32 10">
                        <line x1="0" y1="5" x2="26" y2="5" stroke="#1E1E22" strokeWidth="1.5" />
                        <polyline points="22,1 28,5 22,9" fill="none" stroke="#3B82F6" strokeWidth="1.5" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3-column row */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,360px)_minmax(0,360px)] gap-4">
        {/* Recent Applications */}
        <section className="rounded-xl border border-[#1E1E22] bg-[#141416] overflow-hidden xl:col-span-1">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E22]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#3B82F6]" />
              <h3 className="text-[16px] font-medium text-foreground">Recent Applications</h3>
            </div>
            <Link to="/candidates" className="text-[14px] text-[#3B82F6] hover:underline">View all →</Link>
          </div>
          {recent.isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-12" />)}</div>
          ) : (recent.data?.length ?? 0) === 0 ? (
            <EmptyState icon={FileText} title="No applications yet" description="Create a job and share the application link to start receiving applications." />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="font-medium px-5 py-3">Candidate</th>
                  <th className="font-medium px-5 py-3">Job</th>
                  <th className="font-medium px-5 py-3">Stage</th>
                  <th className="font-medium px-5 py-3">AI</th>
                  <th className="font-medium px-5 py-3">Applied</th>
                  <th className="font-medium px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.data!.map((row: any) => {
                  const name = `${row.candidate?.first_name ?? ""} ${row.candidate?.last_name ?? ""}`.trim();
                  return (
                    <tr key={row.id} className="border-t border-[#1E1E22] hover:bg-[#1A1A1E] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-[#1E1E22] text-white flex items-center justify-center shrink-0" style={{ width: 32, height: 32, fontSize: 12, fontWeight: 500 }}>
                            {initials(name) || "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-foreground truncate">{name || "—"}</div>
                            <div className="text-[12px] text-[#71717A] truncate">{row.candidate?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-foreground">{row.job?.title}</td>
                      <td className="px-5 py-3"><StageBadge stage={row.current_stage} /></td>
                      <td className="px-5 py-3">
                        {row.ai_score != null ? (() => {
                          const c = scoreColors(row.ai_score);
                          return (
                            <div className="rounded-full flex items-center justify-center font-mono font-semibold" style={{ width: 32, height: 32, background: c.bg, color: c.color, fontSize: 13 }}>
                              {row.ai_score}
                            </div>
                          );
                        })() : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{relTime(row.applied_at)}</td>
                      <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* AI Recommendations */}
        <section className="rounded-xl border border-[#1E1E22] bg-[#141416] p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#8B5CF6]" />
              <h3 className="text-[16px] font-medium text-foreground">AI Recommendations</h3>
            </div>
            <Link to="/candidates" className="text-[14px] text-[#3B82F6] hover:underline">View all</Link>
          </div>
          {aiRecs.isLoading ? (
            <div className="space-y-3 mt-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
          ) : (aiRecs.data?.length ?? 0) === 0 ? (
            <EmptyState icon={Sparkles} title="No AI recommendations yet" description="Score candidates to see top recommendations here." />
          ) : (
            <div>
              {aiRecs.data!.map((row: any, idx: number) => {
                const name = `${row.candidate?.first_name ?? ""} ${row.candidate?.last_name ?? ""}`.trim();
                const c = scoreColors(row.ai_score);
                const rb = recBadge(row.ai_recommendation);
                return (
                  <button
                    key={row.id}
                    onClick={() => row.candidate?.id && navigate({ to: "/candidates/$candidateId", params: { candidateId: row.candidate.id } })}
                    className={`w-full flex items-center gap-3 py-4 text-left hover:bg-[#1A1A1E] transition-colors -mx-2 px-2 rounded-md ${idx < aiRecs.data!.length - 1 ? "border-b border-[#1E1E22]" : ""}`}
                  >
                    <div className="rounded-full flex items-center justify-center font-mono font-semibold shrink-0" style={{ width: 48, height: 48, background: c.bg, color: c.color, fontSize: 18 }}>
                      {row.ai_score}
                    </div>
                    <div className="rounded-full bg-[#1E1E22] text-white flex items-center justify-center shrink-0" style={{ width: 40, height: 40, fontSize: 14, fontWeight: 500 }}>
                      {initials(name) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-foreground truncate">{name || "—"}</div>
                      <div className="text-[13px] text-[#71717A] truncate">{row.job?.title}</div>
                      {rb && (
                        <div className="mt-1.5 flex gap-1.5 flex-wrap">
                          <span className="inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium" style={{ background: rb.bg, color: rb.color }}>{rb.label}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#71717A] shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Analytics Snapshot */}
        <section className="rounded-xl border border-[#1E1E22] bg-[#141416] p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-[#3B82F6]" />
            <h3 className="text-[16px] font-medium text-foreground">Analytics Snapshot</h3>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] text-[#71717A]">Applications over time</div>
            <span className="inline-flex items-center rounded-full bg-[#1E1E22] text-[#71717A] px-2 py-0.5" style={{ fontSize: 11 }}>Last 30 days</span>
          </div>

          <div style={{ height: 140 }}>
            {analytics.isLoading ? (
              <div className="skeleton h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.data?.days || []} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="appsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    stroke="#71717A"
                    tick={{ fill: "#71717A", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={6}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0A0A0B", border: "1px solid #1E1E22", borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fill="url(#appsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[#1E1E22]">
            {analytics.isLoading ? (
              <div className="skeleton h-14" />
            ) : !analytics.data?.bottleneck ? (
              <div className="text-[13px] text-[#71717A]">Not enough data yet</div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 40, height: 40, background: "#F59E0B26" }}>
                  <Clock className="h-5 w-5" style={{ color: "#F59E0B" }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] text-[#71717A]">Bottleneck (Time in Stage)</div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-[16px] font-medium text-foreground">{analytics.data.bottleneck.stage}</div>
                    <div className="text-[20px] font-mono font-semibold text-foreground">{analytics.data.bottleneck.avg.toFixed(1)}d</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color, trend, loading,
}: { label: string; value?: number; icon: any; color: string; trend: number | null | undefined; loading: boolean }) {
  return (
    <div className="rounded-xl border border-[#1E1E22] bg-[#141416] hover:border-border-strong transition-colors" style={{ padding: "20px 24px" }}>
      <div className="flex items-center gap-4">
        <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 56, height: 56, background: color + "26" }}>
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] text-[#9CA3AF]">{label}</div>
          {loading ? (
            <div className="skeleton h-7 w-16 my-1" />
          ) : (
            <div className="font-mono font-semibold text-foreground leading-tight" style={{ fontSize: 28 }}>{value ?? 0}</div>
          )}
          <div className="text-[12px] mt-0.5">
            {trend == null ? (
              <span className="text-[#71717A]">—</span>
            ) : trend >= 0 ? (
              <span style={{ color: "#22C55E" }}>↑ {trend}% vs last 30 days</span>
            ) : (
              <span style={{ color: "#EF4444" }}>↓ {Math.abs(trend)}% vs last 30 days</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
