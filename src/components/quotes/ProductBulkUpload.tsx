import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { won } from "@/lib/quoteTypes";

type Row = {
  name: string;
  spec: string | null;
  unit_price: number;
  category: string | null;
  notes: string | null;
  is_active: boolean;
};

const HEADER_MAP: Record<string, keyof Row> = {
  "품명": "name", "제품명": "name", "name": "name",
  "규격": "spec", "spec": "spec",
  "단가": "unit_price", "가격": "unit_price", "unit_price": "unit_price", "price": "unit_price",
  "카테고리": "category", "분류": "category", "category": "category",
  "메모": "notes", "비고": "notes", "notes": "notes",
};

export default function ProductBulkUpload({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["품명", "규격", "단가", "카테고리", "메모"],
      ["예시: YR60DZ-F", "60마력", 45000000, "트랙터", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "제품");
    XLSX.writeFile(wb, "견적제품_템플릿.xlsx");
  };

  const handleFile = async (file: File) => {
    setErrors([]);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const errs: string[] = [];
    const parsed: Row[] = [];

    json.forEach((raw, i) => {
      const r: any = {};
      Object.keys(raw).forEach((k) => {
        const key = HEADER_MAP[k.trim().toLowerCase()] || HEADER_MAP[k.trim()];
        if (key) r[key] = raw[k];
      });
      const name = String(r.name || "").trim();
      if (!name) { errs.push(`${i + 2}행: 품명 없음`); return; }
      const price = Number(String(r.unit_price ?? "").toString().replace(/[,\s원]/g, "")) || 0;
      parsed.push({
        name,
        spec: r.spec ? String(r.spec).trim() : null,
        unit_price: price,
        category: r.category ? String(r.category).trim() : null,
        notes: r.notes ? String(r.notes).trim() : null,
        is_active: true,
      });
    });

    setRows(parsed);
    setErrors(errs);
    if (parsed.length === 0 && errs.length === 0) toast.error("데이터가 없습니다");
  };

  const save = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    const { error } = await (supabase as any).from("quote_products").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length}개 제품이 추가되었습니다`);
    setOpen(false); setRows([]); setErrors([]);
    onDone();
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-1" /> 엑셀 업로드
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows([]); setErrors([]); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>제품 엑셀 대량 업로드</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-1" /> 템플릿 다운로드
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> 파일 선택
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <span className="text-xs text-muted-foreground">
                필수: 품명 · 선택: 규격, 단가, 카테고리, 메모
              </span>
            </div>

            {errors.length > 0 && (
              <div className="text-sm text-destructive space-y-0.5 max-h-24 overflow-auto">
                {errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}

            {rows.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="text-xs text-muted-foreground p-2 bg-muted">미리보기 ({rows.length}건)</div>
                <div className="max-h-[45vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr><th className="p-2 text-left">품명</th><th className="p-2 text-left">규격</th>
                        <th className="p-2 text-right">단가</th><th className="p-2 text-left">카테고리</th>
                        <th className="p-2 text-left">메모</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2 text-muted-foreground">{r.spec}</td>
                          <td className="p-2 text-right tabular-nums">{won(r.unit_price)}</td>
                          <td className="p-2 text-muted-foreground">{r.category}</td>
                          <td className="p-2 text-muted-foreground">{r.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={rows.length === 0 || saving}>
              {saving ? "저장 중..." : `${rows.length}건 저장`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
