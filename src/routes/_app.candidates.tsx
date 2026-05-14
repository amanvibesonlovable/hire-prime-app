import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Search, Users, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { DepartmentBadge } from "@/components/StatusBadge";
import { AIScoreInline } from "@/components/AIScoreBadge";
import { relTime } from "@/lib/format";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/_app/candidates")({
  component: CandidatesPage,
});

const PAGE_SIZE = 20;

function CandidatesPage() {
  useDocumentTitle("Candidates — Meridian");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"name" | "applied" | "applications">("applied");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const candidates = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, applications(applied_at, ai_score)")
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const rows = useMemo(() => {
    let r = (candidates.data || []).map((c: any) => {
      const apps = c.applications || [];
      const last = apps.length ? apps.reduce((a: any, b: any) => (new Date(b.applied_at) > new Date(a.applied_at) ? b : a)).applied_at : null;
      const scored = apps.filter((a: any) => a.ai_score != null);
      const avg = scored.length ? scored.reduce((s: number, a: any) => s + a.ai_score, 0) / scored.length : null;
      return { ...c, app_count: apps.length, last_applied: last, avg_score: avg };
    });
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((c: any) => `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(q));
    }
    r.sort((a: any, b: any) => {
      let v = 0;
      if (sortKey === "name") v = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      else if (sortKey === "applications") v = a.app_count - b.app_count;
      else v = (new Date(a.last_applied || 0).getTime()) - (new Date(b.last_applied || 0).getTime());
      return sortDir === "asc" ? v : -v;
    });
    return r;
  }, [candidates.data, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setSort = (k: typeof sortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search candidates..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {candidates.isLoading ? (
          <div className="p-4 space-y-3">{Array.from({length:6}).map((_,i) => <div key={i} className="skeleton h-10" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No candidates yet" description="Candidates will appear here once they apply through your job links." />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {slice.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => navigate({ to: "/candidates/$candidateId", params: { candidateId: c.id } })}
                  className="p-4 space-y-1.5 cursor-pointer hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[14px] font-medium text-foreground">{c.first_name} {c.last_name}</div>
                    {c.avg_score != null && <AIScoreInline score={Number(c.avg_score.toFixed(1))} />}
                  </div>
                  <div className="text-[12px] text-muted-foreground truncate">{c.email}</div>
                  <div className="flex items-center gap-2 flex-wrap text-[12px] text-muted-foreground">
                    <DepartmentBadge>{c.source || "Direct"}</DepartmentBadge>
                    <span className="font-mono">{c.app_count} app{c.app_count === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>{c.last_applied ? relTime(c.last_applied) : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
            <table className="w-full text-[13px] hidden md:table">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <SortHeader label="Name" active={sortKey === "name"} dir={sortDir} onClick={() => setSort("name")} />
                  <th className="font-medium px-5 py-3">Email</th>
                  <th className="font-medium px-5 py-3">Phone</th>
                  <th className="font-medium px-5 py-3">Source</th>
                  <SortHeader label="Apps" active={sortKey === "applications"} dir={sortDir} onClick={() => setSort("applications")} />
                  <th className="font-medium px-5 py-3">Avg. AI Score</th>
                  <SortHeader label="Last Applied" active={sortKey === "applied"} dir={sortDir} onClick={() => setSort("applied")} />
                  <th className="font-medium px-5 py-3">Resume</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((c: any) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate({ to: "/candidates/$candidateId", params: { candidateId: c.id } })}
                    className="border-t border-border hover:bg-surface-hover cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-foreground">{c.first_name} {c.last_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.email}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-5 py-3"><DepartmentBadge>{c.source || "Direct"}</DepartmentBadge></td>
                    <td className="px-5 py-3 font-mono text-foreground">{c.app_count}</td>
                    <td className="px-5 py-3">{c.avg_score != null ? <AIScoreInline score={Number(c.avg_score.toFixed(1))} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.last_applied ? relTime(c.last_applied) : "—"}</td>
                    <td className="px-5 py-3">
                      {c.resume_url ? (
                        <a href={c.resume_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:text-primary-hover">
                          <Download className="h-4 w-4" />
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {rows.length > 0 && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-border text-[12px] text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="font-medium px-5 py-3">
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ArrowUpDown className={`h-3 w-3 ${active ? "text-foreground" : "opacity-50"}`} />
      </button>
    </th>
  );
}
