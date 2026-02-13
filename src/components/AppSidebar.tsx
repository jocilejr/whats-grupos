import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Send,
  Megaphone,
  FileText,
  History,
  Settings,
  LogOut,
  Clock,
  DatabaseBackup,
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

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  
  { title: "Enviar Mensagem", icon: Send, path: "/messages" },
  { title: "Campanhas", icon: Megaphone, path: "/campaigns" },
  { title: "Templates", icon: FileText, path: "/templates" },
  { title: "Histórico", icon: History, path: "/history" },
  { title: "Backup", icon: DatabaseBackup, path: "/backup" },
  { title: "Configurações", icon: Settings, path: "/settings" },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
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
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60 mb-2 truncate">
          {user?.email}
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
