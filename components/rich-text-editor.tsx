'use client';

import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, type ReactNode } from 'react';

/**
 * WYSIWYG deskripsi produk (polish 31 Agustus 2026) — pola di-port dari
 * `app/website/bagdja-website-admin/app/components/rich-text-editor.tsx`
 * (versi ringkas: TANPA Image/Table — foto produk sudah punya field
 * terpisah `GalleryEditor`, deskripsi murni teks berformat). Styling pakai
 * token warna repo ini sendiri (`zinc-*`/`--brand-primary`), BUKAN token
 * HeroUI (`default-*`/`primary`) yang dipakai referensi — repo ini plain
 * Tailwind, bukan HeroUI.
 */
const EDITOR_CONTENT_CLASS =
  'min-h-[220px] px-4 py-3 text-sm leading-relaxed text-zinc-800 outline-none ' +
  '[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left ' +
  '[&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-zinc-400 ' +
  '[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] ' +
  '[&_a]:text-[var(--brand-primary)] [&_a]:underline ' +
  '[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold ' +
  '[&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, plainTextLength: number) => void;
  disabled?: boolean;
  placeholder?: string;
}

function ToolbarSeparator() {
  return <span className="mx-0.5 w-px self-stretch bg-zinc-200" />;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-[2rem] rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
        active ? 'bg-[var(--brand-primary)] text-white' : 'text-zinc-600 hover:bg-white hover:text-zinc-900'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarButtons({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const setLink = () => {
    const previousUrl = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt('URL link:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <>
      <ToolbarButton title="Bold" disabled={disabled} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </ToolbarButton>
      <ToolbarButton title="Italic" disabled={disabled} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        I
      </ToolbarButton>
      <ToolbarButton title="Underline" disabled={disabled} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        U
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" disabled={disabled} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        S
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        title="Heading 2"
        disabled={disabled}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        disabled={disabled}
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        title="Bullet list"
        disabled={disabled}
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        disabled={disabled}
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton title="Insert link" disabled={disabled} active={editor.isActive('link')} onClick={setLink}>
        🔗
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        title="Clear formatting"
        disabled={disabled}
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        ✕
      </ToolbarButton>
      <ToolbarButton title="Undo" disabled={disabled} onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </ToolbarButton>
      <ToolbarButton title="Redo" disabled={disabled} onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </ToolbarButton>
    </>
  );
}

export function RichTextEditor({ value, onChange, disabled = false, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Tulis deskripsi produk di sini...' }),
    ],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: updated }) => onChange(updated.getHTML(), updated.getText().length),
    editorProps: {
      attributes: { class: EDITOR_CONTENT_CLASS },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Sync balik value->editor (mis. saat modal dibuka ulang dgn produk lain) —
  // TANPA emit onUpdate lagi, supaya tidak muter (loop) dgn onChange di atas.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-[var(--brand-primary)] focus-within:ring-1 focus-within:ring-[var(--brand-primary)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
        {editor && <ToolbarButtons editor={editor} disabled={disabled} />}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
