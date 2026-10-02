import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import clsx from 'clsx';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronsUpDown,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  Underline,
  Undo2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { MenuItem, Popover } from '@/components/ui/Popover';

interface RichTextEditorProps {
  onChange: (html: string, isEmpty: boolean) => void;
  invalid?: boolean;
}

export function RichTextEditor({ onChange, invalid }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Type Your Reply...' }),
    ],
    editorProps: { attributes: { class: 'email-body', 'aria-label': 'Email body' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.isEmpty),
  });

  return (
    <div className={clsx('rounded-xl bg-[#f7f7f7] p-3', invalid && 'ring-1 ring-red-400')}>
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="cursor-text px-1 pt-4 pb-2 sm:px-3" onClick={() => editor?.commands.focus()} />
    </div>
  );
}

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={clsx(
        'inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-md px-1 text-[#4b4b4b] transition hover:bg-surface disabled:opacity-35',
        active && 'bg-brand-soft text-brand',
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-4 w-px bg-line" />;

const BLOCK_STYLES = [
  { label: 'Normal text', level: 0 },
  { label: 'Heading 1', level: 1 },
  { label: 'Heading 2', level: 2 },
  { label: 'Heading 3', level: 3 },
] as const;

const ALIGNMENTS = [
  { label: 'Align left', value: 'left', icon: AlignLeft },
  { label: 'Align center', value: 'center', icon: AlignCenter },
  { label: 'Align right', value: 'right', icon: AlignRight },
] as const;

function Toolbar({ editor }: { editor: Editor }) {
  const [menu, setMenu] = useState<'style' | 'align' | null>(null);
  // Re-render the toolbar only when these derived states change, not on every keystroke.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      inList: e.isActive('listItem'),
      level: ([1, 2, 3] as const).find((level) => e.isActive('heading', { level })) ?? 0,
      align: ALIGNMENTS.find((a) => e.isActive({ textAlign: a.value }))?.value ?? 'left',
    }),
  });
  const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run();
  const AlignIcon = ALIGNMENTS.find((a) => a.value === s.align)!.icon;

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-2xl bg-white px-2 py-1 shadow-[0_0_0_1px_#efefef] sm:rounded-full sm:px-3">
      <ToolButton label="Undo" disabled={!s.canUndo} onClick={() => run((c) => c.undo())}>
        <Undo2 className="size-4" />
      </ToolButton>
      <ToolButton label="Redo" disabled={!s.canRedo} onClick={() => run((c) => c.redo())}>
        <Redo2 className="size-4" />
      </ToolButton>
      <Divider />

      <Popover
        open={menu === 'style'}
        onClose={() => setMenu(null)}
        className="w-40 p-1"
        trigger={
          <ToolButton label="Text style" active={s.level > 0} onClick={() => setMenu(menu === 'style' ? null : 'style')}>
            <Type className="size-4" />
            <ChevronsUpDown className="size-3" />
          </ToolButton>
        }
      >
        {BLOCK_STYLES.map(({ label, level }) => (
          <MenuItem
            key={level}
            active={s.level === level}
            onClick={() => {
              run((c) => (level === 0 ? c.setParagraph() : c.toggleHeading({ level })));
              setMenu(null);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Popover>
      <Divider />

      <ToolButton label="Bold" active={s.bold} onClick={() => run((c) => c.toggleBold())}>
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton label="Italic" active={s.italic} onClick={() => run((c) => c.toggleItalic())}>
        <Italic className="size-4" />
      </ToolButton>
      <ToolButton label="Underline" active={s.underline} onClick={() => run((c) => c.toggleUnderline())}>
        <Underline className="size-4" />
      </ToolButton>
      <Divider />

      <Popover
        open={menu === 'align'}
        onClose={() => setMenu(null)}
        className="w-40 p-1"
        trigger={
          <ToolButton label="Alignment" onClick={() => setMenu(menu === 'align' ? null : 'align')}>
            <AlignIcon className="size-4" />
            <ChevronsUpDown className="size-3" />
          </ToolButton>
        }
      >
        {ALIGNMENTS.map(({ label, value, icon: Icon }) => (
          <MenuItem
            key={value}
            active={s.align === value}
            icon={<Icon className="size-4" />}
            onClick={() => {
              run((c) => c.setTextAlign(value));
              setMenu(null);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Popover>
      <Divider />

      <ToolButton label="Numbered list" active={s.ordered} onClick={() => run((c) => c.toggleOrderedList())}>
        <ListOrdered className="size-4" />
      </ToolButton>
      <ToolButton label="Bulleted list" active={s.bullet} onClick={() => run((c) => c.toggleBulletList())}>
        <List className="size-4" />
      </ToolButton>
      <ToolButton label="Indent" disabled={!s.inList} onClick={() => run((c) => c.sinkListItem('listItem'))}>
        <IndentIncrease className="size-4" />
      </ToolButton>
      <ToolButton label="Outdent" disabled={!s.inList} onClick={() => run((c) => c.liftListItem('listItem'))}>
        <IndentDecrease className="size-4" />
      </ToolButton>
      <Divider />

      <ToolButton label="Quote" active={s.quote} onClick={() => run((c) => c.toggleBlockquote())}>
        <Quote className="size-4" />
      </ToolButton>
      <ToolButton label="Divider" onClick={() => run((c) => c.setHorizontalRule())}>
        <Minus className="size-4" />
      </ToolButton>
      <Divider />

      <ToolButton label="Strikethrough" active={s.strike} onClick={() => run((c) => c.toggleStrike())}>
        <Strikethrough className="size-4" />
      </ToolButton>
    </div>
  );
}
