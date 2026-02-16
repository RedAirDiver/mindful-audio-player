import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect } from "react";
import { Toggle } from "@/components/ui/toggle";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const RichTextEditor = ({ value, onChange, className }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[120px] p-3 focus:outline-none",
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background",
        className
      )}
    >
      <div className="flex flex-wrap gap-0.5 border-b p-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Fet"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Kursiv"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Understruken"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <div className="w-px bg-border mx-1" />
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          aria-label="Rubrik 2"
        >
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 3 })}
          onPressedChange={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          aria-label="Rubrik 3"
        >
          <Heading3 className="h-4 w-4" />
        </Toggle>
        <div className="w-px bg-border mx-1" />
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          aria-label="Punktlista"
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          aria-label="Numrerad lista"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <div className="w-px bg-border mx-1" />
        <Toggle
          size="sm"
          pressed={false}
          onPressedChange={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Ångra"
        >
          <Undo className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={false}
          onPressedChange={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Gör om"
        >
          <Redo className="h-4 w-4" />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
