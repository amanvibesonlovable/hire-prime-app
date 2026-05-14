import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Briefcase, MapPin, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, DepartmentBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { JobFormModal } from "@/components/JobFormModal";
import { relTime } from "@/lib/format";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/_app/jobs")({
  component: JobsRoute,
});

function JobsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/jobs") return <Outlet />;

  return <JobsPage />;
}

function JobsPage() {
  useDocumentTitle("Jobs — Meridian");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dept, setDept] = useState("all");
  const [open, setOpen] = useState(false);

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, applications(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const departments = useMemo(() => {
    const set = new Set<string>(["Engineering","Marketing","Sales","Operations","Design","Finance","HR","Product","Customer Support"]);
    jobs.data?.forEach((j: any) => set.add(j.department));
    return Array.from(set);
  }, [jobs.data]);

  const filtered = useMemo(() => {
    return (jobs.data || []).filter((j: any) => {
      if (search && !j.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== "all" && j.status !== status) return false;
      if (dept !== "all" && j.department !== dept) return false;
      return true;
    });
  }, [jobs.data, search, status, dept]);

  const hasFilters = search || status !== "all" || dept !== "all";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div />
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Job</Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["Open","Draft","Paused","Closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setStatus("all"); setDept("all"); }} className="text-[13px] text-muted-foreground hover:text-foreground">
            Clear filters
          </button>
        )}
      </div>

      {jobs.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg">
          <EmptyState
            icon={Briefcase}
            title={jobs.data?.length === 0 ? "No jobs yet" : "No jobs match your filters"}
            description={jobs.data?.length === 0 ? "Create your first job posting to start building your pipeline." : "Try adjusting your search or filters."}
            action={jobs.data?.length === 0 ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Job</Button> : null}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((j: any) => (
            <Link
              key={j.id}
              to="/jobs/$jobId"
              params={{ jobId: j.id }}
              className="bg-surface border border-border rounded-lg p-5 hover:border-border-strong transition-colors group"
            >
              <div className="flex justify-between items-start gap-3 mb-3">
                <h3 className="text-[16px] font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">{j.title}</h3>
                <StatusBadge status={j.status} />
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <DepartmentBadge>{j.department}</DepartmentBadge>
              </div>
              <div className="space-y-1 text-[13px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {j.location}</div>
                <div>{j.employment_type}</div>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-border text-[12px] text-muted-foreground">
                <span className="font-mono">{j.applications?.[0]?.count ?? 0} candidates</span>
                <span>{relTime(j.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <JobFormModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
