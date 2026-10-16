/** Valores monetários digitados em pt-BR ou vindos de células numéricas XLSX. */
export function parseValorAquisicao(raw: string): number | null {
  let value = raw.trim().replace(/^R\$\s*/, "").trim();
  if (!value) return null;
  if (value.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(value)) {
      throw new Error("Informe um valor de aquisição válido, como 4500,00.");
    }
    value = value.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Informe um valor de aquisição válido, sem valores negativos e com até duas casas decimais.");
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error("Valor de aquisição fora do limite permitido.");
  }
  return Math.round(number * 100) / 100;
}

export function valorAquisicaoImport(raw: string | undefined) {
  const value = parseValorAquisicao(raw ?? "");
  // Coluna ausente ou vazia nunca apaga um valor de compra já registrado.
  return value === null ? {} : { valor_aquisicao: value };
}

export function formatValorAquisicao(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}