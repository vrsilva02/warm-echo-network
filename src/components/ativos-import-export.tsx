import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Upload, FileSpreadsheet, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadXLSX } from "@/lib/export";
import { logAction } from "@/lib/audit";
import { friendlyError } from "@/lib/errors";
import { BulkImportDialog, BulkMetric } from "@/components/bulk-import-dialog";
import { useLatestBulkJob, chunk } from "@/lib/bulk-import";
import { fetchAll } from "@/lib/fetch-all";
import { ATIVOS_COLUMNS } from "@/lib/import-templates";
import { garantirOpcoesCatalogo } from "@/lib/ativos-catalogo";


/**
 * Colunas do template de importação em massa de ativos.
 * A ordem aqui é a mesma usada no CSV de exportação e no arquivo de exemplo,
 * garantindo que um export possa ser re-importado sem edições estruturais.
 */
const COLUMNS = ATIVOS_COLUMNS;

type Col = (typeof COLUMNS)[number];
type RawRow = Partial<Record<Col, string>> & Record<string, string>;

const REQUIRED: Col[] = ["hostname"];
const STATUS_VALIDOS = new Set(["estoque", "em_uso", "manutencao", "baixado", "solicitado"]);
/** Aceita rótulos antigos usados em planilhas anteriores. */
const STATUS_ALIAS: Record<string, string> = { em_estoque: "estoque", em_manutencao: "manutencao" };

function nz(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

/* ------------------------ Exportar ------------------------ */

export async function exportAtivos() {
  const tid = toast.loading("Preparando exportação…");
  const { data, error } = await fetchAll<any>(
    "ativos",
    "hostname, tipo, categoria, marca, modelo, numero_patrimonio, numero_serie, setor, status_ciclo_vida, usuarios(email), clientes(nome)",
    (q) => q.order("hostname"),
    { onProgress: (n) => toast.loading(`Baixando dados… ${n} registro(s)`, { id: tid }) },
  );
  if (error) {
    toast.error(friendlyError(error), { id: tid });
    return;
  }
  const rows = (data ?? []).map((a: any) => [
    a.hostname ?? "",
    a.tipo ?? "",
    a.categoria ?? "",
    a.marca ?? "",
    a.modelo ?? "",
    a.numero_patrimonio ?? "",
    a.numero_serie ?? "",
    a.setor ?? "",
    a.status_ciclo_vida ?? "",
    a.usuarios?.email ?? "",
    a.clientes?.nome ?? "",
  ]);
  toast.loading("Gerando arquivo XLSX…", { id: tid });
  const fname = `ativos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadXLSX(fname, COLUMNS as unknown as string[], rows);
  void logAction("EXPORT", "ativos", { formato: "xlsx", total: rows.length, arquivo: fname });
  toast.success(`${rows.length} ativo(s) exportado(s).`, { id: tid });
}


export function downloadTemplate() {
  // Exemplo completo (todas as colunas preenchidas)
  const exemplo = [
    "NB-0001",
    "NOTEBOOK",
    "Microcomputador TIPO I",
    "Dell",
    "Latitude 5440",
    "PAT-000123",
    "SN123456789",
    "Financeiro",
    "em_uso",
    "colaborador@empresa.com",
    "MTR2.TECH",
  ];
  // Exemplo mínimo: apenas hostname — Tipo e Categoria são opcionais e ficam em branco.
  const exemploMinimo = COLUMNS.map((c) => (c === "hostname" ? "SEM-TIPO-0002" : ""));
  const vazia = COLUMNS.map(() => "");
  downloadXLSX("template_ativos.xlsx", COLUMNS as unknown as string[], [exemplo, exemploMinimo, vazia]);
  toast.success("Template baixado. Apenas hostname é obrigatório; Tipo, Categoria e Cliente podem ficar em branco.");
}


/* ------------------------ Importar ------------------------ */

type Report = {
  total: number;
  inseridos: number;
  atualizados: number;
  responsaveisNaoEncontrados: number;
  clientesNaoEncontrados: number;
  erros: { linha: number; motivo: string }[];
};

const BATCH = 200;

async function importarLinhas(
  rows: RawRow[],
  onProgress: (n: number) => void,
  setPhase: (p: string) => void,
): Promise<Report> {
  const rep: Report = {
    total: rows.length,
    inseridos: 0,
    atualizados: 0,
    responsaveisNaoEncontrados: 0,
    clientesNaoEncontrados: 0,
    erros: [],
  };

  setPhase("Carregando dados de referência…");
  // Cache de usuários, clientes e ativos existentes para reduzir round-trips.
  const [{ data: usuarios }, { data: clientes }, { data: existentes }] = await Promise.all([
    fetchAll<any>("usuarios", "id, email", (q) => q.not("email", "is", null)),
    fetchAll<any>("clientes", "id, nome", (q) => q.not("nome", "is", null)),
    fetchAll<any>("ativos", "id, hostname"),
  ]);
  const userByEmail = new Map<string, string>(
    (usuarios ?? []).filter((u: any) => u.email).map((u: any) => [u.email.toLowerCase(), u.id]),
  );
  const clienteByNome = new Map<string, string>(
    (clientes ?? []).filter((c: any) => c.nome).map((c: any) => [c.nome.trim().toLowerCase(), c.id]),
  );
  const ativoByHost = new Map<string, string>(
    (existentes ?? []).map((a: any) => [a.hostname.toLowerCase(), a.id]),
  );

  setPhase("Validando linhas…");
  type Prepared = { linha: number; payload: Record<string, any>; id?: string };
  const inserts: Prepared[] = [];
  const updates: Prepared[] = [];
  const vistos = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2;
    const r = rows[i];

    const faltando = REQUIRED.filter((req) => !nz(r[req]));
    if (faltando.length > 0) {
      rep.erros.push({ linha, motivo: `Campo obrigatório vazio: ${faltando.join(", ")}` });
      continue;
    }

    const hostname = nz(r.hostname)!;
    const tipo = nz(r.tipo);
    const statusBruto = nz(r.status_ciclo_vida) ?? "estoque";
    const status = STATUS_ALIAS[statusBruto] ?? statusBruto;
    if (!STATUS_VALIDOS.has(status)) {
      rep.erros.push({
        linha,
        motivo: `status_ciclo_vida inválido: ${status}. Use: ${Array.from(STATUS_VALIDOS).join(", ")}`,
      });
      continue;
    }

    let responsavelId: string | null = null;
    const email = nz(r.responsavel_email);
    if (email) {
      const found = userByEmail.get(email.toLowerCase());
      if (found) responsavelId = found;
      else rep.responsaveisNaoEncontrados++;
    }

    let clienteId: string | null = null;
    const clienteNome = nz(r.cliente);
    if (clienteNome) {
      const found = clienteByNome.get(clienteNome.toLowerCase());
      if (found) clienteId = found;
      else rep.clientesNaoEncontrados++;
    }

    const payload = {
      hostname,
      tipo,
      categoria: nz(r.categoria),
      marca: nz(r.marca),
      modelo: nz(r.modelo),
      numero_patrimonio: nz(r.numero_patrimonio),
      numero_serie: nz(r.numero_serie),
      setor: nz(r.setor),
      status_ciclo_vida: status,
      usuario_responsavel_id: responsavelId,
      cliente_id: clienteId,
    };

    const key = hostname.toLowerCase();
    if (vistos.has(key)) {
      rep.erros.push({ linha, motivo: `hostname duplicado no arquivo: ${hostname}` });
      continue;
    }
    vistos.add(key);

    const existenteId = ativoByHost.get(key);
    if (existenteId) updates.push({ linha, payload, id: existenteId });
    else inserts.push({ linha, payload });
  }

  // Garante que tipos/categorias novos existam no catálogo (Admin/Gestão).
  setPhase("Atualizando catálogo de tipos e categorias…");
  const todos = [...inserts, ...updates].map((p) => p.payload);
  await Promise.all([
    garantirOpcoesCatalogo("ativos_tipos", todos.map((p) => p.tipo).filter(Boolean) as string[]),
    garantirOpcoesCatalogo(
      "ativos_categorias",
      todos.map((p) => p.categoria).filter(Boolean) as string[],
    ),
  ]).catch(() => undefined);

  let feitos = rows.length - inserts.length - updates.length;
  onProgress(feitos);

  // Gravação em lotes — 1 requisição a cada BATCH linhas em vez de 1 por linha.
  setPhase(`Inserindo ${inserts.length} novo(s) ativo(s)…`);
  for (const lote of chunk(inserts, BATCH)) {
    const { error } = await supabase.from("ativos").insert(lote.map((p) => p.payload) as any);
    if (error) {
      // Fallback linha a linha apenas no lote com problema, para isolar o erro.
      for (const p of lote) {
        const { error: e2 } = await supabase.from("ativos").insert(p.payload as any);
        if (e2) rep.erros.push({ linha: p.linha, motivo: `Inserir: ${friendlyError(e2)}` });
        else rep.inseridos++;
        onProgress(++feitos);
      }
      continue;
    }
    rep.inseridos += lote.length;
    feitos += lote.length;
    onProgress(feitos);
  }

  setPhase(`Atualizando ${updates.length} ativo(s) existente(s)…`);
  for (const lote of chunk(updates, BATCH)) {
    const { error } = await supabase
      .from("ativos")
      .upsert(lote.map((p) => ({ id: p.id, ...p.payload })) as any, { onConflict: "id" });
    if (error) {
      for (const p of lote) {
        const { error: e2 } = await supabase.from("ativos").update(p.payload as any).eq("id", p.id!);
        if (e2) rep.erros.push({ linha: p.linha, motivo: `Atualizar: ${friendlyError(e2)}` });
        else rep.atualizados++;
        onProgress(++feitos);
      }
      continue;
    }
    rep.atualizados += lote.length;
    feitos += lote.length;
    onProgress(feitos);
  }

  void logAction("BULK_UPDATE", "ativos", {
    operacao: "importar_arquivo",
    total: rep.total,
    inseridos: rep.inseridos,
    atualizados: rep.atualizados,
    responsaveis_nao_encontrados: rep.responsaveisNaoEncontrados,
    clientes_nao_encontrados: rep.clientesNaoEncontrados,
    erros: rep.erros.length,
  });
  return rep;
}


/* ------------------------ Botão do cabeçalho ------------------------ */

export function AtivosImportExport({ canWrite, onImported }: { canWrite: boolean; onImported: () => void }) {
  const [open, setOpen] = React.useState(false);
  const job = useLatestBulkJob<Report>("ativos");
  const running = job?.status === "running";
  const unread = !!job && job.status !== "running" && !job.acknowledged;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            <FileSpreadsheet className="h-4 w-4" /> Importar / Exportar <ChevronDown className="h-3 w-3" />
            {(running || unread) && (
              <span
                className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
                  running ? "bg-primary animate-pulse" : "bg-[color:var(--success)]"
                }`}
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={() => void exportAtivos()}>
            <Download className="h-4 w-4" /> Exportar XLSX
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadTemplate()}>
            <FileSpreadsheet className="h-4 w-4" /> Baixar template
          </DropdownMenuItem>
          {canWrite && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOpen(true)}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Ver progresso ({job!.processed}/{job!.total})
                  </>
                ) : unread ? (
                  <>
                    <FileSpreadsheet className="h-4 w-4" /> Ver relatório da última importação
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Importar XLSX / CSV…
                  </>
                )}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BulkImportDialog<RawRow, Report>
        open={open}
        onOpenChange={setOpen}
        scope="ativos"
        title="Importar ativos"
        description="Envie um arquivo XLSX seguindo o template. Somente hostname é obrigatório — Tipo, Categoria e Cliente são opcionais e podem ficar em branco. Ativos existentes (mesmo hostname) são atualizados; novos são criados. O responsável é vinculado quando o e-mail já existe em Usuários; o cliente é vinculado quando o nome já existe em Clientes."
        requiredColumns={COLUMNS}
        previewColumns={["hostname", "tipo", "categoria", "marca", "modelo", "status_ciclo_vida", "cliente"]}
        renderPreviewCell={(r, c) =>
          c === "numero_patrimonio" ? <span className="font-mono">{r[c]}</span>
          : c === "tipo" && !(r[c] ?? "").trim() ? <span className="text-muted-foreground">Sem tipo</span>
          : c === "categoria" && !(r[c] ?? "").trim() ? <span className="text-muted-foreground">Sem categoria</span>
          : c === "cliente" && !(r[c] ?? "").trim() ? <span className="text-muted-foreground">Sem cliente</span>
          : r[c]
        }

        onTemplate={downloadTemplate}
        runImport={importarLinhas}
        successToast={(r) =>
          `Ativos: ${r.inseridos} inserido(s), ${r.atualizados} atualizado(s)${
            r.erros.length ? `, ${r.erros.length} erro(s)` : ""
          }.`
        }
        onDone={onImported}
        renderReport={(r) => (
          <>
            <div className="grid grid-cols-2 gap-2">
              <BulkMetric label="Linhas no arquivo" value={r.total} />
              <BulkMetric label="Ativos inseridos" value={r.inseridos} tone={r.inseridos > 0 ? "ok" : undefined} />
              <BulkMetric label="Ativos atualizados" value={r.atualizados} tone={r.atualizados > 0 ? "ok" : undefined} />
              <BulkMetric
                label="Responsáveis não encontrados"
                value={r.responsaveisNaoEncontrados}
                tone={r.responsaveisNaoEncontrados > 0 ? "warn" : undefined}
              />
              <BulkMetric
                label="Clientes não encontrados"
                value={r.clientesNaoEncontrados}
                tone={r.clientesNaoEncontrados > 0 ? "warn" : undefined}
              />
              <BulkMetric label="Linhas com erro" value={r.erros.length} tone={r.erros.length > 0 ? "danger" : undefined} />
            </div>
            {r.erros.length > 0 && (
              <div className="rounded-md border p-2 max-h-56 overflow-auto">
                <div className="font-medium mb-1">Erros</div>
                <ul className="space-y-1 text-xs">
                  {r.erros.map((e, i) => (
                    <li key={i}>Linha {e.linha}: <span className="text-destructive">{e.motivo}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      />
    </>
  );
}
