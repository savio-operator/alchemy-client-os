"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Heading2 } from "lucide-react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minimal?: boolean;
}

export function RichEditor({ content, onChange, placeholder, minimal }: RichEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose-measure text-sm outline-none min-h-[${minimal ? "60" : "120"}px] px-3 py-2`,
      },
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--rule)]">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="w-4 h-4" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic className="w-4 h-4" strokeWidth={1.5} />
        </ToolbarButton>
        {!minimal && (
          <>
            <ToolbarButton
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              aria-label="Heading"
            >
              <Heading2 className="w-4 h-4" strokeWidth={1.5} />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              aria-label="Bullet list"
            >
              <List className="w-4 h-4" strokeWidth={1.5} />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              aria-label="Ordered list"
            >
              <ListOrdered className="w-4 h-4" strokeWidth={1.5} />
            </ToolbarButton>
          </>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {placeholder && editor.isEmpty && (
        <p className="absolute px-3 py-2 text-sm text-[var(--ink-muted)] pointer-events-none">
          {placeholder}
        </p>
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  children,
  ...props
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-120 ${
        active
          ? "bg-[var(--muted)] text-[var(--ink)]"
          : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
