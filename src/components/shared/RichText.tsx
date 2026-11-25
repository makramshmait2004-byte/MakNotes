import { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor, type JSONContent, type Editor } from '@tiptap/react';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Heading2, List, ListOrdered, ListChecks, Quote, Code, Undo2, Redo2, Strikethrough } from 'lucide-react';
import { cn, debounce } from '@/lib/utils';

export const CONTENT_EXTENSIONS = [StarterKit, TaskList, TaskItem.configure({ nested: true }), Link.configure({ openOnClick: false, autolink: true })];

export function docToHtml(doc: JSONContent | null | undefined): string {
  if (!doc) return '';
  try {
    return generateHTML(doc, CONTENT_EXTENSIONS);
  } catch {
    return '';
  }
}

export function docToText(doc: JSONContent | null | undefined): string {
  if (!doc) return '';
  const out: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === 'text' && n.text) out.push(n.text);
    n.content?.forEach(walk);
    if (n.type && ['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock'].includes(n.type)) out.push('\n');
  };
  walk(doc);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export function textToDoc(text: string): JSONContent {
  return { type: 'doc', content: text.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) };
}

function ToolbarButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('grid size-8 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground', active && 'bg-accent text-foreground')}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const i = 'size-4';
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1" role="toolbar">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className={i} /></ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className={i} /></ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className={i} /></ToolbarButton>
      <ToolbarButton label="Heading" active={editor.isActive('heading')} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className={i} /></ToolbarButton>
      <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className={i} /></ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className={i} /></ToolbarButton>
      <ToolbarButton label="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className={i} /></ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className={i} /></ToolbarButton>
      <ToolbarButton label="Code" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className={i} /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 className={i} /></ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 className={i} /></ToolbarButton>
    </div>
  );
}

interface Props {
  value: JSONContent | null | undefined;
  onChange: (doc: JSONContent, text: string) => void;
  placeholder?: string;
  toolbar?: boolean;
  className?: string;
  autoFocus?: boolean;
  minimal?: boolean;
  testId?: string;
}

/** Rich text editor. Saves (debounced) on every change; accepts remote updates while not focused. */
export function RichText({ value, onChange, placeholder, toolbar = true, className, autoFocus, testId }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const save = useMemo(
    () =>
      debounce((doc: JSONContent, text: string) => {
        pending.current = false;
        onChangeRef.current(doc, text);
      }, 500),
    [],
  );
  const lastEmitted = useRef<string>('');
  const pending = useRef(false);

  const editor = useEditor({
    extensions: [...CONTENT_EXTENSIONS, Placeholder.configure({ placeholder: placeholder ?? '' })],
    content: value ?? '',
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'px-3 py-2 text-[15px]', dir: 'auto', ...(testId ? { 'data-testid': testId } : {}) } },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      lastEmitted.current = JSON.stringify(json);
      pending.current = true;
      save(json, editor.getText());
    },
    onBlur: ({ editor }) => {
      // only write when something changed (an untouched editor must not create empty content)
      if (pending.current) save.flush(editor.getJSON(), editor.getText());
    },
  });

  // Apply remote changes (sync) when the user is not typing in this editor.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const incoming = JSON.stringify(value ?? null);
    if (incoming === lastEmitted.current) return;
    const current = JSON.stringify(editor.getJSON());
    if (value && incoming !== current) editor.commands.setContent(value, false);
  }, [value, editor]);

  useEffect(() => () => save.cancel(), [save]);

  return (
    <div className={cn('rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring', className)}>
      {toolbar && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
