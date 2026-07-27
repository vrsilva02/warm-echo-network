import * as React from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, Upload, FileSpreadsheet, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/export";
import { logAction } from "@/lib/audit";
import { friendlyError } from "@/lib/errors";

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
type RawRow = Partial<Record<Col, string>>;

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
  const fname = `licencas_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(fname, COLUMNS as unknown as string[], rows);
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
  downloadCSV("template_licencas.csv", COLUMNS as unknown as string[], [exemplo, vazia]);
  toast.success("Template baixado. Preencha e reimporte.");
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

async function importarLinhas(rows: RawRow[]): Promise<Report> {
  const rep: Report = { total: rows.length, inseridas: 0, produtosCriados: 0, fabricantesCriados: 0, contratosNaoEncontrados: 0, erros: [] };

  // Cache dos catálogos para reduzir round-trips.
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
    const linha = i + 2; // +1 header, +1 base 1
    const r = rows[i];

    // Validação de obrigatórios.
    for (const req of REQUIRED) {
      if (!nz(r[req])) {
        rep.erros.push({ linha, motivo: `Campo obrigatório vazio: ${req}` });
      }
    }
    if (rep.erros.at(-1)?.linha === linha) continue;

    const fabricanteNome = nz(r.fabricante)!;
    const produtoNome = nz(r.produto)!;
    const quantidade = toInt(r.quantidade);
    if (!quantidade || quantidade <= 0) {
      rep.erros.push({ linha, motivo: "quantidade deve ser um número inteiro > 0" });
      continue;
    }

    // Fabricante — cria se não existir.
    let fabricanteId = fabByName.get(fabricanteNome.toLowerCase());
    if (!fabricanteId) {
      const { data, error } = await supabase.from("fabricantes").insert({ nome: fabricanteNome }).select("id").single();
      if (error) { rep.erros.push({ linha, motivo: `Fabricante: ${friendlyError(error)}` }); continue; }
      fabricanteId = data!.id;
      fabByName.set(fabricanteNome.toLowerCase(), fabricanteId);
      rep.fabricantesCriados++;
    }

    // Produto — cria se não existir.
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
      if (error) { rep.erros.push({ linha, motivo: `Produto: ${friendlyError(error)}` }); continue; }
      produtoId = data!.id;
      prodByKey.set(prodKey, produtoId);
      rep.produtosCriados++;
    }

    // Contrato — apenas vincula se existir; nunca cria (faltam campos obrigatórios).
    let contratoId: string | null = null;
    const numContrato = nz(r.numero_contrato);
    if (numContrato) {
      const found = contratoByNumero.get(numContrato.toLowerCase());
      if (found) contratoId = found;
      else rep.contratosNaoEncontrados++;
    }

    // Insere licença.
    const dataExp = toDate(r.data_expiracao);
    if (nz(r.data_expiracao) && !dataExp) {
      rep.erros.push({ linha, motivo: "data_expiracao inválida (use AAAA-MM-DD)" });
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
    if (insErr) { rep.erros.push({ linha, motivo: `Licença: ${friendlyError(insErr)}` }); continue; }
    rep.inseridas++;
  }

  void logAction("BULK_UPDATE", "licencas", {
    operacao: "importar_csv",
    total: rep.total,
    inseridas: rep.inseridas,
    fabricantes_criados: rep.fabricantesCriados,
    produtos_criados: rep.produtosCriados,
    contratos_nao_encontrados: rep.contratosNaoEncontrados,
    erros: rep.erros.length,
  });
  return rep;
}

function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<RawRow[] | null>(null);
  const [parseErr, setParseErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [report, setReport] = React.useState<Report | null>(null);

  function reset() {
    setFile(null); setPreview(null); setParseErr(null); setBusy(false); setProgress(0); setReport(null);
  }

  function onPick(f: File | null) {
    reset();
    if (!f) return;
    setFile(f);
    Papa.parse<RawRow>(f, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const cols = res.meta.fields ?? [];
        const faltando = COLUMNS.filter((c) => !cols.includes(c));
        if (faltando.length > 0) {
          setParseErr(`Colunas ausentes: ${faltando.join(", ")}. Baixe o template para o formato correto.`);
          return;
        }
        const rows = (res.data as RawRow[]).filter((r) => Object.values(r).some((v) => (v ?? "").toString().trim() !== ""));
        setPreview(rows);
      },
      error: (err) => setParseErr(err.message),
    });
  }

  async function confirmar() {
    if (!preview || preview.length === 0) return;
    setBusy(true);
    setProgress(5);
    try {
      const rep = await importarLinhas(preview);
      setProgress(100);
      setReport(rep);
      if (rep.inseridas > 0) toast.success(`${rep.inseridas} licença(s) importada(s).`);
      if (rep.erros.length > 0) toast.warning(`${rep.erros.length} linha(s) com erro. Verifique o relatório.`);
      onDone();
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) { reset(); onOpenChange(false); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar licenças</DialogTitle>
          <DialogDescription>
            Envie um CSV seguindo o template. Fabricantes e produtos ausentes são criados automaticamente; contratos são vinculados apenas se o número já existir no sistema.
          </DialogDescription>
        </DialogHeader>

        {!report && (
          <div className="space-y-3">
            <div className="rounded-md border p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{file?.name ?? "Nenhum arquivo selecionado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate()}>
                  <Download className="h-4 w-4" /> Template
                </Button>
                <label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                  />
                  <Button asChild size="sm">
                    <span><Upload className="h-4 w-4" /> Escolher CSV</span>
                  </Button>
                </label>
              </div>
            </div>

            {parseErr && <div className="text-sm text-destructive">{parseErr}</div>}

            {preview && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <div className="font-medium">Pré-visualização</div>
                <div className="text-muted-foreground">
                  {preview.length} linha(s) prontas para importar. Colunas obrigatórias validadas no envio.
                </div>
                <div className="max-h-48 overflow-auto mt-2 text-xs">
                  <table className="w-full">
                    <thead className="bg-background sticky top-0">
                      <tr>
                        {(["produto", "fabricante", "categoria", "quantidade", "data_expiracao"] as Col[]).map((c) => (
                          <th key={c} className="text-left font-medium px-2 py-1 border-b">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 10).map((r, i) => (
                        <tr key={i} className="odd:bg-muted/30">
                          <td className="px-2 py-1">{r.produto}</td>
                          <td className="px-2 py-1">{r.fabricante}</td>
                          <td className="px-2 py-1">{r.categoria}</td>
                          <td className="px-2 py-1 tabular-nums">{r.quantidade}</td>
                          <td className="px-2 py-1">{r.data_expiracao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 10 && (
                    <div className="text-muted-foreground mt-1">…e mais {preview.length - 10} linha(s).</div>
                  )}
                </div>
              </div>
            )}

            {busy && <Progress value={progress} />}
          </div>
        )}

        {report && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Linhas no arquivo" value={report.total} />
              <Metric label="Licenças inseridas" value={report.inseridas} tone={report.inseridas > 0 ? "ok" : undefined} />
              <Metric label="Produtos criados" value={report.produtosCriados} />
              <Metric label="Fabricantes criados" value={report.fabricantesCriados} />
              <Metric label="Contratos não encontrados" value={report.contratosNaoEncontrados} tone={report.contratosNaoEncontrados > 0 ? "warn" : undefined} />
              <Metric label="Linhas com erro" value={report.erros.length} tone={report.erros.length > 0 ? "danger" : undefined} />
            </div>
            {report.erros.length > 0 && (
              <div className="rounded-md border p-2 max-h-56 overflow-auto">
                <div className="font-medium mb-1">Erros</div>
                <ul className="space-y-1 text-xs">
                  {report.erros.map((e, i) => (
                    <li key={i}>Linha {e.linha}: <span className="text-destructive">{e.motivo}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {report ? (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={busy}>Cancelar</Button>
              <Button onClick={confirmar} disabled={!preview || preview.length === 0 || busy}>
                {busy ? "Importando…" : `Importar ${preview?.length ?? 0} linha(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "danger" }) {
  const cls =
    tone === "ok" ? "text-emerald-600"
    : tone === "warn" ? "text-[color:var(--warning)]"
    : tone === "danger" ? "text-destructive"
    : "";
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

/* ------------------------ Botão do cabeçalho ------------------------ */

export function LicencasImportExport({ canWrite, onImported }: { canWrite: boolean; onImported: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4" /> Importar / Exportar <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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
                <Upload className="h-4 w-4" /> Importar CSV…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportDialog open={open} onOpenChange={setOpen} onDone={onImported} />
    </>
  );
}
