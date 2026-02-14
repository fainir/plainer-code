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
  is_instance: boolean;
  app_type_id: string | null;
  app_type_slug: string | null;
  source_file_id: string | null;
  related_source_ids: string[] | null;
  instance_config: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppType {
  id: string;
  slug: string;
  label: string;
  icon: string;
  renderer: string;
  description: string | null;
  created_at: string;
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

export interface WSEvent {
  type: string;
  payload: Record<string, unknown>;
}

export interface MarketplaceItem {
  id: string;
  item_type: 'app' | 'file_template' | 'folder_template' | 'command';
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  content: string | null;
  is_builtin: boolean;
  is_featured: boolean;
  install_count: number;
  sort_order: number;
  status: 'draft' | 'submitted' | 'approved';
  created_by_id: string | null;
  created_at: string;
}

export interface MarketplaceUseResponse {
  action: string;
  file_id: string | null;
  folder_id: string | null;
  app_type_id: string | null;
  prompt: string | null;
}
