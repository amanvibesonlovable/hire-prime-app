import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Copy, ChevronRight } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusBadge, DepartmentBadge } from "@/components/StatusBadge";
import { JobFormModal } from "@/components/JobFormModal";
import { KanbanBoard } from "@/components/KanbanBoard";
import { formatSalary } from "@/lib/format";

export const Route = createFileRoute("/_app/jobs/$jobId")({
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [qr, setQr] = useState<string>("");

  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).single();
      if (error) throw error;
      return data;
    },
  });

  const applyUrl = typeof window !== "undefined" ? `${window.location.origin}/apply/${jobId}` : `/apply/${jobId}`;

  useEffect(() => {
    QRCode.toDataURL(applyUrl, { width: 240, margin: 1, color: { dark: "#FAFAFA", light: "#14141600" } })
      .then(setQr).catch(() => {});
  }, [applyUrl]);

  const changeStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase.from("jobs").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", jobId);
      if (error) throw error;
      toast.success(`Job status changed to ${newStatus}`);
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setConfirmStatus(null);
    }
  };

  if (job.isLoading) return <div className="space-y-4"><div className="skeleton h-12 w-1/3" /><div className="skeleton h-64" /></div>;
  if (!job.data) return <div className="text-muted-foreground">Job not found.</div>;
  const j = job.data;

  return (
    <div className="space-y-6">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>

      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="space-y-3">
          <h1 className="text-[24px] font-semibold text-foreground">{j.title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <DepartmentBadge>{j.department}</DepartmentBadge>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {j.location}
            </span>
            <span className="text-[13px] text-muted-foreground">{j.employment_type}</span>
            <StatusBadge status={j.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          <StatusActions status={j.status} onChange={(s) => setConfirmStatus(s)} />
        </div>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="details">Job Details</TabsTrigger>
          <TabsTrigger value="link">Application Link</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <KanbanBoard jobId={jobId} stages={(j.pipeline_stages as string[]) || []} />
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <Section title="Description"><div className="whitespace-pre-wrap text-[14px] text-foreground/90">{j.description}</div></Section>
          <Section title="Requirements"><div className="whitespace-pre-wrap text-[14px] text-foreground/90">{j.requirements}</div></Section>
          {j.nice_to_haves && <Section title="Nice to Haves"><div className="whitespace-pre-wrap text-[14px] text-foreground/90">{j.nice_to_haves}</div></Section>}
          <Section title="Compensation"><div className="text-[14px] font-mono">{formatSalary(j.salary_min, j.salary_max, j.currency ?? undefined)}</div></Section>
          <Section title="Pipeline Stages">
            <div className="flex items-center gap-2 flex-wrap">
              {(((j.pipeline_stages as string[]) || []) as string[]).map((s, i, arr) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="bg-surface border border-border rounded-md px-3 py-1.5 text-[13px]">{s}</span>
                  {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="link" className="space-y-5">
          {j.status !== "Open" && (
            <div className="bg-warning/10 border border-warning/30 text-warning text-[13px] rounded-md px-4 py-3">
              This job is not currently open. Candidates visiting this link will see a message that applications are closed.
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[13px] text-muted-foreground">Public application link</label>
            <div className="flex gap-2">
              <Input value={applyUrl} readOnly className="font-mono text-[13px]" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(applyUrl);
                  toast.success("Link copied!");
                }}
              >
                <Copy className="h-4 w-4" /> Copy
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">This link opens a public page where candidates can submit their name, contact info, and resume. No login required.</p>
          </div>
          {qr && (
            <div className="bg-surface border border-border rounded-lg p-4 inline-block">
              <img src={qr} alt="QR code" className="w-[120px] h-[120px]" />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <JobFormModal open={editing} onOpenChange={setEditing} initial={j} />

      <AlertDialog open={!!confirmStatus} onOpenChange={(o) => !o && setConfirmStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change job status to {confirmStatus}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStatus === "Closed" && "Candidates can no longer apply to this job."}
              {confirmStatus === "Paused" && "Applications will be paused. You can reopen anytime."}
              {confirmStatus === "Open" && "Candidates will be able to apply through your link."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmStatus && changeStatus(confirmStatus)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-[13px] uppercase tracking-wide text-muted-foreground mb-3 font-medium">{title}</h3>
      {children}
    </div>
  );
}

function StatusActions({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  if (status === "Draft") return <Button onClick={() => onChange("Open")} className="bg-success text-background hover:bg-success/90">Open Job</Button>;
  if (status === "Open") return <>
    <Button variant="outline" onClick={() => onChange("Paused")} className="text-warning border-warning/30 hover:bg-warning/10">Pause</Button>
    <Button variant="outline" onClick={() => onChange("Closed")} className="text-danger border-danger/30 hover:bg-danger/10">Close</Button>
  </>;
  if (status === "Paused") return <>
    <Button onClick={() => onChange("Open")} className="bg-success text-background hover:bg-success/90">Reopen</Button>
    <Button variant="outline" onClick={() => onChange("Closed")} className="text-danger border-danger/30 hover:bg-danger/10">Close</Button>
  </>;
  if (status === "Closed") return <Button onClick={() => onChange("Open")} className="bg-success text-background hover:bg-success/90">Reopen</Button>;
  return null;
}
