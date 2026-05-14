import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Plus, X } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const DEPARTMENTS = ["Engineering", "Marketing", "Sales", "Operations", "Design", "Finance", "HR", "Product", "Customer Support"];
const TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
const DEFAULT_STAGES = ["Applied", "Screening", "Test", "Interview 1", "Interview 2", "Offer", "Hired"];

type JobInput = {
  id?: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  description: string;
  requirements: string;
  nice_to_haves: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  pipeline_stages: string[];
  status?: string;
};

const empty: JobInput = {
  title: "", department: "", location: "", employment_type: "Full-time",
  description: "", requirements: "", nice_to_haves: "",
  salary_min: null, salary_max: null, currency: "INR",
  pipeline_stages: [...DEFAULT_STAGES],
};

export function JobFormModal({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (o: boolean) => void; initial?: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [job, setJob] = useState<JobInput>(empty);
  const [busy, setBusy] = useState(false);
  const [newStage, setNewStage] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      if (initial) {
        setJob({
          id: initial.id,
          title: initial.title, department: initial.department, location: initial.location,
          employment_type: initial.employment_type, description: initial.description,
          requirements: initial.requirements, nice_to_haves: initial.nice_to_haves,
          salary_min: initial.salary_min, salary_max: initial.salary_max,
          currency: initial.currency || "INR",
          pipeline_stages: initial.pipeline_stages || [...DEFAULT_STAGES],
          status: initial.status,
        });
      } else setJob(empty);
    }
  }, [open, initial]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = { ...job };
      if (payload.id) {
        const { id, ...upd } = payload;
        const { error } = await supabase.from("jobs").update({ ...upd, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        toast.success("Job updated");
      } else {
        const { error } = await supabase.from("jobs").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success("Job created successfully");
      }
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job", payload.id] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save job");
    } finally {
      setBusy(false);
    }
  };

  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    const s = [...job.pipeline_stages];
    const [moved] = s.splice(r.source.index, 1);
    s.splice(r.destination.index, 0, moved);
    // ensure Applied first, Hired last
    const applied = s.indexOf("Applied"); if (applied > -1) { s.splice(applied, 1); s.unshift("Applied"); }
    const hired = s.indexOf("Hired"); if (hired > -1 && hired !== s.length - 1) { s.splice(hired, 1); s.push("Hired"); }
    setJob({ ...job, pipeline_stages: s });
  };

  const isCustomDept = job.department && !DEPARTMENTS.includes(job.department);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-surface border-border">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Job" : "New Job"} — Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Job Title *</Label>
              <Input value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Department *</Label>
              <Input
                placeholder="Type or select a department"
                value={job.department}
                onChange={(e) => setJob({ ...job, department: e.target.value })}
                list="dept-list"
              />
              <datalist id="dept-list">
                {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
              </datalist>
              {isCustomDept && <p className="text-[12px] text-muted-foreground">Custom department: "{job.department}"</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Location *</Label>
              <Input value={job.location} onChange={(e) => setJob({ ...job, location: e.target.value })} placeholder="Remote, Mumbai, New York..." />
            </div>
            <div className="space-y-1.5">
              <Label>Employment Type *</Label>
              <Select value={job.employment_type} onValueChange={(v) => setJob({ ...job, employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)} disabled={!job.title || !job.department || !job.location}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea rows={6} value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} placeholder="Describe the role, responsibilities, and what a typical day looks like..." />
            </div>
            <div className="space-y-1.5">
              <Label>Requirements *</Label>
              <Textarea rows={4} value={job.requirements} onChange={(e) => setJob({ ...job, requirements: e.target.value })} placeholder="List the must-have skills, experience, and qualifications..." />
            </div>
            <div className="space-y-1.5">
              <Label>Nice to Haves</Label>
              <Textarea rows={3} value={job.nice_to_haves || ""} onChange={(e) => setJob({ ...job, nice_to_haves: e.target.value })} placeholder="List preferred but not required qualifications..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Salary Min ({job.currency})</Label>
                <Input type="number" value={job.salary_min ?? ""} onChange={(e) => setJob({ ...job, salary_min: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-1.5">
                <Label>Salary Max ({job.currency})</Label>
                <Input type="number" value={job.salary_max ?? ""} onChange={(e) => setJob({ ...job, salary_max: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!job.description || !job.requirements}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Label>Pipeline Stages</Label>
            <p className="text-[12px] text-muted-foreground">Drag to reorder. "Applied" stays first; "Hired" stays last.</p>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="stages">
                {(p) => (
                  <div ref={p.innerRef} {...p.droppableProps} className="space-y-2 max-h-[260px] overflow-auto scrollbar-thin pr-1">
                    {job.pipeline_stages.map((s, i) => {
                      const locked = s === "Applied" || s === "Hired";
                      return (
                        <Draggable key={s} draggableId={s} index={i} isDragDisabled={locked}>
                          {(dp) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2"
                            >
                              <span {...dp.dragHandleProps} className={locked ? "opacity-30 cursor-not-allowed" : "cursor-grab text-muted-foreground"}>
                                <GripVertical className="h-4 w-4" />
                              </span>
                              <span className="flex-1 text-[13px]">{s}</span>
                              {!locked && (
                                <button
                                  onClick={() => setJob({ ...job, pipeline_stages: job.pipeline_stages.filter((x) => x !== s) })}
                                  className="text-muted-foreground hover:text-danger"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {p.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom stage..."
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newStage.trim()) {
                    e.preventDefault();
                    const v = newStage.trim();
                    if (!job.pipeline_stages.includes(v)) {
                      const stages = [...job.pipeline_stages];
                      stages.splice(stages.length - 1, 0, v); // before Hired
                      setJob({ ...job, pipeline_stages: stages });
                    }
                    setNewStage("");
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!newStage.trim()) return;
                  const v = newStage.trim();
                  if (job.pipeline_stages.includes(v)) return;
                  const stages = [...job.pipeline_stages];
                  stages.splice(stages.length - 1, 0, v);
                  setJob({ ...job, pipeline_stages: stages });
                  setNewStage("");
                }}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={submit} disabled={busy}>{busy ? "Saving..." : initial ? "Save Changes" : "Create Job"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
