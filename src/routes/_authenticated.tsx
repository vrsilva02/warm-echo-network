import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette";
import { NotificationsBell } from "@/components/notifications-bell";
import { SessionTimeout } from "@/components/session-timeout";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { loading, session } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b bg-background px-3 gap-3 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground hidden sm:block">
              GestoraIT · Painel
            </div>
            <div className="flex-1" />
            <CommandPaletteTrigger />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}
