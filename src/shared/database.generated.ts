// Generated from the Supabase public schema after migration 202610230003.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      map_request_limits: {
        Row: {
          action: string;
          requests: number;
          user_id: string;
          window_started_at: string;
        };
        Insert: {
          action: string;
          requests: number;
          user_id: string;
          window_started_at: string;
        };
        Update: {
          action?: string;
          requests?: number;
          user_id?: string;
          window_started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_request_limits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      motorcycles: {
        Row: {
          brand: string;
          color: string | null;
          created_at: string;
          engine_cc: number | null;
          id: string;
          is_primary: boolean;
          manufacture_year: number | null;
          model: string;
          photo_path: string | null;
          user_id: string;
        };
        Insert: {
          brand: string;
          color?: string | null;
          created_at?: string;
          engine_cc?: number | null;
          id?: string;
          is_primary?: boolean;
          manufacture_year?: number | null;
          model: string;
          photo_path?: string | null;
          user_id: string;
        };
        Update: {
          brand?: string;
          color?: string | null;
          created_at?: string;
          engine_cc?: number | null;
          id?: string;
          is_primary?: boolean;
          manufacture_year?: number | null;
          model?: string;
          photo_path?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "motorcycles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          display_name: string;
          id: string;
          username: string | null;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string;
          id: string;
          username?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      trip_participants: {
        Row: {
          joined_at: string;
          motorcycle_id: string | null;
          role: string;
          status: string;
          trip_id: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          motorcycle_id?: string | null;
          role: string;
          status: string;
          trip_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          motorcycle_id?: string | null;
          role?: string;
          status?: string;
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_participants_motorcycle_id_fkey";
            columns: ["motorcycle_id"];
            isOneToOne: false;
            referencedRelation: "motorcycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_participants_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_routes: {
        Row: {
          calculated_at: string;
          distance_m: number;
          duration_s: number;
          geometry: Json;
          id: string;
          routing_provider: string;
          trip_id: string;
        };
        Insert: {
          calculated_at?: string;
          distance_m: number;
          duration_s: number;
          geometry: Json;
          id?: string;
          routing_provider: string;
          trip_id: string;
        };
        Update: {
          calculated_at?: string;
          distance_m?: number;
          duration_s?: number;
          geometry?: Json;
          id?: string;
          routing_provider?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_routes_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: true;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_waypoints: {
        Row: {
          id: string;
          label: string;
          latitude: number;
          longitude: number;
          position: number;
          trip_id: string;
        };
        Insert: {
          id?: string;
          label: string;
          latitude: number;
          longitude: number;
          position: number;
          trip_id: string;
        };
        Update: {
          id?: string;
          label?: string;
          latitude?: number;
          longitude?: number;
          position?: number;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_waypoints_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          created_at: string;
          created_by: string;
          departure_at: string;
          id: string;
          revision: number;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          departure_at: string;
          id?: string;
          revision?: number;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          departure_at?: string;
          id?: string;
          revision?: number;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_read_trip: { Args: { p_trip_id: string }; Returns: boolean };
      consume_map_request: { Args: { p_action: string }; Returns: undefined };
      create_trip: {
        Args: { p_departure_at: string; p_title: string; p_waypoints: Json };
        Returns: string;
      };
      delete_trip: {
        Args: { p_expected_revision: number; p_trip_id: string };
        Returns: undefined;
      };
      replace_trip_waypoints: {
        Args: { p_trip_id: string; p_waypoints: Json };
        Returns: undefined;
      };
      set_primary_motorcycle: {
        Args: { motorcycle_id: string };
        Returns: undefined;
      };
      set_trip_status: {
        Args: {
          p_expected_revision: number;
          p_status: string;
          p_trip_id: string;
        };
        Returns: undefined;
      };
      store_trip_route: {
        Args: {
          p_actor: string;
          p_calculated_at: string;
          p_distance_m: number;
          p_duration_s: number;
          p_expected_revision: number;
          p_geometry: Json;
          p_trip_id: string;
        };
        Returns: undefined;
      };
      update_trip: {
        Args: {
          p_departure_at: string;
          p_expected_revision: number;
          p_title: string;
          p_trip_id: string;
          p_waypoints: Json;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
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
  public: {
    Enums: {},
  },
} as const;
