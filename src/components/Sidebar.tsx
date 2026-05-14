import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3, soon: true },
  { to: "/settings", label: "Settings", icon: Settings, soon: true },
] as const;

export function Sidebar({
  collapsed,
  onToggle,
  mobile = false,
  onItemClick,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
  onItemClick?: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { profile, signOut } = useAuth();

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-150 h-screen sticky top-0 z-30",
        collapsed && !mobile ? "w-16" : "w-60",
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="font-mono font-semibold text-base tracking-[0.1em] text-foreground">
          {collapsed && !mobile ? "M" : "MERIDIAN"}
        </Link>
        {!mobile && (
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        <TooltipProvider delayDuration={100}>
          {items.map((item) => {
            const active = path.startsWith(item.to);
            const Icon = item.icon;
            const inner = (
              <Link
                to={item.to}
                onClick={onItemClick}
                className={cn(
                  "group flex items-center gap-3 px-3 h-9 rounded-md text-[13px] font-medium transition-colors relative",
                  active
                    ? "bg-surface text-foreground"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  collapsed && !mobile && "justify-center px-0",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-primary rounded-r" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                {(!collapsed || mobile) && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {"soon" in item && item.soon && (
                      <span className="text-[10px] font-mono uppercase text-muted-foreground bg-surface-hover px-1.5 py-0.5 rounded">
                        Soon
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
            if (collapsed && !mobile) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{inner}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return <div key={item.to}>{inner}</div>;
          })}
        </TooltipProvider>
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-3 w-full px-2 h-12 rounded-md hover:bg-surface transition-colors",
                collapsed && !mobile && "justify-center px-0",
              )}
            >
              <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center text-[12px] font-mono font-medium text-foreground shrink-0">
                {initials(profile?.full_name || "U")}
              </div>
              {(!collapsed || mobile) && (
                <span className="text-[13px] font-medium text-foreground truncate">
                  {profile?.full_name || "Loading..."}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-48 p-1">
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 w-full px-3 h-9 rounded-md text-[13px] text-foreground hover:bg-surface-hover transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}

export function MobileSidebarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="md:hidden text-foreground p-2" aria-label="Open menu">
      <Menu className="h-5 w-5" />
    </button>
  );
}
