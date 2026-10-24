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
      group_memberships: {
        Row: {
          group_id: string;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          role?: string;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "motard_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      location_shares: {
        Row: {
          expires_at: string;
          last_published_at: string | null;
          session_id: string;
          share_id: string;
          user_id: string;
        };
        Insert: {
          expires_at?: string;
          last_published_at?: string | null;
          session_id: string;
          share_id?: string;
          user_id: string;
        };
        Update: {
          expires_at?: string;
          last_published_at?: string | null;
          session_id?: string;
          share_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_shares_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "tracking_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
      motard_groups: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string;
          headquarters_address: string;
          id: string;
          latitude: number;
          legal_name: string;
          longitude: number;
          name: string;
          registration_number: string;
          revision: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          headquarters_address: string;
          id?: string;
          latitude: number;
          legal_name?: string;
          longitude: number;
          name: string;
          registration_number?: string;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          headquarters_address?: string;
          id?: string;
          latitude?: number;
          legal_name?: string;
          longitude?: number;
          name?: string;
          registration_number?: string;
          revision?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "motard_groups_created_by_fkey";
            columns: ["created_by"];
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
      rider_locations: {
        Row: {
          accuracy_m: number;
          heading: number | null;
          latitude: number;
          longitude: number;
          received_at: string;
          recorded_at: string;
          session_id: string;
          trip_id: string;
          user_id: string;
        };
        Insert: {
          accuracy_m: number;
          heading?: number | null;
          latitude: number;
          longitude: number;
          received_at?: string;
          recorded_at: string;
          session_id: string;
          trip_id: string;
          user_id: string;
        };
        Update: {
          accuracy_m?: number;
          heading?: number | null;
          latitude?: number;
          longitude?: number;
          received_at?: string;
          recorded_at?: string;
          session_id?: string;
          trip_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rider_locations_session_id_user_id_fkey";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "location_shares";
            referencedColumns: ["session_id", "user_id"];
          },
          {
            foreignKeyName: "rider_locations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rider_locations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tracking_sessions: {
        Row: {
          ended_at: string | null;
          id: string;
          started_at: string;
          started_by: string;
          trip_id: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          started_at?: string;
          started_by: string;
          trip_id: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          started_at?: string;
          started_by?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tracking_sessions_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tracking_sessions_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: true;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_invitation_receipts: {
        Row: {
          id: string;
          invitation_id: string;
          received_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          received_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          invitation_id?: string;
          received_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_invitation_receipts_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "trip_invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_invitation_receipts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_invitations: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          invited_by: string;
          response: string | null;
          revoked_at: string | null;
          token_hash: string;
          trip_id: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          response?: string | null;
          revoked_at?: string | null;
          token_hash: string;
          trip_id: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          response?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
          trip_id?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_invitations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_invitations_used_by_fkey";
            columns: ["used_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      trip_sos_alerts: {
        Row: {
          expires_at: string;
          raised_at: string;
          raised_by: string;
          reason: string;
          resolved_at: string | null;
          trip_id: string;
        };
        Insert: {
          expires_at?: string;
          raised_at?: string;
          raised_by: string;
          reason: string;
          resolved_at?: string | null;
          trip_id: string;
        };
        Update: {
          expires_at?: string;
          raised_at?: string;
          raised_by?: string;
          reason?: string;
          resolved_at?: string | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_sos_alerts_raised_by_fkey";
            columns: ["raised_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_sos_alerts_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: true;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_voice_limits: {
        Row: {
          requests: number;
          user_id: string;
          window_start: string;
        };
        Insert: {
          requests?: number;
          user_id: string;
          window_start?: string;
        };
        Update: {
          requests?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_voice_limits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_voice_state: {
        Row: {
          epoch_started_at: string;
          operation_id: string | null;
          operation_until: string | null;
          ready: boolean;
          room_epoch: string;
          speaker_id: string | null;
          speaker_kind: string | null;
          speaker_until: string | null;
          trip_id: string;
        };
        Insert: {
          epoch_started_at?: string;
          operation_id?: string | null;
          operation_until?: string | null;
          ready?: boolean;
          room_epoch?: string;
          speaker_id?: string | null;
          speaker_kind?: string | null;
          speaker_until?: string | null;
          trip_id: string;
        };
        Update: {
          epoch_started_at?: string;
          operation_id?: string | null;
          operation_until?: string | null;
          ready?: boolean;
          room_epoch?: string;
          speaker_id?: string | null;
          speaker_kind?: string | null;
          speaker_until?: string | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_voice_state_speaker_id_fkey";
            columns: ["speaker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_voice_state_trip_id_fkey";
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
      begin_trip_voice_operation: {
        Args: { p_action: string; p_actor: string; p_trip_id: string };
        Returns: Json;
      };
      can_read_location: {
        Args: { p_session_id: string; p_trip_id: string; p_user_id: string };
        Returns: boolean;
      };
      can_read_trip: { Args: { p_trip_id: string }; Returns: boolean };
      can_receive_trip_tracking: {
        Args: { p_topic: string };
        Returns: boolean;
      };
      can_receive_trip_voice: { Args: { p_topic: string }; Returns: boolean };
      change_group_membership: {
        Args: { p_action: string; p_group_id: string; p_user_id?: string };
        Returns: undefined;
      };
      consume_map_request: { Args: { p_action: string }; Returns: undefined };
      create_trip: {
        Args: { p_departure_at: string; p_title: string; p_waypoints: Json };
        Returns: string;
      };
      create_trip_invitation: {
        Args: { p_trip_id: string };
        Returns: {
          expires_at: string;
          invitation_id: string;
          token: string;
        }[];
      };
      delete_trip: {
        Args: { p_expected_revision: number; p_trip_id: string };
        Returns: undefined;
      };
      finish_trip: {
        Args: { p_expected_revision: number; p_trip_id: string };
        Returns: undefined;
      };
      finish_trip_voice_operation: {
        Args: { p_operation_id: string; p_success: boolean; p_trip_id: string };
        Returns: boolean;
      };
      is_group_leader: { Args: { p_group_id: string }; Returns: boolean };
      list_group_members: {
        Args: { p_group_id: string };
        Returns: {
          display_name: string;
          role: string;
          status: string;
          user_id: string;
          username: string;
        }[];
      };
      list_received_trip_invitations: {
        Args: never;
        Returns: {
          departure_at: string;
          expires_at: string;
          inviter_name: string;
          receipt_id: string;
          received_at: string;
          status: string;
          title: string;
          trip_id: string;
        }[];
      };
      list_trip_invitations: {
        Args: { p_trip_id: string };
        Returns: {
          created_at: string;
          expires_at: string;
          invitation_id: string;
          response: string;
          revoked_at: string;
          used_at: string;
        }[];
      };
      list_trip_members: {
        Args: { p_trip_id: string };
        Returns: {
          display_name: string;
          motorcycle_brand: string;
          motorcycle_model: string;
          role: string;
          user_id: string;
          username: string;
        }[];
      };
      publish_rider_location: {
        Args: {
          p_accuracy_m: number;
          p_heading: number;
          p_latitude: number;
          p_longitude: number;
          p_recorded_at: string;
          p_session_id: string;
          p_share_id: string;
        };
        Returns: undefined;
      };
      raise_trip_sos: {
        Args: { p_reason: string; p_trip_id: string };
        Returns: undefined;
      };
      remember_trip_invitation: { Args: { p_token: string }; Returns: string };
      replace_trip_waypoints: {
        Args: { p_trip_id: string; p_waypoints: Json };
        Returns: undefined;
      };
      resolve_trip_sos: { Args: { p_trip_id: string }; Returns: undefined };
      respond_invitation_internal: {
        Args: { p_accept: boolean; p_invitation_id: string };
        Returns: string;
      };
      respond_received_trip_invitation: {
        Args: { p_accept: boolean; p_receipt_id: string };
        Returns: string;
      };
      respond_trip_invitation: {
        Args: { p_accept: boolean; p_token: string };
        Returns: string;
      };
      revoke_trip_invitation: {
        Args: { p_invitation_id: string; p_trip_id: string };
        Returns: undefined;
      };
      save_motard_group: {
        Args: {
          p_address: string;
          p_description: string;
          p_group_id: string;
          p_latitude: number;
          p_legal_name: string;
          p_longitude: number;
          p_name: string;
          p_registration_number: string;
          p_revision: number;
        };
        Returns: string;
      };
      set_primary_motorcycle: {
        Args: { motorcycle_id: string };
        Returns: undefined;
      };
      set_trip_motorcycle: {
        Args: { p_motorcycle_id: string; p_trip_id: string };
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
      start_location_sharing: {
        Args: { p_session_id: string };
        Returns: string;
      };
      start_trip: {
        Args: { p_expected_revision: number; p_trip_id: string };
        Returns: string;
      };
      stop_location_sharing: {
        Args: { p_session_id: string; p_share_id: string };
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
      tracking_snapshot: { Args: { p_trip_id: string }; Returns: Json };
      trip_voice_snapshot: { Args: { p_trip_id: string }; Returns: Json };
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
