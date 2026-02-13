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
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
