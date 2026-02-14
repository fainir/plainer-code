import { create } from 'zustand';

type DriveView = 'private' | 'shared';
type FileViewMode = 'edit' | 'document' | 'table' | 'kanban' | 'calendar' | 'html-view' | 'docx' | 'instance';

function getDefaultViewMode(fileName: string, fileType?: string): FileViewMode {
  if (fileType === 'instance') return 'instance';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'doc' || ext === 'docx') return 'docx';
  if (ext === 'csv' || ext === 'tsv' || fileType === 'spreadsheet') return 'table';
  if (ext === 'md' || ext === 'markdown') return 'document';
  if (ext === 'html' || ext === 'htm' || fileType === 'view') return 'html-view';
  return 'edit';
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface DriveState {
  view: DriveView;
  currentFolderId: string | null;
  breadcrumbs: BreadcrumbItem[];
  selectedFileId: string | null;
  selectedFileName: string | null;
  selectedFileType: string | null;
  viewMode: FileViewMode;
  setView: (view: DriveView) => void;
  navigateToFolder: (folderId: string, folderName: string) => void;
  navigateToBreadcrumb: (index: number) => void;
  navigateToRoot: (homeFolderId?: string) => void;
  selectFile: (fileId: string, fileName: string, fileType?: string) => void;
  clearSelectedFile: () => void;
  setViewMode: (mode: FileViewMode) => void;
}

export type { FileViewMode };

export const useDriveStore = create<DriveState>((set) => ({
  view: 'private',
  currentFolderId: null,
  breadcrumbs: [{ id: null, name: 'Private' }],
  selectedFileId: null,
  selectedFileName: null,
  selectedFileType: null,
  viewMode: 'edit',

  setView: (view) =>
    set({
      view,
      currentFolderId: null,
      selectedFileId: null,
      selectedFileName: null,
      selectedFileType: null,
      viewMode: 'edit',
      breadcrumbs: [{ id: null, name: view === 'shared' ? 'Shared' : 'Private' }],
    }),

  navigateToFolder: (folderId, folderName) =>
    set((s) => ({
      currentFolderId: folderId,
      selectedFileId: null,
      selectedFileName: null,
      selectedFileType: null,
      viewMode: 'edit',
      breadcrumbs: [...s.breadcrumbs, { id: folderId, name: folderName }],
    })),

  navigateToBreadcrumb: (index) =>
    set((s) => ({
      currentFolderId: s.breadcrumbs[index].id,
      selectedFileId: null,
      selectedFileName: null,
      selectedFileType: null,
      viewMode: 'edit',
      breadcrumbs: s.breadcrumbs.slice(0, index + 1),
    })),

  navigateToRoot: (homeFolderId?: string) =>
    set({
      view: 'private',
      currentFolderId: homeFolderId || null,
      selectedFileId: null,
      selectedFileName: null,
      selectedFileType: null,
      viewMode: 'edit',
      breadcrumbs: [{ id: homeFolderId || null, name: 'Private' }],
    }),

  selectFile: (fileId, fileName, fileType) =>
    set({
      selectedFileId: fileId,
      selectedFileName: fileName,
      selectedFileType: fileType || null,
      viewMode: getDefaultViewMode(fileName, fileType || undefined),
    }),

  clearSelectedFile: () =>
    set({
      selectedFileId: null,
      selectedFileName: null,
      selectedFileType: null,
      viewMode: 'edit',
    }),

  setViewMode: (mode) =>
    set({ viewMode: mode }),
}));
