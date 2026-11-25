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
    PostgrestVersion: "17.1"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          bucket: string
          created_at: string
          deleted_at: string | null
          file_name: string
          id: string
          mime_type: string | null
          parent_id: string | null
          parent_table: string | null
          path: string
          size_bytes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          deleted_at?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          parent_id?: string | null
          parent_table?: string | null
          path: string
          size_bytes?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          parent_id?: string | null
          parent_table?: string | null
          path?: string
          size_bytes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          deleted_at: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          id: string
          location: string | null
          project_id: string | null
          start_date: string
          start_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          project_id?: string | null
          start_date: string
          start_time?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          project_id?: string | null
          start_date?: string
          start_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      daily_pages: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          energy: number | null
          handwriting_id: string | null
          id: string
          mood: number | null
          morning_plan: Json | null
          quick_notes: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          energy?: number | null
          handwriting_id?: string | null
          id?: string
          mood?: number | null
          morning_plan?: Json | null
          quick_notes?: Json | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          energy?: number | null
          handwriting_id?: string | null
          id?: string
          mood?: number | null
          morning_plan?: Json | null
          quick_notes?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_pages_handwriting_id_user_id_fkey"
            columns: ["handwriting_id", "user_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      daily_priorities: {
        Row: {
          created_at: string
          daily_page_id: string
          deleted_at: string | null
          done: boolean
          id: string
          position: number
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_page_id: string
          deleted_at?: string | null
          done?: boolean
          id?: string
          position: number
          text?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          daily_page_id?: string
          deleted_at?: string | null
          done?: boolean
          id?: string
          position?: number
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_priorities_daily_page_id_user_id_fkey"
            columns: ["daily_page_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_pages"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      daily_reflections: {
        Row: {
          answers: Json
          created_at: string
          daily_page_id: string
          deleted_at: string | null
          id: string
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          daily_page_id: string
          deleted_at?: string | null
          id?: string
          kind: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          daily_page_id?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reflections_daily_page_id_user_id_fkey"
            columns: ["daily_page_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_pages"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      drawing_strokes: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          drawing_id: string
          id: string
          points: Json
          seq: number
          tool: string
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          color: string
          created_at?: string
          deleted_at?: string | null
          drawing_id: string
          id?: string
          points: Json
          seq?: number
          tool: string
          updated_at?: string
          user_id?: string
          width: number
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          drawing_id?: string
          id?: string
          points?: Json
          seq?: number
          tool?: string
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "drawing_strokes_drawing_id_user_id_fkey"
            columns: ["drawing_id", "user_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      drawings: {
        Row: {
          created_at: string
          date: string | null
          deleted_at: string | null
          height: number
          id: string
          is_favorite: boolean
          kind: string
          paper: string
          preview_path: string | null
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          created_at?: string
          date?: string | null
          deleted_at?: string | null
          height?: number
          id?: string
          is_favorite?: boolean
          kind?: string
          paper?: string
          preview_path?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
          width?: number
        }
        Update: {
          created_at?: string
          date?: string | null
          deleted_at?: string | null
          height?: number
          id?: string
          is_favorite?: boolean
          kind?: string
          paper?: string
          preview_path?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          deleted_at: string | null
          duration_seconds: number
          ended_at: string | null
          id: string
          kind: string
          started_at: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date: string
          deleted_at?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          kind?: string
          started_at: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          deleted_at?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          kind?: string
          started_at?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_user_id_fkey"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          horizon: string
          id: string
          notes: Json | null
          period_start: string | null
          position: number
          progress: number
          project_id: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          horizon?: string
          id?: string
          notes?: Json | null
          period_start?: string | null
          position?: number
          progress?: number
          project_id?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          horizon?: string
          id?: string
          notes?: Json | null
          period_start?: string | null
          position?: number
          progress?: number
          project_id?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          habit_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          habit_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          habit_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_user_id_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          frequency: string
          id: string
          name: string
          position: number
          target_per_week: number
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          name: string
          position?: number
          target_per_week?: number
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          name?: string
          position?: number
          target_per_week?: number
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      journal_blocks: {
        Row: {
          attachment_id: string | null
          content: Json | null
          created_at: string
          deleted_at: string | null
          drawing_id: string | null
          id: string
          journal_entry_id: string
          kind: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_id?: string | null
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          drawing_id?: string | null
          id?: string
          journal_entry_id: string
          kind: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          attachment_id?: string | null
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          drawing_id?: string | null
          id?: string
          journal_entry_id?: string
          kind?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_blocks_drawing_id_user_id_fkey"
            columns: ["drawing_id", "user_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "journal_blocks_journal_entry_id_user_id_fkey"
            columns: ["journal_entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          category: string | null
          created_at: string
          deleted_at: string | null
          entry_date: string
          id: string
          is_favorite: boolean
          mood: number | null
          plain_text: string
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          entry_date: string
          id?: string
          is_favorite?: boolean
          mood?: number | null
          plain_text?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          entry_date?: string
          id?: string
          is_favorite?: boolean
          mood?: number | null
          plain_text?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: []
      }
      milestones: {
        Row: {
          created_at: string
          deleted_at: string | null
          done: boolean
          due_date: string | null
          goal_id: string
          id: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          done?: boolean
          due_date?: string | null
          goal_id: string
          id?: string
          position?: number
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          done?: boolean
          due_date?: string | null
          goal_id?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_goal_id_user_id_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notebook_pages: {
        Row: {
          archived_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_favorite: boolean
          notebook_id: string
          parent_page_id: string | null
          plain_text: string
          position: number
          project_id: string | null
          section_id: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_favorite?: boolean
          notebook_id: string
          parent_page_id?: string | null
          plain_text?: string
          position?: number
          project_id?: string | null
          section_id: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_favorite?: boolean
          notebook_id?: string
          parent_page_id?: string | null
          plain_text?: string
          position?: number
          project_id?: string | null
          section_id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_pages_notebook_id_user_id_fkey"
            columns: ["notebook_id", "user_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notebook_pages_parent_page_id_user_id_fkey"
            columns: ["parent_page_id", "user_id"]
            isOneToOne: false
            referencedRelation: "notebook_pages"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notebook_pages_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notebook_pages_section_id_user_id_fkey"
            columns: ["section_id", "user_id"]
            isOneToOne: false
            referencedRelation: "notebook_sections"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notebook_sections: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          notebook_id: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          notebook_id: string
          position?: number
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          notebook_id?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_sections_notebook_id_user_id_fkey"
            columns: ["notebook_id", "user_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notebooks: {
        Row: {
          archived_at: string | null
          category: string
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_favorite: boolean
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean
          position?: number
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          attachment_id: string | null
          content: Json | null
          created_at: string
          deleted_at: string | null
          drawing_id: string | null
          id: string
          kind: string
          page_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_id?: string | null
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          drawing_id?: string | null
          id?: string
          kind: string
          page_id: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          attachment_id?: string | null
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          drawing_id?: string | null
          id?: string
          kind?: string
          page_id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_drawing_id_user_id_fkey"
            columns: ["drawing_id", "user_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notes_page_id_user_id_fkey"
            columns: ["page_id", "user_id"]
            isOneToOne: false
            referencedRelation: "notebook_pages"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: Json | null
          position: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: Json | null
          position?: number
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: Json | null
          position?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          deleted_at: string | null
          dismissed: boolean
          event_id: string | null
          fired_at: string | null
          id: string
          remind_at: string
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dismissed?: boolean
          event_id?: string | null
          fired_at?: string | null
          id?: string
          remind_at: string
          task_id?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          dismissed?: boolean
          event_id?: string | null
          fired_at?: string | null
          id?: string
          remind_at?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_event_id_user_id_fkey"
            columns: ["event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "reminders_task_id_user_id_fkey"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          deleted_at: string | null
          done: boolean
          id: string
          position: number
          task_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          done?: boolean
          id?: string
          position?: number
          task_id: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          done?: boolean
          id?: string
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_user_id_fkey"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_recurrences: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string | null
          freq: string
          id: string
          interval: number
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          freq: string
          id?: string
          interval?: number
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          freq?: string
          id?: string
          interval?: number
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          completed_date: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          original_date: string | null
          position: number
          priority: number
          project_id: string | null
          recurrence_id: string | null
          reschedule_history: Json
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          completed_date?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          original_date?: string | null
          position?: number
          priority?: number
          project_id?: string | null
          recurrence_id?: string | null
          reschedule_history?: Json
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          completed_date?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          original_date?: string | null
          position?: number
          priority?: number
          project_id?: string | null
          recurrence_id?: string | null
          reschedule_history?: Json
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_user_id_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "tasks_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "tasks_recurrence_id_user_id_fkey"
            columns: ["recurrence_id", "user_id"]
            isOneToOne: false
            referencedRelation: "task_recurrences"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          default_paper: string
          deleted_at: string | null
          id: string
          language: string
          pen_only: boolean
          pomodoro: Json
          reflection_prompts: boolean
          section_layout: Json
          start_page: string
          theme: string
          timezone: string
          updated_at: string
          user_id: string
          week_start: number
        }
        Insert: {
          created_at?: string
          default_paper?: string
          deleted_at?: string | null
          id?: string
          language?: string
          pen_only?: boolean
          pomodoro?: Json
          reflection_prompts?: boolean
          section_layout?: Json
          start_page?: string
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          week_start?: number
        }
        Update: {
          created_at?: string
          default_paper?: string
          deleted_at?: string | null
          id?: string
          language?: string
          pen_only?: boolean
          pomodoro?: Json
          reflection_prompts?: boolean
          section_layout?: Json
          start_page?: string
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          week_start?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_my_account: { Args: never; Returns: undefined }
      purge_soft_deleted: { Args: never; Returns: undefined }
      server_now: { Args: never; Returns: string }
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
  public: {
    Enums: {},
  },
} as const

