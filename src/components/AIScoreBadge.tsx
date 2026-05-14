import { cn } from "@/lib/utils";

export function scoreColor(score: number) {
  if (score >= 8) return { bg: "bg-[#22C55E20]", text: "text-[#22C55E]", border: "border-[#22C55E40]", hex: "#22C55E" };
  if (score >= 5) return { bg: "bg-[#EAB30820]", text: "text-[#EAB308]", border: "border-[#EAB30840]", hex: "#EAB308" };
  return { bg: "bg-[#EF444420]", text: "text-[#EF4444]", border: "border-[#EF444440]", hex: "#EF4444" };
}

export function recommendationColor(rec: string | null | undefined) {
  if (rec === "Strong Yes" || rec === "Yes") return "text-[#22C55E]";
  if (rec === "Maybe") return "text-[#EAB308]";
  if (rec === "No") return "text-[#EF4444]";
  return "text-muted-foreground";
}

export function AIScoreCircle({ score, size = 32 }: { score: number; size?: number }) {
  const c = scoreColor(score);
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-mono font-semibold border", c.bg, c.text, c.border)}
      style={{ width: size, height: size, fontSize: size >= 60 ? 28 : 13 }}
    >
      {score}
    </div>
  );
}

export function AIScoreInline({ score }: { score: number }) {
  const c = scoreColor(score);
  return (
    <span className={cn("inline-flex items-center rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] font-semibold border", c.bg, c.text, c.border)}>
      {score}
    </span>
  );
}

export function AIScoreShimmer() {
  return (
    <div className="h-8 w-8 rounded-full animate-pulse bg-violet/20 border border-violet/40" />
  );
}
