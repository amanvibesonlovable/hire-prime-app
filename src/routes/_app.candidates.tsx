import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Users, ChevronDown, SlidersHorizontal, LayoutList, LayoutGrid, Download,
  Star, Eye, MessageSquare, MoreVertical, ChevronLeft, ChevronRight,
  Globe, UserPlus, Briefcase as BriefcaseIcon, Sparkles, FileDown, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { relTime } from "@/lib/format";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { runScoringForApplication, getApiKey, aiErrorToToast } from "@/lib/aiScoring";

export const Route = createFileRoute("/_app/candidates")({
  component: CandidatesRoute,
});

function CandidatesRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.replace(/\/$/, "") !== "/candidates") return <Outlet />;
  return <CandidatesPage />;
}

const STAGES = ["Applied", "Screening", "Test", "Interview 1", "Interview 2", "Offer", "Hired"];
const SOURCES = ["Direct", "Referral", "LinkedIn", "Job Board", "Other"];
const PAGE_SIZES = [10, 20, 50];

const STAGE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  Applied:       { bg: "rgba(59,130,246,0.10)",  color: "#60A5FA", border: "rgba(59,130,246,0.20)" },
  Screening:     { bg: "rgba(139,92,246,0.10)",  color: "#A78BFA", border: "rgba(139,92,246,0.20)" },
  Test:          { bg: "rgba(99,102,241,0.10)",  color: "#818CF8", border: "rgba(99,102,241,0.20)" },
  "Interview 1": { bg: "rgba(6,182,212,0.10)",   color: "#22D3EE", border: "rgba(6,182,212,0.20)" },
  "Interview 2": { bg: "rgba(6,182,212,0.10)",   color: "#22D3EE", border: "rgba(6,182,212,0.20)" },
  Interview:     { bg: "rgba(6,182,212,0.10)",   color: "#22D3EE", border: "rgba(6,182,212,0.20)" },
  Offer:         { bg: "rgba(245,158,11,0.10)",  color: "#FBBF24", border: "rgba(245,158,11,0.20)" },
  Hired:         { bg: "rgba(16,185,129,0.10)",  color: "#34D399", border: "rgba(16,185,129,0.20)" },
  Rejected:      { bg: "rgba(239,68,68,0.10)",   color: "#F87171", border: "rgba(239,68,68,0.20)" },
};

function StageBadge({ stage }: { stage: string }) {
  const c = STAGE_BADGE[stage] ?? STAGE_BADGE.Applied;
  return (
    <span
      className="inline-flex items-center rounded-lg whitespace-nowrap"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}
    >
      {stage}
    </span>
  );
}

function aiScoreColor(score: number) {
  if (score >= 8) return { color: "#34D399", fill: "#34D399" };
  if (score >= 5) return { color: "#60A5FA", fill: "#60A5FA" };
  return { color: "#F87171", fill: "#F87171" };
}

function aiMatchLabel(score: number) {
  if (score >= 9) return "Excellent Match";
  if (score >= 7) return "Strong Match";
  if (score >= 5) return "Good Match";
  if (score >= 3) return "Average Match";
  return "Weak Match";
}

function sourceIconFor(source: string | null) {
  const s = (source || "Direct").toLowerCase();
  if (s.includes("linkedin")) return Globe;
  if (s.includes("referral")) return Users;
  if (s.includes("direct")) return UserPlus;
  if (s.includes("job")) return BriefcaseIcon;
  return Globe;
}

function initialsOf(first: string, last: string) {
  return `${(first?.[0] || "").toUpperCase()}${(last?.[0] || "").toUpperCase()}` || "?";
}

// Custom checkbox styled per spec
function Checkbox({ checked, onChange, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <label
      className="inline-flex items-center justify-center cursor-pointer relative"
      style={{ width: 16, height: 16 }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className="flex items-center justify-center transition-colors"
        style={{
          width: 16, height: 16, borderRadius: 4,
          background: checked || indeterminate ? "#3B82F6" : "#141416",
          border: `1px solid ${checked || indeterminate ? "#3B82F6" : "#2A2A2E"}`,
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.2 5 8.7l4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {!checked && indeterminate && (
          <span style={{ width: 8, height: 2, background: "#fff", borderRadius: 1 }} />
        )}
      </span>
    </label>
  );
}

// Styled select dropdown matching mockup
function FilterSelect({
  value, onChange, options, placeholder, minWidth = 130,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string; minWidth?: number;
}) {
  return (
    <div className="relative" style={{ minWidth }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none w-full h-10 rounded-lg pl-4 pr-9 text-[13px] cursor-pointer transition-colors hover:border-[#2A2A2E] focus:outline-none",
          value ? "text-white" : "text-[#9CA3AF]",
        )}
        style={{ background: "#141416", border: "1px solid #1E1E22" }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "#141416", color: "#fff" }}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717A] pointer-events-none" />
    </div>
  );
}

function CandidatesPage() {
  useDocumentTitle("Candidates — Meridian");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  // Search (debounced)
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [jobFilter, setJobFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [scoreFilter, setScoreFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ appId: string; name: string } | null>(null);

  const candidates = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, applications(id, applied_at, ai_score, current_stage, status, job:jobs(id, title, department))")
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const jobs = useQuery({
    queryKey: ["candidates-job-filter-list"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("id, title").order("title");
      return data || [];
    },
  });

  // Compute "most recent application" per candidate
  const enriched = useMemo(() => {
    return (candidates.data || []).map((c: any) => {
      const apps = c.applications || [];
      let last: any = null;
      for (const a of apps) {
        if (!last || new Date(a.applied_at) > new Date(last.applied_at)) last = a;
      }
      return { ...c, lastApp: last };
    });
  }, [candidates.data]);

  const filtered = useMemo(() => {
    return enriched.filter((c: any) => {
      // Search
      if (search) {
        const hay = `${c.first_name} ${c.last_name} ${c.email} ${c.lastApp?.job?.title ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (jobFilter && c.lastApp?.job?.id !== jobFilter) return false;
      if (stageFilter && c.lastApp?.current_stage !== stageFilter) return false;
      if (sourceFilter && (c.source || "Direct") !== sourceFilter) return false;
      if (scoreFilter) {
        const s = c.lastApp?.ai_score;
        if (scoreFilter === "none" && s != null) return false;
        if (scoreFilter === "high" && !(s != null && s >= 8)) return false;
        if (scoreFilter === "mid" && !(s != null && s >= 5 && s <= 7)) return false;
        if (scoreFilter === "low" && !(s != null && s >= 1 && s <= 4)) return false;
      }
      return true;
    });
  }, [enriched, search, jobFilter, stageFilter, sourceFilter, scoreFilter]);

  // Sort: most recently applied first
  const sorted = useMemo(() => {
    const r = [...filtered];
    r.sort((a, b) => {
      const ta = a.lastApp ? new Date(a.lastApp.applied_at).getTime() : 0;
      const tb = b.lastApp ? new Date(b.lastApp.applied_at).getTime() : 0;
      return tb - ta;
    });
    return r;
  }, [filtered]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const slice = sorted.slice((page - 1) * pageSize, page * pageSize);

  const filtersActive = !!(search || jobFilter || stageFilter || scoreFilter || sourceFilter);
  const clearFilters = () => {
    setSearchInput(""); setSearch("");
    setJobFilter(""); setStageFilter(""); setScoreFilter(""); setSourceFilter("");
    setPage(1);
  };

  // Selection helpers (limited to current page slice)
  const visibleIds = slice.map((c: any) => c.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id)) && !allVisibleSelected;
  const toggleAllVisible = (v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => { v ? next.add(id) : next.delete(id); });
      return next;
    });
  };
  const toggleOne = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      v ? next.add(id) : next.delete(id);
      return next;
    });
  };

  // Cmd+K search focus
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // App-level palette also listens; we only focus if no modifier conflict — let palette handle it, skip.
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Actions
  const handleScore = async (appId: string) => {
    if (!user?.id) { toast.error("You must be signed in"); return; }
    const apiKey = await getApiKey(user.id);
    if (!apiKey) { toast.error("Add your Anthropic API key in Settings."); return; }
    const tid = toast.loading("Scoring with AI…");
    try {
      await runScoringForApplication(appId, apiKey);
      toast.success("Scored", { id: tid });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    } catch (e) {
      toast.error(aiErrorToToast(e), { id: tid });
    }
  };

  const handleDownloadResume = (resumeUrl: string | null) => {
    if (!resumeUrl) { toast.error("No resume available"); return; }
    window.open(resumeUrl, "_blank", "noopener,noreferrer");
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const { error } = await supabase
      .from("applications")
      .update({ status: "Rejected", updated_at: new Date().toISOString() })
      .eq("id", rejectTarget.appId);
    if (error) toast.error("Failed to reject");
    else {
      toast.success(`${rejectTarget.name} rejected`);
      qc.invalidateQueries({ queryKey: ["candidates"] });
    }
    setRejectTarget(null);
  };

  const filterControls = (
    <>
      <FilterSelect
        value={jobFilter} onChange={(v) => { setJobFilter(v); setPage(1); }}
        placeholder="All Jobs" minWidth={140}
        options={(jobs.data || []).map((j: any) => ({ value: j.id, label: j.title }))}
      />
      <FilterSelect
        value={stageFilter} onChange={(v) => { setStageFilter(v); setPage(1); }}
        placeholder="All Stages" minWidth={140}
        options={STAGES.map((s) => ({ value: s, label: s }))}
      />
      <FilterSelect
        value={scoreFilter} onChange={(v) => { setScoreFilter(v); setPage(1); }}
        placeholder="AI Score" minWidth={140}
        options={[
          { value: "high", label: "8-10 (Top Tier)" },
          { value: "mid",  label: "5-7 (Good Match)" },
          { value: "low",  label: "1-4 (Low Match)" },
          { value: "none", label: "Not Scored" },
        ]}
      />
      <FilterSelect
        value={sourceFilter} onChange={(v) => { setSourceFilter(v); setPage(1); }}
        placeholder="All Sources" minWidth={130}
        options={SOURCES.map((s) => ({ value: s, label: s }))}
      />
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[28px] font-semibold text-foreground tracking-tight">Candidates</h2>
          <p className="mt-1" style={{ fontSize: 14, color: "#9CA3AF" }}>Discover, evaluate, and engage top talent.</p>
        </div>
        <div className="hidden md:flex items-center">
          <div
            className="relative flex items-center"
            style={{ width: 280, height: 40, background: "#141416", border: "1px solid #1E1E22", borderRadius: 8 }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717A]" />
            <input
              ref={searchRef}
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              placeholder="Search candidates..."
              className="w-full h-full bg-transparent pl-9 pr-16 text-[13px] text-white placeholder:text-[#71717A] focus:outline-none"
            />
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center font-mono"
              style={{ fontSize: 11, color: "#71717A", background: "#1E1E22", border: "1px solid #2A2A2E", borderRadius: 4, padding: "2px 6px" }}
            >
              ⌘K
            </span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search input on mobile (full-width) */}
        <div className="md:hidden relative flex items-center flex-1 min-w-[200px]"
          style={{ height: 40, background: "#141416", border: "1px solid #1E1E22", borderRadius: 8 }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717A]" />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search candidates..."
            className="w-full h-full bg-transparent pl-9 pr-3 text-[13px] text-white placeholder:text-[#71717A] focus:outline-none"
          />
        </div>

        {/* Desktop filters inline */}
        <div className="hidden md:flex items-center gap-3 flex-1 flex-wrap">
          {filterControls}
          <button
            className="inline-flex items-center justify-center transition-colors hover:border-[#2A2A2E]"
            style={{ height: 40, padding: "0 14px", background: "#141416", border: "1px solid #1E1E22", borderRadius: 8 }}
          >
            <SlidersHorizontal className="h-4 w-4 text-[#9CA3AF] mr-2" />
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>Filters</span>
          </button>
        </div>

        {/* Mobile: filter button opens drawer */}
        <button
          onClick={() => setFiltersOpen(true)}
          className="md:hidden inline-flex items-center justify-center"
          style={{ height: 40, padding: "0 14px", background: "#141416", border: "1px solid #1E1E22", borderRadius: 8 }}
        >
          <SlidersHorizontal className="h-4 w-4 text-[#9CA3AF] mr-2" />
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>Filters</span>
        </button>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center" style={{ background: "#141416", border: "1px solid #1E1E22", borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setView("list")}
              className="inline-flex items-center justify-center"
              style={{
                height: 32, width: 32, borderRadius: 6,
                background: view === "list" ? "rgba(59,130,246,0.12)" : "transparent",
              }}
              aria-label="List view"
            >
              <LayoutList className="h-4 w-4" style={{ color: view === "list" ? "#3B82F6" : "#71717A" }} />
            </button>
            <button
              onClick={() => setView("grid")}
              className="inline-flex items-center justify-center"
              style={{
                height: 32, width: 32, borderRadius: 6,
                background: view === "grid" ? "rgba(59,130,246,0.12)" : "transparent",
              }}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" style={{ color: view === "grid" ? "#3B82F6" : "#71717A" }} />
            </button>
          </div>
          <button
            className="inline-flex items-center justify-center"
            style={{ height: 40, width: 40, background: "#141416", border: "1px solid #1E1E22", borderRadius: 8 }}
            aria-label="Export"
            onClick={() => toast.info("Export coming soon")}
          >
            <Download className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(12,15,22,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {candidates.isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-14" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16">
            {filtersActive ? (
              <div className="flex flex-col items-center text-center px-6">
                <Users className="h-12 w-12 mb-4" style={{ color: "#64748B" }} strokeWidth={1.5} />
                <div style={{ fontSize: 16, fontWeight: 500, color: "#FFFFFF" }}>No candidates match your filters</div>
                <button onClick={clearFilters} className="mt-3 text-[13px]" style={{ color: "#3B82F6" }}>Clear all filters</button>
              </div>
            ) : (
              <EmptyState icon={Users} title="No candidates found" description="Candidates will appear here once they apply through your job links." />
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              {slice.map((c: any) => {
                const name = `${c.first_name} ${c.last_name}`.trim();
                const stage = c.lastApp?.current_stage;
                const score = c.lastApp?.ai_score;
                const sc = score != null ? aiScoreColor(score) : null;
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate({ to: "/candidates/$candidateId", params: { candidateId: c.id } })}
                    className="p-4 cursor-pointer hover:bg-white/[0.025] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="rounded-full flex items-center justify-center shrink-0 ring-2 ring-white/10"
                        style={{ width: 40, height: 40, background: "#1E1E22", color: "#fff", fontSize: 14, fontWeight: 500 }}
                      >
                        {initialsOf(c.first_name, c.last_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium text-white truncate">{name || "—"}</div>
                        <div className="text-[12px] truncate" style={{ color: "#64748B" }}>{c.email}</div>
                        <div className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>{c.lastApp?.job?.title ?? "—"}</div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {stage && <StageBadge stage={stage} />}
                          {score != null && sc && (
                            <span className="inline-flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600, color: sc.color }}>
                              <Star className="h-3 w-3" style={{ fill: sc.fill, color: sc.color }} />
                              {score}
                            </span>
                          )}
                        </div>
                      </div>
                      <RowActions
                        candidateId={c.id}
                        candidateName={name}
                        appId={c.lastApp?.id}
                        resumeUrl={c.resume_url}
                        onScore={handleScore}
                        onDownload={handleDownloadResume}
                        onReject={(appId) => setRejectTarget({ appId, name })}
                        onView={() => navigate({ to: "/candidates/$candidateId", params: { candidateId: c.id } })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]" style={{ minWidth: 900 }}>
                <thead>
                  <tr className="text-left" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <th className="px-5 py-3" style={{ width: 36 }}>
                      <Checkbox
                        checked={allVisibleSelected}
                        indeterminate={someVisibleSelected}
                        onChange={(v) => toggleAllVisible(v)}
                      />
                    </th>
                    <th className="px-5 py-3" style={hStyle}>Candidate</th>
                    <th className="px-5 py-3" style={hStyle}>Job</th>
                    <th className="px-5 py-3" style={hStyle}>Stage</th>
                    <th className="px-5 py-3" style={hStyle}>AI Score</th>
                    <th className="px-5 py-3 hidden lg:table-cell" style={hStyle}>Source</th>
                    <th className="px-5 py-3 hidden lg:table-cell" style={hStyle}>Applied</th>
                    <th className="px-5 py-3 text-right" style={hStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((c: any) => {
                    const name = `${c.first_name} ${c.last_name}`.trim();
                    const stage = c.lastApp?.current_stage;
                    const score = c.lastApp?.ai_score;
                    const sc = score != null ? aiScoreColor(score) : null;
                    const SrcIcon = sourceIconFor(c.source);
                    const isSelected = selected.has(c.id);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate({ to: "/candidates/$candidateId", params: { candidateId: c.id } })}
                        className="cursor-pointer transition-colors hover:bg-white/[0.025]"
                        style={{
                          height: 72,
                          borderBottom: "1px solid rgba(255,255,255,0.07)",
                          background: isSelected ? "rgba(59,130,246,0.05)" : undefined,
                        }}
                      >
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onChange={(v) => toggleOne(c.id, v)} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="rounded-full flex items-center justify-center shrink-0 ring-2 ring-white/10"
                              style={{ width: 40, height: 40, background: "#1E1E22", color: "#fff", fontSize: 14, fontWeight: 500 }}
                            >
                              {initialsOf(c.first_name, c.last_name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-white truncate" style={{ fontSize: 14, fontWeight: 500 }}>{name || "—"}</div>
                              <div className="truncate" style={{ fontSize: 12, color: "#64748B", maxWidth: 220 }}>{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {c.lastApp?.job ? (
                            <div className="min-w-0">
                              <div className="text-white truncate" style={{ fontSize: 13 }}>{c.lastApp.job.title}</div>
                              <div className="truncate" style={{ fontSize: 12, color: "#64748B" }}>{c.lastApp.job.department}</div>
                            </div>
                          ) : <span style={{ color: "#64748B" }}>—</span>}
                        </td>
                        <td className="px-5 py-3">{stage ? <StageBadge stage={stage} /> : <span style={{ color: "#64748B" }}>—</span>}</td>
                        <td className="px-5 py-3">
                          {score != null && sc ? (
                            <div className="min-w-0">
                              <div className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 600, color: sc.color }}>
                                <Star className="h-3 w-3" style={{ fill: sc.fill, color: sc.color }} />
                                {score}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748B" }}>{aiMatchLabel(score)}</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: 14, color: "#64748B" }}>—</div>
                              <div style={{ fontSize: 11, color: "#64748B" }}>Not Scored</div>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          <div className="inline-flex items-center gap-2">
                            <SrcIcon className="h-4 w-4" style={{ color: "#64748B" }} />
                            <span style={{ fontSize: 13, color: "#9CA3AF" }}>{c.source || "Direct"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell" style={{ fontSize: 13, color: "#64748B" }}>
                          {c.lastApp?.applied_at ? relTime(c.lastApp.applied_at) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <RowActions
                              candidateId={c.id}
                              candidateName={name}
                              appId={c.lastApp?.id}
                              resumeUrl={c.resume_url}
                              onScore={handleScore}
                              onDownload={handleDownloadResume}
                              onReject={(appId) => setRejectTarget({ appId, name })}
                              onView={() => navigate({ to: "/candidates/$candidateId", params: { candidateId: c.id } })}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 13, color: "#64748B" }}>
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} candidates
              </div>
              <div className="flex items-center gap-1">
                <PageBtn disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} ariaLabel="Previous">
                  <ChevronLeft className="h-4 w-4" />
                </PageBtn>
                {paginationRange(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`e${i}`} style={{ width: 36, height: 36, color: "#64748B" }} className="inline-flex items-center justify-center text-[13px]">…</span>
                  ) : (
                    <PageBtn key={p} active={p === page} onClick={() => setPage(p as number)}>{p}</PageBtn>
                  ),
                )}
                <PageBtn disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} ariaLabel="Next">
                  <ChevronRight className="h-4 w-4" />
                </PageBtn>
              </div>
              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="appearance-none h-9 pl-3 pr-8 rounded-lg text-[13px] text-white cursor-pointer focus:outline-none"
                  style={{ background: "#141416", border: "1px solid #1E1E22" }}
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n} style={{ background: "#141416" }}>{n} per page</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717A] pointer-events-none" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 flex-wrap"
          style={{
            bottom: 12,
            background: "#141416",
            border: "1px solid #1E1E22",
            borderRadius: 12,
            padding: "10px 20px",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <span className="text-white" style={{ fontSize: 14 }}>{selected.size} candidates selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info("Bulk actions coming soon")}
              className="inline-flex items-center rounded-md transition-colors hover:bg-violet-500/10"
              style={{ padding: "6px 12px", fontSize: 13, color: "#A78BFA", border: "1px solid rgba(139,92,246,0.4)" }}
            >
              Score All
            </button>
            <button
              onClick={() => toast.info("Bulk actions coming soon")}
              className="inline-flex items-center rounded-md transition-colors hover:bg-red-500/10"
              style={{ padding: "6px 12px", fontSize: 13, color: "#F87171", border: "1px solid rgba(239,68,68,0.4)" }}
            >
              Reject All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center rounded-md transition-colors hover:text-white"
              style={{ padding: "6px 8px", fontSize: 13, color: "#71717A" }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Mobile filters drawer */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="bg-background border-border">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          <div className="mt-4 grid grid-cols-1 gap-3">{filterControls}</div>
          <div className="mt-4 flex justify-between">
            <button onClick={clearFilters} style={{ fontSize: 13, color: "#3B82F6" }}>Clear all</button>
            <button onClick={() => setFiltersOpen(false)} className="inline-flex items-center rounded-md" style={{ background: "#3B82F6", color: "#fff", padding: "8px 16px", fontSize: 13 }}>Apply</button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reject confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {rejectTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark their most recent application as Rejected. You can reactivate it later from the candidate's profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject} className="bg-red-500 hover:bg-red-600">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const hStyle: React.CSSProperties = {
  fontSize: 12, color: "#64748B", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase",
};

function PageBtn({ children, active, disabled, onClick, ariaLabel }: { children: React.ReactNode; active?: boolean; disabled?: boolean; onClick?: () => void; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5",
      )}
      style={{
        width: 36, height: 36, fontSize: 13,
        background: active ? "#3B82F6" : "transparent",
        color: active ? "#fff" : "#9CA3AF",
        border: active ? "1px solid #3B82F6" : "1px solid #1E1E22",
      }}
    >
      {children}
    </button>
  );
}

function paginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("...");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("...");
  out.push(total);
  return out;
}

function RowActions({
  candidateId, candidateName, appId, resumeUrl, onScore, onDownload, onReject, onView,
}: {
  candidateId: string;
  candidateName: string;
  appId: string | null | undefined;
  resumeUrl: string | null;
  onScore: (appId: string) => void;
  onDownload: (url: string | null) => void;
  onReject: (appId: string) => void;
  onView: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onView}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
              aria-label="View profile"
            >
              <Eye className="h-4 w-4" style={{ color: "#64748B" }} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">View profile</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => toast.info("Messaging coming soon")}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
              aria-label="Message"
            >
              <MessageSquare className="h-4 w-4" style={{ color: "#64748B" }} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Coming soon</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
              aria-label="More actions"
            >
              <MoreVertical className="h-4 w-4" style={{ color: "#64748B" }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[200px]"
            style={{ background: "#141416", border: "1px solid #1E1E22", borderRadius: 8 }}
          >
            <DropdownMenuItem onClick={onView}>
              <Eye className="h-4 w-4 mr-2" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!appId}
              onClick={() => appId && onScore(appId)}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Score with AI
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!resumeUrl}
              onClick={() => onDownload(resumeUrl)}
            >
              <FileDown className="h-4 w-4 mr-2" /> Download Resume
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!appId}
              onClick={() => appId && onReject(appId)}
              className="text-red-400 focus:text-red-400"
            >
              <Ban className="h-4 w-4 mr-2" /> Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
