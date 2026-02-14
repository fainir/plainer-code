import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFiles, createFile, listFolders, createFolder, listSharedWithMe, getFileContent, getFileLinkedViews, unlinkViewFromFile, uploadFile } from '../../api/drive';
import DocxViewer from './DocxViewer';
import { useDriveStore } from '../../stores/driveStore';
import { useChatStore } from '../../stores/chatStore';
import type { FileViewMode } from '../../stores/driveStore';
import { useUIStore } from '../../stores/uiStore';
import type { FileItem, FolderItem } from '../../lib/types';
import {
  FileCode,
  FileText,
  Image,
  FileSpreadsheet,
  File as FileIcon,
  Folder as FolderIcon,
  Plus,
  Sparkles,
  ChevronRight,
  FolderPlus,
  MessageSquare,
  ArrowLeft,
  Pencil,
  Table,
  FileType,
  Columns3,
  Calendar,
  Eye,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toggleFileFavorite } from '../../api/drive';

function fileIcon(fileType: string) {
  switch (fileType) {
    case 'code':
      return <FileCode size={20} className="text-emerald-500" />;
    case 'document':
      return <FileText size={20} className="text-blue-500" />;
    case 'image':
      return <Image size={20} className="text-purple-500" />;
    case 'spreadsheet':
      return <FileSpreadsheet size={20} className="text-green-500" />;
    case 'pdf':
      return <FileText size={20} className="text-red-500" />;
    case 'view':
      return <Eye size={20} className="text-violet-500" />;
    default:
      return <FileIcon size={20} className="text-gray-400" />;
  }
}

function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

function guessFileType(mimeType: string, fileName: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'spreadsheet';
  if (
    mimeType.startsWith('text/x-') ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    /\.(py|js|ts|tsx|jsx|rb|go|rs|java|c|cpp|h|css|sh|yml|yaml|toml|sql)$/.test(fileName)
  ) return 'code';
  if (/\.html?$/.test(fileName)) return 'view';
  if (mimeType.startsWith('text/')) return 'document';
  return 'other';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── CSV Parser ──────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map(parseLine);
  return { headers, rows };
}

// ── Built-in Viewers ────────────────────────────────────

function RawViewer({ content, isCode }: { content: string; isCode: boolean }) {
  const [editContent, setEditContent] = useState(content);

  return (
    <div className="h-full flex flex-col -m-5">
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        className={`flex-1 p-5 text-sm text-gray-800 outline-none resize-none bg-white ${isCode ? 'font-mono' : ''}`}
        spellCheck={!isCode}
        aria-label="File content editor"
      />
    </div>
  );
}

function TableViewer({ content }: { content: string }) {
  const { headers, rows } = useMemo(() => parseCSV(content), [content]);

  if (headers.length === 0) {
    return <p className="text-sm text-gray-500">No data to display as table.</p>;
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50/50">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-800 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownViewer({ content }: { content: string }) {
  const html = useMemo(() => {
    let result = content;
    // Headers
    result = result.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-4 mb-2">$1</h3>');
    result = result.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-5 mb-2">$1</h2>');
    result = result.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-6 mb-3">$1</h1>');
    // Bold and italic
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Inline code
    result = result.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-pink-600">$1</code>');
    // Code blocks
    result = result.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '<pre class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm font-mono text-gray-800 overflow-auto my-3">$1</pre>');
    // Links
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
    // Unordered lists
    result = result.replace(/^[*-] (.+)$/gm, '<li class="ml-4 list-disc text-gray-800">$1</li>');
    // Ordered lists
    result = result.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-800">$1</li>');
    // Horizontal rules
    result = result.replace(/^---$/gm, '<hr class="my-4 border-gray-200" />');
    // Paragraphs (double newlines)
    result = result.replace(/\n\n/g, '</p><p class="text-sm text-gray-800 mb-3">');
    // Single newlines to <br>
    result = result.replace(/\n/g, '<br />');
    return `<p class="text-sm text-gray-800 mb-3">${result}</p>`;
  }, [content]);

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function KanbanViewer({ content }: { content: string }) {
  const { headers, rows } = useMemo(() => parseCSV(content), [content]);

  // Find a "status" column (status, stage, state, column)
  const statusIdx = useMemo(() => {
    const candidates = ['status', 'stage', 'state', 'column', 'category'];
    const idx = headers.findIndex((h) =>
      candidates.includes(h.toLowerCase())
    );
    return idx >= 0 ? idx : (headers.length > 1 ? 1 : 0);
  }, [headers]);

  const nameIdx = 0;

  const columns = useMemo(() => {
    const map = new Map<string, string[][]>();
    for (const row of rows) {
      const status = row[statusIdx] || 'Uncategorized';
      if (!map.has(status)) map.set(status, []);
      map.get(status)!.push(row);
    }
    return map;
  }, [rows, statusIdx]);

  if (headers.length === 0) {
    return <p className="text-sm text-gray-500">No data to display as kanban.</p>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from(columns.entries()).map(([status, items]) => (
        <div key={status} className="flex-shrink-0 w-64 bg-gray-50 rounded-lg border border-gray-200">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-100 rounded-t-lg">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {status}
              <span className="ml-1.5 text-gray-400 font-normal">{items.length}</span>
            </h3>
          </div>
          <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
            {items.map((row, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <p className="text-sm font-medium text-gray-900">{row[nameIdx]}</p>
                {headers.map((h, hi) => {
                  if (hi === nameIdx || hi === statusIdx) return null;
                  if (!row[hi]) return null;
                  return (
                    <p key={hi} className="text-xs text-gray-500 mt-1">
                      <span className="font-medium">{h}:</span> {row[hi]}
                    </p>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarViewer({ content }: { content: string }) {
  const { headers, rows } = useMemo(() => parseCSV(content), [content]);

  // Find a date column
  const dateIdx = useMemo(() => {
    const candidates = ['date', 'due', 'due_date', 'start', 'start_date', 'created', 'deadline'];
    const idx = headers.findIndex((h) =>
      candidates.includes(h.toLowerCase().replace(/\s+/g, '_'))
    );
    return idx >= 0 ? idx : -1;
  }, [headers]);

  const nameIdx = 0;

  // Group by month-year
  const months = useMemo(() => {
    if (dateIdx < 0) return new Map<string, { date: Date; row: string[] }[]>();
    const map = new Map<string, { date: Date; row: string[] }[]>();
    for (const row of rows) {
      const d = new Date(row[dateIdx]);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ date: d, row });
    }
    // Sort entries within each month
    for (const [, entries] of map) {
      entries.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    return map;
  }, [rows, dateIdx]);

  if (dateIdx < 0) {
    return (
      <div className="text-center py-8">
        <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No date column found in this file.</p>
        <p className="text-xs text-gray-400 mt-1">
          Add a column named "date", "due", or "deadline" to use calendar view.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(months.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, entries]) => {
          const [year, month] = monthKey.split('-');
          const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
          return (
            <div key={monthKey}>
              <h3 className="text-sm font-bold text-gray-700 mb-2">{monthName}</h3>
              <div className="space-y-1">
                {entries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 px-3 bg-white border border-gray-100 rounded-lg">
                    <div className="text-center shrink-0 w-10">
                      <div className="text-lg font-bold text-indigo-600">{entry.date.getDate()}</div>
                      <div className="text-[10px] text-gray-400 uppercase">
                        {entry.date.toLocaleString('default', { weekday: 'short' })}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.row[nameIdx]}</p>
                      {headers.map((h, hi) => {
                        if (hi === nameIdx || hi === dateIdx) return null;
                        if (!entry.row[hi]) return null;
                        return (
                          <p key={hi} className="text-xs text-gray-500">
                            <span className="font-medium">{h}:</span> {entry.row[hi]}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function HtmlViewRenderer({ content }: { content: string }) {
  return (
    <iframe
      srcDoc={content}
      sandbox="allow-scripts"
      className="w-full h-full border-0 rounded-lg bg-white"
      title="View renderer"
    />
  );
}

// ── View Mode Tabs ──────────────────────────────────────

interface ViewModeOption {
  mode: FileViewMode;
  label: string;
  icon: React.ReactNode;
  description: string;
  linkedViewFileId?: string;
  fileViewId?: string;
}

/** The single default view for a file type (the one shown automatically). */
function getDefaultViewModeOption(fileName: string, fileType: string): ViewModeOption {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'doc' || ext === 'docx')
    return { mode: 'docx', label: 'Document', icon: <FileType size={14} />, description: 'Word document' };
  if (ext === 'csv' || ext === 'tsv' || fileType === 'spreadsheet')
    return { mode: 'table', label: 'Table', icon: <Table size={14} />, description: 'Spreadsheet' };
  if (ext === 'md' || ext === 'markdown' || fileType === 'document')
    return { mode: 'document', label: 'Document', icon: <FileType size={14} />, description: 'Rich text' };
  if (ext === 'html' || ext === 'htm' || fileType === 'view')
    return { mode: 'html-view', label: 'Preview', icon: <Eye size={14} />, description: 'Live render' };
  return { mode: 'edit', label: 'Text', icon: <Pencil size={14} />, description: 'Raw source' };
}

/** Built-in views that can be added (excludes the default). */
function getAddableBuiltinModes(fileName: string, fileType: string): ViewModeOption[] {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const all: ViewModeOption[] = [];

  all.push({ mode: 'edit', label: 'Text', icon: <Pencil size={14} />, description: 'Raw source' });

  if (ext === 'md' || ext === 'markdown' || ext === 'txt' || ext === 'rst' || fileType === 'document')
    all.push({ mode: 'document', label: 'Document', icon: <FileType size={14} />, description: 'Rich text' });

  if (ext === 'csv' || ext === 'tsv' || fileType === 'spreadsheet') {
    all.push({ mode: 'table', label: 'Table', icon: <Table size={14} />, description: 'Spreadsheet' });
    all.push({ mode: 'kanban', label: 'Board', icon: <Columns3 size={14} />, description: 'Kanban board' });
    all.push({ mode: 'calendar', label: 'Calendar', icon: <Calendar size={14} />, description: 'Timeline' });
  }

  if (ext === 'html' || ext === 'htm' || fileType === 'view')
    all.push({ mode: 'html-view', label: 'Preview', icon: <Eye size={14} />, description: 'Live render' });

  const defaultMode = getDefaultViewModeOption(fileName, fileType).mode;
  return all.filter((m) => m.mode !== defaultMode);
}

function ViewModeBar({
  modes,
  active,
  activeLinkedViewId,
  onChange,
  onRemove,
  addableBuiltins,
  onAddBuiltin,
  onCreateCustom,
  isDataFile,
}: {
  modes: ViewModeOption[];
  active: FileViewMode;
  activeLinkedViewId: string | null;
  onChange: (mode: FileViewMode, linkedViewFileId?: string) => void;
  onRemove?: (mode: string, fileViewId?: string) => void;
  addableBuiltins: ViewModeOption[];
  onAddBuiltin: (mode: ViewModeOption) => void;
  onCreateCustom: () => void;
  isDataFile: boolean;
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Which built-in modes are already shown as tabs?
  const shownModes = new Set(modes.filter((m) => !m.linkedViewFileId).map((m) => m.mode));
  const availableBuiltins = addableBuiltins.filter((m) => !shownModes.has(m.mode));

  const hasAddOptions = availableBuiltins.length > 0 || isDataFile;

  return (
    <div className="flex items-center gap-0.5 px-4 py-1.5 shrink-0">
      {modes.map(({ mode, label, icon, description, linkedViewFileId, fileViewId }, idx) => {
        const isActive = linkedViewFileId
          ? (active === 'html-view' && activeLinkedViewId === linkedViewFileId)
          : (active === mode && !activeLinkedViewId);
        const isDefault = idx === 0;

        return (
          <button
            key={linkedViewFileId || mode}
            type="button"
            onClick={() => onChange(mode, linkedViewFileId)}
            title={description}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap group ${
              isActive
                ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200'
                : 'text-gray-500 hover:text-gray-800 hover:bg-white/60 border border-transparent'
            }`}
          >
            {icon}
            {label}
            {!isDefault && onRemove && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onRemove(mode, fileViewId); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemove(mode, fileViewId); } }}
                className="ml-0.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                title="Remove this view"
              >
                <X size={10} />
              </span>
            )}
          </button>
        );
      })}

      {/* Add view button */}
      {hasAddOptions && (
        <>
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${
              showAddMenu
                ? 'bg-white text-indigo-600 shadow-sm border border-indigo-200'
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/60 border border-transparent'
            }`}
            title="Add view"
          >
            <Plus size={13} />
            <span className="text-[11px]">Add view</span>
          </button>

          {showAddMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAddMenu(false)}
                onKeyDown={(e) => { if (e.key === 'Escape') setShowAddMenu(false); }}
                role="button"
                tabIndex={-1}
                aria-label="Close menu"
              />
              <div className="absolute left-4 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5">
                {availableBuiltins.map((m) => (
                  <button
                    key={m.mode}
                    type="button"
                    onClick={() => { onAddBuiltin(m); setShowAddMenu(false); }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                  >
                    <span className="text-gray-400">{m.icon}</span>
                    <span className="flex-1">{m.label}</span>
                    <span className="text-[10px] text-gray-400">{m.description}</span>
                  </button>
                ))}

                {isDataFile && (
                  <>
                    {availableBuiltins.length > 0 && <div className="border-t border-gray-100 my-1" />}
                    <button
                      type="button"
                      onClick={() => { onCreateCustom(); setShowAddMenu(false); }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition font-medium"
                    >
                      <Sparkles size={14} />
                      Custom view with AI...
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── FileViewer ──────────────────────────────────────────

function FileViewer({ fileId, fileName }: { fileId: string; fileName: string }) {
  const { clearSelectedFile, viewMode, setViewMode, selectedFileType, linkedViewFileId, selectLinkedView } = useDriveStore();
  const { toggleChatPanel, chatPanelOpen } = useUIStore();
  const queryClient = useQueryClient();

  // Extra built-in tabs the user has added via the "+" menu
  const [extraBuiltinModes, setExtraBuiltinModes] = useState<ViewModeOption[]>([]);
  const [showCustomViewDialog, setShowCustomViewDialog] = useState(false);
  const [customViewPrompt, setCustomViewPrompt] = useState('');
  const { setPendingPrompt } = useChatStore();

  const { data: fileData, isLoading, error } = useQuery({
    queryKey: ['file-content', fileId],
    queryFn: () => getFileContent(fileId),
  });

  // Fetch linked HTML views for this file
  const { data: linkedViews } = useQuery({
    queryKey: ['file-linked-views', fileId],
    queryFn: () => getFileLinkedViews(fileId),
  });

  // Fetch the linked view file's content when active
  const { data: linkedViewData } = useQuery({
    queryKey: ['file-content', linkedViewFileId],
    queryFn: () => getFileContent(linkedViewFileId!),
    enabled: !!linkedViewFileId,
  });

  const favMutation = useMutation({
    mutationFn: () => toggleFileFavorite(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-content', fileId] });
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-files'] });
      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (fileViewId: string) => unlinkViewFromFile(fileViewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-linked-views', fileId] });
      queryClient.invalidateQueries({ queryKey: ['all-views'] });
      if (linkedViewFileId) {
        setViewMode('edit');
      }
    },
  });

  const detectedType = fileData ? guessFileType(fileData.mime_type, fileData.name) : (selectedFileType || 'other');
  const actualName = fileData?.name || fileName;

  const isCode = fileData && (
    fileData.mime_type.startsWith('text/x-') ||
    fileData.mime_type === 'application/javascript' ||
    fileData.mime_type === 'application/json' ||
    fileData.mime_type === 'application/xml' ||
    /\.(py|js|ts|tsx|jsx|rb|go|rs|java|c|cpp|h|css|sh|yml|yaml|toml|sql)$/.test(fileData.name)
  );

  // Build tab list: Edit + default + user-added builtins + custom linked views
  const defaultMode = getDefaultViewModeOption(actualName, detectedType);
  const editMode: ViewModeOption = { mode: 'edit', label: 'Text', icon: <Pencil size={14} />, description: 'Raw source' };
  const baseModes = defaultMode.mode === 'edit' ? [defaultMode] : [editMode, defaultMode];
  const addableBuiltins = getAddableBuiltinModes(actualName, detectedType);

  // Filter out auto-generated linked views (whose labels match built-in mode names)
  const builtinLabels = new Set(['Table', 'Board', 'Calendar', 'Document', 'Edit', 'Preview']);
  const customLinkedViews: ViewModeOption[] = (linkedViews || [])
    .filter((lv) => !builtinLabels.has(lv.label))
    .map((lv) => ({
      mode: 'html-view' as FileViewMode,
      label: lv.label,
      icon: <Eye size={14} />,
      description: lv.view_file_name || lv.label,
      linkedViewFileId: lv.view_file_id,
      fileViewId: lv.id,
    }));
  const shownModes = [...baseModes, ...extraBuiltinModes, ...customLinkedViews];

  const isDataFile = ['spreadsheet', 'document', 'code', 'other'].includes(detectedType) && detectedType !== 'view';

  const handleViewModeChange = (mode: FileViewMode, lvFileId?: string) => {
    if (lvFileId) {
      selectLinkedView(lvFileId);
    } else {
      setViewMode(mode);
    }
  };

  const handleAddBuiltin = (opt: ViewModeOption) => {
    setExtraBuiltinModes((prev) => [...prev, opt]);
    setViewMode(opt.mode);
  };

  const handleRemoveTab = (mode: string, fileViewId?: string) => {
    if (fileViewId) {
      // Unlink a linked HTML view
      unlinkMutation.mutate(fileViewId);
    } else {
      // Remove a user-added built-in tab
      setExtraBuiltinModes((prev) => prev.filter((m) => m.mode !== mode));
      if (viewMode === mode) {
        setViewMode(defaultMode.mode);
      }
    }
  };

  const handleCreateCustom = () => {
    setShowCustomViewDialog(true);
    setCustomViewPrompt('');
  };

  const handleSubmitCustomView = () => {
    if (!customViewPrompt.trim()) return;
    const prompt = `Create a custom HTML view for the file "${actualName}" (ID: ${fileId}) that: ${customViewPrompt.trim()}. Read the file content first, then create an HTML view file and link it to this file.`;
    setPendingPrompt(prompt);
    if (!chatPanelOpen) toggleChatPanel();
    setShowCustomViewDialog(false);
    setCustomViewPrompt('');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={clearSelectedFile}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition shrink-0"
            title="Back to files"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {fileData && fileIcon(detectedType)}
            <span className="text-sm font-semibold text-gray-900 truncate">
              {splitFileName(actualName).base}
              <span className="text-[0.8em] font-normal opacity-40">{splitFileName(actualName).ext}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => favMutation.mutate()}
            className="p-1 rounded hover:bg-gray-100 transition shrink-0"
            title="Toggle favorite"
          >
            <Star size={14} className={favMutation.isPending ? 'text-gray-300' : fileData?.is_favorite ? 'text-amber-500 fill-amber-500' : 'text-gray-400 hover:text-amber-500'} />
          </button>
        </div>
        <button
          type="button"
          onClick={toggleChatPanel}
          className={`p-1.5 rounded-lg transition ${
            chatPanelOpen
              ? 'text-indigo-600 bg-indigo-50'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Toggle AI Chat"
        >
          <MessageSquare size={16} />
        </button>
      </div>

      {/* View mode tabs */}
      <div className="relative flex items-center border-b border-gray-200 bg-gray-50/80 shrink-0">
        <ViewModeBar
          modes={shownModes}
          active={viewMode}
          activeLinkedViewId={linkedViewFileId}
          onChange={handleViewModeChange}
          onRemove={handleRemoveTab}
          addableBuiltins={addableBuiltins}
          onAddBuiltin={handleAddBuiltin}
          onCreateCustom={handleCreateCustom}
          isDataFile={isDataFile}
        />
      </div>

      {/* Custom view with AI dialog */}
      {showCustomViewDialog && (
        <div className="px-5 py-3 border-b border-gray-200 bg-indigo-50/50">
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-indigo-500 mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-indigo-700 mb-1.5">Create a custom view with AI</p>
              <textarea
                value={customViewPrompt}
                onChange={(e) => setCustomViewPrompt(e.target.value)}
                placeholder="Describe the view you want, e.g. 'A dashboard showing task completion rates by status'"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none bg-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitCustomView();
                  }
                }}
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={handleSubmitCustomView}
                  disabled={!customViewPrompt.trim()}
                  className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomViewDialog(false)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-500 text-sm">Failed to load file content</p>
            <button
              type="button"
              onClick={clearSelectedFile}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              Go back
            </button>
          </div>
        ) : viewMode === 'docx' && fileData?.content ? (
          <DocxViewer fileId={fileId} content={fileData.content} fileName={actualName} />
        ) : viewMode === 'html-view' && linkedViewFileId && linkedViewData?.content ? (
          <div className="h-full -m-5">
            <HtmlViewRenderer content={linkedViewData.content} />
          </div>
        ) : viewMode === 'table' && fileData?.content ? (
          <TableViewer content={fileData.content} />
        ) : viewMode === 'document' && fileData?.content ? (
          <MarkdownViewer content={fileData.content} />
        ) : viewMode === 'kanban' && fileData?.content ? (
          <KanbanViewer content={fileData.content} />
        ) : viewMode === 'calendar' && fileData?.content ? (
          <CalendarViewer content={fileData.content} />
        ) : viewMode === 'html-view' && fileData?.content ? (
          <div className="h-full -m-5">
            <HtmlViewRenderer content={fileData.content} />
          </div>
        ) : fileData?.content ? (
          <RawViewer content={fileData.content} isCode={!!isCode} />
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">File Information</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24">Name:</dt>
                <dd className="text-gray-900">{fileData?.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24">Type:</dt>
                <dd className="text-gray-900">{fileData?.mime_type}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Drive Component ────────────────────────────────

export default function Drive() {
  const queryClient = useQueryClient();
  const {
    view,
    currentFolderId,
    breadcrumbs,
    selectedFileId,
    selectedFileName,
    navigateToFolder,
    navigateToBreadcrumb,
    selectFile,
  } = useDriveStore();
  const { toggleChatPanel, chatPanelOpen } = useUIStore();

  const [showCreateFile, setShowCreateFile] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPrivate = view === 'private';
  const isShared = view === 'shared';

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: isShared ? ['shared-files'] : ['drive-files', currentFolderId],
    queryFn: () =>
      isShared ? listSharedWithMe() : listFiles(currentFolderId || undefined),
  });

  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: ['drive-folders', currentFolderId],
    queryFn: () => listFolders(currentFolderId || undefined),
    enabled: isPrivate,
  });

  const createFileMutation = useMutation({
    mutationFn: () => createFile(newFileName, newFileContent, currentFolderId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
      setShowCreateFile(false);
      setNewFileName('');
      setNewFileContent('');
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: () => createFolder(newFolderName, currentFolderId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
      setShowCreateFolder(false);
      setNewFolderName('');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, currentFolderId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files'] });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  };

  // File viewer mode
  if (selectedFileId) {
    return <FileViewer fileId={selectedFileId} fileName={selectedFileName || ''} />;
  }

  // Filter out view-type files — they show nested under their parent in the sidebar
  const visibleFiles = files?.filter((f) => f.file_type !== 'view') || [];

  const isLoading = filesLoading || foldersLoading;
  const title = isShared ? 'Shared' : 'Private';

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0">
        <div>
          {isPrivate && breadcrumbs.length > 1 ? (
            <div className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={14} className="text-gray-400" />}
                  <button
                    type="button"
                    onClick={() => navigateToBreadcrumb(i)}
                    className={`hover:text-indigo-600 transition ${
                      i === breadcrumbs.length - 1
                        ? 'text-gray-900 font-semibold'
                        : 'text-gray-500'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPrivate && (
            <>
              <button
                type="button"
                onClick={() => setShowCreateFolder(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
              >
                <FolderPlus size={14} />
                New folder
              </button>
              <button
                type="button"
                onClick={() => setShowCreateFile(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition"
              >
                <Plus size={14} />
                New file
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
              >
                <Upload size={14} />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".doc,.docx,.pdf,.csv,.xlsx,.xls,.md,.txt"
                onChange={handleFileUpload}
                aria-label="Upload file"
              />
            </>
          )}
          <button
            type="button"
            onClick={toggleChatPanel}
            className={`p-1.5 rounded-lg transition ${
              chatPanelOpen
                ? 'text-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Toggle AI Chat"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      {/* Create forms */}
      <div className="px-5">
        {showCreateFolder && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mt-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => createFolderMutation.mutate()}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateFolder(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showCreateFile && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mt-3">
            <div className="space-y-2">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="File name (e.g. app.py, README.md)"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                autoFocus
              />
              <textarea
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                placeholder="File content..."
                rows={5}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => createFileMutation.mutate()}
                  disabled={!newFileName.trim() || createFileMutation.isPending}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateFile(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto px-5 py-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (folders?.length || 0) === 0 && visibleFiles.length === 0 ? (
          <div className="text-center py-16">
            <FileIcon size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm mb-1">
              {isShared ? 'Nothing shared yet' : 'No files yet'}
            </p>
            {isPrivate && (
              <p className="text-xs text-gray-400">
                Create a file or use the AI chat to generate one
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">
                    Type
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">
                    Size
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                    Modified
                  </th>
                </tr>
              </thead>
              <tbody>
                {isPrivate &&
                  folders?.map((folder: FolderItem) => (
                    <tr
                      key={folder.id}
                      onClick={() => navigateToFolder(folder.id, folder.name)}
                      className="border-b border-gray-50 hover:bg-indigo-50/50 transition cursor-pointer"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <FolderIcon size={18} className="text-amber-500" />
                          <span className="text-sm font-medium text-gray-900">
                            {folder.name}
                          </span>
                          {folder.is_favorite && (
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500 hidden md:table-cell">Folder</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500 hidden md:table-cell">—</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">
                        {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}

                {visibleFiles.map((file: FileItem) => (
                  <tr
                    key={file.id}
                    onClick={() => selectFile(file.id, file.name, file.file_type)}
                    className="border-b border-gray-50 hover:bg-indigo-50/50 transition cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {fileIcon(file.file_type)}
                        <span className="text-sm font-medium text-gray-900">
                          {splitFileName(file.name).base}
                          <span className="text-[0.8em] font-normal opacity-40">{splitFileName(file.name).ext}</span>
                        </span>
                        {file.is_favorite && (
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                        )}
                        {file.is_vibe_file && (
                          <Sparkles size={13} className="text-indigo-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 capitalize hidden md:table-cell">
                      {file.file_type}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 hidden md:table-cell">
                      {formatSize(file.size_bytes)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {formatDistanceToNow(new Date(file.updated_at), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
