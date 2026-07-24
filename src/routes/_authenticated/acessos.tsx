import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { ShieldAlert, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth, roleLabel, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/acessos")({
  component: AcessosPage,
  head: () => ({
    meta: [
      { title: "Gestão de Acessos — ITAM/SAM" },
      { name: "description", content: "Controle de perfis e permissões dos usuários da plataforma." },
    ],
  }),
});

const ROLES: AppRole[] = ["admin", "gestor_ti", "auditoria"];

type Profile = { id: string; nome: string | null; email: string | null; created_at: string };
type UserRoleRow = { user_id: string; role: AppRole };

type UserRow = Profile & { roles: AppRole[] };

function roleBadge(r: AppRole) {
  const map: Record<AppRole, string> = {
    admin: "bg-primary/15 text-primary border-primary/30",
    gestor_ti: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    auditoria: "bg-muted text-muted-foreground",
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
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Link de redefinição enviado para ${email}`);
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Gestão de Acessos" description="Controle de perfis e permissões." />
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar acessos.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Gestão de Acessos"
        description="Atribua perfis (Administrador, Gestor de TI, Auditoria) aos usuários da plataforma."
      />
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
          </div>,
        ])}
      />

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
                    {role === "auditoria" && "Apenas leitura — dashboards, relatórios e logs de auditoria."}
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
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
