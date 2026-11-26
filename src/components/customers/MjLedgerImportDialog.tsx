import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, FileSpreadsheet, Loader2, UserPlus } from "lucide-react";
import { fetchAllRows } from "@/lib/pagination";
import {
  MJ_BOOKS, groupNewCustomers, mergeMjExports, guessMjBook, matchCustomers, mjBook, parseMjLedger, usablePhone,
  type AppCustomer, type BookCustomer, type CustomerMatch, type LegacyLink, type MjBookId, type MjEntry, type MjExport, type MjReplaceRange,
} from "@/lib/mjLedger";

const db = supabase as any;
type Picked = { name: string; rows: unknown[][]; book: MjBookId; period: string; lines: number; afterCutoff: number };
type Prepared = { entries: MjEntry[]; ranges: MjReplaceRange[]; matches: CustomerMatch[]; newGroups: BookCustomer[][]; app: AppCustomer[] };

async function readRows(file: File): Promise<unknown[][]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
}

function describe(rows: unknown[][], book: MjBookId) {
  const r = parseMjLedger(rows, book);
  return { period: `${r.periodStart ?? "?"} ~ ${r.periodEnd ?? "?"}`, lines: r.entries.filter((e) => e.kind !== "carry").length, afterCutoff: r.afterCutoff };
}

/**
 * 천년경영 「거래처 원장」 엑셀을 고객별 거래 원장으로 가져온다.
 * 파일마다 장부(구천년 장흥·강진 / 신천년)를 고르고, 구천년은 2025-10-31까지만 넣는다(그 뒤는 신천년에 있다).
 * 같은 줄은 다시 가져와도 한 번만 들어가고, 여러 장부의 같은 사람은 한 고객으로 묶는다.
 */
export function MjLedgerImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [files, setFiles] = useState<Picked[]>([]);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [reading, setReading] = useState(false);
  const [createNew, setCreateNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, note: "" });
  const [result, setResult] = useState<string | null>(null);

  const reset = () => { setFiles([]); setPrep(null); setResult(null); setProgress({ done: 0, total: 0, note: "" }); };

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    reset();
    setReading(true);
    try {
      const out: Picked[] = [];
      for (const f of Array.from(list)) {
        const rows = await readRows(f);
        const book = guessMjBook(parseMjLedger(rows, "new"));
        out.push({ name: f.name, rows, book, ...describe(rows, book) });
      }
      setFiles(out);
    } catch (e) {
      toast({ title: "엑셀을 읽지 못했어요", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setReading(false);
    }
  };

  const setBook = (i: number, book: MjBookId) => {
    setPrep(null);
    setFiles((fs) => fs.map((f, j) => (j === i ? { ...f, book, ...describe(f.rows, book) } : f)));
  };

  /** 고른 장부로 다시 읽어 앱 고객과 맞춰 본다 (DB는 아직 안 바꾼다) */
  const check = async () => {
    setReading(true);
    try {
      const customers = new Map<string, BookCustomer>();
      const exports: MjExport[] = [];
      for (const f of [...files].map((f) => ({ f, r: parseMjLedger(f.rows, f.book) })).sort((a, b) => (a.r.periodEnd ?? "").localeCompare(b.r.periodEnd ?? ""))) {
        exports.push({ book: f.f.book, periodStart: f.r.periodStart, periodEnd: f.r.periodEnd, entries: f.r.entries, customers: f.r.customers });
        // 같은 장부의 최근 파일(최근 이름·연락처)이 앞 것을 덮는다
        f.r.customers.forEach((c) => customers.set(`${f.f.book}:${c.code}`, { ...c, book: f.f.book }));
      }
      // 같은 장부 기간이 겹치면 늦게까지 뽑은 파일이 이긴다
      const merged = mergeMjExports(exports);
      const entries = new Map(merged.entries.map((e) => [e.source_key, e]));
      const [app, links] = await Promise.all([
        fetchAllRows<AppCustomer>((from, to) => db.from("customers").select("id, name, phone").order("id").range(from, to)),
        fetchAllRows<LegacyLink>((from, to) => db.from("customer_legacy_codes").select("book, code, customer_id").order("book").order("code").range(from, to)),
      ]);
      // 거래가 하나도 없는 거래처(구천년 마감 뒤에만 있던 곳 등)는 빼고 맞춘다
      const used = new Set([...entries.values()].map((e) => `${e.book}:${e.legacy_customer_code}`));
      const matches = matchCustomers([...customers.values()].filter((c) => used.has(`${c.book}:${c.code}`)), app, links);
      setPrep({ entries: [...entries.values()], ranges: merged.ranges, matches, newGroups: groupNewCustomers(matches.filter((m) => !m.match).map((m) => m.customer)), app });
    } catch (e) {
      toast({ title: "확인하지 못했어요", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setReading(false);
    }
  };

  const run = async () => {
    if (!prep) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const idOf = new Map<string, string>(); // "장부:코드" → 고객 id
      const links: { book: string; code: string; customer_id: string; legacy_name: string }[] = [];
      for (const m of prep.matches) if (m.match) {
        idOf.set(`${m.customer.book}:${m.customer.code}`, m.match.id);
        if (m.by !== "code") links.push({ book: m.customer.book, code: m.customer.code, customer_id: m.match.id, legacy_name: m.customer.name });
      }
      // 1) 앱에 없는 거래처 → 새 고객 (여러 장부의 같은 사람은 한 명)
      if (createNew && prep.newGroups.length) {
        setProgress({ done: 0, total: prep.newGroups.length, note: "새 고객 등록 중" });
        for (let i = 0; i < prep.newGroups.length; i += 200) {
          const groups = prep.newGroups.slice(i, i + 200);
          const rows = groups.map((g) => {
            const lead = g[0];
            // id를 미리 정해 넣어야 돌아온 순서에 기대지 않고 장부 코드와 잇는다
            return { id: crypto.randomUUID(), name: lead.name || `천년경영 ${lead.code}`, phone: g.map((c) => c.phone).find((p) => usablePhone(p)) || lead.phone || "", address: g.map((c) => c.address).find(Boolean) || null };
          });
          const { error } = await db.from("customers").insert(rows);
          if (error) throw new Error(error.message);
          rows.forEach((c, k) => {
            for (const bc of groups[k]) {
              idOf.set(`${bc.book}:${bc.code}`, c.id);
              links.push({ book: bc.book, code: bc.code, customer_id: c.id, legacy_name: bc.name });
            }
          });
          setProgress((p) => ({ ...p, done: Math.min(prep.newGroups.length, i + 200) }));
        }
      }
      // 2) (장부, 거래처코드) → 고객 연결을 남겨 다음 가져오기부터 바로 찾는다
      for (let i = 0; i < links.length; i += 500) {
        const { error } = await db.from("customer_legacy_codes").upsert(links.slice(i, i + 500), { onConflict: "book,code", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
      // 3) 파일 기간의 기존 줄을 거래처별로 지운다 — 천년경영에서 고치거나 지운 전표가 남지 않게
      setProgress({ done: 0, total: prep.ranges.length, note: "기존 기간 정리 중" });
      for (const [k, r] of prep.ranges.entries()) {
        for (let i = 0; i < r.codes.length; i += 200) {
          const { error } = await db.from("ledger_entries").delete().eq("book", r.book).gte("entry_date", r.start).lte("entry_date", r.end).in("legacy_customer_code", r.codes.slice(i, i + 200));
          if (error) throw new Error(error.message);
        }
        setProgress((p) => ({ ...p, done: k + 1 }));
      }
      // 4) 원장 줄
      const rows = prep.entries.filter((e) => idOf.has(`${e.book}:${e.legacy_customer_code}`)).map((e) => ({
        ...e, customer_id: idOf.get(`${e.book}:${e.legacy_customer_code}`), source: "mjsoft", imported_by: auth.user?.id ?? null,
      }));
      setProgress({ done: 0, total: rows.length, note: "거래 원장 넣는 중" });
      let added = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const { data, error } = await db.from("ledger_entries").upsert(rows.slice(i, i + 500), { onConflict: "source_key", ignoreDuplicates: true }).select("id");
        if (error) throw new Error(error.message);
        added += (data ?? []).length;
        setProgress((p) => ({ ...p, done: Math.min(rows.length, i + 500) }));
      }
      const skipped = prep.entries.length - rows.length;
      setResult(`원장 ${added.toLocaleString("ko-KR")}줄을 넣었어요${rows.length - added ? ` (이미 있던 ${(rows.length - added).toLocaleString("ko-KR")}줄은 건너뜀)` : ""}.`
        + (createNew && prep.newGroups.length ? ` 새 고객 ${prep.newGroups.length}명 등록.` : "")
        + (skipped ? ` 앱 고객과 잇지 못한 거래처의 ${skipped.toLocaleString("ko-KR")}줄은 넣지 않았어요.` : ""));
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-ledger"] });
    } catch (e) {
      toast({ title: "가져오기 중 멈췄어요", description: `${e instanceof Error ? e.message : String(e)} — 다시 가져오면 들어간 줄은 건너뛰고 이어서 넣어요.`, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const by = (k: CustomerMatch["by"]) => prep?.matches.filter((m) => m.by === k).length ?? 0;
  const kinds = (k: MjEntry["kind"]) => prep?.entries.filter((e) => e.kind === k).length ?? 0;
  const missing = prep?.matches.filter((m) => !m.match) ?? [];
  const n = (v: number) => v.toLocaleString("ko-KR");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> 천년경영 거래 원장 가져오기</DialogTitle>
          <DialogDescription>
            「거래처 원장」 엑셀을 여러 개 한 번에 골라도 돼요. 파일마다 장부를 확인해 주세요 — 구천년(장흥·강진)은 2025-10-31까지만 넣고, 그 뒤는 신천년 파일에서 가져와요. 같은 기간을 다시 가져오면 그 기간은 새 파일 내용으로 바뀌어요.
          </DialogDescription>
        </DialogHeader>

        <Input type="file" accept=".xls,.xlsx" multiple disabled={busy || reading} onChange={(e) => pick(e.target.files)} />
        {reading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />엑셀 읽는 중… (큰 파일은 몇십 초 걸려요)</p>}

        {files.length > 0 && (
          <ul className="space-y-2 text-sm">
            {files.map((f, i) => (
              <li key={i} className="rounded-2xl border p-3 space-y-2">
                <p className="font-medium break-all">{f.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={f.book} onValueChange={(v) => setBook(i, v as MjBookId)} disabled={busy}>
                    <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>{MJ_BOOKS.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">{f.period} · {n(f.lines)}줄{f.afterCutoff ? ` · 마감 뒤 ${n(f.afterCutoff)}줄 제외` : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {files.length > 0 && !prep && (
          <Button variant="outline" onClick={check} disabled={reading || busy}>장부 확인하고 고객 맞춰 보기</Button>
        )}

        {prep && (
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border p-3 space-y-1">
              <p className="text-muted-foreground">매출 {n(kinds("sale"))}줄 · 입금 {n(kinds("payment"))}줄 · 할인 {n(kinds("discount"))}줄 · 메모 {n(kinds("memo"))}줄 · 무상 부품 {n(prep.entries.filter((e) => e.is_free).length)}줄</p>
              <p className="text-xs text-muted-foreground">일계·월계 같은 합계 줄과 주민번호 칸은 가져오지 않아요.</p>
            </div>
            <div className="rounded-2xl border p-3 space-y-1">
              <p><b>거래처 {n(prep.matches.length)}곳</b> 중 앱 고객과 맞춘 곳 {n(prep.matches.length - missing.length)}곳</p>
              <p className="text-muted-foreground text-xs">이미 이은 곳 {by("code")} · 휴대폰 {by("phone")} · 이름 {by("name")}</p>
              {missing.length > 0 && (
                <>
                  <p className="text-amber-700 dark:text-amber-400">
                    앱에 없는 거래처 {n(missing.length)}곳 → 같은 사람을 묶으면 새 고객 {n(prep.newGroups.length)}명: {prep.newGroups.slice(0, 6).map((g) => g[0].name).join(", ")}{prep.newGroups.length > 6 ? " …" : ""}
                  </p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <Checkbox checked={createNew} onCheckedChange={(v) => setCreateNew(!!v)} disabled={busy} />
                    <UserPlus className="h-4 w-4" /> 새 고객으로 등록하고 함께 가져오기
                  </label>
                </>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                장부별: {MJ_BOOKS.map((b) => `${b.label} ${n(prep.matches.filter((m) => m.customer.book === b.id).length)}곳`).join(" · ")}
              </p>
            </div>
            {(busy || progress.total > 0) && !result && (
              <div className="space-y-1">
                <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
                <p className="text-xs text-muted-foreground">{progress.note} {n(progress.done)}/{n(progress.total)}</p>
              </div>
            )}
            {result && <p className="rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 p-3 flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />{result}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>닫기</Button>
          <Button onClick={run} disabled={!prep || busy || !!result} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} 가져오기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const mjBookLabel = (id: string | null | undefined) => mjBook(id)?.label ?? "천년경영";
