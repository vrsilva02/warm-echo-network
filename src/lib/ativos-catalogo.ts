import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ATIVO_TIPOS, ATIVO_CATEGORIAS } from "@/lib/ativos-opcoes";

/**
 * Catálogo dinâmico de Tipo e Categoria de ativos.
 * As listas ficam no banco (`ativos_tipos` / `ativos_categorias`) e podem ser
 * ampliadas por Admin/Gestão diretamente no formulário de ativo.
 */

export type CatalogoTabela = "ativos_tipos" | "ativos_categorias";

async function listar(tabela: CatalogoTabela, fallback: readonly string[]) {
  const { data, error } = await supabase
    .from(tabela)
    .select("nome")
    .eq("ativo", true)
    .order("nome");
  if (error || !data) return [...fallback];
  return data.map((r) => r.nome as string);
}

export function useAtivoTipos() {
  return useQuery({
    queryKey: ["catalogo", "ativos_tipos"],
    queryFn: () => listar("ativos_tipos", ATIVO_TIPOS),
    staleTime: 60_000,
  });
}

export function useAtivoCategorias() {
  return useQuery({
    queryKey: ["catalogo", "ativos_categorias"],
    queryFn: () => listar("ativos_categorias", ATIVO_CATEGORIAS),
    staleTime: 60_000,
  });
}

/**
 * Cria uma opção no catálogo. Se já existir (case-insensitive), reaproveita o
 * registro existente e devolve o nome canônico gravado no banco.
 */
export async function criarOpcaoCatalogo(
  tabela: CatalogoTabela,
  nomeBruto: string,
): Promise<string> {
  const nome = nomeBruto.trim();
  if (!nome) throw new Error("Informe um nome válido.");

  const { data: existente } = await supabase
    .from(tabela)
    .select("nome")
    .ilike("nome", nome)
    .maybeSingle();
  if (existente?.nome) return existente.nome as string;

  const { data, error } = await supabase
    .from(tabela)
    .insert({ nome })
    .select("nome")
    .single();

  if (error) {
    // Corrida com outro usuário: reaproveita o registro já criado.
    const { data: dup } = await supabase.from(tabela).select("nome").ilike("nome", nome).maybeSingle();
    if (dup?.nome) return dup.nome as string;
    throw new Error(error.message);
  }
  return data.nome as string;
}

/** Garante que todos os nomes informados existam no catálogo (usado na importação). */
export async function garantirOpcoesCatalogo(tabela: CatalogoTabela, nomes: string[]) {
  const limpos = Array.from(
    new Map(nomes.map((n) => n.trim()).filter(Boolean).map((n) => [n.toLowerCase(), n])).values(),
  );
  if (limpos.length === 0) return;

  const { data: atuais } = await supabase.from(tabela).select("nome");
  const existentes = new Set((atuais ?? []).map((r) => (r.nome as string).toLowerCase()));
  const faltantes = limpos.filter((n) => !existentes.has(n.toLowerCase()));
  if (faltantes.length === 0) return;

  await supabase.from(tabela).insert(faltantes.map((nome) => ({ nome })));
}

export function useInvalidateCatalogo() {
  const qc = useQueryClient();
  return (tabela: CatalogoTabela) => qc.invalidateQueries({ queryKey: ["catalogo", tabela] });
}
