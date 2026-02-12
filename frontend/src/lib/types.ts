export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  has_api_key: boolean;
  created_at: string;
}

export interface Drive {
  id: string;
  name: string;
  owner_id: string;
  views_folder_id: string | null;
  files_folder_id: string | null;
}

export interface FileItem {
  id: string;
  owner_id: string;
  workspace_id: string;
  folder_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  file_type: string;
  is_vibe_file: boolean;
  is_favorite: boolean;
  created_by_agent: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderItem {
  id: string;
  owner_id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  is_favorite: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  title: string | null;
  is_active: boolean;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'assistant' | 'system';
  sender_id: string | null;
  content: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatMessage {
  id?: string;
  conversation_id: string;
  sender_type: 'user' | 'assistant' | 'system';
  sender_id: string | null;
  sender_name?: string;
  content: string;
  created_at: string;
  isStreaming?: boolean;
}

export interface FileViewLink {
  id: string;
  file_id: string;
  view_file_id: string;
  label: string;
  position: number;
  view_file_name: string | null;
}

export interface AllViewsResponse {
  html_views: FileItem[];
  builtin_files: FileItem[];
}

export interface WSEvent {
  type: string;
  payload: Record<string, unknown>;
}
