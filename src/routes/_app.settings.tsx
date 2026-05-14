import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Eye, EyeOff, CheckCircle2, AlertTriangle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const settings = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("anthropic_api_key, updated_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings.data?.anthropic_api_key) setKeyInput(settings.data.anthropic_api_key);
  }, [settings.data?.anthropic_api_key]);

  const save = useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase
        .from("settings")
        .upsert({ user_id: user!.id, anthropic_api_key: key, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("API key saved successfully.");
      qc.invalidateQueries({ queryKey: ["settings", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("settings").delete().eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("API key removed.");
      setKeyInput("");
      setConfirmRemove(false);
      qc.invalidateQueries({ queryKey: ["settings", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const hasKey = !!settings.data?.anthropic_api_key;
  const masked = hasKey && !show
    ? "••••••••••••" + (settings.data!.anthropic_api_key.slice(-4))
    : keyInput;

  return (
    <div className="space-y-10 max-w-3xl">
      {/* AI Configuration */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-semibold">AI Configuration</h2>
          {hasKey && (
            <span className="inline-flex items-center gap-1 text-[12px] text-[#22C55E] bg-[#22C55E20] px-2 py-0.5 rounded">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground">
          Connect your Anthropic API key to enable AI-powered resume scoring. Your key is stored
          securely and only used to analyze resumes against job requirements.
        </p>

        {!settings.isLoading && !hasKey && (
          <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 text-warning text-[13px] rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4" />
            No API key configured. AI scoring features will be unavailable.
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[13px] text-foreground">Anthropic API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={show ? "text" : "password"}
                placeholder="sk-ant-..."
                value={hasKey && !show ? masked : keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="pr-10 font-mono"
                disabled={hasKey && !show}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={() => save.mutate(keyInput.trim())}
              disabled={!keyInput.trim() || save.isPending}
            >
              {save.isPending ? "Saving..." : "Save Key"}
            </Button>
          </div>
        </div>

        {hasKey && (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger hover:bg-danger/10"
            onClick={() => setConfirmRemove(true)}
          >
            Remove Key
          </Button>
        )}
      </section>

      {/* Account */}
      <section className="space-y-4">
        <h2 className="text-[18px] font-semibold">Account</h2>
        <div className="bg-surface border border-border rounded-lg p-5 space-y-2">
          <div className="text-[13px]">
            <span className="text-muted-foreground">Name: </span>
            <span className="text-foreground">{profile?.full_name || "—"}</span>
          </div>
          <div className="text-[13px]">
            <span className="text-muted-foreground">Email: </span>
            <span className="text-foreground">{user?.email}</span>
          </div>
        </div>
        <Button
          variant="outline"
          className="text-danger border-danger/30 hover:bg-danger/10"
          onClick={async () => {
            await signOut();
          }}
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </section>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove API key?</AlertDialogTitle>
            <AlertDialogDescription>
              AI scoring features will be disabled until you add a new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} className="bg-danger hover:bg-danger/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-[12px] text-muted-foreground">
        Need help? Visit <Link to="/settings" className="text-primary">Settings</Link>.
      </p>
    </div>
  );
}
