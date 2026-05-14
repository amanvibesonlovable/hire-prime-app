import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { relTime } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIScoreCircle, recommendationColor } from "@/components/AIScoreBadge";
import { getApiKey, runScoringForApplication, aiErrorToToast } from "@/lib/aiScoring";

type App = {
  id: string;
  candidate_id: string;
  current_stage: string;
  applied_at: string;
  ai_score: number | null;
  ai_recommendation: string | null;
  candidate: { first_name: string; last_name: string; email: string };
};

type SortKey = "newest" | "oldest" | "score-desc" | "score-asc";
type FilterKey = "all" | "strong-yes" | "yes-up" | "maybe-up" | "unscored";

export function KanbanBoard({ jobId, stages }: { jobId: string; stages: string[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("newest");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [local, setLocal] = useState<App[]>([]);
  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const apps = useQuery({
    queryKey: ["job-apps", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, candidate_id, current_stage, applied_at, ai_score, ai_recommendation, candidate:candidates(first_name, last_name, email)")
        .eq("job_id", jobId);
      if (error) throw error;
      return (data || []) as unknown as App[];
    },
  });

  useEffect(() => { if (apps.data) setLocal(apps.data); }, [apps.data]);

  const filtered = useMemo(() => {
    return local.filter((a) => {
      if (filter === "all") return true;
      if (filter === "unscored") return a.ai_score == null;
      const r = a.ai_recommendation;
      if (filter === "strong-yes") return r === "Strong Yes";
      if (filter === "yes-up") return r === "Strong Yes" || r === "Yes";
      if (filter === "maybe-up") return r === "Strong Yes" || r === "Yes" || r === "Maybe";
      return true;
    });
  }, [local, filter]);

  const grouped = useMemo(() => {
    const m: Record<string, App[]> = {};
    stages.forEach((s) => (m[s] = []));
    filtered.forEach((a) => {
      const stage = stages.includes(a.current_stage) ? a.current_stage : stages[0];
      (m[stage] ||= []).push(a);
    });
    Object.keys(m).forEach((s) => {
      m[s].sort((a, b) => {
        if (sort === "score-desc" || sort === "score-asc") {
          const av = a.ai_score, bv = b.ai_score;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return sort === "score-desc" ? bv - av : av - bv;
        }
        const d = new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime();
        return sort === "newest" ? d : -d;
      });
    });
    return m;
  }, [filtered, stages, sort]);

  const onDragEnd = async (r: DropResult) => {
    if (!r.destination) return;
    if (r.source.droppableId === r.destination.droppableId) return;
    const appId = r.draggableId;
    const fromStage = r.source.droppableId;
    const toStage = r.destination.droppableId;
    const moved = local.find((a) => a.id === appId);
    if (!moved) return;

    setLocal((prev) => prev.map((a) => (a.id === appId ? { ...a, current_stage: toStage } : a)));

    try {
      const { error } = await supabase
        .from("applications")
        .update({ current_stage: toStage, updated_at: new Date().toISOString() })
        .eq("id", appId);
      if (error) throw error;
      await supabase.from("stage_history").insert({
        application_id: appId,
        from_stage: fromStage,
        to_stage: toStage,
        moved_by: user?.id,
      });
      toast.success(`${moved.candidate.first_name} ${moved.candidate.last_name} moved to ${toStage}`);
      qc.invalidateQueries({ queryKey: ["job-apps", jobId] });
    } catch (e: any) {
      toast.error("Failed to move candidate");
      setLocal((prev) => prev.map((a) => (a.id === appId ? { ...a, current_stage: fromStage } : a)));
    }
  };

  const scoreOne = async (appId: string) => {
    if (!user) return;
    const apiKey = await getApiKey(user.id);
    if (!apiKey) {
      toast.error("Please add your Anthropic API key in Settings to use AI scoring.", {
        action: { label: "Settings", onClick: () => navigate({ to: "/settings" }) },
      });
      return;
    }
    setScoringIds((s) => new Set(s).add(appId));
    try {
      const result = await runScoringForApplication(appId, apiKey);
      toast.success(`AI scoring complete — ${result.score}/10`);
      qc.invalidateQueries({ queryKey: ["job-apps", jobId] });
    } catch (e) {
      toast.error(aiErrorToToast(e));
    } finally {
      setScoringIds((s) => { const n = new Set(s); n.delete(appId); return n; });
    }
  };

  const scoreAllUnscored = async () => {
    if (!user) return;
    const apiKey = await getApiKey(user.id);
    if (!apiKey) {
      toast.error("Please add your Anthropic API key in Settings to use AI scoring.", {
        action: { label: "Settings", onClick: () => navigate({ to: "/settings" }) },
      });
      return;
    }
    const unscored = local.filter((a) => a.ai_score == null);
    if (unscored.length === 0) { toast.info("All candidates already scored."); return; }
    setBulkProgress({ done: 0, total: unscored.length });
    for (let i = 0; i < unscored.length; i++) {
      const a = unscored[i];
      setScoringIds((s) => new Set(s).add(a.id));
      try {
        await runScoringForApplication(a.id, apiKey);
      } catch (e) {
        toast.error(`${a.candidate.first_name}: ${aiErrorToToast(e)}`);
      } finally {
        setScoringIds((s) => { const n = new Set(s); n.delete(a.id); return n; });
        setBulkProgress({ done: i + 1, total: unscored.length });
        qc.invalidateQueries({ queryKey: ["job-apps", jobId] });
      }
    }
    setBulkProgress(null);
    toast.success("Bulk scoring complete.");
  };

  if (apps.isLoading) {
    return <div className="flex gap-4 overflow-auto">{stages.map((s) => <div key={s} className="skeleton h-80 min-w-[280px]" />)}</div>;
  }

  if (local.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No candidates yet. Share the application link to start receiving applications.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Button
          variant="outline"
          onClick={scoreAllUnscored}
          disabled={!!bulkProgress}
          className="border-violet/40 text-violet hover:bg-violet/10"
        >
          {bulkProgress ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Scoring {bulkProgress.done} of {bulkProgress.total}...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Score All Unscored</>
          )}
        </Button>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Candidates</SelectItem>
              <SelectItem value="strong-yes">Strong Yes only</SelectItem>
              <SelectItem value="yes-up">Yes & above</SelectItem>
              <SelectItem value="maybe-up">Maybe & above</SelectItem>
              <SelectItem value="unscored">Unscored only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort: Newest First</SelectItem>
              <SelectItem value="oldest">Sort: Oldest First</SelectItem>
              <SelectItem value="score-desc">AI Score: High to Low</SelectItem>
              <SelectItem value="score-asc">AI Score: Low to High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-2">
          {stages.map((stage) => (
            <Droppable key={stage} droppableId={stage}>
              {(p, snap) => (
                <div
                  ref={p.innerRef}
                  {...p.droppableProps}
                  className={cn(
                    "min-w-[280px] w-[280px] rounded-lg p-3 transition-colors",
                    snap.isDraggingOver ? "border border-primary/50 bg-surface/50" : "border border-transparent",
                  )}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[14px] font-medium text-foreground">{stage}</span>
                    <span className="text-[12px] font-mono text-muted-foreground bg-surface px-1.5 py-0.5 rounded">{grouped[stage]?.length ?? 0}</span>
                  </div>
                  <div className="space-y-2 min-h-[20px]">
                    {(grouped[stage] || []).map((a, i) => {
                      const scoring = scoringIds.has(a.id);
                      return (
                        <Draggable key={a.id} draggableId={a.id} index={i}>
                          {(dp, ds) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                              onClick={() => navigate({ to: "/candidates/$candidateId/applications/$applicationId", params: { candidateId: a.candidate_id, applicationId: a.id } })}
                              className={cn(
                                "bg-surface border border-border rounded-lg p-4 cursor-pointer transition-all hover:border-border-strong relative",
                                ds.isDragging && "shadow-lg border-primary",
                              )}
                            >
                              <div className="absolute top-3 right-3">
                                {scoring ? (
                                  <div className="h-8 w-8 rounded-full animate-pulse bg-violet/20 border border-violet/40" />
                                ) : a.ai_score != null ? (
                                  <AIScoreCircle score={a.ai_score} />
                                ) : null}
                              </div>
                              <div className="text-[14px] text-foreground font-medium pr-10">
                                {a.candidate.first_name} {a.candidate.last_name}
                              </div>
                              <div className="text-[12px] text-muted-foreground mt-0.5 truncate">{a.candidate.email}</div>
                              {a.ai_recommendation && (
                                <div className={cn("text-[11px] mt-1 font-medium", recommendationColor(a.ai_recommendation))}>
                                  {a.ai_recommendation}
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <div className="text-[12px] text-muted-foreground">Applied {relTime(a.applied_at)}</div>
                                {a.ai_score == null && !scoring && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); scoreOne(a.id); }}
                                    className="h-6 px-2 inline-flex items-center gap-1 rounded border border-violet/40 text-violet text-[11px] hover:bg-violet/10"
                                  >
                                    <Sparkles className="h-3 w-3" /> Score
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {p.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

// Suppress unused import lint when Link not used
export const _Link = Link;
