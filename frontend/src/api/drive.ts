import api from './client';
import type { FileItem, FolderItem, Conversation, Message, Drive, FileViewLink, AllViewsResponse } from '../lib/types';

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
  return res.data as { id: string; name: string; content: string; mime_type: string; is_favorite: boolean };
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

export async function listViewFiles() {
  const res = await api.get('/drive/views');
  return res.data as FileItem[];
}

export async function listAllViews() {
  const res = await api.get('/drive/all-views');
  return res.data as AllViewsResponse;
}

export async function getFileLinkedViews(fileId: string) {
  const res = await api.get(`/drive/files/${fileId}/views`);
  return res.data as FileViewLink[];
}

export async function linkViewToFile(fileId: string, viewFileId: string, label: string, position: number = 0) {
  const res = await api.post('/drive/file-views', {
    file_id: fileId,
    view_file_id: viewFileId,
    label,
    position,
  });
  return res.data as FileViewLink;
}

export async function unlinkViewFromFile(fileViewId: string) {
  await api.delete(`/drive/file-views/${fileViewId}`);
}

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
