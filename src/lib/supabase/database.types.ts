export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      case_steps: {
        Row: {
          action: string;
          case_id: string;
          expected_result: string;
          id: string;
          position: number;
        };
        Insert: {
          action: string;
          case_id: string;
          expected_result: string;
          id?: string;
          position: number;
        };
        Update: {
          action?: string;
          case_id?: string;
          expected_result?: string;
          id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "case_steps_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "test_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          id: string;
          invited_by: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["member_role"];
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          invited_by: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          invited_by?: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
        };
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          active: boolean;
          created_at: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_cases: {
        Row: {
          case_id: string;
          plan_id: string;
          project_id: string;
        };
        Insert: {
          case_id: string;
          plan_id: string;
          project_id: string;
        };
        Update: {
          case_id?: string;
          plan_id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_cases_case_id_project_id_fkey";
            columns: ["case_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_cases";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "plan_cases_plan_id_project_id_fkey";
            columns: ["plan_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_plans";
            referencedColumns: ["id", "project_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          archived_at: string | null;
          code: string;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          name: string;
          next_case_number: number;
        };
        Insert: {
          archived_at?: string | null;
          code: string;
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          name: string;
          next_case_number?: number;
        };
        Update: {
          archived_at?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          name?: string;
          next_case_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      run_cases: {
        Row: {
          case_id: string;
          case_number: number;
          id: string;
          notes: string;
          project_id: string;
          run_id: string;
          snapshot: NonNullable<Json>;
          status: Database["public"]["Enums"]["result_status"];
          tested_at: string | null;
          tester_id: string | null;
        };
        Insert: {
          case_id: string;
          case_number: number;
          id?: string;
          notes?: string;
          project_id: string;
          run_id: string;
          snapshot: NonNullable<Json>;
          status?: Database["public"]["Enums"]["result_status"];
          tested_at?: string | null;
          tester_id?: string | null;
        };
        Update: {
          case_id?: string;
          case_number?: number;
          id?: string;
          notes?: string;
          project_id?: string;
          run_id?: string;
          snapshot?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["result_status"];
          tested_at?: string | null;
          tester_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "run_cases_case_id_project_id_fkey";
            columns: ["case_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_cases";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "run_cases_run_id_project_id_fkey";
            columns: ["run_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_runs";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "run_cases_tester_id_fkey";
            columns: ["tester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      suites: {
        Row: {
          archived_at: string | null;
          created_at: string;
          description: string;
          id: string;
          name: string;
          parent_id: string | null;
          project_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          project_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suites_parent_fkey";
            columns: ["parent_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "suites";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "suites_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      test_cases: {
        Row: {
          archived_at: string | null;
          classification: Database["public"]["Enums"]["case_classification"];
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          number: number;
          preconditions: string;
          priority: Database["public"]["Enums"]["case_priority"];
          project_id: string;
          suite_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          classification?: Database["public"]["Enums"]["case_classification"];
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          number: number;
          preconditions?: string;
          priority?: Database["public"]["Enums"]["case_priority"];
          project_id: string;
          suite_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          classification?: Database["public"]["Enums"]["case_classification"];
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          number?: number;
          preconditions?: string;
          priority?: Database["public"]["Enums"]["case_priority"];
          project_id?: string;
          suite_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "test_cases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_cases_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_cases_suite_id_project_id_fkey";
            columns: ["suite_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "suites";
            referencedColumns: ["id", "project_id"];
          },
        ];
      };
      test_plans: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          name: string;
          project_id: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          description?: string;
          id?: string;
          name: string;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          name?: string;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "test_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_plans_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      test_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          environment: string;
          id: string;
          name: string;
          plan_id: string | null;
          project_id: string;
          source_run_id: string | null;
          status: Database["public"]["Enums"]["run_status"];
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          environment?: string;
          id?: string;
          name: string;
          plan_id?: string | null;
          project_id: string;
          source_run_id?: string | null;
          status?: Database["public"]["Enums"]["run_status"];
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          environment?: string;
          id?: string;
          name?: string;
          plan_id?: string | null;
          project_id?: string;
          source_run_id?: string | null;
          status?: Database["public"]["Enums"]["run_status"];
        };
        Relationships: [
          {
            foreignKeyName: "runs_plan_fkey";
            columns: ["plan_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_plans";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "runs_source_fkey";
            columns: ["source_run_id", "plan_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_runs";
            referencedColumns: ["id", "plan_id", "project_id"];
          },
          {
            foreignKeyName: "test_runs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_settings: {
        Row: {
          id: boolean;
          name: string;
        };
        Insert: {
          id?: boolean;
          name?: string;
        };
        Update: {
          id?: boolean;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      archive_case: { Args: { p_case_id: string }; Returns: undefined };
      archive_group: { Args: { p_group_id: string }; Returns: undefined };
      archive_plan: { Args: { p_plan_id: string }; Returns: undefined };
      complete_run: { Args: { p_run_id: string }; Returns: undefined };
      create_plan_run: {
        Args: {
          p_environment: string;
          p_mode?: string;
          p_name: string;
          p_plan_id: string;
          p_source_run_id?: string;
        };
        Returns: string;
      };
      dashboard_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      group_descendant_ids: {
        Args: { p_group_id: string; p_project_id: string };
        Returns: string[];
      };
      manage_member: {
        Args: {
          p_active: boolean;
          p_role: Database["public"]["Enums"]["member_role"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      prepare_invitation: {
        Args: {
          p_email: string;
          p_role: Database["public"]["Enums"]["member_role"];
        };
        Returns: string;
      };
      record_result: {
        Args: {
          p_notes: string;
          p_run_case_id: string;
          p_status: Database["public"]["Enums"]["result_status"];
        };
        Returns: undefined;
      };
      revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      save_case: {
        Args: {
          p_case_id?: string;
          p_classification: Database["public"]["Enums"]["case_classification"];
          p_description: string;
          p_preconditions: string;
          p_priority: Database["public"]["Enums"]["case_priority"];
          p_project_id: string;
          p_steps: Json;
          p_suite_id?: string;
          p_title: string;
        };
        Returns: string;
      };
      save_group: {
        Args: {
          p_description: string;
          p_group_id?: string;
          p_name: string;
          p_parent_id?: string;
          p_project_id: string;
        };
        Returns: string;
      };
      save_plan: {
        Args: {
          p_case_ids: string[];
          p_description: string;
          p_name: string;
          p_plan_id?: string;
          p_project_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      case_classification: "manual" | "automated";
      case_priority: "low" | "medium" | "high" | "critical";
      member_role: "admin" | "member";
      result_status: "untested" | "passed" | "failed" | "blocked" | "skipped";
      run_status: "active" | "completed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      case_classification: ["manual", "automated"],
      case_priority: ["low", "medium", "high", "critical"],
      member_role: ["admin", "member"],
      result_status: ["untested", "passed", "failed", "blocked", "skipped"],
      run_status: ["active", "completed"],
    },
  },
} as const;
