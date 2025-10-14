import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          full_name: string;
          department: string;
          role: 'user' | 'cliente' | 'rc_abogados' | 'admin';
          avatar_url: string;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          department?: string;
          role?: 'user' | 'cliente' | 'rc_abogados' | 'admin';
          avatar_url?: string;
        };
        Update: {
          full_name?: string;
          department?: string;
          role?: 'user' | 'cliente' | 'rc_abogados' | 'admin';
          avatar_url?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          name: string;
          rut: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          contact_person: string | null;
          notes: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          rut?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          contact_person?: string | null;
          notes?: string;
          created_by: string;
        };
        Update: {
          name?: string;
          rut?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          contact_person?: string | null;
          notes?: string;
        };
      };
      entity_types: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          parent_id: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
      };
      entities: {
        Row: {
          id: string;
          client_id: string;
          entity_type_id: string;
          name: string;
          rut: string;
          legal_representative: string | null;
          address: string | null;
          notes: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          entity_type_id: string;
          name: string;
          rut: string;
          legal_representative?: string | null;
          address?: string | null;
          notes?: string;
        };
        Update: {
          entity_type_id?: string;
          name?: string;
          rut?: string;
          legal_representative?: string | null;
          address?: string | null;
          notes?: string;
          is_active?: boolean;
        };
      };
      document_categories: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          parent_id: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
      };
      required_documents: {
        Row: {
          id: string;
          category_id: string;
          entity_type_id: string | null;
          name: string;
          description: string;
          is_required: boolean;
          display_order: number;
          validation_rules: any;
          created_at: string;
        };
        Insert: {
          category_id: string;
          entity_type_id?: string | null;
          name: string;
          description?: string;
          is_required?: boolean;
          display_order?: number;
          validation_rules?: any;
        };
      };
      entity_documents: {
        Row: {
          id: string;
          entity_id: string;
          required_document_id: string | null;
          category_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          title: string;
          description: string;
          notes: string;
          version: number;
          status: 'pending' | 'approved' | 'rejected' | 'expired';
          expiration_date: string | null;
          uploaded_by: string;
          uploaded_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string;
          metadata: any;
        };
        Insert: {
          entity_id: string;
          required_document_id?: string | null;
          category_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          title: string;
          description?: string;
          notes?: string;
          status?: 'pending' | 'approved' | 'rejected' | 'expired';
          expiration_date?: string | null;
          uploaded_by: string;
          metadata?: any;
        };
        Update: {
          title?: string;
          description?: string;
          notes?: string;
          status?: 'pending' | 'approved' | 'rejected' | 'expired';
          expiration_date?: string | null;
          reviewed_by?: string;
          reviewed_at?: string;
          review_notes?: string;
        };
      };
      document_reminders: {
        Row: {
          id: string;
          entity_id: string;
          required_document_id: string;
          reminder_type: 'missing' | 'expiring' | 'expired';
          message: string;
          due_date: string | null;
          priority: 'low' | 'medium' | 'high' | 'urgent';
          is_resolved: boolean;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
      };
      client_users: {
        Row: {
          id: string;
          client_id: string;
          user_id: string;
          granted_by: string;
          granted_at: string;
        };
        Insert: {
          client_id: string;
          user_id: string;
          granted_by: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          document_id: string | null;
          user_id: string;
          action: 'view' | 'download' | 'edit' | 'delete' | 'share' | 'upload';
          details: any;
          created_at: string;
        };
        Insert: {
          document_id?: string | null;
          user_id: string;
          action: 'view' | 'download' | 'edit' | 'delete' | 'share' | 'upload';
          details?: any;
        };
      };
    };
  };
};
