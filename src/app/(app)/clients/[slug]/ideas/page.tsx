"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  GripVertical,
  Trash2,
  Globe,
  MapPin,
  Bot,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Idea } from "@/db/schema";

const COLUMNS = [
  { id: "raw", label: "Raw", color: "text-blue-600" },
  { id: "cooking", label: "Cooking", color: "text-amber-600" },
  { id: "ready", label: "Ready to pitch", color: "text-green-600" },
] as const;

export default function IdeasPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchIdeas = useCallback(async () => {
    const res = await fetch(`/api/clients/${slug}/ideas`);
    const data = await res.json();
    setIdeas(data);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const handleAdd = async (column: string) => {
    if (!newTitle.trim()) return;
    await fetch(`/api/clients/${slug}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), column }),
    });
    setNewTitle("");
    setAddingTo(null);
    fetchIdeas();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/clients/${slug}/ideas/${id}`, { method: "DELETE" });
    fetchIdeas();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdea = ideas.find((i) => i.id === active.id);
    if (!activeIdea) return;

    // Check if dropped on a column header
    const targetColumn = COLUMNS.find((c) => c.id === over.id);
    const newColumn = targetColumn ? targetColumn.id : (() => {
      const overIdea = ideas.find((i) => i.id === over.id);
      return overIdea?.column || activeIdea.column;
    })();

    if (newColumn !== activeIdea.column) {
      await fetch(`/api/clients/${slug}/ideas/${activeIdea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column: newColumn }),
      });
      fetchIdeas();
    }
  };

  const getColumnIdeas = (columnId: string) =>
    ideas.filter((i) => i.column === columnId);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold font-serif mb-6">Ideas</h1>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-h-[60vh]">
          {COLUMNS.map((col) => {
            const columnIdeas = getColumnIdeas(col.id);
            return (
              <div key={col.id} className="flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className={`text-sm font-medium ${col.color}`}>
                      {col.label}
                    </h2>
                    <span className="text-xs text-[var(--ink-muted)] bg-[var(--muted)] px-1.5 py-0.5 rounded-full">
                      {columnIdeas.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setAddingTo(addingTo === col.id ? null : col.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Add form */}
                {addingTo === col.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-2"
                  >
                    <div className="rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] p-3">
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd(col.id)}
                        placeholder="Idea title..."
                        className="text-sm mb-2"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setAddingTo(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAdd(col.id)}
                          className="bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Cards */}
                <div className="flex-1 space-y-2">
                  <SortableContext
                    items={columnIdeas.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {columnIdeas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        slug={slug}
                        onDelete={() => handleDelete(idea.id)}
                        onUpdate={fetchIdeas}
                      />
                    ))}
                  </SortableContext>

                  {columnIdeas.length === 0 && addingTo !== col.id && (
                    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--rule)] p-6 text-center">
                      <p className="text-xs text-[var(--ink-muted)]">
                        No ideas here yet
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

function IdeaCard({
  idea,
  slug,
  onDelete,
  onUpdate,
}: {
  idea: Idea;
  slug: string;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: idea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const tags: string[] = idea.tags ? JSON.parse(idea.tags) : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] p-3 hover:shadow-card transition-shadow duration-200"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 w-5 h-5 flex items-center justify-center shrink-0 cursor-grab sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-120"
        >
          <GripVertical className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-1">{idea.title}</p>

          {idea.body && (
            <div
              className="text-xs text-[var(--ink-muted)] mb-2 line-clamp-2 [&_p]:mb-0"
              dangerouslySetInnerHTML={{ __html: idea.body }}
            />
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {idea.isOnline ? (
              <span className="inline-flex items-center gap-0.5 text-xs text-[var(--ink-muted)]">
                <Globe className="w-3 h-3" strokeWidth={1.5} />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-xs text-[var(--ink-muted)]">
                <MapPin className="w-3 h-3" strokeWidth={1.5} />
                Offline
              </span>
            )}

            {idea.estimatedCost !== null && idea.estimatedCost !== undefined && (
              <span className="text-xs text-[var(--ink-muted)]">
                {"\u20B9"}{idea.estimatedCost.toLocaleString("en-IN")}
              </span>
            )}

            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-120">
          <button
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
            title="Refine with agent (Phase 2)"
          >
            <Bot className="w-3 h-3 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </button>
          <button
            onClick={onDelete}
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-colors duration-120"
          >
            <Trash2 className="w-3 h-3 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
