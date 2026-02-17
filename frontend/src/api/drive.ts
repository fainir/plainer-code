import api from './client';
import type { FileItem, FolderItem, Conversation, Message, Drive, AppType } from '../lib/types';

export async function getMyDrive() {
  const res = await api.get('/drive');
  return res.data as Drive;
}

export async function listFiles(folderId?: string) {
  const params: Record<string, string> = {};
  if (folderId) params.folder_id = folderId;
  const res = await api.get('/drive/files', { params });
  return res.data as FileItem[];
}

export async function createFile(name: string, content: string, folderId?: string) {
  const res = await api.post('/drive/files', {
    name,
    content,
    folder_id: folderId || null,
  });
  return res.data as FileItem;
}

export async function getFileContent(fileId: string) {
  const res = await api.get(`/drive/files/${fileId}/content`);
  return res.data as {
    id: string;
    name: string;
    content: string;
    mime_type: string;
    is_favorite: boolean;
    is_instance: boolean;
    app_type_slug: string | null;
    source_file_id: string | null;
    instance_config: string | null;
    template_content: string | null;
  };
}

export async function listFolders(parentId?: string) {
  const params: Record<string, string> = {};
  if (parentId) params.parent_id = parentId;
  const res = await api.get('/drive/folders', { params });
  return res.data as FolderItem[];
}

export async function createFolder(name: string, parentId?: string) {
  const res = await api.post('/drive/folders', {
    name,
    parent_id: parentId || null,
  });
  return res.data as FolderItem;
}

export async function listSharedWithMe() {
  const res = await api.get('/drive/shared');
  return res.data as FileItem[];
}

export async function listRecentFiles() {
  const res = await api.get('/drive/recent');
  return res.data as FileItem[];
}

export async function toggleFileFavorite(fileId: string) {
  const res = await api.put(`/drive/files/${fileId}/favorite`);
  return res.data as FileItem;
}

export async function toggleFolderFavorite(folderId: string) {
  const res = await api.put(`/drive/folders/${folderId}/favorite`);
  return res.data as FolderItem;
}

export async function listFavoriteFiles() {
  const res = await api.get('/drive/favorites/files');
  return res.data as FileItem[];
}

export async function listFavoriteFolders() {
  const res = await api.get('/drive/favorites/folders');
  return res.data as FolderItem[];
}

// ── App Types ──────────────────────────────────────────

export async function listAppTypes() {
  const res = await api.get('/drive/app-types');
  return res.data as AppType[];
}

export async function createAppType(data: {
  slug: string;
  label: string;
  icon?: string;
  renderer?: string;
  template_content?: string;
  description?: string;
}) {
  const res = await api.post('/drive/app-types', data);
  return res.data as AppType;
}

// ── Instances ──────────────────────────────────────────

export async function listInstancesByAppType(appTypeSlug?: string) {
  const params: Record<string, string> = {};
  if (appTypeSlug) params.app_type_slug = appTypeSlug;
  const res = await api.get('/drive/instances', { params });
  return res.data as FileItem[];
}

export async function getFileInstances(fileId: string) {
  const res = await api.get(`/drive/files/${fileId}/instances`);
  return res.data as FileItem[];
}

export async function createInstance(data: {
  source_file_id: string;
  related_source_ids?: string[];
  app_type_slug?: string;
  app_type_id?: string;
  name?: string;
  config?: string;
  content?: string;
}) {
  const res = await api.post('/drive/instances', data);
  return res.data as FileItem;
}

export async function updateInstanceConfig(instanceId: string, config: string) {
  const res = await api.put(`/drive/instances/${instanceId}/config`, { config });
  return res.data as FileItem;
}

// ── Sharing ────────────────────────────────────────────

export async function shareFile(fileId: string, email: string, permission: string = 'view') {
  const res = await api.post(`/drive/files/${fileId}/share`, { email, permission });
  return res.data;
}

export async function listConversations() {
  const res = await api.get('/drive/conversations');
  return res.data as Conversation[];
}

export async function createConversation(title?: string) {
  const res = await api.post('/drive/conversations', { title });
  return res.data as Conversation;
}

export async function listMessages(conversationId: string) {
  const res = await api.get(`/drive/conversations/${conversationId}/messages`);
  return res.data as Message[];
}

export async function uploadFile(file: File, folderId?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (folderId) formData.append('folder_id', folderId);
  const res = await api.post('/drive/files/upload', formData, {
    headers: { 'Content-Type': undefined },
  });
  return res.data as FileItem;
}

export async function updateFileContent(fileId: string, content: string) {
  const res = await api.put(`/drive/files/${fileId}/content`, { content });
  return res.data as {
    id: string;
    name: string;
    content: string;
    mime_type: string;
    is_favorite: boolean;
    is_instance: boolean;
    app_type_slug: string | null;
    source_file_id: string | null;
    instance_config: string | null;
  };
}
