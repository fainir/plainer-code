import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Image,
  FileSpreadsheet,
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
    default:
      return <Eye size={size} className="text-violet-500 shrink-0" />;
  }
}

function treeFileIcon(fileType: string) {
  switch (fileType) {
    case 'code':
      return <FileCode size={14} className="text-emerald-500 shrink-0" />;
    case 'document':
      return <FileText size={14} className="text-blue-500 shrink-0" />;
    case 'image':
      return <Image size={14} className="text-purple-500 shrink-0" />;
    case 'spreadsheet':
      return <FileSpreadsheet size={14} className="text-green-500 shrink-0" />;
    case 'pdf':
      return <FileText size={14} className="text-red-500 shrink-0" />;
    case 'view':
      return <Eye size={14} className="text-violet-500 shrink-0" />;
    default:
      return <FileIcon size={14} className="text-gray-400 shrink-0" />;
  }
}

function FileNode({ file, depth }: { file: FileItem; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const { selectedFileId, selectFile } = useDriveStore();
  const isActive = selectedFileId === file.id;

  // Lazy-load instances when expanded (only for non-instance files)
  const { data: instances } = useQuery({
    queryKey: ['file-instances', file.id],
    queryFn: () => getFileInstances(file.id),
    enabled: expanded && !file.is_instance,
  });

  const hasInstances = expanded && instances && instances.length > 0;
  const hasExpandButton = !file.is_instance;

  return (
    <div>
      <div
        className={`group w-full flex items-center gap-1.5 py-1 px-2 text-sm rounded transition cursor-pointer ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        role="button"
        tabIndex={0}
        onClick={() => selectFile(file.id, file.name, file.is_instance ? 'instance' : file.file_type)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') selectFile(file.id, file.name, file.is_instance ? 'instance' : file.file_type);
        }}
      >
        {/* Expand arrow on the left — only for data files, not instances */}
        {hasExpandButton ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className={`p-0.5 rounded shrink-0 transition ${
              expanded
                ? 'text-gray-500'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title={expanded ? 'Hide instances' : 'Show instances'}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span className="w-[15px] shrink-0" />
        )}
        {treeFileIcon(file.file_type)}
        <span className="truncate flex-1">
          {splitFileName(file.name).base}
          <span className="text-[0.7em] opacity-40">{splitFileName(file.name).ext}</span>
        </span>
        {file.is_vibe_file && (
          <Sparkles size={11} className="text-indigo-400 shrink-0" />
        )}
      </div>

      {/* Instances nested underneath */}
      {expanded && (
        <div>
          {hasInstances ? (
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
                style={{ paddingLeft: `${depth * 16 + 42}px` }}
              >
                {appTypeIcon(inst.app_type_slug, 11)}
                <span className="truncate">{inst.name}</span>
              </button>
            ))
          ) : (
            <p
              className="text-[11px] text-gray-400 italic py-0.5"
              style={{ paddingLeft: `${depth * 16 + 42}px` }}
            >
              No instances
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FolderNode({ folder, depth }: { folder: FolderItem; depth: number }) {
  const [expanded, setExpanded] = useState(false);
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

  // Filter out instance files — they show nested under their source file
  const visibleFiles = childFiles?.filter((f) => !f.is_instance) || [];

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
          {visibleFiles.map((file) => (
            <FileNode key={file.id} file={file} depth={depth + 1} />
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

function AppTypeNode({ slug, label }: { slug: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const { selectedFileId, selectFile } = useDriveStore();

  const { data: instances } = useQuery({
    queryKey: ['app-type-instances', slug],
    queryFn: () => listInstancesByAppType(slug),
    enabled: expanded,
  });

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
            return (
              <div
                key={file.id}
                role="button"
                tabIndex={0}
                onClick={() => selectFile(file.id, file.name, file.file_type)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') selectFile(file.id, file.name, file.file_type);
                }}
                className={`w-full flex items-center gap-1.5 py-1 px-2 text-sm rounded transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{ paddingLeft: '8px' }}
              >
                {treeFileIcon(file.file_type)}
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

  // Fetch contents of Files folder
  const { data: filesFiles } = useQuery({
    queryKey: ['drive-files', filesFolderId],
    queryFn: () => listFiles(filesFolderId!),
    enabled: isActive && !!filesFolderId,
  });

  const { data: filesFolders } = useQuery({
    queryKey: ['drive-folders', filesFolderId],
    queryFn: () => listFolders(filesFolderId!),
    enabled: isActive && !!filesFolderId,
  });

  // Filter out instance files — they show nested under their source file
  const visibleFiles = filesFiles?.filter((f) => !f.is_instance) || [];

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
          <div className="space-y-0.5">
            {filesFolders?.map((folder) => (
              <FolderNode key={folder.id} folder={folder} depth={0} />
            ))}
            {visibleFiles.map((file) => (
              <FileNode key={file.id} file={file} depth={0} />
            ))}
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

  // Filter out instance files
  const visibleFiles = sharedFiles?.filter((f) => !f.is_instance) || [];

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
                <FileNode key={file.id} file={file} depth={0} />
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
