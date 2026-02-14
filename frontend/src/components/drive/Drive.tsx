import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFiles, createFile, listFolders, createFolder, listSharedWithMe, getFileContent, getFileInstances, uploadFile } from '../../api/drive';
import DocxViewer from './DocxViewer';
import { useDriveStore } from '../../stores/driveStore';
import { useChatStore } from '../../stores/chatStore';
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
  ChevronDown,
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
  Search,
  Info,
  List,
  SlidersHorizontal,
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
    result = result.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-4 mb-2">$1</h3>');
    result = result.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-5 mb-2">$1</h2>');
    result = result.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-6 mb-3">$1</h1>');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-pink-600">$1</code>');
    result = result.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '<pre class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm font-mono text-gray-800 overflow-auto my-3">$1</pre>');
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
    result = result.replace(/^[*-] (.+)$/gm, '<li class="ml-4 list-disc text-gray-800">$1</li>');
    result = result.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-800">$1</li>');
    result = result.replace(/^---$/gm, '<hr class="my-4 border-gray-200" />');
    result = result.replace(/\n\n/g, '</p><p class="text-sm text-gray-800 mb-3">');
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

  const dateIdx = useMemo(() => {
    const candidates = ['date', 'due', 'due_date', 'start', 'start_date', 'created', 'deadline'];
    const idx = headers.findIndex((h) =>
      candidates.includes(h.toLowerCase().replace(/\s+/g, '_'))
    );
    return idx >= 0 ? idx : -1;
  }, [headers]);

  const nameIdx = 0;

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

// ── Instance-aware renderer ─────────────────────────────

function InstanceRenderer({
  appTypeSlug,
  sourceContent,
  instanceContent,
  fileId,
  fileName,
}: {
  appTypeSlug: string | null;
  sourceContent: string;
  instanceContent: string | null;
  fileId: string;
  fileName: string;
}) {
  const isCode = /\.(py|js|ts|tsx|jsx|rb|go|rs|java|c|cpp|h|css|sh|yml|yaml|toml|sql)$/.test(fileName);

  switch (appTypeSlug) {
    case 'table':
      return <TableViewer content={sourceContent} />;
    case 'board':
      return <KanbanViewer content={sourceContent} />;
    case 'calendar':
      return <CalendarViewer content={sourceContent} />;
    case 'document': {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      if (ext === 'doc' || ext === 'docx') {
        return <DocxViewer fileId={fileId} content={sourceContent} fileName={fileName} />;
      }
      return <MarkdownViewer content={sourceContent} />;
    }
    case 'text-editor':
      return <RawViewer content={sourceContent} isCode={isCode} />;
    case 'custom-view':
    default:
      // Custom HTML template — render instance content (HTML) in iframe
      if (instanceContent && instanceContent !== '{}') {
        return (
          <div className="h-full -m-5">
            <HtmlViewRenderer content={instanceContent} />
          </div>
        );
      }
      return <RawViewer content={sourceContent} isCode={isCode} />;
  }
}

// ── View Mode Tabs ──────────────────────────────────────

function appTypeToIcon(slug: string | null, size: number = 14) {
  switch (slug) {
    case 'table': return <Table size={size} />;
    case 'board': return <Columns3 size={size} />;
    case 'calendar': return <Calendar size={size} />;
    case 'document': return <FileType size={size} />;
    case 'text-editor': return <Pencil size={size} />;
    default: return <Eye size={size} />;
  }
}

function InstanceTabBar({
  instances,
  activeInstanceId,
  onSelectInstance,
  onCreateCustom,
}: {
  instances: FileItem[];
  activeInstanceId: string | null;
  onSelectInstance: (instanceId: string) => void;
  onCreateCustom: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 px-4 py-1.5 shrink-0">
      {instances.map((inst) => {
        const isActive = inst.id === activeInstanceId;
        return (
          <button
            key={inst.id}
            type="button"
            onClick={() => onSelectInstance(inst.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${
              isActive
                ? 'bg-gray-800 text-indigo-400 shadow-sm border border-gray-700'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 border border-transparent'
            }`}
          >
            {appTypeToIcon(inst.app_type_slug)}
            {inst.name}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onCreateCustom}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 border border-transparent"
        title="Create custom view with AI"
      >
        <Sparkles size={13} />
        <span className="text-[11px]">Custom</span>
      </button>
    </div>
  );
}

// ── FileViewer ──────────────────────────────────────────

function FileViewer({ fileId, fileName }: { fileId: string; fileName: string }) {
  const { clearSelectedFile, viewMode, selectedFileType, selectFile } = useDriveStore();
  const { toggleChatPanel, chatPanelOpen } = useUIStore();
  const queryClient = useQueryClient();

  const [showCustomViewDialog, setShowCustomViewDialog] = useState(false);
  const [customViewPrompt, setCustomViewPrompt] = useState('');
  const { setPendingPrompt } = useChatStore();

  const { data: fileData, isLoading, error } = useQuery({
    queryKey: ['file-content', fileId],
    queryFn: () => getFileContent(fileId),
  });

  // Determine if this is an instance or a data file
  const isInstance = fileData?.is_instance || selectedFileType === 'instance';
  const sourceFileId = fileData?.source_file_id;

  // If viewing an instance, fetch its source file content
  const { data: sourceData } = useQuery({
    queryKey: ['file-content', sourceFileId],
    queryFn: () => getFileContent(sourceFileId!),
    enabled: isInstance && !!sourceFileId,
  });

  // Fetch sibling instances (for tab bar)
  // If this is an instance, get instances of the source file
  // If this is a data file, get its own instances
  const instancesForFileId = isInstance ? sourceFileId : fileId;
  const { data: siblingInstances } = useQuery({
    queryKey: ['file-instances', instancesForFileId],
    queryFn: () => getFileInstances(instancesForFileId!),
    enabled: !!instancesForFileId,
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

  const detectedType = fileData ? guessFileType(fileData.mime_type, fileData.name) : (selectedFileType || 'other');
  const actualName = fileData?.name || fileName;

  const isCode = fileData && (
    fileData.mime_type.startsWith('text/x-') ||
    fileData.mime_type === 'application/javascript' ||
    fileData.mime_type === 'application/json' ||
    fileData.mime_type === 'application/xml' ||
    /\.(py|js|ts|tsx|jsx|rb|go|rs|java|c|cpp|h|css|sh|yml|yaml|toml|sql)$/.test(fileData.name)
  );

  const handleSelectInstance = (instanceId: string) => {
    // Find the instance to get its name
    const inst = siblingInstances?.find((i) => i.id === instanceId);
    if (inst) {
      selectFile(inst.id, inst.name, 'instance');
    }
  };

  const handleCreateCustom = () => {
    setShowCustomViewDialog(true);
    setCustomViewPrompt('');
  };

  const handleSubmitCustomView = () => {
    if (!customViewPrompt.trim()) return;
    const targetFileId = isInstance ? sourceFileId : fileId;
    const targetName = isInstance && sourceData ? sourceData.name : actualName;
    const prompt = `Create a custom HTML view for the file "${targetName}" (ID: ${targetFileId}) that: ${customViewPrompt.trim()}. Read the file content first, then create an instance for this file.`;
    setPendingPrompt(prompt);
    if (!chatPanelOpen) toggleChatPanel();
    setShowCustomViewDialog(false);
    setCustomViewPrompt('');
  };

  // Determine what to render
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
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
      );
    }

    // Instance rendering: use the source file's content with the app type's renderer
    if (isInstance && fileData) {
      // Wait for source file content to load
      if (sourceFileId && !sourceData) {
        return (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
            ))}
          </div>
        );
      }
      const content = sourceData?.content || '';
      return (
        <InstanceRenderer
          appTypeSlug={fileData.app_type_slug}
          sourceContent={content}
          instanceContent={fileData.content}
          fileId={sourceFileId || fileId}
          fileName={sourceData?.name || actualName}
        />
      );
    }

    // Regular data file rendering (when clicked directly, not via instance)
    if (!fileData?.content) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-100 mb-4">File Information</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500 w-24">Name:</dt>
              <dd className="text-gray-200">{fileData?.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-24">Type:</dt>
              <dd className="text-gray-200">{fileData?.mime_type}</dd>
            </div>
          </dl>
        </div>
      );
    }

    // Direct data file rendering based on viewMode
    if (viewMode === 'docx') {
      return <DocxViewer fileId={fileId} content={fileData.content} fileName={actualName} />;
    }
    if (viewMode === 'table') {
      return <TableViewer content={fileData.content} />;
    }
    if (viewMode === 'document') {
      return <MarkdownViewer content={fileData.content} />;
    }
    if (viewMode === 'kanban') {
      return <KanbanViewer content={fileData.content} />;
    }
    if (viewMode === 'calendar') {
      return <CalendarViewer content={fileData.content} />;
    }
    if (viewMode === 'html-view') {
      return (
        <div className="h-full -m-5">
          <HtmlViewRenderer content={fileData.content} />
        </div>
      );
    }
    return <RawViewer content={fileData.content} isCode={!!isCode} />;
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={clearSelectedFile}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition shrink-0"
            title="Back to files"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {fileData && fileIcon(isInstance ? (detectedType) : detectedType)}
            <span className="text-sm font-semibold text-gray-100 truncate">
              {splitFileName(actualName).base}
              <span className="text-[0.8em] font-normal opacity-40">{splitFileName(actualName).ext}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => favMutation.mutate()}
            className="p-1 rounded hover:bg-gray-800 transition shrink-0"
            title="Toggle favorite"
          >
            <Star size={14} className={favMutation.isPending ? 'text-gray-600' : fileData?.is_favorite ? 'text-amber-500 fill-amber-500' : 'text-gray-500 hover:text-amber-500'} />
          </button>
        </div>
        <button
          type="button"
          onClick={toggleChatPanel}
          className={`p-1.5 rounded-lg transition ${
            chatPanelOpen
              ? 'text-indigo-400 bg-indigo-950'
              : 'text-gray-400 hover:bg-gray-800'
          }`}
          title="Toggle AI Chat"
        >
          <MessageSquare size={16} />
        </button>
      </div>

      {/* Instance tab bar — shows sibling instances */}
      {siblingInstances && siblingInstances.length > 0 && (
        <div className="relative flex items-center border-b border-gray-800 bg-gray-900/80 shrink-0">
          <InstanceTabBar
            instances={siblingInstances}
            activeInstanceId={isInstance ? fileId : null}
            onSelectInstance={handleSelectInstance}
            onCreateCustom={handleCreateCustom}
          />
        </div>
      )}

      {/* Custom view with AI dialog */}
      {showCustomViewDialog && (
        <div className="px-5 py-3 border-b border-gray-800 bg-indigo-950/50">
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-indigo-400 mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-indigo-300 mb-1.5">Create a custom view with AI</p>
              <textarea
                value={customViewPrompt}
                onChange={(e) => setCustomViewPrompt(e.target.value)}
                placeholder="Describe the view you want, e.g. 'A dashboard showing task completion rates by status'"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none bg-gray-900 text-white placeholder-gray-500"
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
                  className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 transition"
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
        {renderContent()}
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

  // Filter out instance files — they show nested under their source file
  const visibleFiles = files?.filter((f) => !f.is_instance) || [];

  const isLoading = filesLoading || foldersLoading;
  const title = isShared ? 'Shared' : 'Private';

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Search bar */}
      <div className="px-5 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-gray-800/80 rounded-full px-4 py-2.5 gap-3">
            <Search size={16} className="text-gray-500 shrink-0" />
            <span className="text-sm text-gray-500 flex-1">Search in Drive</span>
            <SlidersHorizontal size={16} className="text-gray-500 shrink-0" />
          </div>
        </div>
      </div>

      {/* Header: title + view controls */}
      <div className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          {isPrivate && breadcrumbs.length > 1 ? (
            <div className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={14} className="text-gray-600" />}
                  <button
                    type="button"
                    onClick={() => navigateToBreadcrumb(i)}
                    className={`hover:text-indigo-400 transition ${
                      i === breadcrumbs.length - 1
                        ? 'text-white font-medium'
                        : 'text-gray-500'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
              <ChevronDown size={16} className="text-gray-500 ml-1" />
            </div>
          ) : (
            <>
              <h1 className="text-lg font-medium text-white">
                {isShared ? 'Shared with me' : 'My Drive'}
              </h1>
              <ChevronDown size={16} className="text-gray-500" />
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isPrivate && (
            <>
              <button
                type="button"
                onClick={() => setShowCreateFolder(true)}
                className="p-2 rounded-full hover:bg-gray-800 text-gray-400 transition"
                title="New folder"
              >
                <FolderPlus size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowCreateFile(true)}
                className="p-2 rounded-full hover:bg-gray-800 text-gray-400 transition"
                title="New file"
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full hover:bg-gray-800 text-gray-400 transition"
                title="Upload"
              >
                <Upload size={18} />
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
            className={`p-2 rounded-full transition ${
              chatPanelOpen
                ? 'text-indigo-400 bg-indigo-950'
                : 'text-gray-400 hover:bg-gray-800'
            }`}
            title="Toggle AI Chat"
          >
            <MessageSquare size={18} />
          </button>
          <button type="button" className="p-2 rounded-full hover:bg-gray-800 text-gray-400 transition" title="List view">
            <List size={18} />
          </button>
          <button type="button" className="p-2 rounded-full hover:bg-gray-800 text-gray-400 transition" title="Details">
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-5 pb-3 flex items-center gap-2 shrink-0">
        {['Type', 'People', 'Modified', 'Source'].map((label) => (
          <button
            key={label}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 border border-gray-700 transition"
          >
            {label}
            <ChevronDown size={12} />
          </button>
        ))}
      </div>

      {/* Create forms */}
      <div className="px-5">
        {showCreateFolder && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-white placeholder-gray-500"
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
                className="px-3 py-1.5 border border-gray-600 text-gray-300 rounded-lg text-sm hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showCreateFile && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-3">
            <div className="space-y-2">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="File name (e.g. app.py, README.md)"
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-white placeholder-gray-500"
                autoFocus
              />
              <textarea
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                placeholder="File content..."
                rows={5}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-white placeholder-gray-500 font-mono"
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
                  className="px-3 py-1.5 border border-gray-600 text-gray-300 rounded-lg text-sm hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggested section */}
      {visibleFiles.length > 0 && (
        <div className="px-5 pb-3 shrink-0">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Suggested</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {visibleFiles.slice(0, 4).map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => selectFile(file.id, file.name, file.file_type)}
                className="flex items-center gap-2.5 px-3 py-2 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-750 hover:border-gray-600 transition min-w-0 shrink-0"
              >
                {fileIcon(file.file_type)}
                <div className="min-w-0 text-left">
                  <p className="text-xs text-gray-200 font-medium truncate max-w-[100px]">
                    {splitFileName(file.name).base}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {formatDistanceToNow(new Date(file.updated_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto px-5 pb-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (folders?.length || 0) === 0 && visibleFiles.length === 0 ? (
          <div className="text-center py-16">
            <FileIcon size={40} className="mx-auto text-gray-700 mb-3" />
            <p className="text-gray-400 text-sm mb-1">
              {isShared ? 'Nothing shared yet' : 'No files yet'}
            </p>
            {isPrivate && (
              <p className="text-xs text-gray-600">
                Create a file or use the AI chat to generate one
              </p>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">
                  Owner
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                  Date modified
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">
                  File size
                </th>
              </tr>
            </thead>
            <tbody>
              {isPrivate &&
                folders?.map((folder: FolderItem) => (
                  <tr
                    key={folder.id}
                    onClick={() => navigateToFolder(folder.id, folder.name)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/60 transition cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <FolderIcon size={18} className="text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-200">
                          {folder.name}
                        </span>
                        {folder.is_favorite && (
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-medium shrink-0">me</div>
                        <span className="text-sm text-gray-400">me</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-400">
                      {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 hidden md:table-cell">—</td>
                  </tr>
                ))}

              {visibleFiles.map((file: FileItem) => (
                <tr
                  key={file.id}
                  onClick={() => selectFile(file.id, file.name, file.file_type)}
                  className="border-b border-gray-800/50 hover:bg-gray-800/60 transition cursor-pointer"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {fileIcon(file.file_type)}
                      <span className="text-sm text-gray-200">
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
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-medium shrink-0">me</div>
                      <span className="text-sm text-gray-400">me</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-400">
                    {formatDistanceToNow(new Date(file.updated_at), {
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-400 hidden md:table-cell">
                    {formatSize(file.size_bytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
