export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          logo_url: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          logo_url?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          logo_url?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          role: Database['public']['Enums']['user_role'];
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          status: Database['public']['Enums']['project_status'];
          start_date: string | null;
          end_date: string | null;
          budget: number | null;
          manager_id: string | null;
          customer_name: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          customer_address: string | null;
          location: unknown | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          status?: Database['public']['Enums']['project_status'];
          start_date?: string | null;
          end_date?: string | null;
          budget?: number | null;
          manager_id?: string | null;
          customer_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          customer_address?: string | null;
          location?: unknown | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          status?: Database['public']['Enums']['project_status'];
          start_date?: string | null;
          end_date?: string | null;
          budget?: number | null;
          manager_id?: string | null;
          customer_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          customer_address?: string | null;
          location?: unknown | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_manager_id_fkey';
            columns: ['manager_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      fiber_routes: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          fiber_type: Database['public']['Enums']['fiber_type'];
          length_meters: number | null;
          route_geometry: unknown | null;
          start_point: unknown | null;
          end_point: unknown | null;
          status: Database['public']['Enums']['connection_status'];
          installation_date: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          fiber_type: Database['public']['Enums']['fiber_type'];
          length_meters?: number | null;
          route_geometry?: unknown | null;
          start_point?: unknown | null;
          end_point?: unknown | null;
          status?: Database['public']['Enums']['connection_status'];
          installation_date?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          description?: string | null;
          fiber_type?: Database['public']['Enums']['fiber_type'];
          length_meters?: number | null;
          route_geometry?: unknown | null;
          start_point?: unknown | null;
          end_point?: unknown | null;
          status?: Database['public']['Enums']['connection_status'];
          installation_date?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fiber_routes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      fiber_connections: {
        Row: {
          id: string;
          route_id: string;
          connection_point: unknown;
          connection_type: string;
          equipment_id: string | null;
          fiber_count: number;
          status: Database['public']['Enums']['connection_status'];
          installation_date: string | null;
          test_results: Json;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          connection_point: unknown;
          connection_type: string;
          equipment_id?: string | null;
          fiber_count?: number;
          status?: Database['public']['Enums']['connection_status'];
          installation_date?: string | null;
          test_results?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          route_id?: string;
          connection_point?: unknown;
          connection_type?: string;
          equipment_id?: string | null;
          fiber_count?: number;
          status?: Database['public']['Enums']['connection_status'];
          installation_date?: string | null;
          test_results?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fiber_connections_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'fiber_routes';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          route_id: string | null;
          assigned_to: string | null;
          title: string;
          description: string | null;
          status: Database['public']['Enums']['task_status'];
          priority: number;
          due_date: string | null;
          estimated_hours: number | null;
          actual_hours: number | null;
          location: unknown | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          route_id?: string | null;
          assigned_to?: string | null;
          title: string;
          description?: string | null;
          status?: Database['public']['Enums']['task_status'];
          priority?: number;
          due_date?: string | null;
          estimated_hours?: number | null;
          actual_hours?: number | null;
          location?: unknown | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          route_id?: string | null;
          assigned_to?: string | null;
          title?: string;
          description?: string | null;
          status?: Database['public']['Enums']['task_status'];
          priority?: number;
          due_date?: string | null;
          estimated_hours?: number | null;
          actual_hours?: number | null;
          location?: unknown | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'fiber_routes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      photos: {
        Row: {
          id: string;
          project_id: string | null;
          route_id: string | null;
          task_id: string | null;
          uploaded_by: string;
          file_name: string;
          file_url: string;
          file_size: number | null;
          mime_type: string | null;
          location: unknown | null;
          caption: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          route_id?: string | null;
          task_id?: string | null;
          uploaded_by: string;
          file_name: string;
          file_url: string;
          file_size?: number | null;
          mime_type?: string | null;
          location?: unknown | null;
          caption?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          route_id?: string | null;
          task_id?: string | null;
          uploaded_by?: string;
          file_name?: string;
          file_url?: string;
          file_size?: number | null;
          mime_type?: string | null;
          location?: unknown | null;
          caption?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photos_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'fiber_routes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_agreements: {
        Row: {
          id: string;
          project_id: string;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string | null;
          property_address: string;
          agreement_type: string;
          agreement_url: string | null;
          signed_date: string | null;
          is_signed: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          customer_name: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          property_address: string;
          agreement_type: string;
          agreement_url?: string | null;
          signed_date?: string | null;
          is_signed?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          customer_name?: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          property_address?: string;
          agreement_type?: string;
          agreement_url?: string | null;
          signed_date?: string | null;
          is_signed?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_agreements_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      realtime_metrics: {
        Row: {
          time: string;
          metric_name: string;
          tags: Json;
          value: number;
          unit: string;
          metadata: Json;
        };
        Insert: {
          time: string;
          metric_name: string;
          tags?: Json;
          value: number;
          unit: string;
          metadata?: Json;
        };
        Update: {
          time?: string;
          metric_name?: string;
          tags?: Json;
          value?: number;
          unit?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: 'admin' | 'manager' | 'field_worker' | 'customer';
      project_status:
        | 'planning'
        | 'in_progress'
        | 'completed'
        | 'on_hold'
        | 'cancelled';
      task_status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
      fiber_type:
        | 'single_mode'
        | 'multi_mode'
        | 'armored'
        | 'aerial'
        | 'underground';
      connection_status:
        | 'planned'
        | 'installed'
        | 'tested'
        | 'active'
        | 'inactive';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
