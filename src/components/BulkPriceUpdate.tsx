import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download, Tag, CheckCircle2, XCircle } from "lucide-react";
import * as XLSX from "xlsx";

type Row = { part_code: string; sales_price: number | null; raw_price: string };

export default function BulkPriceUpdate() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [result, setResult] = useState<{ matched: number; missing: string[] } | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["부품코드", "매출가"],
      ["22217-160000", 12000],
      ["1J700-72110", 45000],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "매출가");
    XLSX.writeFile(wb, "매출가_일괄수정_템플릿.xlsx");
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        const mapped: Row[] = json.map((row) => {
          const raw = Object.values(row);
          const priceStr = String(raw[1] ?? "").replace(/[,\s₩]/g, "");
          const price = priceStr ? parseInt(priceStr) : NaN;
          return {
            part_code: String(raw[0] || "").trim(),
            sales_price: Number.isFinite(price) ? price : null,
            raw_price: String(raw[1] ?? ""),
          };
        }).filter((r) => r.part_code);
        setRows(mapped);
        setResult(null);
        setStep("preview");
        toast({ title: `${mapped.length}건을 불러왔습니다.` });
      } catch {
        toast({ title: "엑셀 파일을 읽을 수 없습니다.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const validRows = rows.filter((r) => r.part_code && r.sales_price != null && r.sales_price > 0);

  const mutation = useMutation({
    mutationFn: async () => {
      // Fetch existing part_codes in inventory
      const codes = validRows.map((r) => r.part_code);
      const uniqueCodes = Array.from(new Set(codes));

      const found = new Set<string>();
      const PAGE = 200;
      for (let i = 0; i < uniqueCodes.length; i += PAGE) {
        const slice = uniqueCodes.slice(i, i + PAGE);
        const { data, error } = await supabase
          .from("inventory")
          .select("part_code")
          .in("part_code", slice);
        if (error) throw error;
        data?.forEach((r) => found.add(r.part_code));
      }

      // Apply price updates only to matched codes
      let matched = 0;
      for (const r of validRows) {
        if (!found.has(r.part_code)) continue;
        const { error } = await supabase
          .from("inventory")
          .update({ sales_price: r.sales_price })
          .eq("part_code", r.part_code);
        if (error) throw error;
        matched++;
      }
      const missing = validRows.filter((r) => !found.has(r.part_code)).map((r) => r.part_code);
      return { matched, missing };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["inventory-search"] });
      qc.invalidateQueries({ queryKey: ["inventory-compare"] });
      setResult(res);
      toast({
        title: `${res.matched}건 가격이 업데이트되었습니다.`,
        description: res.missing.length > 0 ? `미매칭: ${res.missing.length}건` : undefined,
      });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const reset = () => {
    setRows([]);
    setStep("upload");
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-0">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Tag className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">부품 매출가 일괄 수정</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                엑셀 파일(부품코드, 매출가)을 업로드하면 기존 재고의 매출가만 갱신됩니다. 수량·위치는 그대로 유지되며, 지점(장흥/강진)에 동일 부품코드가 있으면 함께 반영됩니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {step === "upload" ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> 엑셀 템플릿 다운로드
          </Button>
          <p className="text-xs text-muted-foreground">열 순서: 부품코드, 매출가</p>
          <label className="cursor-pointer">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors w-96">
              <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">엑셀 파일 선택</p>
              <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
            </div>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b bg-muted/20">
            <span className="text-sm">
              전체 {rows.length}건 · 유효 <b className="text-primary">{validRows.length}</b>건
              {result && (
                <>
                  {" · "}
                  <span className="text-emerald-500 dark:text-emerald-400">
                    <CheckCircle2 className="inline h-3.5 w-3.5 mr-0.5" />업데이트 {result.matched}
                  </span>
                  {result.missing.length > 0 && (
                    <span className="ml-2 text-destructive">
                      <XCircle className="inline h-3.5 w-3.5 mr-0.5" />미매칭 {result.missing.length}
                    </span>
                  )}
                </>
              )}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>다시 선택</Button>
              <Button
                size="sm"
                onClick={() => mutation.mutate()}
                disabled={validRows.length === 0 || mutation.isPending || !!result}
              >
                {mutation.isPending ? "업데이트 중..." : result ? "완료" : `${validRows.length}건 업데이트`}
              </Button>
            </div>
          </div>
          <ScrollArea className="max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">부품코드</th>
                  <th className="text-right p-2 font-medium text-muted-foreground text-xs">매출가</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs w-24">상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const invalid = !r.part_code || r.sales_price == null || r.sales_price <= 0;
                  const missed = result?.missing.includes(r.part_code);
                  return (
                    <tr key={i} className={`border-b last:border-0 ${invalid ? "bg-destructive/5" : ""}`}>
                      <td className="p-2 font-mono text-xs">{r.part_code || <span className="text-destructive">누락</span>}</td>
                      <td className="p-2 text-right tabular-nums">
                        {r.sales_price != null && r.sales_price > 0 ? (
                          r.sales_price.toLocaleString()
                        ) : (
                          <span className="text-destructive">{r.raw_price || "누락"}</span>
                        )}
                      </td>
                      <td className="p-2 text-xs">
                        {invalid ? (
                          <span className="text-destructive">잘못된 값</span>
                        ) : missed ? (
                          <span className="text-destructive">재고에 없음</span>
                        ) : result ? (
                          <span className="text-emerald-500 dark:text-emerald-400">완료</span>
                        ) : (
                          <span className="text-muted-foreground">대기</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
