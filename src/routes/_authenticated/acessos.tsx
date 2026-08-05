import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DataTable, ListToolbar, useFilteredList } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, KeyRound, UserPlus, History, Trash2, AlertTriangle, Mail, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth, roleLabel, type AppRole } from "@/lib/auth";
import { inviteUser, deleteUser } from "@/lib/admin-users.functions";
import { RequireRole } from "@/components/require-role";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/acessos")({
  component: AcessosPage,
  head: () => ({
    meta: [
      { title: "Gestão de Acessos — GestoraIT" },
      { name: "description", content: "Controle de perfis, convites e permissões dos usuários da plataforma." },
    ],
  }),
});

const ROLES: AppRole[] = ["admin", "gestor_ti", "tecnico", "auditoria", "padrao", "visitante"];

type Profile = { id: string; nome: string | null; email: string | null; created_at: string };
type UserRoleRow = { user_id: string; role: AppRole };
type UserRow = Profile & { roles: AppRole[] };

function roleBadge(r: AppRole) {
  const map: Record<AppRole, string> = {
    admin: "bg-primary/15 text-primary border-primary/30",
    gestor_ti: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    tecnico: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
    padrao: "bg-secondary text-secondary-foreground border-border",
    visitante: "bg-muted text-muted-foreground",
    auditoria: "bg-[color:var(--info)]/15 text-[color:var(--info)] border-[color:var(--info)]/30",
  };
  return (
    <Badge key={r} variant="outline" className={map[r]}>
      {roleLabel(r)}
    </Badge>
  );
}

function AcessosPage() {
  const { isAdmin, user: me } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [selected, setSelected] = useState<Set<AppRole>>(new Set());
  const [saving, setSaving] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invNome, setInvNome] = useState("");
  const [invRoles, setInvRoles] = useState<Set<AppRole>>(new Set(["visitante"]));
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const invite = useServerFn(inviteUser);
  const remove = useServerFn(deleteUser);

  const { data: profiles, isLoading: lp } = useQuery({
    queryKey: ["acessos-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,email,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: rolesRows, isLoading: lr } = useQuery({
    queryKey: ["acessos-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return data as UserRoleRow[];
    },
  });

  const { data: convites, isLoading: lc } = useQuery({
    queryKey: ["acessos-convites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows: UserRow[] = useMemo(() => {
    if (!profiles) return [];
    const byUser = new Map<string, AppRole[]>();
    for (const r of rolesRows ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    }
    return profiles.map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
  }, [profiles, rolesRows]);

  const filtered = useFilteredList(rows, q, ["nome", "email"]);

  function openEdit(u: UserRow) {
    setEditing(u);
    setSelected(new Set(u.roles));
  }

  function toggle(role: AppRole) {
    const next = new Set(selected);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    setSelected(next);
  }

  function toggleInv(role: AppRole) {
    const next = new Set(invRoles);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    setInvRoles(next);
  }

  async function save() {
    if (!editing) return;
    if (selected.size === 0) return toast.error("Selecione ao menos um perfil.");
    if (editing.id === me?.id && !selected.has("admin") && editing.roles.includes("admin")) {
      return toast.error("Você não pode remover seu próprio perfil de Administrador.");
    }
    setSaving(true);
    try {
      const current = new Set(editing.roles);
      const target = selected;
      const toAdd = [...target].filter((r) => !current.has(r));
      const toRemove = [...current].filter((r) => !target.has(r));

      if (toRemove.length) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", editing.id)
          .in("role", toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from("user_roles")
          .insert(toAdd.map((role) => ({ user_id: editing.id, role })));
        if (error) throw error;
      }
      toast.success("Perfis atualizados");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["acessos-roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(email: string | null) {
    if (!email) return toast.error("Usuário sem e-mail cadastrado.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Link de redefinição enviado para ${email}`);
  }

  async function sendInvite() {
    if (invRoles.size === 0) return toast.error("Selecione ao menos um perfil.");
    setInviting(true);
    try {
      await invite({
        data: {
          email: invEmail.trim(),
          nome: invNome.trim() || undefined,
          roles: [...invRoles],
          redirectTo: "/auth",
        },
      });
      toast.success(`Convite enviado para ${invEmail}`);
      setInviteOpen(false);
      setInvEmail("");
      setInvNome("");
      setInvRoles(new Set(["visitante"]));
      qc.invalidateQueries({ queryKey: ["acessos-profiles"] });
      qc.invalidateQueries({ queryKey: ["acessos-roles"] });
      qc.invalidateQueries({ queryKey: ["acessos-convites"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar convite");
    } finally {
      setInviting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await remove({ data: deleting.id });
      toast.success("Usuário excluído com sucesso");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["acessos-profiles"] });
      qc.invalidateQueries({ queryKey: ["acessos-roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir usuário");
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isAdmin) {
    return <RequireRole roles={["admin"]}>{null}</RequireRole>;
  }

  return (
    <>
      <PageHeader
        title="Gestão de Acessos"
        description="Convide usuários, atribua perfis e acompanhe a trilha de auditoria."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/auditoria">
                <History className="mr-2 h-4 w-4" /> Trilha de perfis
              </Link>
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Convidar usuário
            </Button>
          </div>
        }
      />
      <Tabs defaultValue="usuarios" className="mt-4">
        <TabsList className="grid w-[400px] grid-cols-2">
          <TabsTrigger value="usuarios">Usuários ativos</TabsTrigger>
          <TabsTrigger value="convites">Convites enviados</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4 space-y-4">
          <ListToolbar query={q} onQueryChange={setQ} />
          <DataTable
            columns={["Nome", "E-mail", "Perfis", "Cadastrado em", "Ações"]}
            empty={lp || lr ? "Carregando…" : "Nenhum usuário."}
            rows={filtered.map((u) => [
              <span key="n" className="font-medium">
                {u.nome ?? "—"} {u.id === me?.id && <span className="text-xs text-muted-foreground">(você)</span>}
              </span>,
              <span key="e" className="text-sm">{u.email ?? "—"}</span>,
              <div key="r" className="flex flex-wrap gap-1">
                {u.roles.length ? u.roles.map(roleBadge) : <span className="text-xs text-muted-foreground">Sem perfil</span>}
              </div>,
              <span key="c" className="text-xs text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString("pt-BR")}
              </span>,
              <div key="a" className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Editar perfis</Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Enviar link de redefinição de senha"
                  onClick={() => resetPassword(u.email)}
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                {u.id !== me?.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Excluir usuário"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleting(u)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>,
            ])}
          />
        </TabsContent>

        <TabsContent value="convites" className="mt-4">
          <DataTable
            columns={["Destinatário", "Perfis", "Status", "Data"]}
            empty={lc ? "Carregando…" : "Nenhum convite enviado."}
            rows={(convites ?? []).map((c) => [
              <div key="d" className="flex flex-col">
                <span className="font-medium">{c.nome ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{c.email}</span>
              </div>,
              <div key="r" className="flex flex-wrap gap-1">
                {(c.roles as AppRole[]).map((role: AppRole) => roleBadge(role))}
              </div>,
              <div key="s">
                {c.status === "aceito" && (
                  <Badge className="bg-success/15 text-success border-success/30">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Aceito
                  </Badge>
                )}
                {c.status === "enviado" && (
                  <Badge className="bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30">
                    <Mail className="mr-1 h-3 w-3" /> Enviado
                  </Badge>
                )}
                {c.status === "enfileirado" && (
                  <Badge variant="outline" className="bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30">
                    <Clock className="mr-1 h-3 w-3" /> Enfileirado
                  </Badge>
                )}
                {c.status === "falhou" && (
                  <Badge variant="destructive" className="flex items-center gap-1" title={c.erro ?? "Erro desconhecido"}>
                    <XCircle className="h-3 w-3" /> Falhou
                  </Badge>
                )}
              </div>,
              <span key="da" className="text-xs text-muted-foreground">
                {c.created_at ? new Date(c.created_at).toLocaleString("pt-BR") : "—"}
              </span>
            ])}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perfis de {editing?.nome ?? editing?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {ROLES.map((role) => (
              <label key={role} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <Checkbox
                  checked={selected.has(role)}
                  onCheckedChange={() => toggle(role)}
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{roleLabel(role)}</div>
                  <div className="text-xs text-muted-foreground">
                    {role === "admin" && "Acesso total, inclusive gestão de acessos e configuração do sistema."}
                    {role === "gestor_ti" && "Cria e edita ativos, licenças, contratos e alocações."}
                    {role === "padrao" && "Leitura completa da plataforma — dashboards, catálogo, alocações e relatórios."}
                    {role === "visitante" && "Acesso mínimo de visualização — apenas dashboards e listas básicas."}
                  </div>
                </div>
              </label>
            ))}
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <Label className="text-xs">Regras</Label>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                <li>É possível combinar perfis (ex.: Administrador + Auditoria).</li>
                <li>Ao menos um perfil deve ser mantido.</li>
                <li>Você não pode remover seu próprio perfil de Administrador.</li>
                <li>Cada concessão ou revogação fica registrada na trilha de auditoria.</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar novo usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">E-mail *</Label>
              <Input
                id="inv-email"
                type="email"
                autoFocus
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-nome">Nome (opcional)</Label>
              <Input
                id="inv-nome"
                value={invNome}
                onChange={(e) => setInvNome(e.target.value)}
                placeholder="Ex.: Maria Silva"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfis</Label>
              {ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={invRoles.has(role)} onCheckedChange={() => toggleInv(role)} />
                  <span className="text-sm">{roleLabel(role)}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Enviaremos um e-mail com link de ativação. O usuário define a senha ao abrir o link.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancelar</Button>
            <Button onClick={sendInvite} disabled={inviting || !invEmail.trim()}>
              {inviting ? "Enviando…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Usuário
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome ?? deleting?.email}</strong>?
              Esta ação é irreversível e removerá todos os acessos do usuário imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Sim, excluir usuário"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
