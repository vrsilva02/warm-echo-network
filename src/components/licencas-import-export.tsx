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
import { useLatestBulkJob } from "@/lib/bulk-import";

/**
 * Colunas do template de importação em massa de licenças.
 * A ordem aqui é a mesma usada no CSV de exportação e no arquivo de exemplo,
 * garantindo que um export possa ser re-importado sem edições estruturais.
 */
const COLUMNS = [
  "fabricante",
  "produto",
  "categoria",
  "modelo_licenciamento",
  "tipo_licenciamento",
  "subtipo",
  "numero_contrato",
  "quantidade",
  "custo_unitario",
  "chave_ativacao",
  "tipo_ativacao",
  "numero_certificado",
  "data_expiracao",
  "limite_workstations",
  "limite_file_servers",
  "dias_carencia",
  "politica_grupo",
] as const;

type Col = (typeof COLUMNS)[number];
type RawRow = Partial<Record<Col, string>> & Record<string, string>;

const REQUIRED: Col[] = ["fabricante", "produto", "categoria", "modelo_licenciamento", "tipo_licenciamento", "quantidade"];

function toInt(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = parseInt(v.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function toNum(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function toDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}
function nz(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

/* ------------------------ Exportar ------------------------ */

export async function exportLicencas() {
  const { data, error } = await supabase
    .from("licencas")
    .select(
      "quantidade, custo_unitario, chave_ativacao, tipo_ativacao, numero_certificado, data_expiracao, limite_workstations, limite_file_servers, dias_carencia, politica_grupo, produtos_catalogo(nome_oficial, categoria, modelo_licenciamento, tipo_licenciamento, subtipo, fabricantes(nome)), contratos(numero_contrato)",
    );
  if (error) {
    toast.error(friendlyError(error));
    return;
  }
  const rows = (data ?? []).map((l: any) => [
    l.produtos_catalogo?.fabricantes?.nome ?? "",
    l.produtos_catalogo?.nome_oficial ?? "",
    l.produtos_catalogo?.categoria ?? "",
    l.produtos_catalogo?.modelo_licenciamento ?? "",
    l.produtos_catalogo?.tipo_licenciamento ?? "",
    l.produtos_catalogo?.subtipo ?? "",
    l.contratos?.numero_contrato ?? "",
    l.quantidade ?? 0,
    l.custo_unitario ?? "",
    l.chave_ativacao ?? "",
    l.tipo_ativacao ?? "",
    l.numero_certificado ?? "",
    l.data_expiracao ?? "",
    l.limite_workstations ?? "",
    l.limite_file_servers ?? "",
    l.dias_carencia ?? "",
    l.politica_grupo ?? "",
  ]);
  const fname = `licencas_${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadXLSX(fname, COLUMNS as unknown as string[], rows);
  void logAction("EXPORT", "licencas", { formato: "csv", total: rows.length, arquivo: fname });
  toast.success(`${rows.length} licença(s) exportada(s).`);
}

export function downloadTemplate() {
  const exemplo = [
    "Microsoft",
    "Windows 11 Pro",
    "Sistema Operacional",
    "Volume",
    "MAK",
    "",
    "CT-2025-001",
    "50",
    "45.90",
    "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "chave_ativacao",
    "",
    "2026-12-31",
    "",
    "",
    "0",
    "",
  ];
  const vazia = COLUMNS.map(() => "");
  downloadXLSX("template_licencas.xlsx", COLUMNS as unknown as string[], [exemplo, vazia]);
  toast.success("Template baixado. Preencha e reimporte (CSV ou XLSX).");
}

/* ------------------------ Importar ------------------------ */

type Report = {
  total: number;
  inseridas: number;
  produtosCriados: number;
  fabricantesCriados: number;
  contratosNaoEncontrados: number;
  erros: { linha: number; motivo: string }[];
};

async function importarLinhas(rows: RawRow[], onProgress: (n: number) => void): Promise<Report> {
  const rep: Report = {
    total: rows.length,
    inseridas: 0,
    produtosCriados: 0,
    fabricantesCriados: 0,
    contratosNaoEncontrados: 0,
    erros: [],
  };

  const [{ data: fabs }, { data: prods }, { data: contratos }] = await Promise.all([
    supabase.from("fabricantes").select("id, nome"),
    supabase.from("produtos_catalogo").select("id, nome_oficial, fabricante_id"),
    supabase.from("contratos").select("id, numero_contrato"),
  ]);
  const fabByName = new Map<string, string>((fabs ?? []).map((f: any) => [f.nome.toLowerCase(), f.id]));
  const prodByKey = new Map<string, string>(
    (prods ?? []).map((p: any) => [`${p.fabricante_id ?? ""}||${p.nome_oficial.toLowerCase()}`, p.id]),
  );
  const contratoByNumero = new Map<string, string>(
    (contratos ?? []).filter((c: any) => c.numero_contrato).map((c: any) => [c.numero_contrato.toLowerCase(), c.id]),
  );

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2;
    const r = rows[i];

    for (const req of REQUIRED) {
      if (!nz(r[req])) {
        rep.erros.push({ linha, motivo: `Campo obrigatório vazio: ${req}` });
      }
    }
    if (rep.erros.at(-1)?.linha === linha) { onProgress(i + 1); continue; }

    const fabricanteNome = nz(r.fabricante)!;
    const produtoNome = nz(r.produto)!;
    const quantidade = toInt(r.quantidade);
    if (!quantidade || quantidade <= 0) {
      rep.erros.push({ linha, motivo: "quantidade deve ser um número inteiro > 0" });
      onProgress(i + 1);
      continue;
    }

    let fabricanteId = fabByName.get(fabricanteNome.toLowerCase());
    if (!fabricanteId) {
      const { data, error } = await supabase.from("fabricantes").insert({ nome: fabricanteNome }).select("id").single();
      if (error) { rep.erros.push({ linha, motivo: `Fabricante: ${friendlyError(error)}` }); onProgress(i + 1); continue; }
      fabricanteId = data!.id;
      fabByName.set(fabricanteNome.toLowerCase(), fabricanteId);
      rep.fabricantesCriados++;
    }

    const prodKey = `${fabricanteId}||${produtoNome.toLowerCase()}`;
    let produtoId = prodByKey.get(prodKey);
    if (!produtoId) {
      const { data, error } = await supabase
        .from("produtos_catalogo")
        .insert({
          nome_oficial: produtoNome,
          fabricante_id: fabricanteId,
          categoria: nz(r.categoria)!,
          modelo_licenciamento: nz(r.modelo_licenciamento)!,
          tipo_licenciamento: nz(r.tipo_licenciamento)!,
          subtipo: nz(r.subtipo),
        })
        .select("id")
        .single();
      if (error) { rep.erros.push({ linha, motivo: `Produto: ${friendlyError(error)}` }); onProgress(i + 1); continue; }
      produtoId = data!.id;
      prodByKey.set(prodKey, produtoId);
      rep.produtosCriados++;
    }

    let contratoId: string | null = null;
    const numContrato = nz(r.numero_contrato);
    if (numContrato) {
      const found = contratoByNumero.get(numContrato.toLowerCase());
      if (found) contratoId = found;
      else rep.contratosNaoEncontrados++;
    }

    const dataExp = toDate(r.data_expiracao);
    if (nz(r.data_expiracao) && !dataExp) {
      rep.erros.push({ linha, motivo: "data_expiracao inválida (use AAAA-MM-DD)" });
      onProgress(i + 1);
      continue;
    }
    const { error: insErr } = await supabase.from("licencas").insert({
      produto_id: produtoId,
      contrato_id: contratoId,
      quantidade,
      custo_unitario: toNum(r.custo_unitario),
      chave_ativacao: nz(r.chave_ativacao),
      tipo_ativacao: nz(r.tipo_ativacao),
      numero_certificado: nz(r.numero_certificado),
      data_expiracao: dataExp,
      limite_workstations: toInt(r.limite_workstations),
      limite_file_servers: toInt(r.limite_file_servers),
      dias_carencia: toInt(r.dias_carencia) ?? 0,
      politica_grupo: nz(r.politica_grupo),
    });
    if (insErr) { rep.erros.push({ linha, motivo: `Licença: ${friendlyError(insErr)}` }); onProgress(i + 1); continue; }
    rep.inseridas++;
    onProgress(i + 1);
  }

  void logAction("BULK_UPDATE", "licencas", {
    operacao: "importar_arquivo",
    total: rep.total,
    inseridas: rep.inseridas,
    fabricantes_criados: rep.fabricantesCriados,
    produtos_criados: rep.produtosCriados,
    contratos_nao_encontrados: rep.contratosNaoEncontrados,
    erros: rep.erros.length,
  });
  return rep;
}

/* ------------------------ Botão do cabeçalho ------------------------ */

export function LicencasImportExport({ canWrite, onImported }: { canWrite: boolean; onImported: () => void }) {
  const [open, setOpen] = React.useState(false);
  const job = useLatestBulkJob<Report>("licencas");
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
          <DropdownMenuItem onClick={() => void exportLicencas()}>
            <Download className="h-4 w-4" /> Exportar CSV
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
                    <Upload className="h-4 w-4" /> Importar CSV / XLSX…
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
        scope="licencas"
        title="Importar licenças"
        description="Envie um arquivo CSV ou XLSX seguindo o template. Fabricantes e produtos ausentes são criados automaticamente; contratos são vinculados apenas se o número já existir no sistema."
        requiredColumns={COLUMNS}
        previewColumns={["produto", "fabricante", "categoria", "quantidade", "data_expiracao"]}
        renderPreviewCell={(r, c) =>
          c === "quantidade" ? <span className="tabular-nums">{r[c]}</span> : r[c]
        }
        onTemplate={downloadTemplate}
        runImport={importarLinhas}
        successToast={(r) =>
          `Licenças: ${r.inseridas} inserida(s)${r.erros.length ? `, ${r.erros.length} erro(s)` : ""}.`
        }
        onDone={onImported}
        renderReport={(r) => (
          <>
            <div className="grid grid-cols-2 gap-2">
              <BulkMetric label="Linhas no arquivo" value={r.total} />
              <BulkMetric label="Licenças inseridas" value={r.inseridas} tone={r.inseridas > 0 ? "ok" : undefined} />
              <BulkMetric label="Produtos criados" value={r.produtosCriados} />
              <BulkMetric label="Fabricantes criados" value={r.fabricantesCriados} />
              <BulkMetric
                label="Contratos não encontrados"
                value={r.contratosNaoEncontrados}
                tone={r.contratosNaoEncontrados > 0 ? "warn" : undefined}
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
