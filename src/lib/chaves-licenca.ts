import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { logAction } from "@/lib/audit";
import { friendlyError } from "@/lib/errors";

export type TipoLicenca = "OEM" | "Retail" | "Volume" | "CSP";
export type StatusChave = "disponivel" | "alocada" | "expirada" | "revogada";

export const TIPOS_LICENCA: TipoLicenca[] = ["OEM", "Retail", "Volume", "CSP"];

export const STATUS_CHAVE_LABEL: Record<StatusChave, string> = {
  disponivel: "Disponível",
  alocada: "Alocada",
  expirada: "Expirada",
  revogada: "Revogada",
};

export type Chave = {
  id: string;
  software: string;
  chave_ativacao: string;
  tipo_licenca: TipoLicenca;
  status: StatusChave;
  licenca_id: string | null;
  ativo_id: string | null;
  usuario_id: string | null;
  data_alocacao: string | null;
  data_expiracao: string | null;
  created_at?: string | null;
  ativos?: { hostname: string } | null;
  usuarios?: { nome: string } | null;
};

export type SaldoChaves = {
  licenca_id: string;
  produto_id: string | null;
  quantidade: number | null;
  chaves_cadastradas: number;
  chaves_disponiveis: number;
  chaves_alocadas: number;
  chaves_expiradas: number;
  chaves_pendentes: number;
};

const CHAVE_SELECT =
  "id, software, chave_ativacao, tipo_licenca, status, licenca_id, ativo_id, usuario_id, data_alocacao, data_expiracao, created_at, ativos(hostname), usuarios(nome)";

/** Todas as chaves do sistema — sem qualquer limite de linhas. */
export async function fetchChaves(modify?: (q: any) => any): Promise<Chave[]> {
  const { data, error } = await fetchAll<Chave>("licenses", CHAVE_SELECT, (q) => {
    const base = q.order("software", { ascending: true }).order("created_at", { ascending: false });
    return modify ? modify(base) : base;
  });
  if (error) throw error;
  return data;
}

/** Saldo (adquiridas x cadastradas x disponíveis x pendentes) por licença. */
export async function fetchSaldoChaves(): Promise<SaldoChaves[]> {
  const { data, error } = await fetchAll<SaldoChaves>("vw_licencas_chaves_saldo", "*");
  if (error) throw error;
  return data;
}

export function normalizaChave(v: string): string {
  return (v ?? "").trim();
}

export type LinhaLote = {
  chave: string;
  software?: string | null;
  tipo_licenca?: string | null;
  data_expiracao?: string | null;
};

export type RelatorioLote = {
  total: number;
  inseridas: number;
  falhas: { chave: string; motivo: string }[];
  saldoAntes: number;
  saldoDepois: number;
  limite: number | null;
};

/**
 * Cadastra chaves em lote para uma licença (bloco de compra).
 * Valida item a item: linhas inválidas não impedem a importação das demais.
 */
export async function inserirChavesEmLote(input: {
  licencaId: string | null;
  softwarePadrao: string;
  tipoPadrao: TipoLicenca;
  linhas: LinhaLote[];
}): Promise<RelatorioLote> {
  const { licencaId, softwarePadrao, tipoPadrao, linhas } = input;

  let limite: number | null = null;
  let cadastradas = 0;
  if (licencaId) {
    const { data: saldo } = await supabase
      .from("vw_licencas_chaves_saldo" as any)
      .select("quantidade, chaves_cadastradas")
      .eq("licenca_id", licencaId)
      .maybeSingle();
    limite = (saldo as any)?.quantidade ?? null;
    cadastradas = (saldo as any)?.chaves_cadastradas ?? 0;
  }

  const rep: RelatorioLote = {
    total: linhas.length,
    inseridas: 0,
    falhas: [],
    saldoAntes: cadastradas,
    saldoDepois: cadastradas,
    limite,
  };

  // Chaves já existentes no sistema (unicidade global).
  const existentes = new Set(
    (await fetchAll<{ chave_ativacao: string }>("licenses", "chave_ativacao")).data.map((r) =>
      r.chave_ativacao.trim().toLowerCase(),
    ),
  );

  const vistas = new Set<string>();
  const validas: { payload: Record<string, unknown>; chave: string }[] = [];

  for (const linha of linhas) {
    const chave = normalizaChave(linha.chave);
    if (!chave) {
      rep.falhas.push({ chave: "(vazia)", motivo: "Chave em branco" });
      continue;
    }
    const k = chave.toLowerCase();
    if (vistas.has(k)) {
      rep.falhas.push({ chave, motivo: "Chave repetida no próprio lote" });
      continue;
    }
    if (existentes.has(k)) {
      rep.falhas.push({ chave, motivo: "Chave já cadastrada no sistema" });
      continue;
    }
    const software = normalizaChave(linha.software ?? "") || softwarePadrao.trim();
    if (!software) {
      rep.falhas.push({ chave, motivo: "Software não informado" });
      continue;
    }
    if (limite != null && cadastradas + validas.length + 1 > limite) {
      rep.falhas.push({
        chave,
        motivo: `Quantidade excedida: a licença permite ${limite} chave(s)`,
      });
      continue;
    }
    const tipo = (linha.tipo_licenca ?? "").trim();
    vistas.add(k);
    validas.push({
      chave,
      payload: {
        software,
        chave_ativacao: chave,
        tipo_licenca: (TIPOS_LICENCA as string[]).includes(tipo) ? tipo : tipoPadrao,
        status: "disponivel",
        licenca_id: licencaId,
        data_expiracao: normalizaChave(linha.data_expiracao ?? "") || null,
      },
    });
  }

  // Insere em lotes; se o lote falhar, tenta linha a linha para atribuir o erro.
  for (let i = 0; i < validas.length; i += 100) {
    const lote = validas.slice(i, i + 100);
    const { error } = await supabase.from("licenses").insert(lote.map((v) => v.payload) as any);
    if (!error) {
      rep.inseridas += lote.length;
      continue;
    }
    for (const item of lote) {
      const { error: e2 } = await supabase.from("licenses").insert(item.payload as any);
      if (e2) rep.falhas.push({ chave: item.chave, motivo: friendlyError(e2) });
      else rep.inseridas++;
    }
  }

  rep.saldoDepois = rep.saldoAntes + rep.inseridas;

  void logAction("BULK_UPDATE", "licenses", {
    operacao: "insercao_lote_chaves",
    licenca_id: licencaId,
    total: rep.total,
    inseridas: rep.inseridas,
    falhas: rep.falhas.length,
  });

  return rep;
}

/** Devolve uma chave para o pool de disponíveis e encerra a alocação aberta. */
export async function desvincularChave(chaveId: string): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();

  const { error: errAloc } = await supabase
    .from("alocacoes")
    .update({ data_fim: now } as any)
    .eq("chave_id", chaveId)
    .is("data_fim", null);
  if (errAloc) return { ok: false, error: friendlyError(errAloc) };

  const { error } = await supabase
    .from("licenses")
    .update({ status: "disponivel", ativo_id: null, usuario_id: null, data_alocacao: null } as any)
    .eq("id", chaveId);
  if (error) return { ok: false, error: friendlyError(error) };

  void logAction("BULK_UPDATE", "licenses", { operacao: "desvincular_chave", chave_id: chaveId }, chaveId);
  return { ok: true };
}

/** Aloca uma chave disponível a um ativo, criando o vínculo e travando a chave. */
export async function alocarChave(input: {
  chaveId: string;
  ativoId: string;
  licencaId?: string | null;
  usuarioId?: string | null;
  observacao?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: chave, error: errSel } = await supabase
    .from("licenses")
    .select("id, status, licenca_id")
    .eq("id", input.chaveId)
    .maybeSingle();
  if (errSel) return { ok: false, error: friendlyError(errSel) };
  if (!chave) return { ok: false, error: "Chave não encontrada." };
  if ((chave as any).status !== "disponivel") {
    return { ok: false, error: "Esta chave não está disponível (já alocada, expirada ou revogada)." };
  }

  const licencaId = input.licencaId ?? (chave as any).licenca_id ?? null;

  const { error: errIns } = await supabase.from("alocacoes").insert({
    licenca_id: licencaId,
    ativo_id: input.ativoId,
    usuario_id: input.usuarioId ?? null,
    chave_id: input.chaveId,
    observacao: input.observacao ?? null,
  } as any);
  if (errIns) {
    if ((errIns as any).code === "23505") {
      return { ok: false, error: "Esta chave (ou licença) já está alocada a este ativo." };
    }
    return { ok: false, error: friendlyError(errIns) };
  }

  const { error: errUpd } = await supabase
    .from("licenses")
    .update({
      status: "alocada",
      ativo_id: input.ativoId,
      usuario_id: input.usuarioId ?? null,
      data_alocacao: hoje,
    } as any)
    .eq("id", input.chaveId)
    .eq("status", "disponivel");
  if (errUpd) return { ok: false, error: friendlyError(errUpd) };

  void logAction(
    "BULK_UPDATE",
    "alocacoes",
    { operacao: "alocar_chave", chave_id: input.chaveId, ativo_id: input.ativoId, licenca_id: licencaId },
    input.chaveId,
  );
  return { ok: true };
}

/** Aloca N chaves disponíveis de uma licença a N ativos diferentes. */
export async function alocarChavesEmLote(input: {
  licencaId: string | null;
  chaveIds: string[];
  ativoIds: string[];
}): Promise<{ alocadas: number; falhas: { ativoId: string; motivo: string }[] }> {
  const falhas: { ativoId: string; motivo: string }[] = [];
  let alocadas = 0;
  const pares = Math.min(input.chaveIds.length, input.ativoIds.length);
  for (let i = 0; i < pares; i++) {
    const r = await alocarChave({
      chaveId: input.chaveIds[i],
      ativoId: input.ativoIds[i],
      licencaId: input.licencaId,
      observacao: "Alocação em lote",
    });
    if (r.ok) alocadas++;
    else falhas.push({ ativoId: input.ativoIds[i], motivo: r.error ?? "Erro desconhecido" });
  }
  for (let i = pares; i < input.ativoIds.length; i++) {
    falhas.push({ ativoId: input.ativoIds[i], motivo: "Sem chave disponível suficiente" });
  }
  return { alocadas, falhas };
}
