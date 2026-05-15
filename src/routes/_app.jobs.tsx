import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Briefcase, Users, Clock, CheckCircle, Plus, Search, MapPin, Globe,
  MoreHorizontal, Code, Palette, Megaphone, DollarSign, Box, Calculator,
  Settings as SettingsIcon, Headphones, ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { JobFormModal } from "@/components/JobFormModal";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/jobs")({
  component: JobsRoute,
});

function JobsRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.replace(/\/$/, "") !== "/jobs") return <Outlet />;
  return <JobsPage />;
}

// ---------- helpers ----------

function compactRel(date: string | null | undefined) {
  if (!date) return "—";
  const t = new Date(date).getTime();
  if (isNaN(t)) return "—";
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const DEPT_META: Record<string, { icon: any; color: string }> = {
  Engineering: { icon: Code, color: "#3B82F6" },
  Design: { icon: Palette, color: "#8B5CF6" },
  Marketing: { icon: Megaphone, color: "#EC4899" },
  Sales: { icon: DollarSign, color: "#22C55E" },
  Product: { icon: Box, color: "#F59E0B" },
  HR: { icon: Users, color: "#14B8A6" },
  Finance: { icon: Calculator, color: "#F59E0B" },
  Operations: { icon: SettingsIcon, color: "#9CA3AF" },
  "Customer Support": { icon: Headphones, color: "#3B82F6" },
};
function deptMeta(dept: string) {
  return DEPT_META[dept] || { icon: Briefcase, color: "#3B82F6" };
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  Open: { bg: "#22C55E15", color: "#22C55E", label: "Open" },
  Draft: { bg: "#71717A15", color: "#9CA3AF", label: "Draft" },
  Paused: { bg: "#F59E0B15", color: "#F59E0B", label: "On Hold" },
  Closed: { bg: "#EF444415", color: "#EF4444", label: "Closed" },
};

function statusBadge(status: string) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Draft;
  return (
    <span
      className="inline-flex items-center rounded-md px-2.5 py-1 text-[12px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

type JobRow = {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  applications: { count: number }[] | null;
  _displayId: string;
  _appsTotal: number;
  _appsNew: number;
};

// ---------- main ----------

function JobsPage() {
  useDocumentTitle("Jobs — Meridian");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "Open" | "Draft" | "Closed" | "Paused">("all");
  const [groupBy, setGroupBy] = useState<"none" | "department" | "status" | "location">("none");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [view, setView] = useState<"list" | "grid">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [editJob, setEditJob] = useState<any | null>(null);

  // Jobs + applications meta
  const jobsQ = useQuery({
    queryKey: ["jobs", "list-with-meta"],
    queryFn: async () => {
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const [jobsRes, appsRes, newAppsRes] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: true }),
        supabase.from("applications").select("job_id"),
        supabase.from("applications").select("job_id").gte("applied_at", since7),
      ]);
      if (jobsRes.error) throw jobsRes.error;
      const totals: Record<string, number> = {};
      (appsRes.data || []).forEach((a: any) => { totals[a.job_id] = (totals[a.job_id] || 0) + 1; });
      const news: Record<string, number> = {};
      (newAppsRes.data || []).forEach((a: any) => { news[a.job_id] = (news[a.job_id] || 0) + 1; });

      // Build display IDs per department, ordered by created_at asc
      const byDept: Record<string, any[]> = {};
      (jobsRes.data || []).forEach((j: any) => {
        (byDept[j.department] ||= []).push(j);
      });
      const displayId: Record<string, string> = {};
      Object.entries(byDept).forEach(([dept, arr]) => {
        const prefix = (dept || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "JB";
        arr.forEach((j, i) => {
          displayId[j.id] = `${prefix}-${String(i + 1).padStart(2, "0")}`;
        });
      });

      const rows: JobRow[] = (jobsRes.data || []).map((j: any) => ({
        ...j,
        applications: null,
        _displayId: displayId[j.id],
        _appsTotal: totals[j.id] || 0,
        _appsNew: news[j.id] || 0,
      }));
      // newest first for display
      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return rows;
    },
  });

  // Stats
  const statsQ = useQuery({
    queryKey: ["jobs", "stats"],
    queryFn: async () => {
      const now = Date.now();
      const d30 = new Date(now - 30 * 86400000).toISOString();
      const d60 = new Date(now - 60 * 86400000).toISOString();

      const [
        openJobs, activeApps,
        openJobsPrev, openJobsCur,
        appsPrev, appsCur,
        hiredApps, offerHistory, hiredHistory,
        offerHistPrev, offerHistCur, hiredHistPrev, hiredHistCur,
      ] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "Open"),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "Open").gte("created_at", d60).lt("created_at", d30),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "Open").gte("created_at", d30),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Active").gte("applied_at", d60).lt("applied_at", d30),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Active").gte("applied_at", d30),
        // For Avg Time to Hire: hired apps with applied_at + their hired moved_at
        supabase.from("applications").select("id, applied_at").eq("status", "Hired"),
        supabase.from("stage_history").select("application_id, to_stage, moved_at").eq("to_stage", "Offer"),
        supabase.from("stage_history").select("application_id, to_stage, moved_at").eq("to_stage", "Hired"),
        supabase.from("stage_history").select("application_id, moved_at").eq("to_stage", "Offer").gte("moved_at", d60).lt("moved_at", d30),
        supabase.from("stage_history").select("application_id, moved_at").eq("to_stage", "Offer").gte("moved_at", d30),
        supabase.from("stage_history").select("application_id, moved_at").eq("to_stage", "Hired").gte("moved_at", d60).lt("moved_at", d30),
        supabase.from("stage_history").select("application_id, moved_at").eq("to_stage", "Hired").gte("moved_at", d30),
      ]);

      // Avg time to hire (overall)
      const hiredMap: Record<string, number> = {};
      (hiredHistory.data || []).forEach((h: any) => {
        const t = new Date(h.moved_at).getTime();
        if (!hiredMap[h.application_id] || t < hiredMap[h.application_id]) hiredMap[h.application_id] = t;
      });
      const durations: number[] = [];
      (hiredApps.data || []).forEach((a: any) => {
        const hiredAt = hiredMap[a.id];
        if (hiredAt) durations.push((hiredAt - new Date(a.applied_at).getTime()) / 86400000);
      });
      const avgHire = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

      // Avg time to hire prev vs cur (use moved_at hired window)
      const durationsFor = (window: any[]) => {
        const ids = new Set(window.map((h: any) => h.application_id));
        const arr: number[] = [];
        (hiredApps.data || []).forEach((a: any) => {
          if (ids.has(a.id) && hiredMap[a.id]) {
            arr.push((hiredMap[a.id] - new Date(a.applied_at).getTime()) / 86400000);
          }
        });
        return arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0;
      };
      const hireCur = durationsFor(hiredHistCur.data || []);
      const hirePrev = durationsFor(hiredHistPrev.data || []);

      // Offer acceptance = hired / offer
      const offerCount = (offerHistory.data || []).length;
      const hiredCount = (hiredHistory.data || []).length;
      const offerAccept = offerCount ? Math.round((hiredCount / offerCount) * 100) : 0;
      const offerAcceptCur = (offerHistCur.data || []).length
        ? Math.round(((hiredHistCur.data || []).length / (offerHistCur.data || []).length) * 100)
        : 0;
      const offerAcceptPrev = (offerHistPrev.data || []).length
        ? Math.round(((hiredHistPrev.data || []).length / (offerHistPrev.data || []).length) * 100)
        : 0;

      const trend = (cur: number, prev: number) =>
        prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

      return {
        openJobs: openJobs.count ?? 0,
        activeApps: activeApps.count ?? 0,
        avgHire,
        offerAccept,
        openJobsTrend: trend(openJobsCur.count ?? 0, openJobsPrev.count ?? 0),
        appsTrend: trend(appsCur.count ?? 0, appsPrev.count ?? 0),
        hireTrend: trend(hireCur, hirePrev), // for hire, lower is better — handled in render
        offerAcceptTrend: trend(offerAcceptCur, offerAcceptPrev),
      };
    },
  });

  const allJobs = jobsQ.data || [];

  const tabCounts = useMemo(() => {
    const c = { all: allJobs.length, Open: 0, Draft: 0, Closed: 0, Paused: 0 } as any;
    allJobs.forEach((j) => { if (c[j.status] !== undefined) c[j.status]++; });
    return c;
  }, [allJobs]);

  const filtered = useMemo(() => {
    return allJobs.filter((j) => {
      if (tab !== "all" && j.status !== tab) return false;
      if (search && !j.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allJobs, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * perPage;
  const pageItems = filtered.slice(pageStart, pageStart + perPage);

  // Group items on the visible page
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "", items: pageItems }];
    const map = new Map<string, JobRow[]>();
    pageItems.forEach((j) => {
      const key =
        groupBy === "department" ? j.department :
        groupBy === "status" ? (STATUS_STYLES[j.status]?.label || j.status) :
        j.location;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [pageItems, groupBy]);

  const hasFilters = !!search || tab !== "all";
  const clearFilters = () => { setSearch(""); setTab("all"); setPage(1); };

  // Actions
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("jobs").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Job ${status === "Closed" ? "closed" : status === "Paused" ? "paused" : "reopened"}`);
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  const copyLink = (id: string) => {
    const url = `${window.location.origin}/apply/${id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Application link copied"));
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground leading-tight">Jobs</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">Manage job openings and track hiring progress.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717A]" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search jobs..."
              className="pl-9 pr-14 h-10 bg-[#141416] border-[#1E1E22] text-[14px]"
            />
            <span className="hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center rounded-md border border-[#1E1E22] bg-[#1A1A1E] px-1.5 py-0.5 text-[11px] text-[#9CA3AF] font-mono">
              ⌘K
            </span>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-10 px-4 text-white border-0 shadow-sm"
            style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}
          >
            <Plus className="h-4 w-4" /> Create Job
          </Button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Jobs" value={statsQ.data?.openJobs} suffix="" icon={Briefcase} color="#3B82F6" trend={statsQ.data?.openJobsTrend} loading={statsQ.isLoading} />
        <StatCard label="Active Candidates" value={statsQ.data?.activeApps} suffix="" icon={Users} color="#22C55E" trend={statsQ.data?.appsTrend} loading={statsQ.isLoading} />
        <StatCard
          label="Avg. Time to Hire"
          value={statsQ.data ? Number(statsQ.data.avgHire.toFixed(1)) : undefined}
          suffix=" days"
          icon={Clock}
          color="#F59E0B"
          trend={statsQ.data?.hireTrend}
          invertTrend
          loading={statsQ.isLoading}
        />
        <StatCard
          label="Offer Acceptance"
          value={statsQ.data?.offerAccept}
          suffix="%"
          icon={CheckCircle}
          color="#8B5CF6"
          trend={statsQ.data?.offerAcceptTrend}
          loading={statsQ.isLoading}
        />
      </div>

      {/* TABS */}
      <div className="border-b border-[#1E1E22]">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin -mb-px">
            {([
              ["all", "All Jobs", tabCounts.all],
              ["Open", "Open", tabCounts.Open],
              ["Draft", "Draft", tabCounts.Draft],
              ["Closed", "Closed", tabCounts.Closed],
              ["Paused", "On Hold", tabCounts.Paused],
            ] as const).map(([key, label, count]) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => { setTab(key as any); setPage(1); }}
                  className={`shrink-0 inline-flex items-center gap-2 px-3 py-3 text-[14px] font-medium border-b-2 transition-colors ${
                    active ? "text-white border-[#3B82F6]" : "text-[#71717A] hover:text-[#9CA3AF] border-transparent"
                  }`}
                >
                  {label}
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={
                      active
                        ? { background: "#3B82F620", color: "#3B82F6" }
                        : { background: "#1E1E22", color: "#9CA3AF" }
                    }
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="hidden md:flex items-center gap-2 pb-2 shrink-0">
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <SelectTrigger className="h-8 w-[180px] text-[13px] bg-[#141416] border-[#1E1E22] text-[#9CA3AF]">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Group by: None</SelectItem>
                <SelectItem value="department">Group by: Department</SelectItem>
                <SelectItem value="status">Group by: Status</SelectItem>
                <SelectItem value="location">Group by: Location</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border border-[#1E1E22] bg-[#141416] p-0.5">
              <button
                onClick={() => setView("list")}
                aria-label="List view"
                className={`h-7 w-7 inline-flex items-center justify-center rounded ${view === "list" ? "bg-[#3B82F620] text-[#3B82F6]" : "text-[#71717A] hover:text-[#9CA3AF]"}`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("grid")}
                aria-label="Grid view"
                className={`h-7 w-7 inline-flex items-center justify-center rounded ${view === "grid" ? "bg-[#3B82F620] text-[#3B82F6]" : "text-[#71717A] hover:text-[#9CA3AF]"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE / EMPTY / LOADING */}
      {jobsQ.isLoading ? (
        <div className="rounded-xl border border-[#1E1E22] bg-[#141416] overflow-hidden">
          <div className="hidden md:block">
            <div className="grid grid-cols-[2fr_1fr_1.4fr_1fr_0.8fr_0.8fr_60px] gap-4 px-6 py-3 border-b border-[#1E1E22]">
              {Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton h-3" />)}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1.4fr_1fr_0.8fr_0.8fr_60px] gap-4 px-6 py-5 border-b border-[#1E1E22]">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-11 w-11 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-3/4" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                </div>
                {Array.from({ length: 6 }).map((_, j) => <div key={j} className="skeleton h-4 self-center" />)}
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#1E1E22] bg-[#141416]">
          <EmptyState
            icon={Briefcase}
            title={hasFilters ? "No jobs match your filters" : "No jobs found"}
            description={hasFilters ? "Try adjusting your search or switching tabs." : "Create your first job posting to start building your pipeline."}
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              ) : (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="h-10 px-4 text-white border-0"
                  style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}
                >
                  <Plus className="h-4 w-4" /> Create Job
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="rounded-xl border border-[#1E1E22] bg-[#141416] overflow-hidden">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[2fr_1fr_1.4fr_1fr_0.8fr_0.8fr_60px] gap-4 px-6 py-3 border-b border-[#1E1E22] text-[12px] uppercase tracking-[0.05em] text-[#71717A] font-medium">
              <div>Job Title</div>
              <div>Department</div>
              <div>Location</div>
              <div>Applications</div>
              <div>Status</div>
              <div className="hidden lg:block">Updated</div>
              <div className="text-right">Actions</div>
            </div>

            {grouped.map((g, gi) => (
              <div key={g.key || gi}>
                {g.key && (
                  <div className="px-6 py-2.5 bg-[#0F0F11] border-b border-[#1E1E22] text-[12px] font-medium text-[#9CA3AF] uppercase tracking-wider">
                    {g.key} <span className="text-[#71717A] normal-case tracking-normal ml-1">— {g.items.length} {g.items.length === 1 ? "job" : "jobs"}</span>
                  </div>
                )}
                {g.items.map((j) => {
                  const meta = deptMeta(j.department);
                  const Icon = meta.icon;
                  const isRemote = /remote/i.test(j.location);
                  return (
                    <div
                      key={j.id}
                      onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId: j.id } })}
                      className="grid grid-cols-[2fr_1fr_1.4fr_1fr_0.8fr_0.8fr_60px] gap-4 px-6 py-4 border-b border-[#1E1E22] last:border-b-0 items-center cursor-pointer hover:bg-[#1A1A1E] transition-colors"
                    >
                      {/* Title */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="rounded-lg flex items-center justify-center shrink-0"
                          style={{ width: 44, height: 44, background: "#1E1E22" }}
                        >
                          <Icon className="h-[18px] w-[18px]" style={{ color: meta.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-white truncate">{j.title}</div>
                          <div className="text-[12px] text-[#71717A] font-mono mt-0.5">{j._displayId}</div>
                        </div>
                      </div>
                      {/* Department */}
                      <div className="text-[13px] text-[#9CA3AF] truncate">{j.department}</div>
                      {/* Location */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[13px] text-[#9CA3AF]">
                          <MapPin className="h-3.5 w-3.5 text-[#71717A] shrink-0" />
                          <span className="truncate">{j.location}</span>
                        </div>
                        {isRemote && (
                          <div className="flex items-center gap-1.5 text-[12px] text-[#71717A] mt-0.5">
                            <Globe className="h-3.5 w-3.5 shrink-0" />
                            <span>Worldwide</span>
                          </div>
                        )}
                      </div>
                      {/* Applications */}
                      <div>
                        <div className="text-[14px] font-medium text-white">{j._appsTotal}</div>
                        {j._appsNew > 0 && (
                          <div className="text-[12px]" style={{ color: "#22C55E" }}>{j._appsNew} new</div>
                        )}
                      </div>
                      {/* Status */}
                      <div>{statusBadge(j.status)}</div>
                      {/* Updated */}
                      <div className="hidden lg:block text-[13px] text-[#71717A]">{compactRel(j.updated_at || j.created_at)}</div>
                      {/* Actions */}
                      <div className="text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActions job={j} onEdit={() => setEditJob(j)} onCopy={() => copyLink(j.id)} onSetStatus={(s) => setStatus(j.id, s)} navigate={navigate} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* MOBILE CARDS */}
          <div className="md:hidden divide-y divide-[#1E1E22]">
            {grouped.map((g, gi) => (
              <div key={g.key || gi}>
                {g.key && (
                  <div className="px-4 py-2 bg-[#0F0F11] text-[12px] text-[#9CA3AF] uppercase tracking-wider">
                    {g.key} — {g.items.length}
                  </div>
                )}
                {g.items.map((j) => {
                  const meta = deptMeta(j.department);
                  const Icon = meta.icon;
                  return (
                    <div
                      key={j.id}
                      onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId: j.id } })}
                      className="p-4 active:bg-[#1A1A1E] cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="rounded-lg flex items-center justify-center shrink-0"
                          style={{ width: 40, height: 40, background: "#1E1E22" }}
                        >
                          <Icon className="h-4 w-4" style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[14px] font-medium text-white truncate">{j.title}</div>
                              <div className="text-[12px] text-[#71717A] font-mono">{j._displayId}</div>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <RowActions job={j} onEdit={() => setEditJob(j)} onCopy={() => copyLink(j.id)} onSetStatus={(s) => setStatus(j.id, s)} navigate={navigate} />
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#9CA3AF]">
                            <span>{j.department}</span>
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{j.location}</span>
                            <span className="text-white font-medium">{j._appsTotal} apps</span>
                            {statusBadge(j.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {!jobsQ.isLoading && filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[13px] text-[#71717A]">
            <span>
              Showing {pageStart + 1} to {Math.min(pageStart + perPage, filtered.length)} of {filtered.length} jobs
            </span>
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[120px] text-[13px] bg-[#141416] border-[#1E1E22]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} per page</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Pager page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      {/* MODALS */}
      <JobFormModal open={createOpen} onOpenChange={setCreateOpen} />
      <JobFormModal open={!!editJob} onOpenChange={(o) => !o && setEditJob(null)} initial={editJob} />
    </div>
  );
}

// ---------- subcomponents ----------

function StatCard({
  label, value, suffix = "", icon: Icon, color, trend, loading, invertTrend,
}: {
  label: string; value?: number; suffix?: string; icon: any; color: string;
  trend: number | null | undefined; loading: boolean; invertTrend?: boolean;
}) {
  const positive = trend != null && (invertTrend ? trend < 0 : trend >= 0);
  return (
    <div className="group rounded-xl border border-[#1E1E22] bg-[#141416] hover:border-border-strong transition-colors" style={{ padding: "20px 24px" }}>
      <div className="flex items-center gap-4">
        <div
          className="rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
          style={{ width: 48, height: 48, background: color + "26" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = color + "40")}
          onMouseLeave={(e) => (e.currentTarget.style.background = color + "26")}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] text-[#9CA3AF]">{label}</div>
          {loading ? (
            <div className="skeleton h-7 w-20 my-1" />
          ) : (
            <div className="font-mono font-semibold text-foreground leading-tight" style={{ fontSize: 26 }}>
              {value ?? 0}{suffix}
            </div>
          )}
          <div className="mt-0.5">
            {trend == null ? (
              <span className="text-[11px] text-[#71717A]">No prior data</span>
            ) : (
              <span className="text-[12px]" style={{ color: positive ? "#22C55E" : "#EF4444" }}>
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last 30 days
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RowActions({
  job, onEdit, onCopy, onSetStatus, navigate,
}: {
  job: JobRow;
  onEdit: () => void;
  onCopy: () => void;
  onSetStatus: (s: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[#71717A] hover:bg-[#1E1E22] hover:text-[#9CA3AF] transition-colors"
          aria-label="Job actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[200px] bg-[#141416] border border-[#1E1E22] rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem className="text-[13px] text-foreground focus:bg-[#1A1A1E] cursor-pointer" onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId: job.id } })}>
          View Pipeline
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[13px] text-foreground focus:bg-[#1A1A1E] cursor-pointer" onClick={onEdit}>
          Edit Job
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[13px] text-foreground focus:bg-[#1A1A1E] cursor-pointer" onClick={onCopy}>
          Copy Application Link
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#1E1E22]" />
        {(job.status === "Open" || job.status === "Paused") && (
          <DropdownMenuItem className="text-[13px] text-[#EF4444] focus:bg-[#1A1A1E] focus:text-[#EF4444] cursor-pointer" onClick={() => { if (confirm("Close this job? It will stop accepting applications.")) onSetStatus("Closed"); }}>
            Close Job
          </DropdownMenuItem>
        )}
        {job.status === "Closed" && (
          <DropdownMenuItem className="text-[13px] text-foreground focus:bg-[#1A1A1E] cursor-pointer" onClick={() => onSetStatus("Open")}>
            Reopen Job
          </DropdownMenuItem>
        )}
        {job.status === "Open" && (
          <DropdownMenuItem className="text-[13px] text-foreground focus:bg-[#1A1A1E] cursor-pointer" onClick={() => onSetStatus("Paused")}>
            Pause Job
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btn = "h-8 min-w-8 px-2 rounded-md text-[13px] inline-flex items-center justify-center transition-colors";
  return (
    <div className="flex items-center gap-1">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className={`${btn} bg-[#141416] border border-[#1E1E22] text-[#9CA3AF] hover:bg-[#1A1A1E] disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-[#71717A] text-[13px]">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={
              p === page
                ? `${btn} bg-[#3B82F6] text-white`
                : `${btn} bg-[#141416] border border-[#1E1E22] text-[#9CA3AF] hover:bg-[#1A1A1E]`
            }
          >
            {p}
          </button>
        ),
      )}
      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className={`${btn} bg-[#141416] border border-[#1E1E22] text-[#9CA3AF] hover:bg-[#1A1A1E] disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
