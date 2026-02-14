import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listMarketplaceItems, useMarketplaceItem } from '../../api/marketplace';
import { useChatStore } from '../../stores/chatStore';
import type { MarketplaceItem } from '../../lib/types';
import toast from 'react-hot-toast';
import {
  X, Search, Download, Play, Sparkles, FolderPlus, FileText,
  Terminal, Package, TrendingUp,
  // Icons for items
  BarChart3, PieChart, Clock, Flame, Grid3x3, Calculator,
  GanttChart, TreePine, Table, Presentation,
  FileSearch, FilePlus, Code, Lightbulb, ClipboardList,
  RefreshCw, BookOpen, Zap, KanbanSquare, TestTube2, MessageCircle,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  currentFolderId?: string | null;
  initialTab?: string;
}

const TABS = [
  { key: 'app', label: 'Apps', icon: Sparkles },
  { key: 'template', label: 'Templates', icon: FileText },
  { key: 'command', label: 'Commands', icon: Terminal },
] as const;

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'bar-chart-3': BarChart3,
  'pie-chart': PieChart,
  'clock': Clock,
  'flame': Flame,
  'grid-3x3': Grid3x3,
  'calculator': Calculator,
  'gantt-chart': GanttChart,
  'tree-pine': TreePine,
  'table': Table,
  'presentation': Presentation,
  'file-search': FileSearch,
  'file-plus': FilePlus,
  'code': Code,
  'lightbulb': Lightbulb,
  'clipboard-list': ClipboardList,
  'refresh-cw': RefreshCw,
  'book-open': BookOpen,
  'zap': Zap,
  'kanban-square': KanbanSquare,
  'test-tube-2': TestTube2,
  'message-circle': MessageCircle,
  'sparkles': Sparkles,
  'file-text': FileText,
  'folder-plus': FolderPlus,
  'package': Package,
  'trending-up': TrendingUp,
};

function ItemIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] || Package;
  return <Icon size={size} className={className} />;
}

export default function MarketplaceModal({ open, onClose, currentFolderId, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'app');
  const [search, setSearch] = useState('');
  const [usingItem, setUsingItem] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { setPendingPrompt } = useChatStore();

  // Sync tab when initialTab changes (e.g. opening from different buttons)
  useEffect(() => {
    if (initialTab && open) setActiveTab(initialTab);
  }, [initialTab, open]);

  // Map tab key to API item_type(s)
  const itemTypeParam = activeTab === 'template' ? undefined : activeTab;

  const { data: rawItems, isLoading } = useQuery({
    queryKey: ['marketplace', activeTab, search],
    queryFn: () =>
      listMarketplaceItems({
        item_type: itemTypeParam,
        search: search || undefined,
      }),
    enabled: open,
  });

  // For the "template" tab, filter to only file_template + folder_template client-side
  const items = activeTab === 'template'
    ? (rawItems || []).filter((i) => i.item_type === 'file_template' || i.item_type === 'folder_template')
    : rawItems;

  if (!open) return null;

  async function handleUse(item: MarketplaceItem) {
    setUsingItem(item.id);
    try {
      if (item.item_type === 'command') {
        // Resolve command and inject into chat
        let prompt = '';
        try {
          prompt = JSON.parse(item.content || '{}').prompt || '';
        } catch { /* skip */ }
        setPendingPrompt(prompt);
        toast.success(`Command "${item.name}" ready`);
        onClose();
        return;
      }

      const result = await useMarketplaceItem(item.id, {
        folder_id: currentFolderId || undefined,
      });

      if (result.action === 'file_created') {
        queryClient.invalidateQueries({ queryKey: ['drive-files'] });
        toast.success(`Template "${item.name}" created`);
      } else if (result.action === 'folder_created') {
        queryClient.invalidateQueries({ queryKey: ['drive-folders'] });
        toast.success(`Folder "${item.name}" created`);
      } else if (result.action === 'app_installed') {
        queryClient.invalidateQueries({ queryKey: ['app-types'] });
        toast.success(`App "${item.name}" installed`);
      } else if (result.action === 'app_already_installed') {
        toast(`App "${item.name}" is already installed`, { icon: '📦' });
      }
    } catch {
      toast.error(`Failed to use "${item.name}"`);
    } finally {
      setUsingItem(null);
    }
  }

  // Group items by category for nicer display
  const categories = [...new Set((items || []).map((i) => i.category))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Package size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Marketplace</h2>
              <p className="text-xs text-gray-500">Apps, templates, and commands</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === tab.key
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search marketplace..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No items found</div>
          ) : (
            <div className="space-y-5">
              {categories.map((cat) => {
                const catItems = items.filter((i) => i.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
                      {cat}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {catItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition">
                            <ItemIcon name={item.icon} size={16} className="text-gray-500 group-hover:text-indigo-600 transition" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                                <div className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{item.description}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUse(item)}
                                disabled={usingItem === item.id}
                                className="shrink-0 mt-0.5 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-50"
                              >
                                {item.item_type === 'app' ? (
                                  <><Download size={11} /> Install</>
                                ) : item.item_type === 'command' ? (
                                  <><Play size={11} /> Run</>
                                ) : (
                                  <><Download size={11} /> Use</>
                                )}
                              </button>
                            </div>
                            {item.install_count > 0 && (
                              <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                <TrendingUp size={10} />
                                {item.install_count} uses
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
