import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, FileSpreadsheet, Loader2, UserPlus } from "lucide-react";
import { fetchAllRows } from "@/lib/pagination";
import { matchCustomers, parseMjLedger, type AppCustomer, type CustomerMatch, type MjEntry } from "@/lib/mjLedger";

const db = supabase as any;
type Prepared = { entries: MjEntry[]; matches: CustomerMatch[]; files: string[]; period: [string | null, string | null] };

async function readRows(file: File): Promise<unknown[][]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
}

/**
 * 천년경영 「거래처 원장」 엑셀(여러 기간을 한 번에도 가능)을 고객별 거래 원장으로 가져온다.
 * 같은 줄은 다시 가져와도 한 번만 들어가고(전표번호 기준), 앱에 없는 거래처는 새 고객으로 등록할 수 있다.
 */
export function MjLedgerImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [reading, setReading] = useState(false);
  const [createNew, setCreateNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, note: "" });
  const [result, setResult] = useState<string | null>(null);

  const reset = () => { setPrep(null); setResult(null); setProgress({ done: 0, total: 0, note: "" }); };

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    reset();
    setReading(true);
    try {
      const entries = new Map<string, MjEntry>();
      const customers = new Map<string, ReturnType<typeof parseMjLedger>["customers"][number]>();
      let start: string | null = null, end: string | null = null;
      for (const f of Array.from(files)) {
        const r = parseMjLedger(await readRows(f));
        r.entries.forEach((e) => entries.set(e.source_key, e));
        r.customers.forEach((c) => customers.set(c.code, c));
        if (r.periodStart && (!start || r.periodStart < start)) start = r.periodStart;
        if (r.periodEnd && (!end || r.periodEnd > end)) end = r.periodEnd;
      }
      const app = await fetchAllRows<AppCustomer>((from, to) => db.from("customers").select("id, name, phone, legacy_code").order("id").range(from, to));
      setPrep({ entries: [...entries.values()], matches: matchCustomers([...customers.values()], app), files: Array.from(files).map((f) => f.name), period: [start, end] });
    } catch (e) {
      toast({ title: "엑셀을 읽지 못했어요", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setReading(false);
    }
  };

  const run = async () => {
    if (!prep) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const idByCode = new Map<string, string>();
      // 1) 맞춘 고객에 천년경영 코드 남기기 (다음 가져오기부터 코드로 바로 찾는다)
      const matched = prep.matches.filter((m) => m.match);
      matched.forEach((m) => idByCode.set(m.customer.code, m.match!.id));
      const needCode = matched.filter((m) => !m.match!.legacy_code);
      setProgress({ done: 0, total: needCode.length, note: "고객에 천년경영 코드 남기는 중" });
      for (let i = 0; i < needCode.length; i++) {
        await db.from("customers").update({ legacy_code: needCode[i].customer.code }).eq("id", needCode[i].match!.id).is("legacy_code", null);
        if (i % 20 === 0) setProgress((p) => ({ ...p, done: i + 1 }));
      }
      // 2) 앱에 없는 거래처를 새 고객으로
      const missing = prep.matches.filter((m) => !m.match);
      if (createNew && missing.length) {
        setProgress({ done: 0, total: missing.length, note: "새 고객 등록 중" });
        for (let i = 0; i < missing.length; i += 200) {
          const chunk = missing.slice(i, i + 200).map((m) => ({
            name: m.customer.name || `천년경영 ${m.customer.code}`, phone: m.customer.phone || "", address: m.customer.address || null, legacy_code: m.customer.code,
          }));
          const { data, error } = await db.from("customers").insert(chunk).select("id, legacy_code");
          if (error) throw new Error(error.message);
          (data ?? []).forEach((c: { id: string; legacy_code: string }) => idByCode.set(c.legacy_code, c.id));
          setProgress((p) => ({ ...p, done: Math.min(missing.length, i + 200) }));
        }
      }
      // 3) 원장 줄 넣기 (이미 있는 줄은 건너뜀)
      const rows = prep.entries.filter((e) => idByCode.has(e.legacy_customer_code)).map((e) => ({
        ...e, customer_id: idByCode.get(e.legacy_customer_code), source: "mjsoft", imported_by: auth.user?.id ?? null,
      }));
      setProgress({ done: 0, total: rows.length, note: "거래 원장 넣는 중" });
      let added = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const { data, error } = await db.from("ledger_entries").upsert(rows.slice(i, i + 500), { onConflict: "source_key", ignoreDuplicates: true }).select("id");
        if (error) throw new Error(error.message);
        added += (data ?? []).length;
        setProgress((p) => ({ ...p, done: Math.min(rows.length, i + 500) }));
      }
      const skippedCustomers = createNew ? 0 : missing.length;
      setResult(`원장 ${added.toLocaleString("ko-KR")}줄을 넣었어요${rows.length - added ? ` (이미 있던 ${(rows.length - added).toLocaleString("ko-KR")}줄은 건너뜀)` : ""}.${createNew && missing.length ? ` 새 고객 ${missing.length}명 등록.` : ""}${skippedCustomers ? ` 앱에 없는 거래처 ${skippedCustomers}곳은 넣지 않았어요.` : ""}`);
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> 천년경영 거래 원장 가져오기</DialogTitle>
          <DialogDescription>천년경영에서 「거래처 원장」을 엑셀로 저장해 올려 주세요. 기간별 파일 여러 개를 한 번에 골라도 돼요 (2014년~). 같은 줄은 두 번 들어가지 않아요.</DialogDescription>
        </DialogHeader>

        <Input type="file" accept=".xls,.xlsx" multiple disabled={busy || reading} onChange={(e) => pick(e.target.files)} />
        {reading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />엑셀 읽는 중… (큰 파일은 몇십 초 걸려요)</p>}

        {prep && (
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border p-3 space-y-1">
              <p><b>{prep.files.length}개 파일</b> · 기간 {prep.period[0]} ~ {prep.period[1]}</p>
              <p className="text-muted-foreground">매출 {kinds("sale").toLocaleString("ko-KR")}줄 · 입금 {kinds("payment").toLocaleString("ko-KR")}줄 · 할인 {kinds("discount")}줄 · 메모 {kinds("memo").toLocaleString("ko-KR")}줄 · 무상 부품 {prep.entries.filter((e) => e.is_free).length}줄</p>
              <p className="text-xs text-muted-foreground">일계·월계 같은 합계 줄과 주민번호 칸은 가져오지 않아요.</p>
            </div>
            <div className="rounded-2xl border p-3 space-y-1">
              <p><b>거래처 {prep.matches.length}곳</b> 중 앱 고객과 맞춘 곳 {prep.matches.length - missing.length}곳</p>
              <p className="text-muted-foreground text-xs">거래처코드 {by("code")} · 휴대폰 {by("phone")} · 이름 {by("name")}</p>
              {missing.length > 0 && (
                <>
                  <p className="text-amber-700 dark:text-amber-400">앱에 없는 거래처 {missing.length}곳: {missing.slice(0, 8).map((m) => m.customer.name).join(", ")}{missing.length > 8 ? " …" : ""}</p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <Checkbox checked={createNew} onCheckedChange={(v) => setCreateNew(!!v)} disabled={busy} />
                    <UserPlus className="h-4 w-4" /> 새 고객으로 등록하고 함께 가져오기
                  </label>
                </>
              )}
            </div>
            {(busy || progress.total > 0) && !result && (
              <div className="space-y-1">
                <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
                <p className="text-xs text-muted-foreground">{progress.note} {progress.done.toLocaleString("ko-KR")}/{progress.total.toLocaleString("ko-KR")}</p>
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
