import { Suspense } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/messages": "Enviar Mensagem",
  "/campaigns": "Campanhas",
  "/templates": "Templates",
  "/queue": "Fila de Mensagens",
  "/backup": "Backup & Restauração",
  "/settings": "Configurações",
  "/admin": "Painel Admin",
  "/admin/users": "Gerenciar Usuários",
  "/admin/config": "Configuração Global",
};

function ContentLoader() {
  return (
    <div className="flex items-center justify-center py-32">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .shimmer-loader {
          background: linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--accent)) 50%, hsl(var(--muted)) 75%);
          background-size: 1000px 100%;
          animation: shimmer 2.5s infinite;
        }
      `}</style>
      <div className="space-y-4 w-full max-w-md">
        <div className="h-12 shimmer-loader rounded-lg"></div>
        <div className="h-4 shimmer-loader rounded-md w-3/4"></div>
        <div className="space-y-3 pt-4">
          <div className="h-3 shimmer-loader rounded-md w-full"></div>
          <div className="h-3 shimmer-loader rounded-md w-5/6"></div>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 lg:px-6">
            <SidebarTrigger />
            {title && (
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
            )}
          </div>
          <div className="p-4 lg:p-6">
            <Suspense fallback={<ContentLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
