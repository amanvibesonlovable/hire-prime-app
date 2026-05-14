import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Briefcase, Clock, FileText, Sparkles, TrendingUp, Users, ArrowUp, ArrowDown,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
  AreaChart, Area, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { relTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Meridian" }] }),
  component: AnalyticsPage,
});

type Range = "7" | "30" | "90" | "all";

const STAGES = ["Applied", "Screening", "Test", "Interview 1", "Interview 2", "Offer", "Hired"];

function rangeToDays(r: Range): number | null {
  if (r === "all") return null;
  return parseInt(r, 10);
}

function rangeStart(r: Range): Date | null {
  const days = rangeToDays(r);
  if (days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function priorRangeStart(r: Range): Date | null {
  const days = rangeToDays(r);
  if (days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days * 2);
  return d;
}

const tooltipStyle = {
  contentStyle: { background: "#1E1E22", border: "1px solid #2A2A2E", borderRadius: 6, color: "#FAFAFA", fontSize: 12 },
  labelStyle: { color: "#FAFAFA" },
  itemStyle: { color: "#FAFAFA" },
};

function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30");
  const [dept, setDept] = useState<string>("all");

  const departments = useQuery({
    queryKey: ["a-departments"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("department");
      const set = new Set<string>();
      (data || []).forEach((j) => j.department && set.add(j.department));
      return Array.from(set).sort();
    },
    staleTime: 30_000,
  });

  const data = useQuery({
    queryKey: ["analytics", range, dept],
    queryFn: async () => loadAnalytics(range, dept),
    staleTime: 30_000,
  });

  const k = data.data;

  return (
    <div className="space-y-6 page-fade-in">
      {/* Sticky filters */}
      <div className="sticky top-14 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/95 backdrop-blur z-10 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex gap-1 bg-surface border border-border rounded-md p-0.5 w-fit">
            {(["7", "30", "90", "all"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 h-7 text-[12px] rounded transition-colors",
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r === "all" ? "All time" : `${r} days`}
              </button>
            ))}
          </div>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="bg-surface border border-border rounded-md h-8 px-3 text-[13px] text-foreground"
          >
            <option value="all">All Departments</option>
            {(departments.data || []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Open Jobs" value={k?.openJobs.value} trend={k?.openJobs.trend} icon={Briefcase} loading={data.isLoading} />
        <KpiCard label="Total Candidates" value={k?.totalCandidates.value} trend={k?.totalCandidates.trend} icon={Users} loading={data.isLoading} />
        <KpiCard label="Active Applications" value={k?.activeApps.value} trend={k?.activeApps.trend} icon={FileText} loading={data.isLoading} />
        <KpiCard label="Avg. AI Score" value={k?.avgScore.display} trend={k?.avgScore.trend} icon={Sparkles} iconClass="text-violet" loading={data.isLoading} />
        <KpiCard label="Avg. Time-to-Hire" value={k?.timeToHire.display} trend={k?.timeToHire.trend} icon={Clock} loading={data.isLoading} />
        <KpiCard label="Offer Acceptance" value={k?.offerAccept.display} trend={k?.offerAccept.trend} icon={TrendingUp} loading={data.isLoading} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Pipeline Funnel" subtitle="Candidates reaching each stage" loading={data.isLoading}>
          {k && k.funnel.some((f) => f.value > 0) ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={k.funnel} layout="vertical" margin={{ left: 16, right: 32, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#1E1E22" horizontal={false} />
                <XAxis type="number" stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} />
                <YAxis dataKey="stage" type="category" stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} width={90} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "#1A1A1E" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ fill: "#FAFAFA", fontSize: 12, position: "right" }}>
                  {k.funnel.map((_, i) => (
                    <Cell key={i} fill={funnelColor(i, k.funnel.length)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} title="No data" description="No applications in this period yet." />
          )}
        </ChartCard>

        <ChartCard title="Applications Over Time" subtitle="New applications received" loading={data.isLoading}>
          {k && k.overTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={k.overTime} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E1E22" />
                <XAxis dataKey="label" stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} />
                <YAxis stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fill="url(#appGrad)" dot={{ fill: "#3B82F6", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} title="No data" description="No applications in this period yet." />
          )}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Avg. Time in Stage" subtitle="Identifies bottlenecks in your process" loading={data.isLoading}>
          {k && k.timeInStage.some((t) => t.days > 0) ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={k.timeInStage} margin={{ left: 0, right: 16, top: 16, bottom: 8 }}>
                <CartesianGrid stroke="#1E1E22" vertical={false} />
                <XAxis dataKey="stage" stroke="#71717A" fontSize={11} axisLine={{ stroke: "#1E1E22" }} tickLine={false} />
                <YAxis stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "#1A1A1E" }} formatter={(v: any) => [`${v} days`, "Avg time"]} />
                <Bar dataKey="days" radius={[4, 4, 0, 0]} label={{ fill: "#FAFAFA", fontSize: 11, position: "top" }}>
                  {k.timeInStage.map((t, i) => (
                    <Cell key={i} fill={t.isLongest ? "#EF4444" : "#3B82F6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} title="No data" description="Move candidates through stages to see timings." />
          )}
        </ChartCard>

        <ChartCard title="AI Score Distribution" subtitle="Spread of candidate scores" loading={data.isLoading}>
          {k && k.scoreDist.some((s) => s.count > 0) ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={k.scoreDist} margin={{ left: 0, right: 16, top: 16, bottom: 8 }}>
                <CartesianGrid stroke="#1E1E22" vertical={false} />
                <XAxis dataKey="score" stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} />
                <YAxis stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "#1A1A1E" }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Sparkles} title="No AI scores yet" description="Score candidates to see the distribution." />
          )}
        </ChartCard>
      </div>

      {/* Hiring by department */}
      <ChartCard title="Hiring by Department" subtitle="Positions, candidates, and hires across teams" loading={data.isLoading}>
        {k && k.byDept.length > 0 ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={k.byDept} margin={{ left: 0, right: 16, top: 16, bottom: 8 }}>
              <CartesianGrid stroke="#1E1E22" vertical={false} />
              <XAxis dataKey="department" stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} />
              <YAxis stroke="#71717A" fontSize={12} axisLine={{ stroke: "#1E1E22" }} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "#1A1A1E" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#71717A" }} />
              <Bar name="Open Positions" dataKey="open" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar name="Candidates" dataKey="candidates" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              <Bar name="Hires" dataKey="hires" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={BarChart3} title="No data" description="Create jobs and receive applications to see breakdown." />
        )}
      </ChartCard>

      {/* Recruiter Activity */}
      <section className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-[14px] font-semibold">Recruiter Activity</h3>
          <span className="text-[12px] text-muted-foreground">{labelFor(range)}</span>
        </div>
        {data.isLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10" />)}</div>
        ) : !k || k.recruiters.length === 0 ? (
          <div className="py-10"><EmptyState icon={Users} title="No recruiter activity in this period" description="Move candidates and add notes to see activity here." /></div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="font-medium px-5 py-3">Recruiter</th>
                <th className="font-medium px-5 py-3">Candidates Moved</th>
                <th className="font-medium px-5 py-3">Notes Added</th>
                <th className="font-medium px-5 py-3">Avg. Rating</th>
                <th className="font-medium px-5 py-3">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {k.recruiters.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-hover transition-colors">
                  <td className="px-5 py-3 text-foreground">{r.name}</td>
                  <td className="px-5 py-3 font-mono">{r.moved}</td>
                  <td className="px-5 py-3 font-mono">{r.notes}</td>
                  <td className="px-5 py-3 font-mono">{r.avgRating != null ? r.avgRating.toFixed(1) : "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.lastActive ? relTime(r.lastActive) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function labelFor(r: Range) {
  if (r === "all") return "All time";
  return `Last ${r} days`;
}

function funnelColor(i: number, n: number): string {
  // blue (#3B82F6) → green (#22C55E)
  const t = n <= 1 ? 0 : i / (n - 1);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(0x3B, 0x22)}, ${lerp(0x82, 0xC5)}, ${lerp(0xF6, 0x5E)})`;
}

function KpiCard({
  label, value, trend, icon: Icon, loading, iconClass,
}: { label: string; value?: number | string; trend?: number | null; icon: any; loading: boolean; iconClass?: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          {loading ? <div className="skeleton h-7 w-16 mb-2" /> : (
            <div className="text-[28px] font-mono font-semibold text-foreground leading-none">{value ?? "—"}</div>
          )}
          <div className="text-[12px] text-muted-foreground mt-2 uppercase tracking-wide">{label}</div>
          {!loading && (
            trend == null ? (
              <div className="text-[11px] text-muted-foreground mt-1">—</div>
            ) : (
              <div className={cn("text-[11px] mt-1 inline-flex items-center gap-0.5", trend >= 0 ? "text-success" : "text-danger")}>
                {trend >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(trend).toFixed(0)}%
              </div>
            )
          )}
        </div>
        <Icon className={cn("h-5 w-5 text-muted-foreground shrink-0", iconClass)} />
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, loading, children }: { title: string; subtitle: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      {loading ? <div className="skeleton h-[320px]" /> : children}
    </div>
  );
}

// ===== Data layer =====

type Kpi = { value: number | string; trend: number | null };
type AnalyticsData = {
  openJobs: { value: number; trend: number | null };
  totalCandidates: { value: number; trend: number | null };
  activeApps: { value: number; trend: number | null };
  avgScore: { display: string; trend: number | null };
  timeToHire: { display: string; trend: number | null };
  offerAccept: { display: string; trend: number | null };
  funnel: { stage: string; value: number }[];
  overTime: { label: string; count: number }[];
  timeInStage: { stage: string; days: number; isLongest: boolean }[];
  scoreDist: { score: number; count: number }[];
  byDept: { department: string; open: number; candidates: number; hires: number }[];
  recruiters: { id: string; name: string; moved: number; notes: number; avgRating: number | null; lastActive: string | null }[];
};

async function loadAnalytics(range: Range, dept: string): Promise<AnalyticsData> {
  const start = rangeStart(range);
  const priorStart = priorRangeStart(range);
  const startIso = start?.toISOString();
  const priorStartIso = priorStart?.toISOString();

  // Load jobs (filtered by department)
  let jobsQ = supabase.from("jobs").select("id, title, department, status, created_at");
  if (dept !== "all") jobsQ = jobsQ.eq("department", dept);
  const { data: jobs } = await jobsQ;
  const allJobs = jobs || [];
  const jobIds = allJobs.map((j) => j.id);
  const jobById = new Map(allJobs.map((j) => [j.id, j]));

  // Load applications scoped to those jobs
  let appsQ = supabase.from("applications").select("id, job_id, candidate_id, current_stage, status, applied_at, ai_score");
  if (jobIds.length > 0) appsQ = appsQ.in("job_id", jobIds);
  else appsQ = appsQ.eq("job_id", "00000000-0000-0000-0000-000000000000");
  const { data: appsAll } = await appsQ;
  const apps = appsAll || [];

  const appIds = apps.map((a) => a.id);
  const { data: history } = appIds.length
    ? await supabase.from("stage_history").select("id, application_id, from_stage, to_stage, moved_at, moved_by").in("application_id", appIds)
    : { data: [] as any[] };

  const { data: notes } = appIds.length
    ? await supabase.from("evaluation_notes").select("id, application_id, author_id, rating, created_at").in("application_id", appIds)
    : { data: [] as any[] };

  // Filter by date range
  const inCurrent = (iso: string) => !startIso || iso >= startIso;
  const inPrior = (iso: string) => !!priorStartIso && !!startIso && iso >= priorStartIso && iso < startIso;

  // KPI: Open Jobs (filtered period by created_at)
  const openJobsCurr = allJobs.filter((j) => j.status === "Open" && inCurrent(j.created_at)).length;
  const openJobsPrev = allJobs.filter((j) => j.status === "Open" && inPrior(j.created_at)).length;

  // Total Candidates
  const candCurr = new Set(apps.filter((a) => inCurrent(a.applied_at)).map((a) => a.candidate_id)).size;
  const candPrev = new Set(apps.filter((a) => inPrior(a.applied_at)).map((a) => a.candidate_id)).size;

  // Active Applications
  const activeCurr = apps.filter((a) => a.status === "Active" && inCurrent(a.applied_at)).length;
  const activePrev = apps.filter((a) => a.status === "Active" && inPrior(a.applied_at)).length;

  // Avg AI Score
  const scored = apps.filter((a) => a.ai_score != null && inCurrent(a.applied_at));
  const scoredPrev = apps.filter((a) => a.ai_score != null && inPrior(a.applied_at));
  const avgC = scored.length ? scored.reduce((s, a) => s + (a.ai_score as number), 0) / scored.length : null;
  const avgP = scoredPrev.length ? scoredPrev.reduce((s, a) => s + (a.ai_score as number), 0) / scoredPrev.length : null;

  // Time-to-hire
  const hiredApps = apps.filter((a) => a.status === "Hired" && inCurrent(a.applied_at));
  const hiredAppsPrev = apps.filter((a) => a.status === "Hired" && inPrior(a.applied_at));
  const computeTTH = (list: typeof apps) => {
    const days: number[] = [];
    list.forEach((a) => {
      const h = (history || []).find((s) => s.application_id === a.id && s.to_stage === "Hired");
      if (h) {
        const d = (new Date(h.moved_at).getTime() - new Date(a.applied_at).getTime()) / 86400000;
        if (d >= 0) days.push(d);
      }
    });
    return days.length ? days.reduce((a, b) => a + b, 0) / days.length : null;
  };
  const tthC = computeTTH(hiredApps);
  const tthP = computeTTH(hiredAppsPrev);

  // Offer acceptance
  const offerSet = new Set((history || []).filter((s) => s.to_stage === "Offer" && inCurrent(s.moved_at)).map((s) => s.application_id));
  const offerSetP = new Set((history || []).filter((s) => s.to_stage === "Offer" && inPrior(s.moved_at)).map((s) => s.application_id));
  const hiredFromOffer = hiredApps.filter((a) => offerSet.has(a.id)).length;
  const hiredFromOfferP = hiredAppsPrev.filter((a) => offerSetP.has(a.id)).length;
  const oaC = offerSet.size ? (hiredFromOffer / offerSet.size) * 100 : null;
  const oaP = offerSetP.size ? (hiredFromOfferP / offerSetP.size) * 100 : null;

  // Funnel (count of unique apps that reached each stage)
  const reachedByStage: Record<string, Set<string>> = Object.fromEntries(STAGES.map((s) => [s, new Set<string>()]));
  apps.forEach((a) => {
    if (!inCurrent(a.applied_at)) return;
    if (STAGES.includes(a.current_stage)) reachedByStage[a.current_stage].add(a.id);
    if (a.current_stage === "Applied" || a.status === "Active") reachedByStage["Applied"].add(a.id);
    else reachedByStage["Applied"].add(a.id);
  });
  (history || []).forEach((h) => {
    if (h.to_stage && STAGES.includes(h.to_stage) && reachedByStage[h.to_stage]) {
      reachedByStage[h.to_stage].add(h.application_id);
    }
  });
  // Always include Applied for any app in period
  apps.forEach((a) => { if (inCurrent(a.applied_at)) reachedByStage["Applied"].add(a.id); });
  const funnel = STAGES.map((s) => ({ stage: s, value: reachedByStage[s].size }));

  // Applications over time
  const overTime = bucketTime(apps.filter((a) => inCurrent(a.applied_at)).map((a) => a.applied_at), range);

  // Time in stage
  const timeInStage = computeTimeInStage(history || []);

  // Score distribution
  const scoreDist = Array.from({ length: 10 }, (_, i) => i + 1).map((s) => ({
    score: s,
    count: scored.filter((a) => Math.round(a.ai_score as number) === s).length,
  }));

  // Hiring by department
  const deptMap = new Map<string, { open: number; candidates: number; hires: number }>();
  allJobs.forEach((j) => {
    if (!deptMap.has(j.department)) deptMap.set(j.department, { open: 0, candidates: 0, hires: 0 });
    if (j.status === "Open") deptMap.get(j.department)!.open += 1;
  });
  apps.forEach((a) => {
    const j = jobById.get(a.job_id);
    if (!j) return;
    const ent = deptMap.get(j.department) || { open: 0, candidates: 0, hires: 0 };
    if (a.status === "Active" && inCurrent(a.applied_at)) ent.candidates += 1;
    if (a.status === "Hired" && inCurrent(a.applied_at)) ent.hires += 1;
    deptMap.set(j.department, ent);
  });
  const byDept = Array.from(deptMap.entries()).map(([department, v]) => ({ department, ...v }));

  // Recruiter activity
  const { data: profiles } = await supabase.from("profiles").select("id, full_name");
  const profMap = new Map<string, string>((profiles || []).map((p) => [p.id, p.full_name || "Unknown"]));
  const rec = new Map<string, { id: string; name: string; moved: number; notes: number; ratings: number[]; lastActive: string | null }>();
  (history || []).forEach((h) => {
    if (!h.moved_by || !inCurrent(h.moved_at)) return;
    const r = rec.get(h.moved_by) || { id: h.moved_by, name: profMap.get(h.moved_by) || "Unknown", moved: 0, notes: 0, ratings: [], lastActive: null };
    r.moved += 1;
    if (!r.lastActive || h.moved_at > r.lastActive) r.lastActive = h.moved_at;
    rec.set(h.moved_by, r);
  });
  (notes || []).forEach((n) => {
    if (!n.author_id || !inCurrent(n.created_at)) return;
    const r = rec.get(n.author_id) || { id: n.author_id, name: profMap.get(n.author_id) || "Unknown", moved: 0, notes: 0, ratings: [], lastActive: null };
    r.notes += 1;
    if (n.rating != null) r.ratings.push(n.rating);
    if (!r.lastActive || n.created_at > r.lastActive) r.lastActive = n.created_at;
    rec.set(n.author_id, r);
  });
  const recruiters = Array.from(rec.values()).map((r) => ({
    id: r.id, name: r.name, moved: r.moved, notes: r.notes,
    avgRating: r.ratings.length ? r.ratings.reduce((a, b) => a + b, 0) / r.ratings.length : null,
    lastActive: r.lastActive,
  })).sort((a, b) => b.moved - a.moved);

  const longestStage = timeInStage.reduce((max, t) => (t.days > max ? t.days : max), 0);
  timeInStage.forEach((t) => { t.isLongest = longestStage > 0 && t.days === longestStage; });

  return {
    openJobs: { value: openJobsCurr, trend: pctTrend(openJobsCurr, openJobsPrev, !!priorStart) },
    totalCandidates: { value: candCurr, trend: pctTrend(candCurr, candPrev, !!priorStart) },
    activeApps: { value: activeCurr, trend: pctTrend(activeCurr, activePrev, !!priorStart) },
    avgScore: { display: avgC == null ? "—" : avgC.toFixed(1), trend: avgC == null || avgP == null || !priorStart ? null : ((avgC - avgP) / avgP) * 100 },
    timeToHire: { display: tthC == null ? "—" : `${Math.round(tthC)} days`, trend: tthC == null || tthP == null || !priorStart ? null : ((tthC - tthP) / tthP) * 100 },
    offerAccept: { display: oaC == null ? "—" : `${Math.round(oaC)}%`, trend: oaC == null || oaP == null || !priorStart ? null : oaC - oaP },
    funnel, overTime, timeInStage, scoreDist, byDept, recruiters,
  };
}

function pctTrend(curr: number, prev: number, hasPrior: boolean): number | null {
  if (!hasPrior) return null;
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function bucketTime(dates: string[], range: Range): { label: string; count: number }[] {
  if (dates.length === 0) return [];
  const granularity = range === "7" ? "day" : range === "all" ? "month" : "week";
  const map = new Map<string, { date: Date; count: number }>();
  dates.forEach((iso) => {
    const d = new Date(iso);
    let bucket: Date;
    let key: string;
    if (granularity === "day") {
      bucket = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      key = bucket.toISOString();
    } else if (granularity === "week") {
      const day = d.getDay();
      bucket = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
      key = bucket.toISOString();
    } else {
      bucket = new Date(d.getFullYear(), d.getMonth(), 1);
      key = bucket.toISOString();
    }
    const ent = map.get(key) || { date: bucket, count: 0 };
    ent.count += 1;
    map.set(key, ent);
  });
  return Array.from(map.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => ({
      label: granularity === "month"
        ? e.date.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
        : e.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: e.count,
    }));
}

function computeTimeInStage(history: any[]): { stage: string; days: number; isLongest: boolean }[] {
  // Group history by application
  const byApp = new Map<string, any[]>();
  history.forEach((h) => {
    const arr = byApp.get(h.application_id) || [];
    arr.push(h);
    byApp.set(h.application_id, arr);
  });
  const totals: Record<string, { sum: number; n: number }> = {};
  byApp.forEach((arr) => {
    arr.sort((a, b) => new Date(a.moved_at).getTime() - new Date(b.moved_at).getTime());
    for (let i = 0; i < arr.length - 1; i++) {
      const stage = arr[i].to_stage;
      const days = (new Date(arr[i + 1].moved_at).getTime() - new Date(arr[i].moved_at).getTime()) / 86400000;
      if (days < 0) continue;
      totals[stage] = totals[stage] || { sum: 0, n: 0 };
      totals[stage].sum += days;
      totals[stage].n += 1;
    }
  });
  return STAGES.map((s) => {
    const t = totals[s];
    const days = t && t.n > 0 ? Math.round(t.sum / t.n) : 0;
    return { stage: s, days, isLongest: false };
  });
}
