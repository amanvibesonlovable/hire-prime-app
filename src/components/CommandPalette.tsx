import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Briefcase, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StatusBadge, DepartmentBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

type JobHit = { id: string; title: string; department: string; status: string; location: string };
type CandHit = { id: string; first_name: string; last_name: string; email: string; app_count: number };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [jobs, setJobs] = useState<JobHit[]>([]);
  const [cands, setCands] = useState<CandHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setHighlight(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    if (!debounced) { setJobs([]); setCands([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const like = `%${debounced}%`;
      const [jres, cres] = await Promise.all([
        supabase.from("jobs").select("id, title, department, status, location").ilike("title", like).limit(5),
        supabase.from("candidates").select("id, first_name, last_name, email").or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`).limit(5),
      ]);
      if (cancelled) return;
      const candidateIds = (cres.data || []).map((c) => c.id);
      let counts: Record<string, number> = {};
      if (candidateIds.length) {
        const { data: apps } = await supabase.from("applications").select("candidate_id").in("candidate_id", candidateIds);
        (apps || []).forEach((a) => { counts[a.candidate_id] = (counts[a.candidate_id] || 0) + 1; });
      }
      setJobs((jres.data || []) as JobHit[]);
      setCands(((cres.data || []) as any[]).map((c) => ({ ...c, app_count: counts[c.id] || 0 })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  const items = useMemo(() => {
    const arr: Array<{ type: "job" | "cand"; id: string; }> = [];
    jobs.forEach((j) => arr.push({ type: "job", id: j.id }));
    cands.forEach((c) => arr.push({ type: "cand", id: c.id }));
    return arr;
  }, [jobs, cands]);

  const select = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    if (it.type === "job") navigate({ to: "/jobs/$jobId", params: { jobId: it.id } });
    else navigate({ to: "/candidates/$candidateId", params: { candidateId: it.id } });
    onOpenChange(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(items.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); select(highlight); }
  };

  let runIdx = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-w-[560px] w-[calc(100vw-32px)] gap-0 bg-surface border-border rounded-xl overflow-hidden"
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setHighlight(0); }}
            placeholder="Search jobs, candidates..."
            className="flex-1 bg-transparent border-0 outline-none text-[16px] md:text-[18px] text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] font-mono text-muted-foreground bg-surface-hover px-1.5 py-0.5 rounded border border-border">ESC</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {!debounced ? null : loading ? (
            <div className="px-4 py-8 text-[13px] text-muted-foreground">Searching...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" strokeWidth={1.5} />
              <div className="text-[13px] text-muted-foreground">No results for "{debounced}"</div>
            </div>
          ) : (
            <div className="py-2">
              {jobs.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="h-3 w-3" /> Jobs <span className="text-muted-foreground/60">({jobs.length})</span>
                  </div>
                  {jobs.map((j) => {
                    const idx = runIdx++;
                    return (
                      <button
                        key={j.id}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => select(idx)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                          highlight === idx ? "bg-surface-hover" : "hover:bg-surface-hover/60",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[14px] text-foreground truncate">{j.title}</span>
                          <DepartmentBadge>{j.department}</DepartmentBadge>
                          <StatusBadge status={j.status} />
                        </div>
                        <span className="text-[12px] text-muted-foreground shrink-0">{j.location}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {cands.length > 0 && (
                <div className={jobs.length ? "mt-1 pt-1 border-t border-border" : ""}>
                  <div className="px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> Candidates <span className="text-muted-foreground/60">({cands.length})</span>
                  </div>
                  {cands.map((c) => {
                    const idx = runIdx++;
                    return (
                      <button
                        key={c.id}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => select(idx)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                          highlight === idx ? "bg-surface-hover" : "hover:bg-surface-hover/60",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] text-foreground truncate">{c.first_name} {c.last_name}</div>
                          <div className="text-[12px] text-muted-foreground truncate">{c.email}</div>
                        </div>
                        <span className="text-[12px] text-muted-foreground shrink-0">{c.app_count} application{c.app_count === 1 ? "" : "s"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
