/**
 * Definição central das colunas dos templates de importação/exportação em massa.
 * Mantido fora dos componentes para poder ser reutilizado em testes automatizados
 * sem carregar dependências de UI/Supabase.
 */

export const ATIVOS_COLUMNS = [
  "hostname",
  "tipo",
  "categoria",
  "marca",
  "modelo",
  "numero_patrimonio",
  "numero_serie",
  "setor",
  "status_ciclo_vida",
  "responsavel_email",
] as const;


export const LICENCAS_COLUMNS = [
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

export type AtivosCol = (typeof ATIVOS_COLUMNS)[number];
export type LicencasCol = (typeof LICENCAS_COLUMNS)[number];
