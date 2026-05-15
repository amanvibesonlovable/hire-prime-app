import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, Users, FileText, Clock, Workflow, Sparkles, BarChart3,
  FileUp, Search, ClipboardCheck, UserCheck, Mail, CheckCircle, ChevronRight,
} from "lucide-react";
import { XAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { greeting, initials } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const STAGES = [
  { name: "Applied", icon: FileUp, color: "#3B82F6" },
  { name: "Screening", icon: Search, color: "#6366F1" },
  { name: "Test", icon: ClipboardCheck, color: "#8B5CF6" },
  { name: "Interview 1", icon: Users, color: "#06B6D4" },
  { name: "Interview 2", icon: UserCheck, color: "#06B6D4" },
  { name: "Offer", icon: Mail, color: "#F59E0B" },
  { name: "Hired", icon: CheckCircle, color: "#22C55E" },
];

const STAGE_BADGE: Record<string, { bg: string; color: string }> = {
  "Applied":     { bg: "#3B82F620", color: "#3B82F6" },
  "Screening":   { bg: "#6366F120", color: "#6366F1" },
  "Test":        { bg: "#8B5CF620", color: "#8B5CF6" },
  "Interview 1": { bg: "#06B6D420", color: "#06B6D4" },
  "Interview 2": { bg: "#06B6D420", color: "#06B6D4" },
  "Offer":       { bg: "#F59E0B20", color: "#F59E0B" },
  "Hired":       { bg: "#22C55E20", color: "#22C55E" },
};

function StageChip({ stage }: { stage: string }) {
  const c = STAGE_BADGE[stage] || { bg: "#1E1E22", color: "#9CA3AF" };
  return (
    <span
      className="inline-flex items-center rounded-md font-medium"
      style={{ background: c.bg, color: c.color, fontSize: 12, padding: "4px 10px", fontWeight: 500 }}
    >
      {stage}
    </span>
  );
}

function scoreColors(score: number) {
  if (score >= 8) return { bg: "#22C55E18", color: "#22C55E", ring: "#22C55E66" };
  if (score >= 5) return { bg: "#EAB30818", color: "#EAB308", ring: "#EAB30866" };
  return { bg: "#EF444418", color: "#EF4444", ring: "#EF444466" };
}

function recBadge(rec: string | null) {
  if (rec === "Strong Yes") return { bg: "#22C55E20", color: "#22C55E", label: "Strong Hire" };
  if (rec === "Yes") return { bg: "#3B82F620", color: "#3B82F6", label: "Recommended" };
  if (rec === "Maybe") return { bg: "#F59E0B20", color: "#F59E0B", label: "Worth Reviewing" };
  if (rec === "No") return { bg: "#EF444420", color: "#EF4444", label: "Low Match" };
  return null;
}

function fitBadge(score: number) {
  if (score >= 9) return { bg: "#22C55E20", color: "#22C55E", label: "Top Match" };
  if (score >= 8) return { bg: "#8B5CF620", color: "#8B5CF6", label: "High Potential" };
  if (score >= 7) return { bg: "#3B82F620", color: "#3B82F6", label: "Good Fit" };
  return null;
}

function formatShortDate(d: string | null | undefined) {
  if (!d) return "—";
  const t = new Date(d);
  if (isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
        .limit(6);
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
        .limit(4);
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
    <div className="space-y-10">
      <div>
        <h2 className="text-[28px] font-semibold text-foreground">{greeting()}, {firstName} <span className="inline-block">👋</span></h2>
        <p className="mt-1 mb-6" style={{ fontSize: 15, color: "#9CA3AF" }}>Here's your hiring overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Open Jobs" value={stats.data?.openJobs} icon={Briefcase} color="#3B82F6" trend={stats.data?.openJobsTrend} loading={stats.isLoading} />
        <StatCard label="Total Candidates" value={stats.data?.candidates} icon={Users} color="#22C55E" trend={stats.data?.candidatesTrend} loading={stats.isLoading} />
        <StatCard label="Active Applications" value={stats.data?.activeApps} icon={FileText} color="#8B5CF6" trend={stats.data?.appsTrend} loading={stats.isLoading} />
        <StatCard label="Avg. Days in Pipeline" value={stats.data?.avgDays} icon={Clock} color="#F59E0B" trend={null} loading={stats.isLoading} />
      </div>

      {/* Pipeline overview */}
      <section className="rounded-xl border border-[#1E1E22] bg-[#141416] p-8 transition-colors hover:border-[#2A2A2E]">
        <div className="flex items-center gap-2 mb-6">
          <Workflow className="h-4 w-4" style={{ color: "#3B82F6" }} />
          <h3 className="text-[16px] font-medium text-foreground">Hiring Pipeline Overview</h3>
        </div>
        {pipeline.isLoading ? (
          <div className="grid grid-cols-7 gap-3">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton h-32" />)}</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2 [scroll-snap-type:x_mandatory] md:[scroll-snap-type:none]">
            <div className="flex items-start gap-0 min-w-[760px] md:min-w-0">
              {STAGES.map((s, i) => {
                const count = pipeline.data?.counts[s.name] || 0;
                const pct = pipeline.data?.total ? Math.round((count / pipeline.data.total) * 100) : 0;
                const Icon = s.icon;
                return (
                  <div key={s.name} className="contents">
                    <div className="flex flex-col items-center text-center px-2 shrink-0 [scroll-snap-align:center] md:shrink md:flex-1">
                      <div
                        className="rounded-full flex items-center justify-center"
                        style={{ width: 56, height: 56, background: s.color + "33" }}
                      >
                        <Icon style={{ color: s.color, width: 24, height: 24 }} />
                      </div>
                      <div className="mt-4 text-[14px] font-medium text-foreground">{s.name}</div>
                      <div className="mt-2 font-mono font-semibold text-foreground leading-none" style={{ fontSize: 32 }}>{count}</div>
                      <div className="mt-2 text-[13px]" style={{ color: "#71717A" }}>{pct}%</div>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className="flex items-center flex-1 min-w-[60px]" style={{ height: 56 }}>
                        <div className="flex-1 h-px bg-[#2A2A2E]" />
                        <ChevronRight className="h-4 w-4 -ml-1 shrink-0" style={{ color: "#3B82F6" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 3-column row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
        {/* Recent Applications */}
        <section className="rounded-xl border border-[#1E1E22] bg-[#141416] overflow-hidden lg:col-span-2 xl:col-span-1 transition-colors hover:border-[#2A2A2E] flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#1E1E22]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: "#3B82F6" }} />
              <h3 className="text-[16px] font-medium text-foreground">Recent Applications</h3>
            </div>
            <Link to="/candidates" className="text-[14px] text-[#3B82F6] hover:underline">View all</Link>
          </div>
          {recent.isLoading ? (
            <div className="p-5 space-y-3 flex-1">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14" />)}</div>
          ) : (recent.data?.length ?? 0) === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={FileText} title="No applications yet" description="Create a job and share the application link to start receiving applications." />
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left">
                    <th className="px-5 py-3 font-normal" style={{ fontSize: 12, color: "#71717A", letterSpacing: "0.05em", textTransform: "uppercase" }}>Candidate</th>
                    <th className="px-5 py-3 font-normal" style={{ fontSize: 12, color: "#71717A", letterSpacing: "0.05em", textTransform: "uppercase" }}>Role</th>
                    <th className="px-5 py-3 font-normal whitespace-nowrap" style={{ fontSize: 12, color: "#71717A", letterSpacing: "0.05em", textTransform: "uppercase" }}>Applied</th>
                    <th className="px-5 py-3 font-normal" style={{ fontSize: 12, color: "#71717A", letterSpacing: "0.05em", textTransform: "uppercase" }}>Stage</th>
                    <th className="px-5 py-3 font-normal" style={{ fontSize: 12, color: "#71717A", letterSpacing: "0.05em", textTransform: "uppercase" }}>AI</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data!.map((row: any) => {
                    const name = `${row.candidate?.first_name ?? ""} ${row.candidate?.last_name ?? ""}`.trim();
                    return (
                      <tr key={row.id} className="border-t border-[#1E1E22] hover:bg-[#1A1A1E] transition-colors" style={{ height: 56 }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="rounded-full bg-[#1E1E22] text-white flex items-center justify-center shrink-0" style={{ width: 36, height: 36, fontSize: 13, fontWeight: 500 }}>
                              {initials(name) || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="text-foreground truncate" style={{ fontSize: 14 }}>{name || "—"}</div>
                              <div className="truncate" style={{ fontSize: 12, color: "#71717A" }}>{row.candidate?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 truncate" style={{ fontSize: 13, color: "#9CA3AF" }} title={row.job?.title}>{row.job?.title}</td>
                        <td className="px-5 py-3 whitespace-nowrap" style={{ fontSize: 13, color: "#71717A" }}>{formatShortDate(row.applied_at)}</td>
                        <td className="px-5 py-3"><StageChip stage={row.current_stage} /></td>
                        <td className="px-5 py-3">
                          {row.ai_score != null ? (() => {
                            const c = scoreColors(row.ai_score);
                            return (
                              <div className="rounded-full flex items-center justify-center font-mono font-semibold" style={{ width: 40, height: 40, background: c.bg, color: c.color, fontSize: 15, fontWeight: 600, border: `2px solid ${c.ring}` }}>
                                {row.ai_score}
                              </div>
                            );
                          })() : <span style={{ color: "#71717A" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* AI Recommendations */}
        <section className="rounded-xl border border-[#1E1E22] bg-[#141416] p-6 transition-colors hover:border-[#2A2A2E] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: "#8B5CF6" }} />
              <h3 className="text-[16px] font-medium text-foreground">AI Recommendations</h3>
            </div>
            <Link to="/candidates" className="text-[14px] text-[#3B82F6] hover:underline">View all</Link>
          </div>
          {aiRecs.isLoading ? (
            <div className="space-y-3 mt-4 flex-1">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
          ) : (aiRecs.data?.length ?? 0) === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={Sparkles} title="No AI recommendations yet" description="Score candidates to see top recommendations here." />
            </div>
          ) : (
            <div className="flex-1">
              {aiRecs.data!.map((row: any, idx: number) => {
                const name = `${row.candidate?.first_name ?? ""} ${row.candidate?.last_name ?? ""}`.trim();
                const c = scoreColors(row.ai_score);
                const rb = recBadge(row.ai_recommendation);
                const fb = fitBadge(row.ai_score);
                return (
                  <button
                    key={row.id}
                    onClick={() => row.candidate?.id && navigate({ to: "/candidates/$candidateId", params: { candidateId: row.candidate.id } })}
                    className={`w-full flex items-center gap-4 text-left hover:bg-[#1A1A1E] transition-colors -mx-2 px-2 rounded-md ${idx < aiRecs.data!.length - 1 ? "border-b border-[#1E1E22]" : ""}`}
                    style={{ paddingTop: 20, paddingBottom: 20 }}
                  >
                    <div
                      className="rounded-full flex items-center justify-center font-mono shrink-0"
                      style={{ width: 56, height: 56, background: c.bg, color: c.color, fontSize: 22, fontWeight: 700, border: `2px solid ${c.ring}` }}
                    >
                      {row.ai_score}
                    </div>
                    <div className="rounded-full bg-[#1E1E22] text-white flex items-center justify-center shrink-0" style={{ width: 48, height: 48, fontSize: 16, fontWeight: 500 }}>
                      {initials(name) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate" style={{ fontSize: 15 }}>{name || "—"}</div>
                      <div className="truncate" style={{ fontSize: 13, color: "#71717A" }}>{row.job?.title}</div>
                      {(rb || fb) && (
                        <div className="mt-2 flex gap-1.5 flex-wrap">
                          {rb && (
                            <span className="inline-flex items-center rounded-md font-medium" style={{ background: rb.bg, color: rb.color, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>{rb.label}</span>
                          )}
                          {fb && (
                            <span className="inline-flex items-center rounded-md font-medium" style={{ background: fb.bg, color: fb.color, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>{fb.label}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="shrink-0" style={{ color: "#71717A", width: 18, height: 18 }} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Analytics Snapshot */}
        <section className="rounded-xl border border-[#1E1E22] bg-[#141416] p-6 transition-colors hover:border-[#2A2A2E] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: "#3B82F6" }} />
              <h3 className="text-[16px] font-medium text-foreground">Analytics Snapshot</h3>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>Applications over time</div>
            <span
              className="inline-flex items-center rounded-full"
              style={{ background: "#1E1E22", color: "#71717A", border: "1px solid #2A2A2E", padding: "4px 12px", fontSize: 12 }}
            >
              Last 30 days
            </span>
          </div>

          <div className="relative" style={{ height: 180 }}>
            {analytics.isLoading ? (
              <div className="skeleton h-full w-full" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.data?.days || []} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.45} />
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
                {(analytics.data?.days.filter((d) => d.count > 0).length ?? 0) < 3 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[12px]" style={{ color: "#71717A" }}>More data needed for trends</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[#1E1E22] flex-1 flex items-center">
            {analytics.isLoading ? (
              <div className="skeleton h-14 w-full" />
            ) : !analytics.data?.bottleneck ? (
              <div style={{ fontSize: 13, color: "#71717A" }}>Not enough data yet</div>
            ) : (
              <div className="flex items-center gap-3 w-full">
                <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 48, height: 48, background: "#F59E0B33" }}>
                  <Clock style={{ color: "#F59E0B", width: 22, height: 22 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 12, color: "#71717A" }}>Bottleneck (Time in Stage)</div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="font-medium text-foreground" style={{ fontSize: 18 }}>{analytics.data.bottleneck.stage}</div>
                    <div className="font-mono font-semibold text-foreground" style={{ fontSize: 24 }}>
                      {analytics.data.bottleneck.avg.toFixed(1)}
                      <span className="font-sans font-normal ml-1" style={{ fontSize: 14, color: "#71717A" }}>days</span>
                    </div>
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
    <div
      className="group rounded-xl border border-[#1E1E22] bg-[#141416] hover:border-[#2A2A2E] transition-colors"
      style={{ padding: "24px 28px", borderLeft: `3px solid ${color}99` }}
    >
      <div className="flex items-center gap-4">
        <div
          className="rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
          style={{ width: 64, height: 64, background: color + "33" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = color + "55")}
          onMouseLeave={(e) => (e.currentTarget.style.background = color + "33")}
        >
          <Icon style={{ color, width: 28, height: 28 }} />
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>{label}</div>
          {loading ? (
            <div className="skeleton h-9 w-20 my-1" />
          ) : (
            <div className="font-mono font-semibold text-foreground leading-tight" style={{ fontSize: 36, fontWeight: 600 }}>{value ?? 0}</div>
          )}
          <div className="mt-1">
            {trend == null ? (
              <span style={{ fontSize: 12, color: "#71717A" }}>No prior data</span>
            ) : trend >= 0 ? (
              <span style={{ fontSize: 13 }}>
                <span style={{ color: "#22C55E" }}>↑ {trend}%</span>
                <span style={{ color: "#71717A" }}> vs last 30 days</span>
              </span>
            ) : (
              <span style={{ fontSize: 13 }}>
                <span style={{ color: "#EF4444" }}>↓ {Math.abs(trend)}%</span>
                <span style={{ color: "#71717A" }}> vs last 30 days</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
