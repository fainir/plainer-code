import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import {
  getMyDrive,
  listFolders,
  listFiles,
  listSharedWithMe,
  listFavoriteFiles,
  listFavoriteFolders,
  listAppTypes,
  listInstancesByAppType,
  getFileInstances,
  createFile,
  uploadFile,
  reorderFiles,
  reorderFolders,
} from '../../api/drive';
import { useDriveStore } from '../../stores/driveStore';
import { useAuthStore } from '../../stores/authStore';
import type { FolderItem, FileItem } from '../../lib/types';
import {
  Lock,
  Globe,
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  LogOut,
  FileCode,
  FileText,
  FileSpreadsheet,
  Image,
  File as FileIcon,
  Sparkles,
  Star,
  Plus,
  Table,
  Columns3,
  Calendar,
  Pencil,
  Eye,
  LayoutGrid,
  Upload,
  Package,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import MarketplaceModal from '../marketplace/MarketplaceModal';

function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

function appTypeIcon(slug: string | null, size: number = 14) {
  switch (slug) {
    case 'table':
      return <Table size={size} className="text-green-600 shrink-0" />;
    case 'board':
      return <Columns3 size={size} className="text-blue-500 shrink-0" />;
    case 'calendar':
      return <Calendar size={size} className="text-orange-500 shrink-0" />;
    case 'document':
      return <FileText size={size} className="text-blue-600 shrink-0" />;
    case 'text-editor':
      return <Pencil size={size} className="text-gray-500 shrink-0" />;
    case 'custom-view':
    default:
      return <Sparkles size={size} className="text-amber-500 shrink-0" />;
  }
}

function treeFileIcon(fileType: string) {
  const cls = "text-gray-400 shrink-0";
  switch (fileType) {
    case 'code':
      return <FileCode size={14} className={cls} />;
    case 'document':
      return <FileText size={14} className={cls} />;
    case 'image':
      return <Image size={14} className={cls} />;
    case 'spreadsheet':
      return <FileSpreadsheet size={14} className={cls} />;
    case 'pdf':
      return <FileText size={14} className={cls} />;
    case 'view':
      return <Eye size={14} className={cls} />;
    default:
      return <FileIcon size={14} className={cls} />;
  }
}

function FileNode({ file, depth, siblingFiles }: { file: FileItem; depth: number; siblingFiles: FileItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const { selectedFileId, selectFile, setViewMode } = useDriveStore();
  const isActive = selectedFileId === file.id;

  // Data files: lazy-load instances via API
  const { data: instances } = useQuery({
    queryKey: ['file-instances', file.id],
    queryFn: () => getFileInstances(file.id),
    enabled: expanded && !file.is_instance,
  });

  // Instance files: find source data file(s) from siblings
  const relatedFiles = useMemo(() => {
    if (!file.is_instance || !expanded) return [];
    const related: FileItem[] = [];
    if (file.source_file_id) {
      const source = siblingFiles.find((f) => f.id === file.source_file_id);
      if (source) related.push(source);
    }
    if (file.related_source_ids) {
      for (const rid of file.related_source_ids) {
        if (rid === file.source_file_id) continue;
        const r = siblingFiles.find((f) => f.id === rid);
        if (r) related.push(r);
      }
    }
    return related;
  }, [file, expanded, siblingFiles]);

  // Filter out text-editor instances — editing is built into every file, not a separate view
  const expandedItems = file.is_instance
    ? relatedFiles
    : (instances || []).filter((i) => i.app_type_slug !== 'text-editor');

  return (
    <div>
      <div
        className={`group w-full flex items-center gap-1.5 py-1 px-2 text-sm rounded transition cursor-pointer ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${depth * 16 + 28}px` }}
        role="button"
        tabIndex={0}
        onClick={() => selectFile(file.id, file.name, file.is_instance ? 'instance' : file.file_type)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') selectFile(file.id, file.name, file.is_instance ? 'instance' : file.file_type);
        }}
      >
        {file.is_instance ? appTypeIcon(file.app_type_slug, 14) : treeFileIcon(file.file_type)}
        <span className="truncate flex-1">
          {splitFileName(file.name).base}
          <span className="text-[0.7em] opacity-40">{splitFileName(file.name).ext}</span>
        </span>
        {file.is_vibe_file && !file.is_instance && (
          <Sparkles size={11} className="text-indigo-400 shrink-0" />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className={`p-0.5 rounded shrink-0 transition ${
            expanded
              ? 'text-gray-500'
              : 'text-gray-300 group-hover:text-gray-400'
          }`}
          title={expanded ? 'Hide related files' : 'Show related files'}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
      </div>

      {/* Related files nested underneath */}
      {expanded && (
        <div>
          {/* Built-in Edit always first */}
          <button
            type="button"
            onClick={() => {
              selectFile(file.id, file.name, file.is_instance ? 'instance' : file.file_type);
              setViewMode('edit');
            }}
            className="w-full flex items-center gap-1.5 py-0.5 px-2 text-xs rounded transition text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
            style={{ paddingLeft: `${depth * 16 + 46}px` }}
          >
            <Pencil size={11} className="text-gray-400 shrink-0" />
            <span className="truncate">Edit</span>
          </button>
          {expandedItems.map((rel) => (
            <button
              key={rel.id}
              type="button"
              onClick={() => selectFile(rel.id, rel.name, rel.is_instance ? 'instance' : rel.file_type)}
              className={`w-full flex items-center gap-1.5 py-0.5 px-2 text-xs rounded transition ${
                selectedFileId === rel.id
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
              style={{ paddingLeft: `${depth * 16 + 46}px` }}
            >
              {rel.is_instance ? appTypeIcon(rel.app_type_slug, 11) : treeFileIcon(rel.file_type)}
              <span className="truncate">{rel.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderNode({ folder, depth }: { folder: FolderItem; depth: number }) {
  const isPlannerFolder = folder.name === 'Personal Planner' || folder.name === 'Company Planner';
  const [expanded, setExpanded] = useState(isPlannerFolder);
  const { currentFolderId, navigateToFolder } = useDriveStore();
  const isActive = currentFolderId === folder.id;

  const { data: childFolders } = useQuery({
    queryKey: ['drive-folders', folder.id],
    queryFn: () => listFolders(folder.id),
    enabled: expanded,
  });

  const { data: childFiles } = useQuery({
    queryKey: ['drive-files', folder.id],
    queryFn: () => listFiles(folder.id),
    enabled: expanded,
  });

  // text-editor is built-in edit mode, not a separate view file
  const allFiles = (childFiles || []).filter((f) => !(f.is_instance && f.app_type_slug === 'text-editor'));

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          navigateToFolder(folder.id, folder.name);
          if (!expanded) setExpanded(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            navigateToFolder(folder.id, folder.name);
            if (!expanded) setExpanded(true);
          }
        }}
        className={`w-full flex items-center gap-1.5 py-1 px-2 text-sm rounded transition cursor-pointer ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-0.5 hover:bg-gray-100 rounded shrink-0"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronDown size={12} className="text-gray-400" />
          ) : (
            <ChevronRight size={12} className="text-gray-400" />
          )}
        </button>
        <FolderIcon size={14} className="text-amber-500 shrink-0" />
        <span className="truncate">{folder.name}</span>
      </div>

      {expanded && (
        <>
          {childFolders?.map((child) => (
            <FolderNode key={child.id} folder={child} depth={depth + 1} />
          ))}
          {allFiles.map((file) => (
            <FileNode key={file.id} file={file} depth={depth + 1} siblingFiles={allFiles} />
          ))}
        </>
      )}
    </div>
  );
}


function CollapsibleSection({
  label,
  icon,
  children,
  defaultOpen = false,
  count,
  onAction,
  actionTitle,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  onAction?: () => void;
  actionTitle?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-700 transition"
        >
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {icon}
          <span>{label}</span>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-normal normal-case">
              {count}
            </span>
          )}
        </button>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="px-2 py-1 text-gray-400 hover:text-indigo-600 transition"
            title={actionTitle || 'Add'}
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      {open && <div className="ml-2 pl-1">{children}</div>}
    </div>
  );
}

function AddDropdown({
  onUpload,
  onTemplates,
  fileInputRef,
  onUploadChange,
}: {
  onUpload: () => void;
  onTemplates?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-2 py-1 text-gray-400 hover:text-indigo-600 transition"
        title="Add"
      >
        <Plus size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
          <button
            type="button"
            onClick={() => { onUpload(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition"
          >
            <Upload size={12} className="text-gray-400" /> Upload
          </button>
          {onTemplates && (
            <button
              type="button"
              onClick={() => { onTemplates(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition"
            >
              <FileText size={12} className="text-gray-400" /> From templates
            </button>
          )}
        </div>
      )}
      <input ref={fileInputRef} type="file" className="hidden" onChange={onUploadChange} multiple title="Upload files" />
    </div>
  );
}

const BUILTIN_SLUGS = ['table', 'board', 'calendar', 'document', 'text-editor', 'custom-view'];

const NON_CUSTOM_SLUGS = ['table', 'board', 'calendar', 'document', 'text-editor'];

function AppTypeNode({ slug, label }: { slug: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const { selectedFileId, selectFile } = useDriveStore();

  const isCustom = slug === 'custom-view';

  const { data: rawInstances } = useQuery({
    queryKey: ['app-type-instances', isCustom ? 'all-custom' : slug],
    queryFn: () => isCustom ? listInstancesByAppType() : listInstancesByAppType(slug),
    enabled: expanded,
  });

  const instances = isCustom
    ? rawInstances?.filter((i) => !NON_CUSTOM_SLUGS.includes(i.app_type_slug || ''))
    : rawInstances;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 py-1 px-2 text-sm text-gray-600 rounded hover:bg-gray-100 transition"
      >
        <span className={`transition ${expanded ? 'text-gray-500' : 'text-gray-300'}`}>
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        {appTypeIcon(slug, 14)}
        <span className="truncate flex-1 text-left">{label}</span>
        {expanded && instances && (
          <span className="text-[10px] text-gray-400">{instances.length}</span>
        )}
      </button>

      {expanded && (
        <div>
          {instances && instances.length > 0 ? (
            instances.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => selectFile(inst.id, inst.name, 'instance')}
                className={`w-full flex items-center gap-1.5 py-0.5 px-2 text-xs rounded transition ${
                  selectedFileId === inst.id
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                style={{ paddingLeft: '42px' }}
              >
                {appTypeIcon(inst.app_type_slug, 11)}
                <span className="truncate">{inst.name}</span>
              </button>
            ))
          ) : (
            <p className="text-[11px] text-gray-400 italic py-0.5" style={{ paddingLeft: '42px' }}>
              No instances yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AppAddDropdown({
  onCreateCustom,
  onFromMarketplace,
}: {
  onCreateCustom: () => void;
  onFromMarketplace: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition"
      >
        <Plus size={11} />
        <span>New App</span>
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
          <button
            type="button"
            onClick={() => { onCreateCustom(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition"
          >
            <Sparkles size={12} className="text-indigo-400" /> Create with AI
          </button>
          <button
            type="button"
            onClick={() => { onFromMarketplace(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition"
          >
            <Package size={12} className="text-gray-400" /> From marketplace
          </button>
        </div>
      )}
    </div>
  );
}

function AppsSection({
  onCreateCustomApp,
  onMarketplaceApp,
}: {
  onCreateCustomApp?: () => void;
  onMarketplaceApp?: () => void;
}) {
  const { data: appTypes } = useQuery({
    queryKey: ['app-types'],
    queryFn: () => listAppTypes(),
  });

  const builtinApps = (appTypes?.filter((a) => BUILTIN_SLUGS.includes(a.slug)) || [])
    .sort((a, b) => (a.slug === 'custom-view' ? -1 : b.slug === 'custom-view' ? 1 : 0));

  return (
    <CollapsibleSection
      label="Apps"
      icon={<LayoutGrid size={10} />}
      defaultOpen
    >
      {builtinApps.length > 0 ? (
        builtinApps.map((app) => (
          <AppTypeNode key={app.id} slug={app.slug} label={app.slug === 'custom-view' ? 'Custom' : app.label} />
        ))
      ) : (
        <p className="px-3 py-2 text-xs text-gray-400 italic">
          Loading apps...
        </p>
      )}
      {onCreateCustomApp && onMarketplaceApp && (
        <AppAddDropdown
          onCreateCustom={onCreateCustomApp}
          onFromMarketplace={onMarketplaceApp}
        />
      )}
    </CollapsibleSection>
  );
}

function FavoritesSection() {
  const { selectedFileId, selectFile, navigateToFolder } = useDriveStore();

  const { data: favFiles } = useQuery({
    queryKey: ['favorite-files'],
    queryFn: () => listFavoriteFiles(),
  });

  const { data: favFolders } = useQuery({
    queryKey: ['favorite-folders'],
    queryFn: () => listFavoriteFolders(),
  });

  const favCount = (favFiles?.length || 0) + (favFolders?.length || 0);

  return (
    <CollapsibleSection
      label="Favorites"
      icon={<Star size={10} />}
      count={favCount}
      defaultOpen
    >
      {favCount > 0 ? (
        <>
          {favFolders?.map((folder) => (
            <div
              key={folder.id}
              role="button"
              tabIndex={0}
              onClick={() => navigateToFolder(folder.id, folder.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id, folder.name);
              }}
              className="w-full flex items-center gap-1.5 py-1 px-2 text-sm rounded transition cursor-pointer text-gray-700 hover:bg-gray-100"
              style={{ paddingLeft: '8px' }}
            >
              <FolderIcon size={14} className="text-amber-500 shrink-0" />
              <span className="truncate flex-1">{folder.name}</span>
              <Star size={10} className="text-yellow-400 shrink-0 fill-yellow-400" />
            </div>
          ))}
          {favFiles?.map((file) => {
            const isActive = selectedFileId === file.id;
            const fileType = file.is_instance ? 'instance' : file.file_type;
            return (
              <div
                key={file.id}
                role="button"
                tabIndex={0}
                onClick={() => selectFile(file.id, file.name, fileType)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') selectFile(file.id, file.name, fileType);
                }}
                className={`w-full flex items-center gap-1.5 py-1 px-2 text-sm rounded transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{ paddingLeft: '8px' }}
              >
                {file.is_instance ? appTypeIcon(file.app_type_slug, 14) : treeFileIcon(file.file_type)}
                <span className="truncate flex-1">
                  {splitFileName(file.name).base}
                  <span className="text-[0.7em] opacity-40">{splitFileName(file.name).ext}</span>
                </span>
                <Star size={10} className="text-yellow-400 shrink-0 fill-yellow-400" />
              </div>
            );
          })}
        </>
      ) : (
        <p className="px-3 py-2 text-xs text-gray-400 italic">
          Star files to pin them here
        </p>
      )}
    </CollapsibleSection>
  );
}

function PrivateSection({ onAddTemplate }: { onAddTemplate?: () => void }) {
  const { view, navigateToRoot, currentFolderId, selectFile } = useDriveStore();
  const isActive = view === 'private';
  const [open, setOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch drive to get system folder IDs
  const { data: drive } = useQuery({
    queryKey: ['my-drive'],
    queryFn: () => getMyDrive(),
  });

  const filesFolderId = drive?.files_folder_id;

  // Auto-navigate to Files folder when drive data loads (Private = Files folder)
  useEffect(() => {
    if (isActive && filesFolderId && !currentFolderId) {
      navigateToRoot(filesFolderId);
    }
  }, [isActive, filesFolderId, currentFolderId, navigateToRoot]);

  // Fetch contents of Files folder — poll every 3s when empty (workspace being set up)
  const { data: filesFiles } = useQuery({
    queryKey: ['drive-files', filesFolderId],
    queryFn: () => listFiles(filesFolderId!),
    enabled: isActive && !!filesFolderId,
    refetchInterval: (query) =>
      query.state.data && query.state.data.length === 0 ? 3000 : false,
  });

  const { data: filesFolders } = useQuery({
    queryKey: ['drive-folders', filesFolderId],
    queryFn: () => listFolders(filesFolderId!),
    enabled: isActive && !!filesFolderId,
    refetchInterval: (query) =>
      query.state.data && query.state.data.length === 0 ? 3000 : false,
  });

  const isSettingUp = !!filesFolderId && filesFiles?.length === 0 && filesFolders?.length === 0;

  // text-editor is built-in edit mode, not a separate view file
  const visibleFiles = (filesFiles || []).filter((f) => !(f.is_instance && f.app_type_slug === 'text-editor'));

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;

    if (source.droppableId === 'sidebar-folders' && destination.droppableId === 'sidebar-folders') {
      const items = [...(filesFolders || [])];
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      queryClient.setQueryData(['drive-folders', filesFolderId], items);
      reorderFolders(items.map((f, i) => ({ id: f.id, sort_order: i })));
    } else if (source.droppableId === 'sidebar-files' && destination.droppableId === 'sidebar-files') {
      const items = [...visibleFiles];
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      const hidden = (filesFiles || []).filter((f) => f.is_instance && f.app_type_slug === 'text-editor');
      queryClient.setQueryData(['drive-files', filesFolderId], [...items, ...hidden]);
      reorderFiles(items.map((f, i) => ({ id: f.id, sort_order: i })));
    }
  }, [filesFolders, visibleFiles, filesFiles, filesFolderId, queryClient]);

  async function handleNewFile() {
    if (!filesFolderId) return;
    try {
      const file = await createFile('Untitled.md', '', filesFolderId);
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      selectFile(file.id, file.name, file.file_type);
    } catch { /* ignore */ }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !filesFolderId) return;
    for (const f of Array.from(files)) {
      try {
        await uploadFile(f, filesFolderId);
      } catch { /* ignore */ }
    }
    queryClient.invalidateQueries({ queryKey: ['drive-files'] });
    e.target.value = '';
  }

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => {
            if (!open) {
              setOpen(true);
              if (filesFolderId) navigateToRoot(filesFolderId);
            } else {
              setOpen(false);
            }
          }}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-700 transition"
        >
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <Lock size={10} />
          <span>Private Files</span>
        </button>
        <AddDropdown
          onUpload={() => fileInputRef.current?.click()}
          onTemplates={onAddTemplate}
          fileInputRef={fileInputRef}
          onUploadChange={handleUpload}
        />
      </div>

      {open && (
        <div className="ml-2 pl-1">
          {isSettingUp ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
              <div className="w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
              <span>Setting up your workspace...</span>
            </div>
          ) : (
            <>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="sidebar-folders">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5">
                      {filesFolders?.map((folder, index) => (
                        <Draggable key={folder.id} draggableId={`sf-${folder.id}`} index={index}>
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={snapshot.isDragging ? 'opacity-80 bg-white rounded shadow-sm' : ''}
                            >
                              <FolderNode folder={folder} depth={0} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <Droppable droppableId="sidebar-files">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5">
                      {visibleFiles.map((file, index) => (
                        <Draggable key={file.id} draggableId={`sf-${file.id}`} index={index}>
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={snapshot.isDragging ? 'opacity-80 bg-white rounded shadow-sm' : ''}
                            >
                              <FileNode file={file} depth={0} siblingFiles={visibleFiles} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <button
                type="button"
                onClick={handleNewFile}
                className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition"
              >
                <Plus size={11} />
                <span>New</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SharedSection({ onAddTemplate }: { onAddTemplate?: () => void }) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { selectFile } = useDriveStore();

  const { data: sharedFiles } = useQuery({
    queryKey: ['shared-files'],
    queryFn: () => listSharedWithMe(),
  });

  // Get files folder for new/upload actions
  const { data: drive } = useQuery({
    queryKey: ['my-drive'],
    queryFn: () => getMyDrive(),
  });
  const filesFolderId = drive?.files_folder_id;

  const visibleFiles = sharedFiles || [];

  async function handleNewFile() {
    if (!filesFolderId) return;
    try {
      const file = await createFile('Untitled.md', '', filesFolderId);
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      selectFile(file.id, file.name, file.file_type);
    } catch { /* ignore */ }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !filesFolderId) return;
    for (const f of Array.from(files)) {
      try {
        await uploadFile(f, filesFolderId);
      } catch { /* ignore */ }
    }
    queryClient.invalidateQueries({ queryKey: ['drive-files'] });
    e.target.value = '';
  }

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-700 transition"
        >
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <Globe size={10} />
          <span>Shared Files</span>
          {visibleFiles.length > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-normal normal-case">
              {visibleFiles.length}
            </span>
          )}
        </button>
        <AddDropdown
          onUpload={() => fileInputRef.current?.click()}
          onTemplates={onAddTemplate}
          fileInputRef={fileInputRef}
          onUploadChange={handleUpload}
        />
      </div>

      {open && (
        <div className="ml-2 pl-1">
          <div className="space-y-0.5">
            {visibleFiles.length > 0 ? (
              visibleFiles.map((file) => (
                <FileNode key={file.id} file={file} depth={0} siblingFiles={visibleFiles} />
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-gray-400 italic">
                No shared files yet
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleNewFile}
            className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100 transition"
          >
            <Plus size={11} />
            <span>New</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function FolderExplorer() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [marketplaceTab, setMarketplaceTab] = useState<string | null>(null);
  const { currentFolderId } = useDriveStore();

  return (
    <div className="h-full flex flex-col bg-white">
      {/* App header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h1 className="text-base font-bold text-gray-900">Plainer</h1>
      </div>

      {/* Navigation sections */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-0.5">
          <FavoritesSection />
          <AppsSection
            onCreateCustomApp={() => {
              useChatStore.getState().setPendingPrompt(
                'I want to create a new custom app. Ask me what kind of app I want and then create it for me.'
              );
              useUIStore.getState().setChatPanelOpen(true);
            }}
            onMarketplaceApp={() => setMarketplaceTab('app')}
          />
          <PrivateSection onAddTemplate={() => setMarketplaceTab('template')} />
          <SharedSection onAddTemplate={() => setMarketplaceTab('template')} />
        </div>
      </div>

      <MarketplaceModal
        open={!!marketplaceTab}
        onClose={() => setMarketplaceTab(null)}
        currentFolderId={currentFolderId}
        initialTab={marketplaceTab || undefined}
      />

      {/* User */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0">
              {user?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-sm text-gray-700 truncate">{user?.display_name}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="text-gray-400 hover:text-gray-600"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
