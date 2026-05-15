import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import meridianLogo from "@/assets/meridian-logo.png";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3, soon: true },
  { to: "/settings", label: "Settings", icon: Settings, soon: true },
] as const;

export function Sidebar({
  mobile = false,
  onItemClick,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  mobile?: boolean;
  onItemClick?: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { profile, signOut } = useAuth();

  // Mobile drawer keeps full labels; desktop is permanently icon-only.
  const iconOnly = !mobile;

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-30",
        iconOnly ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center h-14 border-b border-sidebar-border",
          iconOnly ? "justify-center px-0" : "px-4",
        )}
      >
        <Link to="/dashboard" className="flex items-center" aria-label="Meridian home">
          {iconOnly ? (
            <img src={meridianLogo} alt="Meridian" style={{ height: 28, width: "auto" }} />
          ) : (
            <span className="font-mono font-semibold text-base tracking-[0.1em] text-foreground">MERIDIAN</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        <TooltipProvider delayDuration={150}>
          {items.map((item) => {
            const active = path.startsWith(item.to);
            const Icon = item.icon;
            const inner = (
              <Link
                to={item.to}
                onClick={onItemClick}
                className={cn(
                  "group relative flex items-center rounded-md text-[13px] font-medium transition-colors",
                  active
                    ? "bg-surface text-foreground"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  iconOnly ? "h-10 justify-center" : "h-9 px-3 gap-3",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-primary rounded-r" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                {!iconOnly && (
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
            if (iconOnly) {
              const tip = "soon" in item && item.soon ? `${item.label} (Coming soon)` : item.label;
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{inner}</TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={8}
                    className="bg-[#1E1E22] text-white border border-[#2A2A2E] rounded-md px-3 py-1 text-[13px] shadow-lg"
                  >
                    {tip}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return <div key={item.to}>{inner}</div>;
          })}
        </TooltipProvider>
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-1">
        <ThemeToggle iconOnly={iconOnly} />
        <TooltipProvider delayDuration={150}>
          <Popover>
            {iconOnly ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      className="flex items-center justify-center w-full h-12 rounded-md hover:bg-surface transition-colors"
                      aria-label={profile?.full_name || "Account"}
                    >
                      <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center text-[12px] font-mono font-medium text-foreground shrink-0">
                        {initials(profile?.full_name || "U")}
                      </div>
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={8}
                  className="bg-[#1E1E22] text-white border border-[#2A2A2E] rounded-md px-3 py-1 text-[13px] shadow-lg"
                >
                  {profile?.full_name || "Account"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <PopoverTrigger asChild>
                <button className="flex items-center gap-3 w-full px-2 h-12 rounded-md hover:bg-surface transition-colors">
                  <div className="h-8 w-8 rounded-full bg-surface-hover flex items-center justify-center text-[12px] font-mono font-medium text-foreground shrink-0">
                    {initials(profile?.full_name || "U")}
                  </div>
                  <span className="text-[13px] font-medium text-foreground truncate">
                    {profile?.full_name || "Loading..."}
                  </span>
                </button>
              </PopoverTrigger>
            )}
            <PopoverContent side="right" align="end" className="w-48 p-1">
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 w-full px-3 h-9 rounded-md text-[13px] text-foreground hover:bg-surface-hover transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </PopoverContent>
          </Popover>
        </TooltipProvider>
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

function ThemeToggle({ iconOnly }: { iconOnly: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const btn = (
    <button
      onClick={toggle}
      aria-label={label}
      className={cn(
        "flex items-center rounded-lg transition-colors",
        "hover:bg-white/5 dark:hover:bg-white/5",
        "text-[#9CA3AF] dark:text-[#71717A] hover:text-foreground",
        iconOnly ? "h-10 w-10 mx-auto justify-center" : "w-full h-10 px-3 gap-3",
      )}
      style={!iconOnly ? undefined : undefined}
    >
      <span className="relative inline-flex h-5 w-5 items-center justify-center">
        <Sun
          className={cn(
            "absolute h-5 w-5 transition-all duration-200",
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75",
          )}
        />
        <Moon
          className={cn(
            "absolute h-5 w-5 transition-all duration-200",
            isDark ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100",
          )}
        />
      </span>
      {!iconOnly && <span className="text-[13px] font-medium">{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
  if (!iconOnly) return btn;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="bg-[#1E1E22] text-white border border-[#2A2A2E] rounded-md px-3 py-1 text-[13px] shadow-lg"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
