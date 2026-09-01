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
  Briefcase,
  Package,
  UserCog,
  ClipboardList,
  Building2,
  Network,
  Wallet,
  Wrench,
  Boxes,
  User,
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
import mtrLogo from "@/assets/mtr2-tech-logo.png.asset.json";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Ativos", url: "/ativos", icon: Server },
  { title: "Clientes", url: "/clientes", icon: Briefcase },
  { title: "Colaboradores", url: "/colaboradores", icon: Users },
  { title: "Catálogo", url: "/produtos", icon: Package },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Licenças", url: "/licencas", icon: KeySquare },
  { title: "Chaves de licença", url: "/chaves-licenca", icon: KeySquare },
  { title: "Alocações", url: "/alocacoes", icon: Link2 },
  { title: "Solicitações", url: "/solicitacoes", icon: ClipboardList },
  { title: "Serviços", url: "/servicos", icon: Network },
] as const;

const fase2 = [
  { title: "Ordens de serviço", url: "/ordens-servico", icon: Wrench },
  { title: "Peças", url: "/pecas", icon: Package },
  { title: "Estoque", url: "/estoque", icon: Boxes },
  { title: "Relatórios de OS", url: "/relatorios-os", icon: BarChart3 },
  { title: "Reconciliação", url: "/reconciliacao", icon: Upload },
  { title: "Alertas", url: "/alertas", icon: Bell },
  { title: "Auditoria", url: "/auditoria", icon: ScrollText },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
] as const;

// Rotas visíveis apenas para o perfil Técnico (somente OS e estoque)
const TECNICO_ALLOWED = new Set<string>([
  "/ordens-servico", "/pecas", "/estoque", "/relatorios-os", "/ativos",
]);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, roles, signOut, isAdmin, isTecnico } = useAuth();
  const primaryRole = roles[0];
  const tecnicoOnly = isTecnico && !isAdmin && roles.length === 1;

  const admin = [
    { title: "Unidades", url: "/unidades", icon: Building2 },
    { title: "Centros de Custo", url: "/centros-custo", icon: Wallet },
    { title: "Gestão de Acessos", url: "/acessos", icon: UserCog },
  ] as const;

  const filterMenu = <T extends { url: string }>(items: readonly T[]) =>
    tecnicoOnly ? items.filter((i) => TECNICO_ALLOWED.has(i.url)) : items;

  const mainVisible = filterMenu(main);
  const fase2Visible = filterMenu(fase2);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2 min-w-0">
          <div className="rounded-md bg-primary p-1.5 text-primary-foreground shrink-0">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">GestoraIT</div>
              <div className="text-[10px] text-sidebar-foreground/70 truncate">Gestão de Licenças</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainVisible.map((item) => (
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
              {fase2Visible.map((item) => (
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
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/perfil")} tooltip="Meu Perfil">
              <Link to="/perfil">
                <User className="h-4 w-4" />
                {!collapsed && <span>Meu Perfil</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
        {!collapsed && (
          <div className="mt-2 border-t pt-2 px-2 pb-1 flex flex-col items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Powered by</span>
            <img src={mtrLogo.url} alt="MTR2.TECH" width={100} height={20} loading="lazy" decoding="async" className="h-5 w-auto opacity-80 dark:invert-0 invert" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
