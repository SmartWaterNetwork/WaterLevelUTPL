/**
 * Generated from the database schema. Do not edit by hand — regenerate with:
 *
 *   supabase gen types typescript --project-id czideigtfvjrhwpcddoa > src/lib/database.types.ts
 *
 * Typing the client this way is what makes a renamed or mistyped column a
 * build error instead of a silent `undefined` at runtime.
 *
 * The `Relationships` arrays are left empty here — they only type PostgREST
 * embeds, which the browser never asks for. Regenerating fills them back in.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      alert_events: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          created_at: string;
          id: number;
          message: string | null;
          occurred_at: string;
          rule_id: number | null;
          severity: Database['public']['Enums']['alert_severity'];
          station_id: number;
          unit: string;
          value: number;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          id?: never;
          message?: string | null;
          occurred_at: string;
          rule_id?: number | null;
          severity: Database['public']['Enums']['alert_severity'];
          station_id: number;
          unit: string;
          value: number;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          id?: never;
          message?: string | null;
          occurred_at?: string;
          rule_id?: number | null;
          severity?: Database['public']['Enums']['alert_severity'];
          station_id?: number;
          unit?: string;
          value?: number;
        };
        Relationships: [];
      };
      alert_rules: {
        Row: {
          created_at: string;
          created_by: string | null;
          enabled: boolean;
          id: number;
          name: string;
          push_notification: boolean;
          severity: Database['public']['Enums']['alert_severity'];
          sound_alert: boolean;
          station_id: number | null;
          threshold: number;
          type: Database['public']['Enums']['alert_type'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          id?: never;
          name: string;
          push_notification?: boolean;
          severity?: Database['public']['Enums']['alert_severity'];
          sound_alert?: boolean;
          station_id?: number | null;
          threshold: number;
          type: Database['public']['Enums']['alert_type'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          id?: never;
          name?: string;
          push_notification?: boolean;
          severity?: Database['public']['Enums']['alert_severity'];
          sound_alert?: boolean;
          station_id?: number | null;
          threshold?: number;
          type?: Database['public']['Enums']['alert_type'];
          updated_at?: string;
        };
        Relationships: [];
      };
      station_channel_secrets: {
        Row: {
          read_api_key: string | null;
          station_id: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          read_api_key?: string | null;
          station_id: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          read_api_key?: string | null;
          station_id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      station_channels: {
        Row: {
          channel_id: string;
          field_name: string;
          provider: string;
          refresh_interval_s: number;
          results_count: number;
          station_id: number;
          updated_at: string;
        };
        Insert: {
          channel_id: string;
          field_name?: string;
          provider?: string;
          refresh_interval_s?: number;
          results_count?: number;
          station_id: number;
          updated_at?: string;
        };
        Update: {
          channel_id?: string;
          field_name?: string;
          provider?: string;
          refresh_interval_s?: number;
          results_count?: number;
          station_id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      station_hydraulics: {
        Row: {
          channel_slope: number;
          channel_width_m: number;
          conversion_mode: Database['public']['Enums']['conversion_mode'];
          linear_factor: number;
          manning_n: number;
          station_id: number;
          updated_at: string;
        };
        Insert: {
          channel_slope?: number;
          channel_width_m?: number;
          conversion_mode?: Database['public']['Enums']['conversion_mode'];
          linear_factor?: number;
          manning_n?: number;
          station_id: number;
          updated_at?: string;
        };
        Update: {
          channel_slope?: number;
          channel_width_m?: number;
          conversion_mode?: Database['public']['Enums']['conversion_mode'];
          linear_factor?: number;
          manning_n?: number;
          station_id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      stations: {
        Row: {
          alerta_cm: number;
          code: string;
          communication_type: Database['public']['Enums']['comm_type'];
          created_at: string;
          created_by: string | null;
          flow_unit: Database['public']['Enums']['flow_unit'];
          geom: unknown;
          id: number;
          installation_height_cm: number;
          is_active: boolean;
          lat: number | null;
          level_unit: Database['public']['Enums']['level_unit'];
          lng: number | null;
          location_label: string | null;
          name: string;
          notes: string | null;
          precaucion_cm: number;
          river_name: string | null;
          sensor_material: Database['public']['Enums']['sensor_material'];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          alerta_cm?: number;
          code: string;
          communication_type?: Database['public']['Enums']['comm_type'];
          created_at?: string;
          created_by?: string | null;
          flow_unit?: Database['public']['Enums']['flow_unit'];
          geom: unknown;
          id?: never;
          installation_height_cm: number;
          is_active?: boolean;
          lat?: number | null;
          level_unit?: Database['public']['Enums']['level_unit'];
          lng?: number | null;
          location_label?: string | null;
          name: string;
          notes?: string | null;
          precaucion_cm?: number;
          river_name?: string | null;
          sensor_material?: Database['public']['Enums']['sensor_material'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          alerta_cm?: number;
          code?: string;
          communication_type?: Database['public']['Enums']['comm_type'];
          created_at?: string;
          created_by?: string | null;
          flow_unit?: Database['public']['Enums']['flow_unit'];
          geom?: unknown;
          id?: never;
          installation_height_cm?: number;
          is_active?: boolean;
          lat?: number | null;
          level_unit?: Database['public']['Enums']['level_unit'];
          lng?: number | null;
          location_label?: string | null;
          name?: string;
          notes?: string | null;
          precaucion_cm?: number;
          river_name?: string | null;
          sensor_material?: Database['public']['Enums']['sensor_material'];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      station_config: {
        Row: {
          alerta_cm: number | null;
          channel_id: string | null;
          channel_slope: number | null;
          channel_width_m: number | null;
          code: string | null;
          communication_type: Database['public']['Enums']['comm_type'] | null;
          conversion_mode: Database['public']['Enums']['conversion_mode'] | null;
          field_name: string | null;
          flow_unit: Database['public']['Enums']['flow_unit'] | null;
          id: number | null;
          installation_height_cm: number | null;
          is_active: boolean | null;
          lat: number | null;
          level_unit: Database['public']['Enums']['level_unit'] | null;
          linear_factor: number | null;
          lng: number | null;
          location_label: string | null;
          manning_n: number | null;
          name: string | null;
          precaucion_cm: number | null;
          provider: string | null;
          refresh_interval_s: number | null;
          results_count: number | null;
          river_name: string | null;
          sensor_material: Database['public']['Enums']['sensor_material'] | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_bootstrap_available: {
        Args: never;
        Returns: boolean;
      };
      claim_admin: {
        Args: never;
        Returns: Database['public']['Enums']['app_role'];
      };
      create_station: {
        Args: {
          p_alerta_cm?: number;
          p_channel_id: string;
          p_channel_slope?: number;
          p_channel_width_m?: number;
          p_code: string;
          p_conversion_mode?: Database['public']['Enums']['conversion_mode'];
          p_installation_height_cm: number;
          p_lat: number;
          p_lng: number;
          p_location_label?: string;
          p_manning_n?: number;
          p_name: string;
          p_precaucion_cm?: number;
          p_read_api_key?: string;
          p_river_name?: string;
        };
        Returns: number;
      };
      current_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['app_role'];
      };
      move_station: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_station_id: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      alert_severity: 'critical' | 'warning' | 'info';
      alert_type:
        | 'MAX_LEVEL'
        | 'MIN_LEVEL'
        | 'MAX_FLOW'
        | 'MIN_FLOW'
        | 'RATE_OF_CHANGE'
        | 'SENSOR_OFFLINE';
      app_role: 'admin' | 'operator' | 'viewer';
      comm_type: '4-20mA' | 'RS485_MODBUS';
      conversion_mode: 'MANNING' | 'WEIR' | 'LINEAR' | 'DIRECT';
      flow_unit: 'L/s' | 'm3/s' | 'm3/h' | 'GPM';
      level_unit: 'cm' | 'm' | 'mm' | 'in';
      sensor_material: 'PP' | 'STAINLESS';
    };
    CompositeTypes: Record<never, never>;
  };
};

export type AppRole = Database['public']['Enums']['app_role'];
export type StationConfigRow = Database['public']['Views']['station_config']['Row'];
