export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alocacoes: {
        Row: {
          ativo_id: string | null
          chave_individual: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          id: string
          licenca_id: string | null
          observacao: string | null
          usuario_id: string | null
        }
        Insert: {
          ativo_id?: string | null
          chave_individual?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          licenca_id?: string | null
          observacao?: string | null
          usuario_id?: string | null
        }
        Update: {
          ativo_id?: string | null
          chave_individual?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          licenca_id?: string | null
          observacao?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alocacoes_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_gap_edr"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "alocacoes_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_tco_ativo"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "alocacoes_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "licencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "vw_licencas_indicadores"
            referencedColumns: ["licenca_id"]
          },
          {
            foreignKeyName: "alocacoes_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "vw_licencas_ociosas"
            referencedColumns: ["licenca_id"]
          },
          {
            foreignKeyName: "alocacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_licenses: {
        Row: {
          asset_id: string
          assigned_at: string | null
          assigned_by: string | null
          id: string
          license_id: string
          removed_at: string | null
          removed_by: string | null
          status: string | null
        }
        Insert: {
          asset_id: string
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          license_id: string
          removed_at?: string | null
          removed_by?: string | null
          status?: string | null
        }
        Update: {
          asset_id?: string
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          license_id?: string
          removed_at?: string | null
          removed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_licenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_licenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "vw_gap_edr"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "asset_licenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "vw_tco_ativo"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "asset_licenses_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_licenses_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "vw_licencas_indicadores"
            referencedColumns: ["licenca_id"]
          },
          {
            foreignKeyName: "asset_licenses_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "vw_licencas_ociosas"
            referencedColumns: ["licenca_id"]
          },
        ]
      }
      ativos: {
        Row: {
          categoria: string | null
          centro_custo_id: string | null
          cliente_id: string | null
          created_at: string | null
          data_aquisicao: string | null
          data_fim_garantia: string | null
          data_ultima_transicao: string | null
          hostname: string
          id: string
          marca: string | null
          modelo: string | null
          numero_patrimonio: string | null
          numero_serie: string | null
          setor: string | null
          status_ciclo_vida: string
          tipo: string | null
          unidade_id: string | null
          updated_at: string | null
          usuario_responsavel_id: string | null
          valor_aquisicao: number | null
          vida_util_meses: number | null
        }
        Insert: {
          categoria?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_aquisicao?: string | null
          data_fim_garantia?: string | null
          data_ultima_transicao?: string | null
          hostname: string
          id?: string
          marca?: string | null
          modelo?: string | null
          numero_patrimonio?: string | null
          numero_serie?: string | null
          setor?: string | null
          status_ciclo_vida?: string
          tipo?: string | null
          unidade_id?: string | null
          updated_at?: string | null
          usuario_responsavel_id?: string | null
          valor_aquisicao?: number | null
          vida_util_meses?: number | null
        }
        Update: {
          categoria?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_aquisicao?: string | null
          data_fim_garantia?: string | null
          data_ultima_transicao?: string | null
          hostname?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          numero_patrimonio?: string | null
          numero_serie?: string | null
          setor?: string | null
          status_ciclo_vida?: string
          tipo?: string | null
          unidade_id?: string | null
          updated_at?: string | null
          usuario_responsavel_id?: string | null
          valor_aquisicao?: number | null
          vida_util_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ativos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_usuario_responsavel_id_fkey"
            columns: ["usuario_responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ativos_historico_status: {
        Row: {
          ativo_id: string | null
          data_transicao: string | null
          id: string
          observacao: string | null
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          ativo_id?: string | null
          data_transicao?: string | null
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          ativo_id?: string | null
          data_transicao?: string | null
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ativos_historico_status_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_historico_status_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_gap_edr"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "ativos_historico_status_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_tco_ativo"
            referencedColumns: ["ativo_id"]
          },
        ]
      }
      ativos_relacionamentos: {
        Row: {
          ativo_filho_id: string | null
          ativo_pai_id: string | null
          created_at: string
          id: string
          tipo_relacao: string | null
        }
        Insert: {
          ativo_filho_id?: string | null
          ativo_pai_id?: string | null
          created_at?: string
          id?: string
          tipo_relacao?: string | null
        }
        Update: {
          ativo_filho_id?: string | null
          ativo_pai_id?: string | null
          created_at?: string
          id?: string
          tipo_relacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ativos_relacionamentos_ativo_filho_id_fkey"
            columns: ["ativo_filho_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_relacionamentos_ativo_filho_id_fkey"
            columns: ["ativo_filho_id"]
            isOneToOne: false
            referencedRelation: "vw_gap_edr"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "ativos_relacionamentos_ativo_filho_id_fkey"
            columns: ["ativo_filho_id"]
            isOneToOne: false
            referencedRelation: "vw_tco_ativo"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "ativos_relacionamentos_ativo_pai_id_fkey"
            columns: ["ativo_pai_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_relacionamentos_ativo_pai_id_fkey"
            columns: ["ativo_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_gap_edr"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "ativos_relacionamentos_ativo_pai_id_fkey"
            columns: ["ativo_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_tco_ativo"
            referencedColumns: ["ativo_id"]
          },
        ]
      }
      ativos_servicos: {
        Row: {
          ativo_id: string | null
          created_at: string
          id: string
          servico_id: string | null
          tipo_dependencia: string | null
        }
        Insert: {
          ativo_id?: string | null
          created_at?: string
          id?: string
          servico_id?: string | null
          tipo_dependencia?: string | null
        }
        Update: {
          ativo_id?: string | null
          created_at?: string
          id?: string
          servico_id?: string | null
          tipo_dependencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ativos_servicos_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_servicos_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_gap_edr"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "ativos_servicos_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_tco_ativo"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "ativos_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_convites: {
        Row: {
          convite_id: string | null
          created_at: string | null
          detalhes: Json | null
          evento: string
          id: string
        }
        Insert: {
          convite_id?: string | null
          created_at?: string | null
          detalhes?: Json | null
          evento: string
          id?: string
        }
        Update: {
          convite_id?: string | null
          created_at?: string | null
          detalhes?: Json | null
          evento?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_convites_convite_id_fkey"
            columns: ["convite_id"]
            isOneToOne: false
            referencedRelation: "convites"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_log: {
        Row: {
          acao: string
          created_at: string | null
          id: string
          registro_id: string | null
          tabela_afetada: string
          usuario_sistema: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          id?: string
          registro_id?: string | null
          tabela_afetada: string
          usuario_sistema?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          id?: string
          registro_id?: string | null
          tabela_afetada?: string
          usuario_sistema?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          codigo: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          codigo: string | null
          contato: string | null
          created_at: string
          documento: string | null
          email: string | null
          id: string
          nome: string
          observacao: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          contato?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          nome: string
          observacao?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          contato?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contratos: {
        Row: {
          centro_custo_id: string | null
          cliente_id: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          fornecedor: string
          id: string
          numero_contrato: string | null
          quantidade_seats: number
          tipo_contrato: string | null
          unidade_id: string | null
          valor_total: number | null
        }
        Insert: {
          centro_custo_id?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          fornecedor: string
          id?: string
          numero_contrato?: string | null
          quantidade_seats?: number
          tipo_contrato?: string | null
          unidade_id?: string | null
          valor_total?: number | null
        }
        Update: {
          centro_custo_id?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          fornecedor?: string
          id?: string
          numero_contrato?: string | null
          quantidade_seats?: number
          tipo_contrato?: string | null
          unidade_id?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_aditivos: {
        Row: {
          contrato_id: string
          created_at: string
          criado_por: string | null
          delta_seats: number | null
          delta_valor: number | null
          descricao: string | null
          id: string
          nova_data_fim: string | null
          numero: string
          tipo: Database["public"]["Enums"]["aditivo_tipo"]
          updated_at: string
        }
        Insert: {
          contrato_id: string
          created_at?: string
          criado_por?: string | null
          delta_seats?: number | null
          delta_valor?: number | null
          descricao?: string | null
          id?: string
          nova_data_fim?: string | null
          numero: string
          tipo: Database["public"]["Enums"]["aditivo_tipo"]
          updated_at?: string
        }
        Update: {
          contrato_id?: string
          created_at?: string
          criado_por?: string | null
          delta_seats?: number | null
          delta_valor?: number | null
          descricao?: string | null
          id?: string
          nova_data_fim?: string | null
          numero?: string
          tipo?: Database["public"]["Enums"]["aditivo_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "vw_contratos_vencendo"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          aceito_em: string | null
          created_at: string | null
          email: string
          enviado_por: string | null
          erro: string | null
          expira_em: string | null
          id: string
          nome: string | null
          roles: Database["public"]["Enums"]["app_role"][]
          status: Database["public"]["Enums"]["status_convite"]
          token: string | null
          updated_at: string | null
        }
        Insert: {
          aceito_em?: string | null
          created_at?: string | null
          email: string
          enviado_por?: string | null
          erro?: string | null
          expira_em?: string | null
          id?: string
          nome?: string | null
          roles: Database["public"]["Enums"]["app_role"][]
          status?: Database["public"]["Enums"]["status_convite"]
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          aceito_em?: string | null
          created_at?: string | null
          email?: string
          enviado_por?: string | null
          erro?: string | null
          expira_em?: string | null
          id?: string
          nome?: string | null
          roles?: Database["public"]["Enums"]["app_role"][]
          status?: Database["public"]["Enums"]["status_convite"]
          token?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          criado_por: string | null
          custo_unitario: number | null
          id: string
          observacao: string | null
          ordem_servico_id: string | null
          origem: string
          peca_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["mov_tipo"]
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          custo_unitario?: number | null
          id?: string
          observacao?: string | null
          ordem_servico_id?: string | null
          origem?: string
          peca_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["mov_tipo"]
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          custo_unitario?: number | null
          id?: string
          observacao?: string | null
          ordem_servico_id?: string | null
          origem?: string
          peca_id?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["mov_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "vw_estoque_saldo"
            referencedColumns: ["peca_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "vw_pecas_reposicao"
            referencedColumns: ["peca_id"]
          },
        ]
      }
      fabricantes: {
        Row: {
          created_at: string | null
          criticidade: number
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          criticidade?: number
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          criticidade?: number
          id?: string
          nome?: string
        }
        Relationships: []
      }
      inventario_importado: {
        Row: {
          data_importacao: string | null
          data_ultima_comunicacao: string | null
          hostname: string | null
          id: string
          origem: string
          produto_id: string | null
          produto_nome_bruto: string
          reconciliado: boolean | null
        }
        Insert: {
          data_importacao?: string | null
          data_ultima_comunicacao?: string | null
          hostname?: string | null
          id?: string
          origem: string
          produto_id?: string | null
          produto_nome_bruto: string
          reconciliado?: boolean | null
        }
        Update: {
          data_importacao?: string | null
          data_ultima_comunicacao?: string | null
          hostname?: string | null
          id?: string
          origem?: string
          produto_id?: string | null
          produto_nome_bruto?: string
          reconciliado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "inventario_importado_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_importado_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_elp"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "inventario_importado_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_ociosidade_financeira"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      licencas: {
        Row: {
          chave_ativacao: string | null
          cliente_id: string | null
          contrato_id: string | null
          created_at: string | null
          custo_unitario: number | null
          data_expiracao: string | null
          dias_carencia: number | null
          id: string
          limite_file_servers: number | null
          limite_workstations: number | null
          numero_certificado: string | null
          politica_grupo: string | null
          produto_id: string | null
          quantidade: number
          tipo_ativacao: string | null
        }
        Insert: {
          chave_ativacao?: string | null
          cliente_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          custo_unitario?: number | null
          data_expiracao?: string | null
          dias_carencia?: number | null
          id?: string
          limite_file_servers?: number | null
          limite_workstations?: number | null
          numero_certificado?: string | null
          politica_grupo?: string | null
          produto_id?: string | null
          quantidade?: number
          tipo_ativacao?: string | null
        }
        Update: {
          chave_ativacao?: string | null
          cliente_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          custo_unitario?: number | null
          data_expiracao?: string | null
          dias_carencia?: number | null
          id?: string
          limite_file_servers?: number | null
          limite_workstations?: number | null
          numero_certificado?: string | null
          politica_grupo?: string | null
          produto_id?: string | null
          quantidade?: number
          tipo_ativacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licencas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licencas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licencas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "vw_contratos_vencendo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licencas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licencas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_elp"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "licencas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_ociosidade_financeira"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          ativo_id: string
          created_at: string
          data_abertura: string
          data_conclusao: string | null
          descricao_defeito: string
          id: string
          numero: number
          observacoes: string | null
          prioridade: Database["public"]["Enums"]["os_prioridade"]
          status: Database["public"]["Enums"]["os_status"]
          status_ativo_anterior: string | null
          tecnico_id: string | null
          updated_at: string
        }
        Insert: {
          ativo_id: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao_defeito: string
          id?: string
          numero?: number
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["os_prioridade"]
          status?: Database["public"]["Enums"]["os_status"]
          status_ativo_anterior?: string | null
          tecnico_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo_id?: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao_defeito?: string
          id?: string
          numero?: number
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["os_prioridade"]
          status?: Database["public"]["Enums"]["os_status"]
          status_ativo_anterior?: string | null
          tecnico_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_gap_edr"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "ordens_servico_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_tco_ativo"
            referencedColumns: ["ativo_id"]
          },
        ]
      }
      ordens_servico_anexos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          ordem_servico_id: string
          storage_path: string
          tamanho_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          ordem_servico_id: string
          storage_path: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          ordem_servico_id?: string
          storage_path?: string
          tamanho_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_anexos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico_pecas: {
        Row: {
          created_at: string
          custo_unitario: number | null
          id: string
          ordem_servico_id: string
          peca_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          ordem_servico_id: string
          peca_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          ordem_servico_id?: string
          peca_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_pecas_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_pecas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_pecas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "vw_estoque_saldo"
            referencedColumns: ["peca_id"]
          },
          {
            foreignKeyName: "ordens_servico_pecas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "vw_pecas_reposicao"
            referencedColumns: ["peca_id"]
          },
        ]
      }
      pecas_catalogo: {
        Row: {
          categoria: string
          created_at: string
          custo_unitario: number | null
          estoque_minimo: number
          fabricante: string | null
          fornecedor_padrao: string | null
          id: string
          modelos_compativeis: string[]
          nome: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          custo_unitario?: number | null
          estoque_minimo?: number
          fabricante?: string | null
          fornecedor_padrao?: string | null
          id?: string
          modelos_compativeis?: string[]
          nome: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          custo_unitario?: number | null
          estoque_minimo?: number
          fabricante?: string | null
          fornecedor_padrao?: string | null
          id?: string
          modelos_compativeis?: string[]
          nome?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      produtos_aliases: {
        Row: {
          alias: string
          created_at: string | null
          id: string
          produto_id: string | null
        }
        Insert: {
          alias: string
          created_at?: string | null
          id?: string
          produto_id?: string | null
        }
        Update: {
          alias?: string
          created_at?: string | null
          id?: string
          produto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_aliases_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_aliases_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_elp"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produtos_aliases_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_ociosidade_financeira"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      produtos_catalogo: {
        Row: {
          categoria: string
          created_at: string | null
          fabricante_id: string | null
          id: string
          modelo_licenciamento: string
          nome_oficial: string
          subtipo: string | null
          tipo_licenciamento: string
        }
        Insert: {
          categoria: string
          created_at?: string | null
          fabricante_id?: string | null
          id?: string
          modelo_licenciamento: string
          nome_oficial: string
          subtipo?: string | null
          tipo_licenciamento: string
        }
        Update: {
          categoria?: string
          created_at?: string | null
          fabricante_id?: string | null
          id?: string
          modelo_licenciamento?: string
          nome_oficial?: string
          subtipo?: string | null
          tipo_licenciamento?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_catalogo_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "fabricantes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relatorios_recorrentes: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          destinatarios: string[]
          filtros: Json
          formato: string
          frequencia: string
          id: string
          nome: string
          proximo_envio: string | null
          tipo: string
          ultimo_envio: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          destinatarios?: string[]
          filtros?: Json
          formato?: string
          frequencia?: string
          id?: string
          nome: string
          proximo_envio?: string | null
          tipo: string
          ultimo_envio?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          destinatarios?: string[]
          filtros?: Json
          formato?: string
          frequencia?: string
          id?: string
          nome?: string
          proximo_envio?: string | null
          tipo?: string
          ultimo_envio?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      servicos: {
        Row: {
          created_at: string
          criticidade: string | null
          id: string
          nome: string
          responsavel_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          criticidade?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          criticidade?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_licenca: {
        Row: {
          aprovador_id: string | null
          created_at: string
          decidido_em: string | null
          id: string
          justificativa: string
          motivo_decisao: string | null
          produto_id: string
          quantidade: number
          solicitante_id: string
          status: Database["public"]["Enums"]["solicitacao_status"]
          updated_at: string
        }
        Insert: {
          aprovador_id?: string | null
          created_at?: string
          decidido_em?: string | null
          id?: string
          justificativa: string
          motivo_decisao?: string | null
          produto_id: string
          quantidade: number
          solicitante_id: string
          status?: Database["public"]["Enums"]["solicitacao_status"]
          updated_at?: string
        }
        Update: {
          aprovador_id?: string | null
          created_at?: string
          decidido_em?: string | null
          id?: string
          justificativa?: string
          motivo_decisao?: string | null
          produto_id?: string
          quantidade?: number
          solicitante_id?: string
          status?: Database["public"]["Enums"]["solicitacao_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_licenca_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_licenca_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_elp"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "solicitacoes_licenca_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_ociosidade_financeira"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          id: string
          nome: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nome: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nome?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          created_at: string | null
          data_desligamento: string | null
          email: string | null
          id: string
          matricula: string | null
          nome: string
          setor: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_desligamento?: string | null
          email?: string | null
          id?: string
          matricula?: string | null
          nome: string
          setor?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_desligamento?: string | null
          email?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          setor?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_ativos_defeito_recorrente: {
        Row: {
          ativo_id: string | null
          hostname: string | null
          os_count: number | null
          setor: string | null
          ultima_os: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_gap_edr"
            referencedColumns: ["ativo_id"]
          },
          {
            foreignKeyName: "ordens_servico_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "vw_tco_ativo"
            referencedColumns: ["ativo_id"]
          },
        ]
      }
      vw_contratos_vencendo: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          dias_para_vencer: number | null
          fornecedor: string | null
          id: string | null
          numero_contrato: string | null
          quantidade_seats: number | null
          tipo_contrato: string | null
          urgencia: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dias_para_vencer?: never
          fornecedor?: string | null
          id?: string | null
          numero_contrato?: string | null
          quantidade_seats?: number | null
          tipo_contrato?: string | null
          urgencia?: never
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dias_para_vencer?: never
          fornecedor?: string | null
          id?: string | null
          numero_contrato?: string | null
          quantidade_seats?: number | null
          tipo_contrato?: string | null
          urgencia?: never
          valor_total?: number | null
        }
        Relationships: []
      }
      vw_custo_ociosas: {
        Row: {
          custo_mensal_desperdicado: number | null
          nome_oficial: string | null
          qtd_ociosa: number | null
        }
        Relationships: []
      }
      vw_elp: {
        Row: {
          categoria: string | null
          fabricante: string | null
          licencas_alocadas: number | null
          licencas_compradas: number | null
          nome_oficial: string | null
          produto_id: string | null
          saldo: number | null
          status_compliance: string | null
        }
        Relationships: []
      }
      vw_estoque_saldo: {
        Row: {
          categoria: string | null
          custo_unitario: number | null
          estoque_minimo: number | null
          fabricante: string | null
          fornecedor_padrao: string | null
          nome: string | null
          peca_id: string | null
          saldo: number | null
        }
        Relationships: []
      }
      vw_gap_edr: {
        Row: {
          ativo_id: string | null
          hostname: string | null
          setor: string | null
          status_ciclo_vida: string | null
        }
        Insert: {
          ativo_id?: string | null
          hostname?: string | null
          setor?: string | null
          status_ciclo_vida?: string | null
        }
        Update: {
          ativo_id?: string | null
          hostname?: string | null
          setor?: string | null
          status_ciclo_vida?: string | null
        }
        Relationships: []
      }
      vw_licencas_indicadores: {
        Row: {
          atribuidas: number | null
          categoria: string | null
          data_vencimento: string | null
          disponiveis: number | null
          fabricante: string | null
          licenca_id: string | null
          nome: string | null
          percentual_uso: number | null
          tipo_licenca: string | null
          total: number | null
        }
        Relationships: []
      }
      vw_licencas_ociosas: {
        Row: {
          licenca_id: string | null
          nome_oficial: string | null
          quantidade: number | null
          ultima_desalocacao: string | null
        }
        Relationships: []
      }
      vw_ociosidade_financeira: {
        Row: {
          categoria: string | null
          licencas_ociosas: number | null
          nome_oficial: string | null
          produto_id: string | null
          valor_ocioso: number | null
        }
        Relationships: []
      }
      vw_pecas_reposicao: {
        Row: {
          categoria: string | null
          custo_unitario: number | null
          estoque_minimo: number | null
          fabricante: string | null
          fornecedor_padrao: string | null
          nome: string | null
          peca_id: string | null
          quantidade_sugerida: number | null
          saldo: number | null
        }
        Relationships: []
      }
      vw_tco_ativo: {
        Row: {
          ativo_id: string | null
          custo_licencas_mensal: number | null
          hostname: string | null
          tco_anual_estimado: number | null
          valor_aquisicao: number | null
          valor_residual: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_operate_os: { Args: { _user_id: string }; Returns: boolean }
      can_read: { Args: { _user_id: string }; Returns: boolean }
      can_read_os: { Args: { _user_id: string }; Returns: boolean }
      fn_log_action: {
        Args: {
          p_acao: string
          p_metadata: Json
          p_registro_id: string
          p_tabela: string
        }
        Returns: string
      }
      fn_risco_compliance: {
        Args: { _categoria: string }
        Returns: {
          categoria: string
          criticidade_media: number
          deficit_pct: number
          score: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_gestor_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tecnico: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      aditivo_tipo: "quantidade" | "prazo" | "valor" | "outro"
      app_role:
        | "admin"
        | "gestor_ti"
        | "auditoria"
        | "padrao"
        | "visitante"
        | "tecnico"
      mov_tipo: "entrada" | "saida" | "ajuste"
      os_prioridade: "baixa" | "media" | "alta" | "critica"
      os_status:
        | "aberta"
        | "em_andamento"
        | "aguardando_peca"
        | "concluida"
        | "cancelada"
      solicitacao_status: "pendente" | "aprovada" | "rejeitada" | "cancelada"
      status_convite: "enfileirado" | "enviado" | "falhou" | "aceito"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      aditivo_tipo: ["quantidade", "prazo", "valor", "outro"],
      app_role: [
        "admin",
        "gestor_ti",
        "auditoria",
        "padrao",
        "visitante",
        "tecnico",
      ],
      mov_tipo: ["entrada", "saida", "ajuste"],
      os_prioridade: ["baixa", "media", "alta", "critica"],
      os_status: [
        "aberta",
        "em_andamento",
        "aguardando_peca",
        "concluida",
        "cancelada",
      ],
      solicitacao_status: ["pendente", "aprovada", "rejeitada", "cancelada"],
      status_convite: ["enfileirado", "enviado", "falhou", "aceito"],
    },
  },
} as const
