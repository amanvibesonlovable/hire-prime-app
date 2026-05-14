import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  Open: "bg-[#22C55E20] text-[#22C55E]",
  Draft: "bg-[#71717A20] text-[#71717A]",
  Paused: "bg-[#EAB30820] text-[#EAB308]",
  Closed: "bg-[#EF444420] text-[#EF4444]",
  Active: "bg-[#3B82F620] text-[#3B82F6]",
  Rejected: "bg-[#EF444420] text-[#EF4444]",
  Withdrawn: "bg-[#71717A20] text-[#71717A]",
  Hired: "bg-[#22C55E20] text-[#22C55E]",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cls = styles[status] ?? "bg-[#71717A20] text-[#71717A]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[12px] font-medium font-mono",
        cls,
        className,
      )}
    >
      {status}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className="inline-flex items-center rounded-[4px] bg-surface-hover border border-border px-2 py-0.5 text-[12px] text-foreground">
      {stage}
    </span>
  );
}

export function DepartmentBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[4px] bg-surface-hover px-2 py-0.5 text-[12px] text-muted-foreground">
      {children}
    </span>
  );
}
