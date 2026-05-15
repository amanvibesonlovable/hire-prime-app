import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, Users, FileText, Clock, Workflow, Sparkles, BarChart3,
  FileUp, Search, UserCheck, Mail, CheckCircle, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { greeting, initials } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

// Full set used to count counts via DB stages
const STAGE_KEYS = ["Applied", "Screening", "Test", "Interview 1", "Interview 2", "Offer", "Hired"];

// Display-only consolidated pipeline (5 stages)
const DISPLAY_STAGES: { name: string; icon: any; sources: string[]; gradient: string; border: string; iconColor: string; shadow: string }[] = [
  { name: "Applied",   icon: FileUp,      sources: ["Applied"],                   gradient: "linear-gradient(135deg, rgba(59,130,246,0.28), rgba(30,58,138,0.22))",  border: "rgba(96,165,250,0.25)",  iconColor: "#93C5FD", shadow: "0 4px 16px rgba(59,130,246,0.22)" },
  { name: "Screening", icon: Search,      sources: ["Screening", "Test"],         gradient: "linear-gradient(135deg, rgba(139,92,246,0.28), rgba(76,29,149,0.22))",  border: "rgba(167,139,250,0.25)", iconColor: "#C4B5FD", shadow: "0 4px 16px rgba(139,92,246,0.22)" },
  { name: "Interview", icon: Users,       sources: ["Interview 1", "Interview 2"],gradient: "linear-gradient(135deg, rgba(217,70,239,0.28), rgba(112,26,117,0.22))", border: "rgba(232,121,249,0.25)", iconColor: "#F0ABFC", shadow: "0 4px 16px rgba(217,70,239,0.22)" },
  { name: "Offer",     icon: Mail,        sources: ["Offer"],                     gradient: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(120,53,15,0.22))",  border: "rgba(251,191,36,0.25)",  iconColor: "#FCD34D", shadow: "0 4px 16px rgba(251,191,36,0.22)" },
  { name: "Hired",     icon: CheckCircle, sources: ["Hired"],                     gradient: "linear-gradient(135deg, rgba(52,211,153,0.28), rgba(6,78,59,0.22))",   border: "rgba(52,211,153,0.25)",  iconColor: "#6EE7B7", shadow: "0 4px 16px rgba(52,211,153,0.22)" },
];

// Card visual constants
const CARD_BG = "rgba(12, 15, 22, 0.8)";
const CARD_BORDER = "1px solid rgba(255, 255, 255, 0.08)";
const CARD_SHADOW = "0 4px 24px -4px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03)";
const CARD_STYLE: React.CSSProperties = {
  background: CARD_BG,
  border: CARD_BORDER,
  borderRadius: 16,
  boxShadow: CARD_SHADOW,
};

function stageBadgeStyle(stage: string): { bg: string; color: string } {
  if (stage === "Applied")    return { bg: "rgba(59,130,246,0.10)",  color: "#93C5FD" };
  if (stage === "Screening")  return { bg: "rgba(139,92,246,0.10)",  color: "#C4B5FD" };
  if (stage === "Test")       return { bg: "rgba(236,72,153,0.10)",  color: "#F9A8D4" };
  if (stage?.startsWith("Interview")) return { bg: "rgba(236,72,153,0.10)", color: "#F9A8D4" };
  if (stage === "Offer")      return { bg: "rgba(251,191,36,0.10)",  color: "#FCD34D" };
  if (stage === "Hired")      return { bg: "rgba(52,211,153,0.10)",  color: "#6EE7B7" };
  return { bg: "rgba(255,255,255,0.06)", color: "#CBD5E1" };
}

function StageChip({ stage }: { stage: string }) {
  const c = stageBadgeStyle(stage);
  return (
    <span
      className="inline-flex items-center font-medium"
      style={{ background: c.bg, color: c.color, fontSize: 12, padding: "4px 12px", fontWeight: 500, borderRadius: 8 }}
    >
      {stage}
    </span>
  );
}

function aiScoreRing(score: number): { border: string; color: string } {
  if (score >= 80 || score >= 8) return { border: "rgba(251,146,60,0.7)", color: "#FDBA74" };
  if (score >= 70 || score >= 7) return { border: "rgba(167,139,250,0.7)", color: "#C4B5FD" };
  return { border: "rgba(96,165,250,0.7)", color: "#93C5FD" };
}

function recBadge(rec: string | null) {
  if (rec === "Strong Yes") return "Strong Hire";
  if (rec === "Yes") return "Recommended";
  if (rec === "Maybe") return "Worth Reviewing";
  if (rec === "No") return "Low Match";
  return null;
}

function fitBadge(score: number) {
  if (score >= 9) return "Top Match";
  if (score >= 8) return "High Potential";
  if (score >= 7) return "Good Fit";
  return null;
}

function formatShortDate(d: string | null | undefined) {
  if (!d) return "—";
  const t = new Date(d);
  if (isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ViewAllButton({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center rounded-lg transition-colors hover:bg-white/5"
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        padding: "6px 12px",
        fontSize: 12,
        color: "#CBD5E1",
      }}
    >
      View all
    </Link>
  );
}

function SectionTitle({ icon: Icon, color, children }: { icon: any; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color }} />
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF" }}>{children}</h3>
    </div>
  );
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
      const total = STAGE_KEYS.reduce((s, st) => s + (counts[st] || 0), 0);
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
    <div className="relative">
      {/* Decorative background orbs + grid */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute"
          style={{
            top: -120, left: -80, width: 384, height: 384, borderRadius: "9999px",
            background: "rgba(37, 99, 235, 0.08)", filter: "blur(80px)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: 120, right: -100, width: 384, height: 384, borderRadius: "9999px",
            background: "rgba(168, 85, 247, 0.08)", filter: "blur(80px)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            opacity: 0.3,
          }}
        />
      </div>

      <div className="relative z-10 space-y-10">
        <div>
          <h2 className="text-[28px] font-semibold text-foreground tracking-tight">
            {greeting()}, {firstName} <span className="inline-block">👋</span>
          </h2>
          <p className="mt-1 mb-6" style={{ fontSize: 15, color: "#CBD5E1" }}>Here's your hiring overview.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Open Jobs" value={stats.data?.openJobs} icon={Briefcase}
            gradient="linear-gradient(135deg, rgba(139,92,246,0.25), rgba(46,16,101,0.20))"
            border="rgba(167,139,250,0.20)" iconColor="#C4B5FD"
            shadow="0 4px 12px rgba(139,92,246,0.20)"
            trend={stats.data?.openJobsTrend} loading={stats.isLoading}
          />
          <StatCard
            label="Total Candidates" value={stats.data?.candidates} icon={Users}
            gradient="linear-gradient(135deg, rgba(217,70,239,0.25), rgba(74,4,78,0.20))"
            border="rgba(232,121,249,0.20)" iconColor="#F0ABFC"
            shadow="0 4px 12px rgba(217,70,239,0.20)"
            trend={stats.data?.candidatesTrend} loading={stats.isLoading}
          />
          <StatCard
            label="Active Applications" value={stats.data?.activeApps} icon={FileText}
            gradient="linear-gradient(135deg, rgba(59,130,246,0.25), rgba(23,37,84,0.20))"
            border="rgba(96,165,250,0.20)" iconColor="#93C5FD"
            shadow="0 4px 12px rgba(59,130,246,0.20)"
            trend={stats.data?.appsTrend} loading={stats.isLoading}
          />
          <StatCard
            label="Avg. Days in Pipeline" value={stats.data?.avgDays} icon={Clock}
            gradient="linear-gradient(135deg, rgba(245,158,11,0.25), rgba(69,26,3,0.20))"
            border="rgba(251,191,36,0.20)" iconColor="#FCD34D"
            shadow="0 4px 12px rgba(245,158,11,0.20)"
            trend={null} loading={stats.isLoading}
          />
        </div>

        {/* Pipeline overview */}
        <section style={{ ...CARD_STYLE, padding: 32 }}>
          <div className="mb-7">
            <SectionTitle icon={Workflow} color="#C4B5FD">Hiring Pipeline Overview</SectionTitle>
          </div>
          {pipeline.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] gap-y-6 md:gap-y-0 items-center">
              {DISPLAY_STAGES.map((s, i) => {
                const count = s.sources.reduce((sum, key) => sum + (pipeline.data?.counts[key] || 0), 0);
                const pct = pipeline.data?.total ? Math.round((count / pipeline.data.total) * 100) : 0;
                const Icon = s.icon;
                return (
                  <div key={s.name} className="contents">
                    <div className="flex items-center gap-4 justify-self-center md:justify-self-stretch">
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 56, height: 56, borderRadius: 9999,
                          background: s.gradient,
                          border: `1px solid ${s.border}`,
                          boxShadow: s.shadow,
                        }}
                      >
                        <Icon style={{ color: s.iconColor, width: 24, height: 24 }} />
                      </div>
                      <div className="min-w-0">
                        <div style={{ fontSize: 14, color: "#FFFFFF" }}>{s.name}</div>
                        <div className="font-mono leading-none mt-1" style={{ fontSize: 22, fontWeight: 600, color: "#FFFFFF" }}>{count}</div>
                        <div className="mt-1" style={{ fontSize: 12, color: "#64748B" }}>{pct}%</div>
                      </div>
                    </div>
                    {i < DISPLAY_STAGES.length - 1 && (
                      <div className="hidden md:block mx-2" style={{ width: 64, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0))" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3-column row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
          {/* Recent Applications */}
          <section style={{ ...CARD_STYLE, overflow: "hidden" }} className="lg:col-span-2 xl:col-span-1 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <SectionTitle icon={FileText} color="#93C5FD">Recent Applications</SectionTitle>
              <ViewAllButton to="/candidates" />
            </div>
            {recent.isLoading ? (
              <div className="p-5 space-y-3 flex-1">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14" />)}</div>
            ) : (recent.data?.length ?? 0) === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState icon={FileText} title="No applications yet" description="Create a job and share the application link to start receiving applications." />
              </div>
            ) : (
              <div className="flex-1">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left">
                      <th className="px-5 py-3 font-medium" style={{ fontSize: 12, color: "#64748B" }}>Candidate</th>
                      <th className="px-5 py-3 font-medium whitespace-nowrap" style={{ fontSize: 12, color: "#64748B" }}>Applied</th>
                      <th className="px-5 py-3 font-medium" style={{ fontSize: 12, color: "#64748B" }}>Stage</th>
                      <th className="px-5 py-3 font-medium" style={{ fontSize: 12, color: "#64748B" }}>AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.data!.map((row: any) => {
                      const name = `${row.candidate?.first_name ?? ""} ${row.candidate?.last_name ?? ""}`.trim();
                      const ring = row.ai_score != null ? aiScoreRing(row.ai_score) : null;
                      return (
                        <tr key={row.id} className="hover:bg-white/[0.025] transition-colors" style={{ height: 56, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="rounded-full text-white flex items-center justify-center shrink-0 ring-2 ring-white/10"
                                style={{ width: 36, height: 36, fontSize: 13, fontWeight: 500, background: "rgba(255,255,255,0.06)" }}
                              >
                                {initials(name) || "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-foreground truncate" style={{ fontSize: 14, fontWeight: 600 }}>{name || "—"}</div>
                                <div className="truncate" style={{ fontSize: 11, color: "#64748B" }}>{row.candidate?.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap" style={{ fontSize: 13, color: "#94A3B8" }}>{formatShortDate(row.applied_at)}</td>
                          <td className="px-5 py-3"><StageChip stage={row.current_stage} /></td>
                          <td className="px-5 py-3">
                            {row.ai_score != null && ring ? (
                              <div
                                className="rounded-full flex items-center justify-center font-mono"
                                style={{ width: 40, height: 40, fontSize: 14, fontWeight: 600, color: ring.color, border: `2px solid ${ring.border}`, background: "rgba(255,255,255,0.02)" }}
                              >
                                {row.ai_score}
                              </div>
                            ) : <span style={{ color: "#64748B" }}>—</span>}
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
          <section style={{ ...CARD_STYLE, padding: 24 }} className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <SectionTitle icon={Sparkles} color="#F0ABFC">AI Recommendations</SectionTitle>
              <ViewAllButton to="/candidates" />
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
                  const rb = recBadge(row.ai_recommendation);
                  const fb = fitBadge(row.ai_score);
                  return (
                    <button
                      key={row.id}
                      onClick={() => row.candidate?.id && navigate({ to: "/candidates/$candidateId", params: { candidateId: row.candidate.id } })}
                      className="w-full flex items-center gap-4 text-left hover:bg-white/[0.03] transition-colors -mx-2 px-2 rounded-md"
                      style={{
                        paddingTop: 18,
                        paddingBottom: 18,
                        borderBottom: idx < aiRecs.data!.length - 1 ? "1px solid rgba(255,255,255,0.07)" : undefined,
                      }}
                    >
                      <div
                        className="rounded-full flex items-center justify-center font-mono shrink-0"
                        style={{
                          width: 56, height: 56,
                          fontSize: 20, fontWeight: 600, color: "#FFFFFF",
                          border: "2px solid #D946EF",
                          boxShadow: "0 0 20px rgba(217,70,239,0.25)",
                          background: "rgba(217,70,239,0.08)",
                        }}
                      >
                        {row.ai_score}
                      </div>
                      <div className="rounded-full text-white flex items-center justify-center shrink-0 ring-2 ring-white/10" style={{ width: 44, height: 44, fontSize: 15, fontWeight: 500, background: "rgba(255,255,255,0.06)" }}>
                        {initials(name) || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF" }}>{name || "—"}</div>
                        <div className="truncate" style={{ fontSize: 12, color: "#94A3B8" }}>{row.job?.title}</div>
                        {(rb || fb) && (
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            {rb && (
                              <span className="inline-flex items-center" style={{ background: "rgba(52,211,153,0.15)", color: "#6EE7B7", padding: "2px 8px", fontSize: 11, fontWeight: 500, borderRadius: 6 }}>{rb}</span>
                            )}
                            {fb && (
                              <span className="inline-flex items-center" style={{ background: "rgba(139,92,246,0.15)", color: "#C4B5FD", padding: "2px 8px", fontSize: 11, fontWeight: 500, borderRadius: 6 }}>{fb}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="shrink-0" style={{ color: "#64748B", width: 18, height: 18 }} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Analytics Snapshot */}
          <section style={{ ...CARD_STYLE, padding: 24 }} className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle icon={BarChart3} color="#C4B5FD">Analytics Snapshot</SectionTitle>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div style={{ fontSize: 13, color: "#CBD5E1" }}>Applications over time</div>
              <span
                className="inline-flex items-center rounded-full"
                style={{ background: "rgba(255,255,255,0.04)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.08)", padding: "4px 12px", fontSize: 12 }}
              >
                Last 30 days
              </span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.10)", padding: 12 }}>
              {analytics.isLoading ? (
                <div className="skeleton" style={{ height: 156, width: "100%" }} />
              ) : (
                <AnalyticsSparkline points={(analytics.data?.days || []).map((d) => d.count)} labels={(analytics.data?.days || []).map((d) => d.label)} />
              )}
            </div>

            <div className="mt-4 flex-1 flex items-center">
              {analytics.isLoading ? (
                <div className="skeleton h-14 w-full" />
              ) : !analytics.data?.bottleneck ? (
                <div style={{ fontSize: 13, color: "#94A3B8" }}>Not enough data yet</div>
              ) : (
                <div
                  className="flex items-center gap-4 w-full"
                  style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 16 }}
                >
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(139,92,246,0.15)" }}
                  >
                    <Clock style={{ color: "#C4B5FD", width: 22, height: 22 }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>Bottleneck (Time in Stage)</div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <div style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF" }}>{analytics.data.bottleneck.stage}</div>
                      <div className="font-mono" style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF" }}>
                        {analytics.data.bottleneck.avg.toFixed(1)}
                        <span className="font-sans font-normal ml-1" style={{ fontSize: 14, color: "#94A3B8" }}>days</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-auto" style={{ fontSize: 12, color: "#34D399" }}>↓ trending</div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, gradient, border, iconColor, shadow, trend, loading,
}: {
  label: string; value?: number; icon: any;
  gradient: string; border: string; iconColor: string; shadow: string;
  trend: number | null | undefined; loading: boolean;
}) {
  return (
    <div style={{ ...CARD_STYLE, padding: "24px 24px" }}>
      <div className="flex items-center gap-4">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: gradient,
            border: `1px solid ${border}`,
            boxShadow: shadow,
          }}
        >
          <Icon style={{ color: iconColor, width: 26, height: 26 }} />
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 14, fontWeight: 500, color: "#CBD5E1" }}>{label}</div>
          {loading ? (
            <div className="skeleton h-8 w-20 my-1" />
          ) : (
            <div className="font-mono leading-tight tracking-tight" style={{ fontSize: 32, fontWeight: 600, color: "#FFFFFF" }}>{value ?? 0}</div>
          )}
          <div className="mt-1">
            {trend == null ? (
              <span style={{ fontSize: 12, color: "#64748B" }}>No prior data</span>
            ) : trend >= 0 ? (
              <span style={{ fontSize: 12 }}>
                <span style={{ color: "#34D399" }}>↑ {trend}%</span>
                <span style={{ color: "#64748B" }}> vs last 30 days</span>
              </span>
            ) : (
              <span style={{ fontSize: 12 }}>
                <span style={{ color: "#F87171" }}>↓ {Math.abs(trend)}%</span>
                <span style={{ color: "#64748B" }}> vs last 30 days</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsSparkline({ points, labels }: { points: number[]; labels: string[] }) {
  const W = 600;
  const H = 156;
  const padX = 16;
  const padY = 16;
  const n = points.length;
  if (n === 0) return <div style={{ height: H }} />;
  const max = Math.max(1, ...points);
  const stepX = (W - padX * 2) / Math.max(1, n - 1);
  const yFor = (v: number) => H - padY - (v / max) * (H - padY * 2);
  const xFor = (i: number) => padX + i * stepX;

  // Smooth path using cubic bezier
  const pts = points.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  const fillD = `${d} L ${pts[pts.length - 1].x} ${H - padY} L ${pts[0].x} ${H - padY} Z`;

  // Pick ~5 evenly spaced label indices that have a label
  const tickIdx: number[] = [];
  const target = 4;
  for (let i = 0; i < target; i++) {
    tickIdx.push(Math.round((i / (target - 1)) * (n - 1)));
  }

  // Dot indices: every 6th
  const dots: number[] = [];
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6))) dots.push(i);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }}>
        <defs>
          <linearGradient id="dashSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#dashSparkFill)" />
        <path d={d} fill="none" stroke="#7C3AED" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {dots.map((i) => (
          <circle key={i} cx={pts[i].x} cy={pts[i].y} r={4} fill="#60A5FA" />
        ))}
      </svg>
      <div className="flex justify-between mt-2 px-1">
        {tickIdx.map((i) => (
          <span key={i} style={{ fontSize: 11, color: "#64748B" }}>{labels[i]}</span>
        ))}
      </div>
    </div>
  );
}
