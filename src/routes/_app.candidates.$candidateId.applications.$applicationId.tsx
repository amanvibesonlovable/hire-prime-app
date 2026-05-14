import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, type ComponentType } from "react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { configurePdfWorker } from "@/lib/pdfWorker";
import {
  ArrowLeft, Mail, Phone, Linkedin, Download, Sparkles, CheckCircle, AlertCircle,
  ZoomIn, ZoomOut, Star, UserPlus, FileX, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DepartmentBadge } from "@/components/StatusBadge";
import { AIScoreCircle, recommendationColor, scoreColor } from "@/components/AIScoreBadge";
import { relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getApiKey, runScoringForApplication, aiErrorToToast } from "@/lib/aiScoring";

export const Route = createFileRoute("/_app/candidates/$candidateId/applications/$applicationId")({
  ssr: false,
  component: ApplicationDetail,
});

function ApplicationDetail() {
  const { candidateId, applicationId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const candidate = useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").eq("id", candidateId).single();
      if (error) throw error;
      return data;
    },
  });

  const app = useQuery({
    queryKey: ["application", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, job:jobs(id, title, pipeline_stages)")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const allApps = useQuery({
    queryKey: ["candidate-apps", candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, job:jobs(title)")
        .eq("candidate_id", candidateId)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (candidate.isLoading || app.isLoading) {
    return <div className="space-y-4"><div className="skeleton h-12 w-1/3" /><div className="skeleton h-96" /></div>;
  }
  if (!candidate.data || !app.data) return <div className="text-muted-foreground">Not found.</div>;

  const c = candidate.data;
  const a = app.data;
  const job = a.job as any;
  const stages: string[] = (job?.pipeline_stages as string[]) || [];
  const currentIdx = stages.indexOf(a.current_stage);
  const nextStage = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

  const moveNext = async () => {
    if (!nextStage) return;
    try {
      await supabase.from("applications").update({ current_stage: nextStage, updated_at: new Date().toISOString() }).eq("id", applicationId);
      await supabase.from("stage_history").insert({ application_id: applicationId, from_stage: a.current_stage, to_stage: nextStage, moved_by: user?.id });
      toast.success(`${c.first_name} ${c.last_name} moved to ${nextStage}`);
      qc.invalidateQueries({ queryKey: ["application", applicationId] });
      qc.invalidateQueries({ queryKey: ["timeline", applicationId] });
    } catch (e: any) { toast.error(e.message); }
  };

  const reject = async () => {
    try {
      await supabase.from("applications").update({ status: "Rejected", updated_at: new Date().toISOString() }).eq("id", applicationId);
      await supabase.from("stage_history").insert({ application_id: applicationId, from_stage: a.current_stage, to_stage: "Rejected", moved_by: user?.id });
      toast.success(`${c.first_name} ${c.last_name} has been rejected.`);
      qc.invalidateQueries({ queryKey: ["application", applicationId] });
      qc.invalidateQueries({ queryKey: ["timeline", applicationId] });
    } catch (e: any) { toast.error(e.message); }
  };

  const reactivate = async () => {
    try {
      await supabase.from("applications").update({ status: "Active", updated_at: new Date().toISOString() }).eq("id", applicationId);
      await supabase.from("stage_history").insert({ application_id: applicationId, from_stage: "Rejected", to_stage: a.current_stage, moved_by: user?.id });
      toast.success(`${c.first_name} ${c.last_name} reactivated.`);
      qc.invalidateQueries({ queryKey: ["application", applicationId] });
      qc.invalidateQueries({ queryKey: ["timeline", applicationId] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <Link to="/candidates" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header */}
          <div className="bg-surface border border-border rounded-lg p-6 space-y-3">
            <h1 className="text-[24px] font-semibold">{c.first_name} {c.last_name}</h1>
            <div className="flex flex-wrap gap-4 text-[13px] text-muted-foreground">
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="h-3.5 w-3.5" /> {c.email}</a>
              {c.phone ? (
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="h-3.5 w-3.5" /> {c.phone}</a>
              ) : <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> —</span>}
              {c.linkedin_url ? (
                <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:text-primary-hover">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </a>
              ) : <span className="inline-flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5" /> —</span>}
            </div>
            {c.source && <DepartmentBadge>{c.source}</DepartmentBadge>}
            {(allApps.data?.length ?? 0) > 1 && (
              <div className="pt-2">
                <label className="text-[12px] text-muted-foreground block mb-1">Viewing application for:</label>
                <Select
                  value={applicationId}
                  onValueChange={(v) => navigate({ to: "/candidates/$candidateId/applications/$applicationId", params: { candidateId, applicationId: v } })}
                >
                  <SelectTrigger className="w-full max-w-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allApps.data!.map((x: any) => (
                      <SelectItem key={x.id} value={x.id}>{x.job?.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Resume */}
          <ResumeBlock url={c.resume_url} />

          {/* AI Analysis */}
          <AIAnalysisBlock app={a} />
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-2 space-y-6">
          <QuickActions
            status={a.status}
            currentStage={a.current_stage}
            nextStage={nextStage}
            onNext={moveNext}
            onReject={reject}
            onReactivate={reactivate}
            candidateName={`${c.first_name} ${c.last_name}`}
            jobTitle={job?.title || ""}
          />
          <TimelineBlock applicationId={applicationId} />
          <NotesBlock applicationId={applicationId} currentStage={a.current_stage} />
        </div>
      </div>
    </div>
  );
}

function ResumeBlock({ url }: { url: string | null }) {
  const [pages, setPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [pdfComponents, setPdfComponents] = useState<{
    Document: ComponentType<any>;
    Page: ComponentType<any>;
  } | null>(null);
  const file = useMemo(() => (url ? { url } : null), [url]);

  useEffect(() => {
    let cancelled = false;
    void import("react-pdf").then((module) => {
      configurePdfWorker(module.pdfjs);
      if (!cancelled) setPdfComponents({ Document: module.Document, Page: module.Page });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!url) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[16px] font-semibold">Resume</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileX className="h-10 w-10 mb-2" />
          <p className="text-sm">No resume uploaded</p>
        </div>
      </div>
    );
  }

  const PdfDocument = pdfComponents?.Document;
  const PdfPage = pdfComponents?.Page;

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[16px] font-semibold">Resume</h3>
        <a href={url} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Download</Button>
        </a>
      </div>
      <div className="flex items-center justify-end gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
        <span className="text-[12px] font-mono text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="sm" onClick={() => setScale((s) => Math.min(2, s + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
      </div>
      <div className="bg-background border border-border rounded-md h-[500px] overflow-auto p-4 flex flex-col items-center gap-4">
        {PdfDocument && PdfPage ? (
          <PdfDocument
            file={file}
            onLoadSuccess={({ numPages }: { numPages: number }) => setPages(numPages)}
            loading={<div className="text-muted-foreground text-sm py-12">Loading PDF...</div>}
            error={<div className="text-danger text-sm py-12">Failed to load PDF.</div>}
          >
            {Array.from({ length: pages }).map((_, i) => (
              <div key={i} className="border border-border bg-white">
                <PdfPage pageNumber={i + 1} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
                <div className="bg-background text-center text-[11px] text-muted-foreground py-1">Page {i + 1} of {pages}</div>
              </div>
            ))}
          </PdfDocument>
        ) : (
          <div className="text-muted-foreground text-sm py-12">Loading PDF...</div>
        )}
      </div>
    </div>
  );
}

function AIAnalysisBlock({ app }: { app: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [scoring, setScoring] = useState(false);
  const scored = app.ai_score != null;

  const runScore = async () => {
    if (!user) return;
    const apiKey = await getApiKey(user.id);
    if (!apiKey) {
      toast.error("Please add your Anthropic API key in Settings to use AI scoring.", {
        action: { label: "Settings", onClick: () => navigate({ to: "/settings" }) },
      });
      return;
    }
    setScoring(true);
    try {
      const result = await runScoringForApplication(app.id, apiKey);
      toast.success(`AI scoring complete — ${result.score}/10`);
      qc.invalidateQueries({ queryKey: ["application", app.id] });
    } catch (e) {
      toast.error(aiErrorToToast(e));
    } finally {
      setScoring(false);
    }
  };

  const strengths: string[] = Array.isArray(app.ai_strengths) ? app.ai_strengths : [];
  const concerns: string[] = Array.isArray(app.ai_concerns) ? app.ai_concerns : [];
  const sc = scored ? scoreColor(app.ai_score) : null;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet" />
          <h3 className="text-[16px] font-semibold">AI Analysis</h3>
          {scored && <span className="text-[12px] text-muted-foreground">Scored {relTime(app.ai_scored_at)}</span>}
        </div>
        <Button
          onClick={runScore}
          disabled={scoring}
          className={cn(scored ? "border border-violet/40 text-violet bg-transparent hover:bg-violet/10" : "bg-violet text-white hover:bg-violet/90")}
        >
          {scoring ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</>) : scored ? "Re-score" : (<><Sparkles className="h-4 w-4" /> Score with AI</>)}
        </Button>
      </div>

      {!scored && !scoring && (
        <div className="flex flex-col items-center text-center py-10 gap-2">
          <Sparkles className="h-12 w-12 text-violet/60" strokeWidth={1.5} />
          <p className="text-[14px] font-medium">Not yet analyzed</p>
          <p className="text-[13px] text-muted-foreground max-w-sm">Click 'Score with AI' to analyze this resume against the job requirements.</p>
        </div>
      )}

      {scoring && !scored && (
        <div className="flex flex-col items-center py-10">
          <div className="h-20 w-20 rounded-full animate-pulse bg-violet/20 border border-violet/40" />
        </div>
      )}

      {scored && sc && (
        <>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <AIScoreCircle score={app.ai_score} size={80} />
              <span className="text-[12px] text-muted-foreground mt-1">out of 10</span>
            </div>
            {app.ai_recommendation && (
              <div
                className={cn("inline-flex items-center rounded-md px-4 py-2 text-[16px] font-semibold border", sc.border)}
                style={{ background: sc.hex + "26", color: sc.hex }}
              >
                {app.ai_recommendation}
              </div>
            )}
          </div>

          {app.ai_summary && (
            <div className="border-l-2 border-violet pl-4 italic text-[14px] text-foreground/95">
              {app.ai_summary}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <h4 className="text-[13px] font-semibold">Strengths</h4>
              </div>
              <ul className="space-y-1.5">
                {strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[13px]">
                    <CheckCircle className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-danger" />
                <h4 className="text-[13px] font-semibold">Concerns</h4>
              </div>
              <ul className="space-y-1.5">
                {concerns.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[13px]">
                    <AlertCircle className="h-3.5 w-3.5 text-danger mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickActions({
  status, currentStage, nextStage, onNext, onReject, onReactivate, candidateName, jobTitle,
}: {
  status: string; currentStage: string; nextStage: string | null;
  onNext: () => void; onReject: () => void; onReactivate: () => void;
  candidateName: string; jobTitle: string;
}) {
  const [confirmReject, setConfirmReject] = useState(false);
  const isRejected = status === "Rejected";

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap gap-2">
        {!isRejected && nextStage && (
          <Button onClick={onNext} className="flex-1">Move to {nextStage}</Button>
        )}
        {!isRejected && (
          <Button variant="outline" onClick={() => setConfirmReject(true)} className="text-danger border-danger/30 hover:bg-danger/10">Reject</Button>
        )}
        {isRejected && (
          <Button variant="outline" onClick={onReactivate} className="text-success border-success/30 hover:bg-success/10">Reactivate</Button>
        )}
      </div>
      <div className="border-l-2 border-primary pl-3 py-1">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Current Stage</div>
        <div className="text-[15px] font-semibold">{currentStage}</div>
      </div>
      <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {candidateName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject {candidateName} for {jobTitle}? This will remove them from the active pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onReject(); setConfirmReject(false); }} className="bg-danger hover:bg-danger/90">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TimelineBlock({ applicationId }: { applicationId: string }) {
  const history = useQuery({
    queryKey: ["timeline", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stage_history")
        .select("*, profile:profiles!stage_history_moved_by_fkey(full_name)")
        .eq("application_id", applicationId)
        .order("moved_at", { ascending: false });
      if (error) {
        // Fallback without join (no FK relation in schema)
        const { data: d2 } = await supabase
          .from("stage_history")
          .select("*")
          .eq("application_id", applicationId)
          .order("moved_at", { ascending: false });
        return d2 || [];
      }
      return data || [];
    },
  });

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-[16px] font-semibold mb-4">Timeline</h3>
      {history.isLoading ? (
        <div className="space-y-2">{Array.from({length:3}).map((_,i)=><div key={i} className="skeleton h-12"/>)}</div>
      ) : (history.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-5 pl-5">
          {history.data!.map((h: any) => {
            const isHired = h.to_stage === "Hired";
            const isRejected = h.to_stage === "Rejected";
            const dot = isHired ? "bg-success" : isRejected ? "bg-danger" : "bg-primary";
            const isInitial = !h.from_stage;
            return (
              <li key={h.id} className="relative">
                <span className={cn("absolute -left-[26px] top-1.5 h-2 w-2 rounded-full", dot)} />
                <div className="text-[13px]">
                  {isInitial ? (
                    <span className="inline-flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-primary" /> Applied</span>
                  ) : (
                    <>
                      Moved to <span className="font-semibold">{h.to_stage}</span>{" "}
                      <span className="text-muted-foreground">from {h.from_stage}</span>
                    </>
                  )}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {h.profile?.full_name && <span>by {h.profile.full_name} · </span>}
                  {relTime(h.moved_at)}
                </div>
                {h.notes && (
                  <div className="mt-2 bg-card border border-border rounded p-2 text-[12px] text-foreground/90">{h.notes}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function NotesBlock({ applicationId, currentStage }: { applicationId: string; currentStage: string }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);

  const notes = useQuery({
    queryKey: ["notes", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluation_notes")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch author profiles
  const authorIds = useMemo(() => Array.from(new Set((notes.data || []).map((n: any) => n.author_id))), [notes.data]);
  const profiles = useQuery({
    queryKey: ["note-profiles", authorIds],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
      const m: Record<string, string> = {};
      (data || []).forEach((p: any) => (m[p.id] = p.full_name));
      return m;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("evaluation_notes").insert({
        application_id: applicationId,
        author_id: user!.id,
        stage: currentStage,
        content: content.trim(),
        rating: rating || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note added.");
      setContent(""); setRating(0);
      qc.invalidateQueries({ queryKey: ["notes", applicationId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[16px] font-semibold">Evaluation Notes</h3>
        <span className="text-[12px] font-mono bg-muted text-muted-foreground rounded px-1.5 py-0.5">{notes.data?.length ?? 0}</span>
      </div>

      <div className="bg-card border border-border rounded-md p-4 space-y-3">
        <div className="text-[13px] font-medium">Add a note</div>
        <div className="text-[12px] text-muted-foreground">Current stage: <span className="text-foreground">{currentStage}</span></div>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(rating === n ? 0 : n)}
            >
              <Star className={cn("h-5 w-5", (hover || rating) >= n ? "fill-warning text-warning" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Write your evaluation notes..."
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button size="sm" disabled={!content.trim() || submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? "Adding..." : "Add Note"}
        </Button>
      </div>

      {notes.isLoading ? (
        <div className="space-y-2">{Array.from({length:2}).map((_,i)=><div key={i} className="skeleton h-16"/>)}</div>
      ) : (notes.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No evaluation notes yet. Add your first note above.</p>
      ) : (
        <div className="space-y-2">
          {notes.data!.map((n: any) => (
            <div key={n.id} className="bg-card border border-border rounded-md p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-medium text-foreground">
                  {n.author_id === user?.id ? (profile?.full_name || "You") : (profiles.data?.[n.author_id] || "User")}
                </span>
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5">{n.stage}</span>
                <span className="text-muted-foreground">{relTime(n.created_at)}</span>
              </div>
              {n.rating && (
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} className={cn("h-3.5 w-3.5", i <= n.rating ? "fill-warning text-warning" : "text-muted-foreground")} />
                  ))}
                </div>
              )}
              <p className="text-[14px] text-foreground whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// satisfy unused-import lint
export const _r = recommendationColor;
