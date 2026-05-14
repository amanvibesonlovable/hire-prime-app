import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: () => (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <Sparkles className="h-12 w-12 text-muted-foreground/60 mb-4" strokeWidth={1.5} />
      <h2 className="text-[20px] font-semibold mb-1">Settings</h2>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  ),
});
