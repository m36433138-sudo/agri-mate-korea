import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  parseExcel,
  normalizeModelName,
  inferManufacturer,
  normalizeTechnician,
  normalizePhone,
  type RawCustomer,
  type RawMachine,
  type RawAttachment,
  type RawRepair,
} from "@/lib/migrationUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertCircle, ChevronRight, Loader2 } from "lucide-react";

const db = supabase as any;

// ── 배치 처리 헬퍼 ─────────────────────────────────────────────────────────
async function batchInsert<T>(
  items: T[],
  batchSize: number,
  insertFn: (batch: T[]) => Promise<void>,
  onProgress: (done: number, total: number) => void
) {
  let done = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await insertFn(batch);
    done += batch.length;
    onProgress(done, items.length);
  }
}

// ── 스텝 상태 타입 ─────────────────────────────────────────────────────────
interface StepState {
  status: "idle" | "ready" | "running" | "done" | "error";
  total: number;
  newCount: number;
  skipCount: number;
  done: number;
  error?: string;
}

const initStep = (): StepState => ({ status: "idle", total: 0, newCount: 0, skipCount: 0, done: 0 });

export default function MigrationPage() {
  const [parsed, setParsed] = useState<{
    customers: RawCustomer[];
    machines: RawMachine[];
    attachments: RawAttachment[];
    repairs: RawRepair[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [steps, setSteps] = useState({
    customers: initStep(),
    machines: initStep(),
    attachments: initStep(),
    repairs: initStep(),
  });

  const setStep = (key: keyof typeof steps, update: Partial<StepState>) =>
    setSteps(prev => ({ ...prev, [key]: { ...prev[key], ...update } }));

  // ── 파일 처리 ────────────────────────────────────────────────────────────
  const handleFile = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    try {
      const result = await parseExcel(file);
      setParsed(result);
      setSteps({
        customers:   { ...initStep(), status: "ready", total: result.customers.length },
        machines:    { ...initStep(), status: "idle",  total: result.machines.length },
        attachments: { ...initStep(), status: "idle",  total: result.attachments.length },
        repairs:     { ...initStep(), status: "idle",  total: result.repairs.length },
      });
    } catch (e: any) {
      alert("엑셀 파싱 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: 고객 ─────────────────────────────────────────────────────────
  const importCustomers = async () => {
    if (!parsed) return;
    setStep("customers", { status: "running", done: 0 });
    try {
      // 기존 고객 phone 목록 조회
      const { data: existing } = await db.from("customers").select("phone, legacy_code");
      const existingPhones = new Set((existing ?? []).map((c: any) => normalizePhone(c.phone)));
      const existingCodes  = new Set((existing ?? []).map((c: any) => c.legacy_code).filter(Boolean));

      const toInsert = parsed.customers.filter(c => {
        if (!c.name) return false;
        if (c.legacy_code && existingCodes.has(c.legacy_code)) return false;
        if (c.phone && existingPhones.has(c.phone)) return false;
        return true;
      });

      const newCount = toInsert.length;
      const skipCount = parsed.customers.length - newCount;
      setStep("customers", { newCount, skipCount });

      await batchInsert(toInsert, 200, async (batch) => {
        const rows = batch.map(c => ({
          name: c.name,
          phone: c.phone || "",
          address: c.address || null,
          branch: c.branch || null,
          legacy_code: c.legacy_code || null,
          created_at: c.registered_at || undefined,
        }));
        const { error } = await db.from("customers").insert(rows);
        if (error) throw error;
      }, (done) => setStep("customers", { done }));

      setStep("customers", { status: "done", done: newCount });
      setStep("machines", { status: "ready" });
    } catch (e: any) {
      setStep("customers", { status: "error", error: e.message });
    }
  };

  // ── Step 2: 본기 ─────────────────────────────────────────────────────────
  const importMachines = async () => {
    if (!parsed) return;
    setStep("machines", { status: "running", done: 0 });
    try {
      // 고객 legacy_code → id 맵
      const { data: custData } = await db.from("customers").select("id, legacy_code, phone");
      const codeMap = new Map<string, string>();
      for (const c of custData ?? []) {
        if (c.legacy_code) codeMap.set(c.legacy_code, c.id);
      }

      // 기존 기계 serial 목록
      const { data: existingMach } = await db.from("machines").select("serial_number");
      const existingSerials = new Set((existingMach ?? []).map((m: any) => m.serial_number));

      // 제조번호 기준 중복 제거 (엑셀 내부 중복 포함)
      const seen = new Set<string>();
      const toInsert = parsed.machines.filter(m => {
        if (!m.serial_number || seen.has(m.serial_number)) return false;
        if (existingSerials.has(m.serial_number)) { seen.add(m.serial_number); return false; }
        seen.add(m.serial_number);
        return true;
      });

      const newCount = toInsert.length;
      const skipCount = parsed.machines.length - newCount;
      setStep("machines", { newCount, skipCount });

      await batchInsert(toInsert, 100, async (batch) => {
        const rows = batch.map(m => {
          const mfr = inferManufacturer(m.model_header, m.brand, m.serial_number);
          const model = normalizeModelName(m.model_header, m.brand) || m.serial_number.slice(0, 20);
          const customerId = codeMap.get(m.legacy_code) ?? null;
          return {
            model_name: model,
            serial_number: m.serial_number,
            manufacturer: mfr,
            machine_type: "타사구매",
            status: customerId ? "판매완료" : "재고중",
            customer_id: customerId,
            entry_date: m.entry_date || new Date().toISOString().slice(0, 10),
            purchase_price: 0,
            notes: m.model_header || null,
          };
        });
        const { error } = await db.from("machines").insert(rows);
        if (error) throw error;
      }, (done) => setStep("machines", { done }));

      setStep("machines", { status: "done", done: newCount });
      setStep("attachments", { status: "ready" });
    } catch (e: any) {
      setStep("machines", { status: "error", error: e.message });
    }
  };

  // ── Step 3: 작업기 ────────────────────────────────────────────────────────
  const importAttachments = async () => {
    if (!parsed) return;
    setStep("attachments", { status: "running", done: 0 });
    try {
      // 기계 serial_number → id 맵
      const { data: machData } = await db.from("machines").select("id, serial_number");
      const serialMap = new Map<string, string>();
      for (const m of machData ?? []) serialMap.set(m.serial_number, m.id);

      // "작업기" 유형만 처리 (본기(타사)는 machines로 처리됨)
      const realAttachments = parsed.attachments.filter(a => a.attach_type === "작업기");

      // 기존 작업기 serial 목록
      const { data: existingAtt } = await db.from("machine_attachments").select("serial_number");
      const existingAttSerials = new Set((existingAtt ?? []).map((a: any) => a.serial_number).filter(Boolean));

      const seen = new Set<string>();
      const toInsert = realAttachments.filter(a => {
        const key = a.serial_number;
        if (!key || seen.has(key) || existingAttSerials.has(key)) return false;
        seen.add(key);
        return true;
      });

      const newCount = toInsert.length;
      const skipCount = parsed.attachments.length - newCount;
      setStep("attachments", { newCount, skipCount });

      await batchInsert(toInsert, 100, async (batch) => {
        const rows = batch.map(a => {
          const machineId = serialMap.get(a.parent_serial) ?? null;
          return {
            machine_id: machineId,
            name: a.model_header || a.serial_number,
            serial_number: a.serial_number || null,
            notes: a.model_header || null,
          };
        }).filter(r => r.machine_id); // machine_id 없으면 스킵
        if (rows.length === 0) return;
        const { error } = await db.from("machine_attachments").insert(rows);
        if (error) throw error;
      }, (done) => setStep("attachments", { done }));

      setStep("attachments", { status: "done", done: newCount });
      setStep("repairs", { status: "ready" });
    } catch (e: any) {
      setStep("attachments", { status: "error", error: e.message });
    }
  };

  // ── Step 4: 수리이력 ──────────────────────────────────────────────────────
  const importRepairs = async () => {
    if (!parsed) return;
    setStep("repairs", { status: "running", done: 0 });
    try {
      const { data: machData } = await db.from("machines").select("id, serial_number");
      const serialMap = new Map<string, string>();
      for (const m of machData ?? []) serialMap.set(m.serial_number, m.id);

      const { data: custData } = await db.from("customers").select("id, legacy_code");
      const codeMap = new Map<string, string>();
      for (const c of custData ?? []) {
        if (c.legacy_code) codeMap.set(c.legacy_code, c.id);
      }

      const toInsert = parsed.repairs.filter(r => r.repair_date && r.content);
      const newCount = toInsert.length;
      setStep("repairs", { newCount, skipCount: parsed.repairs.length - newCount });

      await batchInsert(toInsert, 100, async (batch) => {
        const rows = batch.map(r => {
          const machineId = r.serial_number ? (serialMap.get(r.serial_number) ?? null) : null;
          const customerId = r.legacy_code ? (codeMap.get(r.legacy_code) ?? null) : null;
          const tech = normalizeTechnician(r.technician);
          return {
            machine_id: machineId,
            customer_id: customerId,
            repair_date: r.repair_date,
            repair_content: r.content,
            parts_used: r.parts_count > 0 ? `부품 ${r.parts_count}종` : null,
            cost: (r.cost_labor || 0) + (r.cost_parts || 0),
            cost_labor: r.cost_labor || 0,
            cost_parts: r.cost_parts || 0,
            repair_type: r.repair_type || null,
            technician: tech,
          };
        });
        const { error } = await db.from("repair_history").insert(rows);
        if (error) throw error;
      }, (done) => setStep("repairs", { done }));

      setStep("repairs", { status: "done", done: newCount });
    } catch (e: any) {
      setStep("repairs", { status: "error", error: e.message });
    }
  };

  // ── 렌더 헬퍼 ─────────────────────────────────────────────────────────────
  const StepCard = ({
    title, step, onImport, description,
  }: { title: string; step: StepState; onImport: () => void; description: string }) => (
    <Card className={`border-0 shadow-card ${step.status === "done" ? "border-l-4 border-l-green-500" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {step.status === "done" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {step.status === "error" && <AlertCircle className="h-5 w-5 text-destructive" />}
            {step.status === "running" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {(step.status === "idle" || step.status === "ready") && (
              <div className={`h-5 w-5 rounded-full border-2 ${step.status === "ready" ? "border-primary bg-primary/10" : "border-muted"}`} />
            )}
            <span className="font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {step.status === "ready" && (
              <Badge variant="outline" className="text-xs">
                신규 {step.total}건
              </Badge>
            )}
            {step.status === "done" && (
              <>
                <Badge className="text-xs bg-green-100 text-green-700 border-green-200">추가 {step.newCount}건</Badge>
                <Badge variant="secondary" className="text-xs">건너뜀 {step.skipCount}건</Badge>
              </>
            )}
            <Button
              size="sm"
              onClick={onImport}
              disabled={step.status !== "ready"}
              className="gap-1"
            >
              {step.status === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3 w-3" />}
              가져오기
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
        {step.status === "running" && (
          <div className="space-y-1">
            <Progress value={step.total > 0 ? (step.done / step.total) * 100 : 0} className="h-1.5" />
            <p className="text-xs text-muted-foreground text-right">{step.done} / {step.total}</p>
          </div>
        )}
        {step.status === "error" && (
          <p className="text-xs text-destructive mt-1">{step.error}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">데이터 마이그레이션</h1>
        <p className="text-sm text-muted-foreground mt-1">엑셀 파일에서 고객·기계·수리이력을 Supabase로 가져옵니다.</p>
      </div>

      {/* 파일 업로드 */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
          />
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">파싱 중...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">엑셀 파일을 드래그하거나 클릭해서 선택</p>
                <p className="text-xs text-muted-foreground">AgriMate_마이그레이션_v4_최종.xlsx</p>
              </div>
            )}
          </div>

          {parsed && (
            <div className="mt-4 grid grid-cols-4 gap-3 text-center">
              {[
                { label: "고객", count: parsed.customers.length },
                { label: "본기", count: parsed.machines.length },
                { label: "작업기", count: parsed.attachments.filter(a => a.attach_type === "작업기").length },
                { label: "수리이력", count: parsed.repairs.length },
              ].map(({ label, count }) => (
                <div key={label} className="rounded-md bg-muted/50 p-3">
                  <p className="text-lg font-bold tabular-nums">{count.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4단계 Import */}
      {parsed && (
        <div className="space-y-3">
          <StepCard
            title="1단계 · 고객"
            step={steps.customers}
            onImport={importCustomers}
            description="전화번호 또는 legacy_code 기준으로 기존 고객과 중복 확인 후 신규 고객만 추가합니다."
          />
          <StepCard
            title="2단계 · 본기 (기계)"
            step={steps.machines}
            onImport={importMachines}
            description="제조번호 기준 중복 제거. 모델명 정규화(JD=존디어, YT/YM=얀마 등). 모두 타사구매로 등록됩니다."
          />
          <StepCard
            title="3단계 · 작업기"
            step={steps.attachments}
            onImport={importAttachments}
            description="본기에 연결된 작업기를 가져옵니다. 본기(타사) 유형은 제외하고 작업기 유형만 처리합니다."
          />
          <StepCard
            title="4단계 · 수리이력"
            step={steps.repairs}
            onImport={importRepairs}
            description="날짜 오름차순으로 정렬. 담당기사는 현재 재직자 6명(유호상·김영일·마성수·이재현·이동진·주희로)만 유효 처리됩니다."
          />
        </div>
      )}

      <Card className="border-0 shadow-card bg-amber-50">
        <CardContent className="p-4">
          <p className="text-xs text-amber-800 font-medium mb-1">주의사항</p>
          <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
            <li>마이그레이션 전 Supabase에서 migration SQL을 먼저 실행해주세요.</li>
            <li>고객 중복 기준: 전화번호 또는 레거시 코드</li>
            <li>기계 중복 기준: 제조번호 (serial_number)</li>
            <li>수리이력은 중복 체크 없이 전체 추가됩니다 (재실행 시 중복됨)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
