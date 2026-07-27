import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Server,
  Users,
  FileText,
  KeySquare,
  Link2,
  Upload,
  Bell,
  ScrollText,
  BarChart3,
  LogOut,
  ShieldCheck,
  Package,
  UserCog,
  ClipboardList,
  Building2,
} from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth, roleLabel } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Ativos", url: "/ativos", icon: Server },
  { title: "Colaboradores", url: "/colaboradores", icon: Users },
  { title: "Catálogo", url: "/produtos", icon: Package },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Licenças", url: "/licencas", icon: KeySquare },
  { title: "Alocações", url: "/alocacoes", icon: Link2 },
  { title: "Solicitações", url: "/solicitacoes", icon: ClipboardList },
] as const;

const fase2 = [
  { title: "Reconciliação", url: "/reconciliacao", icon: Upload },
  { title: "Alertas", url: "/alertas", icon: Bell },
  { title: "Auditoria", url: "/auditoria", icon: ScrollText },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, roles, signOut, isAdmin } = useAuth();
  const primaryRole = roles[0];

  const admin = [
    { title: "Unidades", url: "/unidades", icon: Building2 },
    { title: "Gestão de Acessos", url: "/acessos", icon: UserCog },
  ] as const;

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="rounded-md bg-primary p-1.5 text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Gestorait</div>
              <div className="text-[10px] text-muted-foreground truncate">Gestão de Licenças</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Compliance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {fase2.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={`${item.title} (em breve)`}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                      {!collapsed && (
                        <Badge variant="secondary" className="ml-auto text-[9px]">
                          em breve
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {admin.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>


      <SidebarFooter>
        {!collapsed && user && (
          <div className="px-2 pb-2 text-xs">
            <div className="font-medium truncate">{user.email}</div>
            <div className="text-muted-foreground">{primaryRole ? roleLabel(primaryRole) : "Sem papel"}</div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="justify-start"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
