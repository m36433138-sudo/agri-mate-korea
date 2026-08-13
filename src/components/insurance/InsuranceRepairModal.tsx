import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { MachineSearchInput } from "@/components/MachineSearchInput";
import { useTechnicians } from "@/hooks/useTechnicians";
import InsurancePhotoManager from "./InsurancePhotoManager";
import {
  INSURANCE_STATUSES,
  useInsuranceCompanies,
  useSaveInsuranceRepair,
  statusSideEffects,
  type InsuranceRepair,
  type InsuranceStatus,
} from "@/hooks/useInsurance";
import { ExternalLink, FileText, ShieldCheck } from "lucide-react";

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const num = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(/[^0-9-]/g, "")) || 0));

export default function InsuranceRepairModal({
  open,
  onOpenChange,
  repair,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  repair?: InsuranceRepair | null;
}) {
  const { toast } = useToast();
  const { data: companies = [] } = useInsuranceCompanies();
  const { data: technicians = [] } = useTechnicians();
  const save = useSaveInsuranceRepair();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [machineId, setMachineId] = useState<string | null>(null);
  const [machineName, setMachineName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branch, setBranch] = useState("장흥");
  const [technician, setTechnician] = useState("");
  const [status, setStatus] = useState<InsuranceStatus>("수리대기");
  const [accidentDate, setAccidentDate] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [estimateAmount, setEstimateAmount] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [deductible, setDeductible] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes-picker"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("quotes")
        .select("id, quote_number, customer_name, total_amount, quote_date")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    if (!open) return;
    if (repair) {
      setCustomerId(repair.customer_id);
      setCustomerName(repair.customers?.name || "");
      setMachineId(repair.machine_id);
      setMachineName(repair.machines?.model_name || "");
      setCompanyId(repair.insurance_company_id || "");
      setBranch(repair.branch || "장흥");
      setTechnician(repair.technician || "");
      setStatus(repair.status);
      setAccidentDate(repair.accident_date || "");
      setClaimNumber(repair.claim_number || "");
      setDescription(repair.description || "");
      setNotes(repair.notes || "");
      setQuoteId(repair.quote_id || "");
      setEstimateAmount(repair.estimate_amount?.toString() || "");
      setClaimAmount(repair.claim_amount?.toString() || "");
      setDeductible(repair.deductible?.toString() || "");
      setPaidAmount(repair.paid_amount?.toString() || "");
      setSavedId(repair.id);
    } else {
      setCustomerId(null); setCustomerName(""); setMachineId(null); setMachineName("");
      setCompanyId(""); setBranch("장흥"); setTechnician(""); setStatus("수리대기");
      setAccidentDate(""); setClaimNumber(""); setDescription(""); setNotes("");
      setQuoteId(""); setEstimateAmount(""); setClaimAmount(""); setDeductible(""); setPaidAmount("");
      setSavedId(null);
    }
  }, [open, repair]);

  // 견적서를 선택하면 견적금액을 자동으로 채운다
  useEffect(() => {
    if (!quoteId) return;
    const q = quotes.find((x) => x.id === quoteId);
    if (q && !estimateAmount) setEstimateAmount(String(Math.round(q.total_amount || 0)));
  }, [quoteId, quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!customerId && !customerName.trim()) {
      toast({ title: "고객을 선택하세요", variant: "destructive" });
      return;
    }
    const prevStatus = repair?.status;
    try {
      const id = await save.mutateAsync({
        ...(savedId ? { id: savedId } : {}),
        customer_id: customerId,
        machine_id: machineId,
        insurance_company_id: companyId || null,
        branch,
        technician: technician || null,
        status,
        accident_date: accidentDate || null,
        claim_number: claimNumber || null,
        description: description || null,
        notes: notes || null,
        quote_id: quoteId || null,
        estimate_amount: num(estimateAmount),
        claim_amount: num(claimAmount),
        deductible: num(deductible),
        paid_amount: num(paidAmount),
        ...(status !== prevStatus ? statusSideEffects(status) : {}),
      });
      setSavedId(id);
      toast({
        title: savedId ? "보험수리 건을 수정했습니다." : "보험수리 건을 등록했습니다.",
        description: savedId ? undefined : "이제 수리사진을 첨부할 수 있습니다.",
      });
      if (savedId) onOpenChange(false);
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    }
  };

  const selectedQuote = quotes.find((q) => q.id === quoteId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {repair ? "보험수리 수정" : "보험수리 등록"}
            <Badge variant="secondary">{status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 고객 · 기계 */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">고객 *</Label>
              <CustomerSearchInput
                value={customerName}
                onChange={(v) => { setCustomerName(v); if (!v) { setCustomerId(null); setMachineId(null); setMachineName(""); } }}
                onSelect={(c) => { setCustomerId(c.id); setMachineId(null); setMachineName(""); }}
              />
            </div>
            <div>
              <Label className="text-xs">기계</Label>
              <MachineSearchInput
                value={machineName}
                customerId={customerId}
                onChange={(v) => { setMachineName(v); if (!v) setMachineId(null); }}
                onSelect={(m) => { setMachineId(m.id); setMachineName(`${m.model_name} (${m.serial_number})`); }}
                placeholder={customerId ? "보유 기계 선택" : "고객을 먼저 선택하세요"}
              />
            </div>
          </div>

          {/* 보험사 · 접수번호 · 사고일 */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">보험사</Label>
              <select className={selectCls} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">선택하세요</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">접수번호</Label>
              <Input value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} placeholder="보험 접수번호" />
            </div>
            <div>
              <Label className="text-xs">사고일</Label>
              <Input type="date" value={accidentDate} onChange={(e) => setAccidentDate(e.target.value)} />
            </div>
          </div>

          {/* 지점 · 기사 · 진행상태 */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">지점</Label>
              <select className={selectCls} value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="장흥">장흥</option>
                <option value="강진">강진</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">담당 기사</Label>
              <select className={selectCls} value={technician} onChange={(e) => setTechnician(e.target.value)}>
                <option value="">선택하세요</option>
                {technicians.map((t: any) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">진행상태</Label>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as InsuranceStatus)}>
                {INSURANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 내용 */}
          <div>
            <Label className="text-xs">사고 · 수리 내용</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="파손 부위, 수리 내용 등" />
          </div>

          {/* 견적서 연결 */}
          <div className="rounded-xl border p-3 space-y-2 bg-muted/20">
            <Label className="text-xs flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> 견적서 연결</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select className={selectCls} value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
                <option value="">견적서 없음</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quote_number} · {q.customer_name || "고객없음"} · {Math.round(q.total_amount || 0).toLocaleString()}원
                  </option>
                ))}
              </select>
              {selectedQuote ? (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link to={`/quotes/${quoteId}`} target="_blank">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> 견적서 열기
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link to="/quotes/new" target="_blank">
                    <FileText className="h-3.5 w-3.5 mr-1" /> 새 견적서 작성
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* 금액 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">견적금액</Label>
              <Input value={estimateAmount} onChange={(e) => setEstimateAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">청구금액</Label>
              <Input value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">자기부담금</Label>
              <Input value={deductible} onChange={(e) => setDeductible(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">입금액</Label>
              <Input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <Label className="text-xs">비고</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* 수리사진 */}
          <div className="rounded-xl border p-3 space-y-2">
            <Label className="text-xs">수리사진</Label>
            {savedId ? (
              <InsurancePhotoManager repairId={savedId} />
            ) : (
              <p className="text-xs text-muted-foreground">먼저 저장하면 사진을 첨부할 수 있습니다.</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={save.isPending} className="flex-1">
              {save.isPending ? "저장 중..." : savedId ? "수정 저장" : "등록"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
