import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Meridian — Precision hiring. Peak talent." },
      { name: "description", content: "Meridian is a modern applicant tracking system for high-performance hiring teams." },
      { property: "og:title", content: "Meridian — Precision hiring. Peak talent." },
      { name: "twitter:title", content: "Meridian — Precision hiring. Peak talent." },
      { property: "og:description", content: "Meridian is a modern applicant tracking system for high-performance hiring teams." },
      { name: "twitter:description", content: "Meridian is a modern applicant tracking system for high-performance hiring teams." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36fcc278-152f-42d7-b6cc-3a5d4bbfd784/id-preview-38548d4d--fe8a1c7a-7e93-4a9f-9b0d-9c99b3956882.lovable.app-1778757612370.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36fcc278-152f-42d7-b6cc-3a5d4bbfd784/id-preview-38548d4d--fe8a1c7a-7e93-4a9f-9b0d-9c99b3956882.lovable.app-1778757612370.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/meridian-logo.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster theme="dark" position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-7xl font-mono font-semibold text-foreground">404</h1>
        <p className="mt-3 text-muted-foreground">Page not found</p>
        <a href="/" className="mt-6 inline-block text-primary hover:text-primary-hover">Go home</a>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}
