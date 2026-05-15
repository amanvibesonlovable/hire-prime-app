import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { AlertTriangle, Check, MapPin, ShieldCheck, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DepartmentBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/apply/$jobId")({
  component: ApplyPage,
});

function ApplyPage() {
  const { jobId } = Route.useParams();
  const job = useQuery({
    queryKey: ["public-job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useDocumentTitle(job.data?.title ? `Apply — ${job.data.title} — Meridian` : "Meridian");

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cooldown, setCooldown] = useState<{ lastAppliedAt: string } | null>(null);
  const [emailWarning, setEmailWarning] = useState<{ endsAt: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const COOLDOWN_DAYS = 90;
  const isValidEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

  // Returns { lastAppliedAt } if a recent application exists within COOLDOWN_DAYS, else null.
  const checkCooldown = async (rawEmail: string) => {
    const e = rawEmail.trim();
    if (!isValidEmail(e)) return null;
    const since = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: cands } = await supabase.from("candidates").select("id").ilike("email", e);
    const ids = (cands ?? []).map((c) => c.id);
    if (ids.length === 0) return null;
    const { data: apps } = await supabase
      .from("applications")
      .select("applied_at")
      .in("candidate_id", ids)
      .gte("applied_at", since)
      .order("applied_at", { ascending: false })
      .limit(1);
    const last = apps?.[0];
    return last ? { lastAppliedAt: last.applied_at } : null;
  };

  const onEmailBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isValidEmail(email)) { setEmailWarning(null); return; }
    debounceRef.current = setTimeout(async () => {
      const result = await checkCooldown(email);
      if (result) {
        const ends = new Date(new Date(result.lastAppliedAt).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        setEmailWarning({ endsAt: formatLongDate(ends) });
      } else {
        setEmailWarning(null);
      }
    }, 500);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    onFile(e.dataTransfer.files?.[0]);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf") { toast.error("Only PDF files are accepted"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!first.trim()) errs.first = "Required";
    if (!last.trim()) errs.last = "Required";
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = "Valid email required";
    if (!file) errs.file = "Resume is required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      // 90-day cooldown check across ALL jobs
      const cd = await checkCooldown(email);
      if (cd) {
        setCooldown(cd);
        setBusy(false);
        return;
      }

      // upsert candidate
      const { data: existing } = await supabase.from("candidates").select("id").eq("email", email).maybeSingle();
      let candidateId = existing?.id;
      if (candidateId) {
        await supabase.from("candidates").update({
          first_name: first, last_name: last, phone: phone || null, linkedin_url: linkedin || null,
        }).eq("id", candidateId);
      } else {
        const { data: ins, error: insErr } = await supabase.from("candidates").insert({
          first_name: first, last_name: last, email, phone: phone || null, linkedin_url: linkedin || null, source: "Direct",
        }).select("id").single();
        if (insErr) throw insErr;
        candidateId = ins.id;
      }

      // check duplicate application
      const { data: dup } = await supabase.from("applications").select("id").eq("job_id", jobId).eq("candidate_id", candidateId!).maybeSingle();
      if (dup) {
        toast.error("You've already applied for this position.");
        setBusy(false);
        return;
      }

      // upload resume
      const path = `${jobId}/${candidateId}/${Date.now()}-${file!.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file!, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("resumes").getPublicUrl(path);
      await supabase.from("candidates").update({ resume_url: pub.publicUrl }).eq("id", candidateId!);

      // create application + initial stage history
      const { data: app, error: appErr } = await supabase.from("applications").insert({
        job_id: jobId, candidate_id: candidateId!, current_stage: "Applied", status: "Active",
      }).select("id").single();
      if (appErr) throw appErr;
      await supabase.from("stage_history").insert({
        application_id: app.id, from_stage: null, to_stage: "Applied", moved_by: null,
      });

      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  if (job.isLoading) return <CenteredCard><div className="skeleton h-40 w-full" /></CenteredCard>;
  if (!job.data) return <CenteredCard><div className="text-center text-muted-foreground p-8">Job not found.</div></CenteredCard>;
  const j = job.data;

  return (
    <CenteredCard>
      <div className="text-center mb-5">
        <div className="font-mono font-semibold text-base tracking-[0.1em] text-foreground">MERIDIAN</div>
      </div>
      <h1 className="text-[20px] font-semibold text-foreground mb-3">{j.title}</h1>
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <DepartmentBadge>{j.department}</DepartmentBadge>
        <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"><MapPin className="h-3 w-3" />{j.location}</span>
        <span className="text-[12px] text-muted-foreground">{j.employment_type}</span>
      </div>
      <div className="h-px bg-border mb-6" />

      {j.status !== "Open" ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          This position is no longer accepting applications.
        </div>
      ) : done ? (
        <div className="text-center py-8 space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto h-14 w-14 rounded-full bg-success/15 flex items-center justify-center">
            <Check className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-[20px] font-semibold">Application Submitted!</h2>
          <p className="text-sm text-muted-foreground">Thank you for applying to {j.title}. Our team will review your application and get back to you.</p>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className={`space-y-4 transition-opacity duration-200 ${busy ? "opacity-70" : "opacity-100"}`}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name *" error={errors.first}><Input value={first} onChange={(e) => setFirst(e.target.value)} className={errors.first ? "border-danger" : ""} /></Field>
            <Field label="Last Name *" error={errors.last}><Input value={last} onChange={(e) => setLast(e.target.value)} className={errors.last ? "border-danger" : ""} /></Field>
          </div>
          <Field label="Email *" error={errors.email}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={errors.email ? "border-danger" : ""} /></Field>
          <Field label="Phone"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="LinkedIn Profile URL"><Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/yourprofile" /></Field>

          <Field label="Resume (PDF) *" error={errors.file}>
            {file ? (
              <div className="flex items-center justify-between bg-surface border border-border rounded-md px-3 py-2 text-[13px]">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-danger"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`block border border-dashed rounded-md p-6 text-center cursor-pointer transition-colors hover:bg-surface ${errors.file ? "border-danger" : "border-border"}`}
                style={isDragging ? { borderColor: "#3B82F6", backgroundColor: "#3B82F610" } : undefined}
              >
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-[13px] text-muted-foreground">Drag & drop your resume (PDF) or click to browse</div>
              </label>
            )}
          </Field>

          <Button type="submit" className="w-full h-9" disabled={busy}>
            {busy ? "Submitting..." : "Submit Application"}
          </Button>
        </form>
      )}
    </CenteredCard>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen radial-glow flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px] bg-surface border border-border rounded-lg p-8">{children}</div>
      <p className="mt-4 text-center text-[12px] text-[#71717A] flex items-center justify-center gap-1">
        Powered by <span className="font-mono text-foreground/80">M</span> Meridian
      </p>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
