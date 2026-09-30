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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string | null
          created_at: string
          date: string | null
          description: string | null
          display_order: number
          featured: boolean
          id: string
          metric_context: string | null
          metric_unit: string | null
          metric_value: number | null
          title: string
          updated_at: string
          work_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          display_order?: number
          featured?: boolean
          id?: string
          metric_context?: string | null
          metric_unit?: string | null
          metric_value?: number | null
          title: string
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          display_order?: number
          featured?: boolean
          id?: string
          metric_context?: string | null
          metric_unit?: string | null
          metric_value?: number | null
          title?: string
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achievements_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "work"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          country: string | null
          created_at: string
          event_name: string
          id: number
          path: string | null
          properties: Json
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          event_name: string
          id?: never
          path?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          event_name?: string
          id?: never
          path?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      certification_skills: {
        Row: {
          certification_id: string
          skill_id: string
        }
        Insert: {
          certification_id: string
          skill_id: string
        }
        Update: {
          certification_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_skills_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          certificate_image_url: string | null
          created_at: string
          credential_id: string | null
          credential_url: string | null
          description: string | null
          display_order: number
          expiry_date: string | null
          featured: boolean
          id: string
          issue_date: string | null
          issuer: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          certificate_image_url?: string | null
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          description?: string | null
          display_order?: number
          expiry_date?: string | null
          featured?: boolean
          id?: string
          issue_date?: string | null
          issuer: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          certificate_image_url?: string | null
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          description?: string | null
          display_order?: number
          expiry_date?: string | null
          featured?: boolean
          id?: string
          issue_date?: string | null
          issuer?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          role: string
          session_id: string
          sources: Json
          tool_calls: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          role: string
          session_id: string
          sources?: Json
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          role?: string
          session_id?: string
          sources?: Json
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          channel: string
          created_at: string
          id: string
          last_message_at: string
          metadata: Json
          visitor_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          last_message_at?: string
          metadata?: Json
          visitor_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          last_message_at?: string
          metadata?: Json
          visitor_id?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          email_status: string
          id: number
          message: string
          name: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_status?: string
          id?: never
          message: string
          name: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_status?: string
          id?: never
          message?: string
          name?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string
          id: string
          metadata: Json
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding: string
          id?: string
          metadata?: Json
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string
          id?: string
          metadata?: Json
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          checksum: string | null
          content: string
          created_at: string
          id: string
          metadata: Json
          source_id: string | null
          source_type: string
          title: string
          updated_at: string
        }
        Insert: {
          checksum?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          source_type: string
          title: string
          updated_at?: string
        }
        Update: {
          checksum?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          source_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string
          headline: string | null
          id: number
          location: string | null
          resume_url: string | null
          social_links: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          headline?: string | null
          id?: number
          location?: string | null
          resume_url?: string | null
          social_links?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          headline?: string | null
          id?: number
          location?: string | null
          resume_url?: string | null
          social_links?: Json
          updated_at?: string
        }
        Relationships: []
      }
      prototypes: {
        Row: {
          created_at: string
          demo_url: string | null
          description: string | null
          display_order: number
          embed_url: string | null
          featured: boolean
          id: string
          published: boolean
          repo_url: string | null
          slug: string
          stage: string
          summary: string | null
          tech_stack: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          demo_url?: string | null
          description?: string | null
          display_order?: number
          embed_url?: string | null
          featured?: boolean
          id?: string
          published?: boolean
          repo_url?: string | null
          slug: string
          stage?: string
          summary?: string | null
          tech_stack?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          demo_url?: string | null
          description?: string | null
          display_order?: number
          embed_url?: string | null
          featured?: boolean
          id?: string
          published?: boolean
          repo_url?: string | null
          slug?: string
          stage?: string
          summary?: string | null
          tech_stack?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          featured: boolean
          icon: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_order?: number
          featured?: boolean
          icon?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          featured?: boolean
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      work: {
        Row: {
          approach: string | null
          architecture: Json
          category: string | null
          company: string | null
          created_at: string
          decisions: Json
          display_order: number
          featured: boolean
          id: string
          metrics: Json
          outcome: string | null
          problem: string | null
          published: boolean
          role: string | null
          slug: string
          subtitle: string | null
          summary: string | null
          title: string
          updated_at: string
          users: string | null
          year: number | null
        }
        Insert: {
          approach?: string | null
          architecture?: Json
          category?: string | null
          company?: string | null
          created_at?: string
          decisions?: Json
          display_order?: number
          featured?: boolean
          id?: string
          metrics?: Json
          outcome?: string | null
          problem?: string | null
          published?: boolean
          role?: string | null
          slug: string
          subtitle?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          users?: string | null
          year?: number | null
        }
        Update: {
          approach?: string | null
          architecture?: Json
          category?: string | null
          company?: string | null
          created_at?: string
          decisions?: Json
          display_order?: number
          featured?: boolean
          id?: string
          metrics?: Json
          outcome?: string | null
          problem?: string | null
          published?: boolean
          role?: string | null
          slug?: string
          subtitle?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          users?: string | null
          year?: number | null
        }
        Relationships: []
      }
      work_skills: {
        Row: {
          skill_id: string
          work_id: string
        }
        Insert: {
          skill_id: string
          work_id: string
        }
        Update: {
          skill_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_skills_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "work"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analytics_summary: { Args: { days?: number }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      match_document_chunks: {
        Args: {
          filter_source_types?: string[]
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          document_title: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
