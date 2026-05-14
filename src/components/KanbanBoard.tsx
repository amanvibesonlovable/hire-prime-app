import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { relTime } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type App = {
  id: string;
  candidate_id: string;
  current_stage: string;
  applied_at: string;
  ai_score: number | null;
  candidate: { first_name: string; last_name: string; email: string };
};

export function KanbanBoard({ jobId, stages }: { jobId: string; stages: string[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [local, setLocal] = useState<App[]>([]);

  const apps = useQuery({
    queryKey: ["job-apps", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, candidate_id, current_stage, applied_at, ai_score, candidate:candidates(first_name, last_name, email)")
        .eq("job_id", jobId);
      if (error) throw error;
      return (data || []) as unknown as App[];
    },
  });

  useEffect(() => { if (apps.data) setLocal(apps.data); }, [apps.data]);

  const grouped = useMemo(() => {
    const m: Record<string, App[]> = {};
    stages.forEach((s) => (m[s] = []));
    local.forEach((a) => {
      const stage = stages.includes(a.current_stage) ? a.current_stage : stages[0];
      (m[stage] ||= []).push(a);
    });
    Object.keys(m).forEach((s) => {
      m[s].sort((a, b) => {
        const d = new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime();
        return sort === "newest" ? d : -d;
      });
    });
    return m;
  }, [local, stages, sort]);

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
      <div className="flex justify-end mb-4">
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Sort: Newest First</SelectItem>
            <SelectItem value="oldest">Sort: Oldest First</SelectItem>
          </SelectContent>
        </Select>
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
                    {(grouped[stage] || []).map((a, i) => (
                      <Draggable key={a.id} draggableId={a.id} index={i}>
                        {(dp, ds) => (
                          <div
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            onClick={() => navigate({ to: "/candidates/$candidateId", params: { candidateId: a.candidate_id } })}
                            className={cn(
                              "bg-surface border border-border rounded-lg p-4 cursor-pointer transition-all hover:border-border-strong relative",
                              ds.isDragging && "shadow-lg border-primary",
                            )}
                          >
                            {a.ai_score != null && (
                              <ScoreBadge score={a.ai_score} />
                            )}
                            <div className="text-[14px] text-foreground font-medium pr-8">
                              {a.candidate.first_name} {a.candidate.last_name}
                            </div>
                            <div className="text-[12px] text-muted-foreground mt-0.5 truncate">{a.candidate.email}</div>
                            <div className="text-[12px] text-muted-foreground mt-2">Applied {relTime(a.applied_at)}</div>
                          </div>
                        )}
                      </Draggable>
                    ))}
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

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "bg-[#22C55E20] text-[#22C55E]" : score >= 5 ? "bg-[#EAB30820] text-[#EAB308]" : "bg-[#EF444420] text-[#EF4444]";
  return (
    <div className={cn("absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-mono", color)}>
      {score}
    </div>
  );
}
