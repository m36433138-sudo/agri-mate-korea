import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useListFilter } from "@/hooks/useListFilter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FileSpreadsheet, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Part } from "@/types/database";

export default function PartsList() {
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  useRealtimeSync("parts", [["parts"]]);

  const { data: parts, isLoading } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("*").order("part_name");
      if (error) throw error;
      return data as Part[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parts"] });
      toast({ title: "부품이 삭제되었습니다." });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const { search, setSearch, filtered } = useListFilter<Part>({
    data: parts,
    searchFields: ["part_name", "part_number"],
  });

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["품명", "부품번호", "단위", "메모"],
      ["엔진오일 필터", "1E6C30-17430", "개", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "부품");
    XLSX.writeFile(wb, "부품_템플릿.xlsx");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">부품관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> 엑셀 일괄등록
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 부품 등록
          </Button>
        </div>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="품명 또는 부품번호 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            등록된 부품이 없습니다. 부품을 등록하여 수리 시 활용하세요.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">품명</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">부품번호</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">단위</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">메모</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{p.part_name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{p.part_number}</td>
                    <td className="p-3 text-muted-foreground">{p.unit}</td>
                    <td className="p-3 text-muted-foreground">{p.notes || "-"}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddPartDialog open={addOpen} onOpenChange={setAddOpen} />
      <BulkPartDialog open={bulkOpen} onOpenChange={setBulkOpen} onDownloadTemplate={downloadTemplate} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>부품 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 부품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddPartDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ part_name: "", part_number: "", unit: "개", notes: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("parts").insert({
        part_name: form.part_name,
        part_number: form.part_number,
        unit: form.unit || "개",
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parts"] });
      toast({ title: "부품이 등록되었습니다." });
      onOpenChange(false);
      setForm({ part_name: "", part_number: "", unit: "개", notes: "" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>부품 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>품명 *</Label>
            <Input value={form.part_name} onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value }))} placeholder="예: 엔진오일 필터" />
          </div>
          <div>
            <Label>부품번호 *</Label>
            <Input value={form.part_number} onChange={(e) => setForm((f) => ({ ...f, part_number: e.target.value }))} placeholder="예: 1E6C30-17430" />
          </div>
          <div>
            <Label>단위</Label>
            <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="개" />
          </div>
          <div>
            <Label>메모</Label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!(form.part_name && form.part_number) || mutation.isPending}>
            {mutation.isPending ? "등록 중..." : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkPartDialog({
  open,
  onOpenChange,
  onDownloadTemplate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDownloadTemplate: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<{ part_name: string; part_number: string; unit: string; notes: string }[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        const mapped = json.map((row) => {
          const raw = Object.values(row);
          return {
            part_name: String(raw[0] || ""),
            part_number: String(raw[1] || ""),
            unit: String(raw[2] || "개"),
            notes: String(raw[3] || ""),
          };
        });
        setRows(mapped);
        setStep("preview");
        toast({ title: `${mapped.length}개의 부품을 불러왔습니다.` });
      } catch {
        toast({ title: "엑셀 파일을 읽을 수 없습니다.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const validRows = rows.filter((r) => r.part_name && r.part_number);

  const mutation = useMutation({
    mutationFn: async () => {
      const inserts = validRows.map((r) => ({
        part_name: r.part_name,
        part_number: r.part_number,
        unit: r.unit || "개",
        notes: r.notes || null,
      }));
      // Upsert on part_number conflict
      const { error } = await supabase.from("parts").upsert(inserts, { onConflict: "part_number" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parts"] });
      toast({ title: `${validRows.length}건 등록 완료` });
      onOpenChange(false);
      setRows([]);
      setStep("upload");
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const handleClose = () => {
    onOpenChange(false);
    setRows([]);
    setStep("upload");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>부품 엑셀 일괄등록</DialogTitle>
          <p className="text-sm text-muted-foreground">엑셀 파일을 업로드하여 부품을 일괄 등록합니다. 동일한 부품번호는 자동으로 업데이트됩니다.</p>
        </DialogHeader>

        {step === "upload" ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Button variant="outline" onClick={onDownloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> 엑셀 템플릿 다운로드
            </Button>
            <p className="text-xs text-muted-foreground">열 순서: 품명, 부품번호, 단위, 메모</p>
            <label className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">엑셀 파일 선택</p>
                <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
            </label>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium text-muted-foreground">품명</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">부품번호</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">단위</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b ${!r.part_name || !r.part_number ? "bg-destructive/10" : ""}`}>
                      <td className="p-2">{r.part_name || <span className="text-destructive">누락</span>}</td>
                      <td className="p-2 font-mono text-xs">{r.part_number || <span className="text-destructive">누락</span>}</td>
                      <td className="p-2">{r.unit}</td>
                      <td className="p-2 text-muted-foreground">{r.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <DialogFooter className="pt-4 border-t">
              <span className="text-sm text-muted-foreground mr-auto">
                유효: {validRows.length} / {rows.length}건
              </span>
              <Button variant="outline" onClick={() => setStep("upload")}>다시 선택</Button>
              <Button onClick={() => mutation.mutate()} disabled={validRows.length === 0 || mutation.isPending}>
                {mutation.isPending ? "등록 중..." : `${validRows.length}건 등록`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
