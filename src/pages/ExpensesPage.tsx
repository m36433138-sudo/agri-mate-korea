import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_CATEGORIES, expenseSheet, receiptToRows, totalsByCategory, type Expense, type ReceiptRead } from "@/lib/expenses";
import { Camera, Download, FileText, Loader2, Plus, Receipt, Search, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { PageHeader, SearchField, Segmented } from "@/components/page/PageParts";
import { readPdfText } from "@/lib/pdfText";
import { isYanmarStatement, parseYanmarStatement, type YanmarStatement } from "@/lib/yanmarStatement";
import YanmarStatementDialog from "@/components/partReceipts/YanmarStatementDialog";
import { codeFromDescription, generalPartCode, matchVendor, type Branch } from "@/lib/partReceipts";
import { createPartReceipt, ensureVendor, loadVendors } from "@/components/partReceipts/receiptData";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";

const db = supabase as any;
const BUCKET = "receipts";
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const todayStr = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** 휴대폰 파일 선택기는 PDF 종류를 비워 보내기도 해서 확장자로도 본다 */
const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

async function toDataUrl(file: File): Promise<{ dataUrl: string; blob: Blob; ext: string; type: string }> {
  if (isPdf(file)) {
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { dataUrl: `data:application/pdf;base64,${btoa(bin)}`, blob: file, ext: "pdf", type: "application/pdf" };
  }
  // 사진은 2000px로 줄여 올린다 (글자는 그대로 읽힘)
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.85);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("사진 변환 실패"))), "image/jpeg", 0.85));
  return { dataUrl, blob, ext: "jpg", type: "image/jpeg" };
}

type Draft = ReturnType<typeof receiptToRows>[number];

export default function ExpensesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin, hasPermission } = useUserRole();
  const canManage = isAdmin || hasPermission("manage_expenses");
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [category, setCategory] = useState("전체");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [review, setReview] = useState<{ rows: Draft[]; fileName: string; total: number | null; vendor: string | null } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [yanmar, setYanmar] = useState<{ file: File; statement: YanmarStatement } | null>(null);
  // 일반 거래처 명세서의 「부품 매입」 줄을 부품 입고 대기로 보낼지 · 어느 지점으로
  const [toReceiving, setToReceiving] = useState(true);
  const [receiveBranch, setReceiveBranch] = useState<Branch>("장흥");
  const navigate = useNavigate();
  const { data: vendorList = [] } = useQuery({ queryKey: ["vendors-for-expenses"], queryFn: loadVendors, staleTime: 60_000 });
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queue = useRef<File[]>([]);

  const { data: rows = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses", month],
    queryFn: async () => {
      const [y, m] = month.split("-").map(Number);
      const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      const { data, error } = await db.from("expenses").select("*")
        .gte("expense_date", `${month}-01`).lt("expense_date", end)
        .order("expense_date", { ascending: false }).order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return data as Expense[];
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (category === "전체" || r.category === category)
      && (!t || `${r.vendor ?? ""} ${r.description} ${r.notes ?? ""}`.toLowerCase().includes(t)));
  }, [rows, category, q]);
  const totals = useMemo(() => totalsByCategory(rows), [rows]);
  const sum = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  const monthSum = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Expense> & { id: string }) => {
      const { error } = await db.from("expenses").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
    onError: (e: any) => toast({ title: "변경 실패", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (r: Expense) => {
      const { error } = await db.from("expenses").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const readNext = async () => {
    const file = queue.current.shift();
    if (!file) { setBusy(null); return; }
    setBusy(`「${file.name}」 읽는 중… (AI가 항목을 나누고 분류합니다)${queue.current.length ? ` · 남은 ${queue.current.length}장` : ""}`);
    let notYanmarPdf = false;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("10MB 이하 파일만 올릴 수 있습니다.");
      // 얀마 거래명세서 PDF는 글자층을 바로 읽는다 (AI 없이, 부품번호·수량·금액이 정확)
      if (isPdf(file)) {
        try {
          const pages = await readPdfText(file, 10);
          if (isYanmarStatement(pages)) {
            const statement = parseYanmarStatement(pages);
            if (statement.lines.length > 0) {
              setBusy(null);
              setYanmar({ file, statement });
              return;
            }
          }
        } catch (e) { console.warn("[expenses] PDF 글자층 읽기 실패, AI로 읽기", e); /* 글자층이 없는 스캔 PDF 등은 AI로 읽는다 */ }
        notYanmarPdf = true;
      }
      const { dataUrl, blob, ext, type } = await toDataUrl(file);
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user?.id ?? "anon"}/${todayStr()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type });
      if (up.error) throw up.error;
      const { data, error } = await supabase.functions.invoke("read-receipt", { body: { file: dataUrl, filename: file.name } });
      if (error || data?.error) {
        let msg = data?.error ?? error?.message ?? "판독 실패";
        try { const ctx = await (error as any)?.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* 본문 없음 */ }
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(msg);
      }
      const read = data as ReceiptRead;
      const drafts = receiptToRows(read, todayStr(), { receipt_path: path, receipt_group: crypto.randomUUID() });
      if (drafts.length === 0) throw new Error("금액이 있는 항목을 찾지 못했습니다. 직접 입력해 주세요.");
      setBusy(null);
      setReview({ rows: drafts, fileName: file.name, total: read.total, vendor: read.vendor });
    } catch (e: any) {
      const hint = notYanmarPdf ? " (얀마 거래명세서 형식이 아니어서 AI로 읽으려 했습니다. 얀마 사이트에서 받은 원본 PDF는 AI 없이 바로 읽힙니다.)" : "";
      toast({ title: "영수증을 읽지 못했습니다", description: `${e.message}${hint}`, variant: "destructive" });
      readNext();
    }
  };

  const pick = (list: FileList | null) => {
    if (!list?.length) return;
    queue.current.push(...Array.from(list));
    if (!busy && !review && !yanmar) readNext();
  };

  const saveReview = async () => {
    if (!review) return;
    const valid = review.rows.filter((r) => r.description.trim() && Number(r.amount));
    const partRows = valid.filter((r) => r.category === "부품 매입");
    const { error } = await db.from("expenses").insert(valid);
    if (error) { toast({ title: "저장 실패", description: error.message, variant: "destructive" }); return; }
    let receivingNote = "";
    if (toReceiving && partRows.length > 0) {
      // 거래처를 찾거나 등록하고, 부품 매입 줄을 부품 입고 대기로 (모두 재고에 등록되는 일반 부품)
      try {
        const first = partRows[0];
        const vendor = await ensureVendor(vendorList, {
          name: first.vendor, business_number: first.business_number,
          itemsHint: partRows.map((r) => r.description).slice(0, 3).join(", "),
        });
        await createPartReceipt(
          {
            source: "general", vendor_id: vendor?.id ?? null, vendor_name: vendor?.name ?? first.vendor, business_number: first.business_number,
            doc_number: null, doc_date: first.expense_date, branch: receiveBranch,
            supply_amount: null, vat_amount: null, total_amount: partRows.reduce((s, r) => s + Number(r.amount), 0),
            expense_group: first.receipt_group, file_path: first.receipt_path, notes: null,
          },
          partRows.map((r, i) => {
            const qty = Math.max(1, Math.round(Number(r.quantity) || 1));
            return {
              line_no: i + 1,
              part_code: codeFromDescription(r.description) ?? generalPartCode(vendor?.name ?? first.vendor, r.description),
              alt_part_code: null, part_name: r.description.trim(), quantity: qty,
              unit_price: Math.round(Number(r.unit_price) || Number(r.amount) / qty), amount: Math.round(Number(r.amount)), location: null,
            };
          }),
        );
        receivingNote = ` · ${receiveBranch} 부품 입고 대기 ${partRows.length}줄`;
        qc.invalidateQueries({ queryKey: ["vendors-for-expenses"] });
      } catch (e: any) {
        toast({ title: "지출은 저장했지만 부품 입고 대기를 만들지 못했어요", description: e.message, variant: "destructive" });
      }
    }
    toast({
      title: `지출 ${valid.length}건을 표에 추가했습니다.`,
      description: won(valid.reduce((s, r) => s + Number(r.amount), 0)) + receivingNote,
      action: receivingNote ? <ToastAction altText="부품 입고로 가기" onClick={() => navigate("/parts?tab=receiving")}>입고하러 가기</ToastAction> : undefined,
    });
    if (valid[0]?.expense_date) setMonth(valid[0].expense_date.slice(0, 7));
    qc.invalidateQueries({ queryKey: ["expenses"] });
    setReview(null);
    readNext();
  };
  const cancelReview = async () => {
    const path = review?.rows[0]?.receipt_path;
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    setReview(null);
    readNext();
  };

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    if (error || !data) { toast({ title: "원본을 열 수 없습니다.", variant: "destructive" }); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.aoa_to_sheet(expenseSheet(filtered));
    ws["!cols"] = [10, 18, 14, 10, 30, 6, 10, 12, 10, 6, 16].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "지출");
    const sumWs = XLSX.utils.aoa_to_sheet([["분류", "금액"], ...totalsByCategory(filtered).map((t) => [t.category, t.amount])]);
    XLSX.utils.book_append_sheet(wb, sumWs, "분류별 합계");
    XLSX.writeFile(wb, `지출_${month}${category !== "전체" ? `_${category}` : ""}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="지출 관리"
        sub={<>{month.replace("-", "년 ")}월 지출 {won(monthSum)} · {rows.length}건</>}
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full bg-card gap-1.5 hidden sm:inline-flex" onClick={exportXlsx} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> 엑셀
            </Button>
            {canManage && (
              <>
                <Button variant="outline" className="h-11 rounded-full bg-card gap-1.5" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" /> 직접 입력</Button>
                <Button variant="outline" className="h-11 rounded-full bg-card gap-1.5 sm:hidden" onClick={() => cameraRef.current?.click()} disabled={!!busy}><Camera className="h-4 w-4" /> 촬영</Button>
                <Button className="h-11 rounded-full px-5 gap-1.5" onClick={() => fileRef.current?.click()} disabled={!!busy}><Upload className="h-4 w-4" /> 영수증 올리기</Button>
              </>
            )}
          </>
        }
      />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />

      {busy && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 text-primary px-4 py-3 text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" /> {busy}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40 h-11 rounded-xl bg-card" aria-label="월" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40 h-11 rounded-xl bg-card" aria-label="분류"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="전체">전체 분류</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <SearchField value={q} onChange={setQ} placeholder="거래처, 내용으로 찾기" className="min-w-[12rem]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{month.replace("-", "년 ")}월 지출</p>
          <p className="text-[26px] sm:text-[30px] leading-tight font-extrabold tracking-tight tabular-nums mt-1">{won(monthSum)}</p>
          <p className="text-xs text-muted-foreground">{rows.length}건{category !== "전체" || q ? ` · 보이는 것 ${won(sum)}` : ""}</p>
        </CardContent></Card>
        <Card className="sm:col-span-2"><CardContent className="p-4 space-y-1.5">
          <p className="text-xs text-muted-foreground">분류별</p>
          {totals.length === 0 ? <p className="text-sm text-muted-foreground">아직 없음</p> : totals.slice(0, 6).map((t) => (
            <button key={t.category} type="button" onClick={() => setCategory(category === t.category ? "전체" : t.category)} className="w-full flex items-center gap-2 text-sm text-left">
              <span className={`w-24 shrink-0 truncate ${category === t.category ? "text-primary font-semibold" : ""}`}>{t.category}</span>
              <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${monthSum ? (t.amount / monthSum) * 100 : 0}%` }} /></span>
              <span className="w-28 text-right tabular-nums">{won(t.amount)}</span>
            </button>
          ))}
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2"><CardContent className="py-14 text-center text-sm text-muted-foreground">
          <Receipt className="h-8 w-8 mx-auto mb-3 opacity-30" />
          이 달 지출이 없습니다. 영수증 사진이나 청구서 PDF를 올리면 AI가 항목별로 나눠 분류해 표에 넣습니다.
        </CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="text-left p-3 font-medium">날짜</th>
                <th className="text-left p-3 font-medium">거래처</th>
                <th className="text-left p-3 font-medium">내용</th>
                <th className="text-left p-3 font-medium">분류</th>
                <th className="text-right p-3 font-medium">금액</th>
                <th className="p-3 w-20"></th>
              </tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/25">
                    <td className="p-3 whitespace-nowrap tabular-nums">{r.expense_date.slice(5).replace("-", ".")}</td>
                    <td className="p-3 max-w-[10rem] truncate" title={r.vendor ?? ""}>{r.vendor ?? "-"}</td>
                    <td className="p-3 min-w-[10rem]">{r.description}{r.quantity ? <span className="text-xs text-muted-foreground"> ×{r.quantity}</span> : null}</td>
                    <td className="p-3">
                      {canManage ? (
                        <Select value={r.category} onValueChange={(v) => update.mutate({ id: r.id, category: v })}>
                          <SelectTrigger className="h-8 w-32 text-xs" aria-label="분류 바꾸기"><SelectValue /></SelectTrigger>
                          <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : r.category}
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium whitespace-nowrap">{won(Number(r.amount))}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        {r.receipt_path && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openReceipt(r.receipt_path!)} aria-label="원본 보기" title="원본 보기">
                            {r.receipt_path.endsWith(".pdf") ? <FileText className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="삭제" onClick={() => { if (confirm("이 지출을 삭제할까요?")) remove.mutate(r); }}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-muted/20 font-semibold"><td className="p-3" colSpan={4}>합계 {filtered.length}건</td><td className="p-3 text-right tabular-nums">{won(sum)}</td><td /></tr></tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* AI 판독 결과 확인 → 저장 */}
      <Dialog open={!!review} onOpenChange={(v) => { if (!v) cancelReview(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>읽은 내용 확인 · {review?.fileName}</DialogTitle></DialogHeader>
          {review && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input value={review.rows[0]?.vendor ?? ""} placeholder="거래처" aria-label="거래처"
                  onChange={(e) => setReview({ ...review, rows: review.rows.map((r) => ({ ...r, vendor: e.target.value || null })) })} />
                <Input type="date" value={review.rows[0]?.expense_date ?? ""} aria-label="날짜"
                  onChange={(e) => setReview({ ...review, rows: review.rows.map((r) => ({ ...r, expense_date: e.target.value })) })} />
              </div>
              <div className="space-y-2">
                {review.rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_8rem_7rem_2rem] gap-1.5 items-center">
                    <Input value={r.description} aria-label="내용" onChange={(e) => setReview({ ...review, rows: review.rows.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
                    <Select value={r.category} onValueChange={(v) => setReview({ ...review, rows: review.rows.map((x, j) => j === i ? { ...x, category: v } : x) })}>
                      <SelectTrigger className="text-xs" aria-label="분류"><SelectValue /></SelectTrigger>
                      <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" inputMode="numeric" value={r.amount} aria-label="금액" className="text-right tabular-nums"
                      onChange={(e) => setReview({ ...review, rows: review.rows.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x) })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="이 줄 빼기" onClick={() => setReview({ ...review, rows: review.rows.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              {review.rows.some((r) => r.category === "부품 매입") && (() => {
                const v = matchVendor(vendorList, review.rows[0]?.vendor ?? null, review.rows[0]?.business_number ?? null);
                const n = review.rows.filter((r) => r.category === "부품 매입").length;
                return (
                  <div className="rounded-2xl border bg-muted/40 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <Checkbox checked={toReceiving} onCheckedChange={(c) => setToReceiving(!!c)} />
                      「부품 매입」 {n}줄을 부품 입고 대기로 보내기 (창고 확인 후 재고 등록)
                    </label>
                    {toReceiving && (
                      <div className="flex items-center gap-3 flex-wrap pl-6">
                        <Segmented<Branch> label="입고 지점" value={receiveBranch} onChange={setReceiveBranch}
                          options={[{ value: "장흥", label: "장흥" }, { value: "강진", label: "강진" }]} />
                        <span className="text-xs text-muted-foreground">
                          거래처: {v ? <b className="text-foreground">{v.name} (등록된 거래처)</b> : <b className="text-primary">{review.rows[0]?.vendor || "이름 없음"} · 새로 등록돼요</b>}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <p className="text-sm text-right">
                항목 합계 <b className="tabular-nums">{won(review.rows.reduce((s, r) => s + Number(r.amount || 0), 0))}</b>
                {review.total != null && <span className="text-muted-foreground"> · 영수증 합계 {won(review.total)}</span>}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelReview}>버리기</Button>
            <Button onClick={saveReview} disabled={!review?.rows.length}>표에 추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {yanmar && (
        <YanmarStatementDialog
          file={yanmar.file}
          statement={yanmar.statement}
          onDone={(saved) => {
            setYanmar(null);
            if (saved) { setMonth(saved.month); qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["part-receipts"] }); }
            readNext();
          }}
        />
      )}

      <ManualExpenseDialog open={manualOpen} onOpenChange={setManualOpen} onSaved={(d) => { setMonth(d.slice(0, 7)); qc.invalidateQueries({ queryKey: ["expenses"] }); }} />
    </div>
  );
}

function ManualExpenseDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: (date: string) => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ expense_date: todayStr(), vendor: "", description: "", category: "기타", amount: "" });
  const save = async () => {
    const { error } = await db.from("expenses").insert({ ...f, vendor: f.vendor || null, amount: Number(f.amount), source: "manual" });
    if (error) { toast({ title: "저장 실패", description: error.message, variant: "destructive" }); return; }
    onSaved(f.expense_date);
    onOpenChange(false);
    setF({ expense_date: todayStr(), vendor: "", description: "", category: "기타", amount: "" });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>지출 직접 입력</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} aria-label="날짜" />
          <Input value={f.vendor} placeholder="거래처" onChange={(e) => setF({ ...f, vendor: e.target.value })} />
          <Input value={f.description} placeholder="내용 (예: 경유 50L)" onChange={(e) => setF({ ...f, description: e.target.value })} />
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger aria-label="분류"><SelectValue /></SelectTrigger>
            <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" inputMode="numeric" value={f.amount} placeholder="금액 (원)" onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </div>
        <DialogFooter><Button onClick={save} disabled={!f.description.trim() || !Number(f.amount)}>저장</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
