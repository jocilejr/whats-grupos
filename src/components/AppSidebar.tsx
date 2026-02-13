import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Send,
  Megaphone,
  FileText,
  Settings,
  LogOut,
  Clock,
  DatabaseBackup,
  ListOrdered,
  Shield,
  Users,
  Cog,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const userMenuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  { title: "Enviar Mensagem", icon: Send, path: "/messages" },
  { title: "Campanhas", icon: Megaphone, path: "/campaigns" },
  { title: "Templates", icon: FileText, path: "/templates" },
  { title: "Fila", icon: ListOrdered, path: "/queue" },
  { title: "Backup", icon: DatabaseBackup, path: "/backup" },
  { title: "Configurações", icon: Settings, path: "/settings" },
];

const adminMenuItems = [
  { title: "Painel Admin", icon: Shield, path: "/admin" },
  { title: "Usuários", icon: Users, path: "/admin/users" },
  { title: "Config Global", icon: Cog, path: "/admin/config" },
];

function getInitials(email?: string | null): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-center px-2">
          <img src={logoImg} alt="Simplificando Grupos" className="h-14 w-full object-contain" />
        </div>
        <div className="flex items-center gap-2 mt-3 rounded-lg bg-sidebar-accent/50 px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-sidebar-foreground/60" />
          <div className="flex flex-col">
            <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider leading-none">Hora do sistema</span>
            <span className="text-sm font-mono font-semibold text-sidebar-foreground tabular-nums">
              {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.path}
                      onClick={() => navigate(item.path)}
                      tooltip={item.title}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8 border border-sidebar-border">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
              {getInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.email?.split("@")[0] || "Usuário"}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
