import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

const titleMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/jobs": "Jobs",
  "/candidates": "Candidates",
  "/analytics": "Analytics",
  "/settings": "Settings",
};

function AppLayout() {
  const { loading, session } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  let title = "Meridian";
  for (const k of Object.keys(titleMap)) {
    if (path.startsWith(k)) { title = titleMap[k]; break; }
  }

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="skeleton h-10 w-32" /></div>;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60 bg-sidebar border-sidebar-border">
          <Sidebar mobile onItemClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar title={title} onMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1">
          <div className="max-w-[1440px] mx-auto px-6 md:px-10 py-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
