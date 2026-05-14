import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { MobileSidebarTrigger } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { NotificationBell } from "./NotificationBell";

export function TopBar({ title, onMobileMenu }: { title: string; onMobileMenu: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8 sticky top-0 bg-background z-20">
      <div className="flex items-center gap-2">
        <MobileSidebarTrigger onClick={onMobileMenu} />
        <h1 className="text-[20px] font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setSearchOpen(true)}
          className="h-9 w-9 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <NotificationBell />
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
