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
      ativos: {
        Row: {
          created_at: string | null
          data_ultima_transicao: string | null
          hostname: string
          id: string
          numero_patrimonio: string | null
          numero_serie: string | null
          setor: string | null
          status_ciclo_vida: string
          tipo: string
          updated_at: string | null
          usuario_responsavel_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_ultima_transicao?: string | null
          hostname: string
          id?: string
          numero_patrimonio?: string | null
          numero_serie?: string | null
          setor?: string | null
          status_ciclo_vida?: string
          tipo: string
          updated_at?: string | null
          usuario_responsavel_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_ultima_transicao?: string | null
          hostname?: string
          id?: string
          numero_patrimonio?: string | null
          numero_serie?: string | null
          setor?: string | null
          status_ciclo_vida?: string
          tipo?: string
          updated_at?: string | null
          usuario_responsavel_id?: string | null
        }
        Relationships: [
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
      contratos: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          fornecedor: string
          id: string
          numero_contrato: string | null
          quantidade_seats: number
          tipo_contrato: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          fornecedor: string
          id?: string
          numero_contrato?: string | null
          quantidade_seats?: number
          tipo_contrato?: string | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          fornecedor?: string
          id?: string
          numero_contrato?: string | null
          quantidade_seats?: number
          tipo_contrato?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      fabricantes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
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
        ]
      }
      licencas: {
        Row: {
          chave_ativacao: string | null
          contrato_id: string | null
          created_at: string | null
          data_expiracao: string | null
          id: string
          produto_id: string | null
          quantidade: number
        }
        Insert: {
          chave_ativacao?: string | null
          contrato_id?: string | null
          created_at?: string | null
          data_expiracao?: string | null
          id?: string
          produto_id?: string | null
          quantidade?: number
        }
        Update: {
          chave_ativacao?: string | null
          contrato_id?: string | null
          created_at?: string | null
          data_expiracao?: string | null
          id?: string
          produto_id?: string | null
          quantidade?: number
        }
        Relationships: [
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
        ]
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
          tipo_licenciamento: string
        }
        Insert: {
          categoria: string
          created_at?: string | null
          fabricante_id?: string | null
          id?: string
          modelo_licenciamento: string
          nome_oficial: string
          tipo_licenciamento: string
        }
        Update: {
          categoria?: string
          created_at?: string | null
          fabricante_id?: string | null
          id?: string
          modelo_licenciamento?: string
          nome_oficial?: string
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
      vw_licencas_ociosas: {
        Row: {
          licenca_id: string | null
          nome_oficial: string | null
          quantidade: number | null
          ultima_desalocacao: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_read: { Args: { _user_id: string }; Returns: boolean }
      fn_log_action: {
        Args: {
          p_acao: string
          p_metadata: Json
          p_registro_id: string
          p_tabela: string
        }
        Returns: string
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
    }
    Enums: {
      app_role: "admin" | "gestor_ti" | "auditoria" | "padrao" | "visitante"
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
      app_role: ["admin", "gestor_ti", "auditoria", "padrao", "visitante"],
    },
  },
} as const
