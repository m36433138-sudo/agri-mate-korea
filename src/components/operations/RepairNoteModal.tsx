import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRepairNotes, RepairNote } from "@/hooks/useRepairNotes";
import { SheetRow } from "@/types/operations";
import { Plus, Trash2, CheckCircle2, Circle, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  row: SheetRow;
}

export function RepairNoteModal({ open, onClose, row }: Props) {
  const { getNotesForRow, addNote, toggleDone, deleteNote } = useRepairNotes();
  const [input, setInput] = useState("");
  const { toast } = useToast();

  const notes = getNotesForRow(row._branch, row._rowIndex);
  const pending = notes.filter(n => !n.is_done);
  const done = notes.filter(n => n.is_done);

  const handleAdd = async () => {
    const content = input.trim();
    if (!content) return;
    try {
      await addNote.mutateAsync({ branch: row._branch, rowIndex: row._rowIndex, content });
      setInput("");
    } catch (e: any) {
      toast({ title: "추가 실패", description: e?.message || "Supabase 테이블이 없을 수 있습니다.", variant: "destructive" });
    }
  };

  const handleToggle = async (note: RepairNote) => {
    try {
      await toggleDone.mutateAsync({ id: note.id, isDone: !note.is_done });
    } catch {
      toast({ title: "변경 실패", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote.mutateAsync(id);
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            조달/필요사항
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {row.손님성명} · {row.기계} {row.품목} · {row._branch}
          </p>
        </DialogHeader>

        {/* 입력 */}
        <div className="flex gap-2">
          <Input
            placeholder="부품명, 필요사항 입력..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!input.trim() || addNote.isPending} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* 미완료 목록 */}
        {pending.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              조달 필요 ({pending.length})
            </p>
            {pending.map(note => (
              <div key={note.id} className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
                <button onClick={() => handleToggle(note)} className="shrink-0 text-muted-foreground hover:text-green-600 transition-colors">
                  <Circle className="h-4 w-4" />
                </button>
                <span className="flex-1 text-sm">{note.content}</span>
                <button onClick={() => handleDelete(note.id)} className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 완료 목록 */}
        {done.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              조달 완료 ({done.length})
            </p>
            {done.map(note => (
              <div key={note.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                <button onClick={() => handleToggle(note)} className="shrink-0 text-green-600 hover:text-muted-foreground transition-colors">
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <span className="flex-1 text-sm text-muted-foreground line-through">{note.content}</span>
                <button onClick={() => handleDelete(note.id)} className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {notes.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            등록된 조달사항이 없습니다.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
