import { Bell, Search } from "lucide-react";
import { MobileSidebarTrigger } from "./Sidebar";

export function TopBar({ title, onMobileMenu }: { title: string; onMobileMenu: () => void }) {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 sticky top-0 bg-background z-20">
      <div className="flex items-center gap-2">
        <MobileSidebarTrigger onClick={onMobileMenu} />
        <h1 className="text-[20px] font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        <button className="h-9 w-9 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" aria-label="Search">
          <Search className="h-4 w-4" />
        </button>
        <button className="h-9 w-9 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
