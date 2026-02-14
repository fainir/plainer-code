import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { updateFileContent } from '../../api/drive';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Link as LinkIcon,
  Highlighter,
  Quote,
  Minus,
  ChevronRight,
  ChevronDown,
  FileText,
} from 'lucide-react';

// ── Toolbar ──────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-white flex-wrap">
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo2 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo2 size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
        <UnderlineIcon size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">
        <Highlighter size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
        <AlignLeft size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
        <AlignCenter size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
        <AlignRight size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
        <AlignJustify size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
        <Quote size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        <Minus size={15} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Insert link">
        <LinkIcon size={15} />
      </ToolbarButton>
    </div>
  );
}

// ── Document Outline Sidebar ─────────────────────────────

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

function DocumentOutline({ editor, collapsed, onToggle }: {
  editor: ReturnType<typeof useEditor>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    if (!editor) return;

    const extractHeadings = () => {
      const items: HeadingItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          items.push({
            level: node.attrs.level as number,
            text: node.textContent,
            pos,
          });
        }
      });
      setHeadings(items);
    };

    extractHeadings();
    editor.on('update', extractHeadings);
    return () => { editor.off('update', extractHeadings); };
  }, [editor]);

  const scrollToHeading = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).run();
    // Scroll the heading into view
    const { node } = editor.view.domAtPos(pos + 1);
    const el = node instanceof HTMLElement ? node : node.parentElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className={`shrink-0 border-r border-gray-200 bg-white transition-all ${collapsed ? 'w-10' : 'w-56'}`}>
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-gray-100">
        <button
          type="button"
          onClick={onToggle}
          className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
          title={collapsed ? 'Expand outline' : 'Collapse outline'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        {!collapsed && (
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Document tabs</span>
        )}
      </div>

      {!collapsed && (
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] py-1">
          {headings.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No headings yet</p>
          ) : (
            headings.map((h, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToHeading(h.pos)}
                className="w-full text-left px-3 py-1 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition truncate"
                style={{ paddingLeft: `${(h.level - 1) * 12 + 12}px` }}
                title={h.text}
              >
                <span className={`${h.level === 1 ? 'font-semibold' : h.level === 2 ? 'font-medium' : 'font-normal text-gray-500'}`}>
                  {h.text}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main DocxViewer ──────────────────────────────────────

interface DocxViewerProps {
  fileId: string;
  content: string;
  fileName: string;
}

export default function DocxViewer({ fileId, content, fileName }: DocxViewerProps) {
  const queryClient = useQueryClient();
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveMutation = useMutation({
    mutationFn: (html: string) => updateFileContent(fileId, html),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['file-content', fileId] });
    },
    onError: () => setSaveStatus('unsaved'),
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
      }),
      Highlight,
      Placeholder.configure({
        placeholder: 'Start typing your document...',
      }),
    ],
    content,
    onUpdate: () => {
      setSaveStatus('unsaved');
      // Debounced auto-save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (editor) {
          saveMutation.mutate(editor.getHTML());
        }
      }, 3000);
    },
  });

  // Ctrl+S / Cmd+S manual save
  const handleSave = useCallback(() => {
    if (editor) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      saveMutation.mutate(editor.getHTML());
    }
  }, [editor, saveMutation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const statusLabel = useMemo(() => {
    switch (saveStatus) {
      case 'saving': return 'Saving...';
      case 'unsaved': return 'Unsaved changes';
      case 'saved': return 'All changes saved';
    }
  }, [saveStatus]);

  return (
    <div className="h-full flex flex-col -m-5">
      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <FileText size={12} />
          <span>{fileName}</span>
        </div>
        <span className={`text-xs ${
          saveStatus === 'saving' ? 'text-amber-500' :
          saveStatus === 'unsaved' ? 'text-orange-500' :
          'text-gray-400'
        }`}>
          {statusLabel}
        </span>
      </div>

      {/* Editor area with outline sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Outline sidebar */}
        <DocumentOutline
          editor={editor}
          collapsed={outlineCollapsed}
          onToggle={() => setOutlineCollapsed(!outlineCollapsed)}
        />

        {/* Page area - Google Docs style */}
        <div className="flex-1 overflow-auto bg-gray-100">
          <div className="flex justify-center py-8 px-4">
            <div className="w-full max-w-[816px] min-h-[1056px] bg-white shadow-lg rounded-sm px-16 py-12">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
