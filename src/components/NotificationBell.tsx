import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Gift, PartyPopper, Sparkles, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { relTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const PAGE = 20;

const iconMap: Record<string, { Icon: any; bg: string; color: string }> = {
  new_application: { Icon: UserPlus, bg: "bg-primary/15", color: "text-primary" },
  ai_score_complete: { Icon: Sparkles, bg: "bg-violet/15", color: "text-violet" },
  candidate_offer: { Icon: Gift, bg: "bg-warning/15", color: "text-warning" },
  candidate_hired: { Icon: PartyPopper, bg: "bg-success/15", color: "text-success" },
};

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [pulse, setPulse] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

  const list = useQuery({
    queryKey: ["notifications", user?.id, limit],
    queryFn: async () => {
      if (!user) return { items: [], unread: 0, total: 0 };
      const [{ data: items }, { count: unread }, { count: total }] = await Promise.all([
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      return { items: (items || []) as Notif[], unread: unread ?? 0, total: total ?? 0 };
    },
    enabled: !!user,
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  // Click outside to close (desktop)
  useEffect(() => {
    if (!open || isMobile) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open, isMobile]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const onClickItem = async (n: Notif) => {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    }
    if (n.link) navigate({ to: n.link });
    setOpen(false);
  };

  const unread = list.data?.unread ?? 0;
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  const Panel = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border">
        <div className="text-[14px] font-semibold">Notifications</div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button onClick={markAllRead} className="text-[12px] text-primary hover:text-primary-hover">Mark all as read</button>
          )}
          {isMobile && (
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <Bell className="h-8 w-8 text-muted-foreground/60 mb-3" strokeWidth={1.5} />
            <div className="text-[14px] text-foreground font-medium mb-1">No notifications yet</div>
            <p className="text-[12px] text-muted-foreground max-w-xs">You'll be notified when candidates apply or reach key stages.</p>
          </div>
        ) : (
          <>
            {items.map((n) => {
              const meta = iconMap[n.type] || iconMap.new_application;
              return (
                <button
                  key={n.id}
                  onClick={() => onClickItem(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border hover:bg-surface-hover transition-colors relative",
                    !n.is_read && "bg-surface-hover/60",
                  )}
                >
                  {!n.is_read && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />}
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", meta.bg)}>
                    <meta.Icon className={cn("h-4 w-4", meta.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-foreground">{n.title}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{n.message}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{relTime(n.created_at)}</div>
                  </div>
                </button>
              );
            })}
            {total > items.length && (
              <button onClick={() => setLimit((l) => l + PAGE)} className="w-full py-3 text-[12px] text-primary hover:bg-surface-hover">
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-9 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-mono font-medium flex items-center justify-center",
              pulse && "animate-pulse-once",
            )}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && !isMobile && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-surface border border-border rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] z-50 overflow-hidden flex flex-col">
          {Panel}
        </div>
      )}
      {open && isMobile && (
        <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-150">
          {Panel}
        </div>
      )}
    </div>
  );
}
