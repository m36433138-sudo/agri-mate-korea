import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, Save, Share2, Eraser } from "lucide-react";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import { CustomerPickerDialog, ProductPickerDialog } from "@/components/quotes/PickerDialogs";
import { QuotePrintView } from "@/components/quotes/QuotePrintView";
import { ShareQuoteDialog } from "@/components/quotes/ShareQuoteDialog";
import { won, calcLine } from "@/lib/quoteTypes";
import type { Company, QuoteItem } from "@/lib/quoteTypes";

export default function QuoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [quoteNumber, setQuoteNumber] = useState<string>("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerSsn, setCustomerSsn] = useState("");

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [tradeIn, setTradeIn] = useState(0);
  const [memo, setMemo] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  const [pickCustOpen, setPickCustOpen] = useState(false);
  const [pickProdOpen, setPickProdOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(id !== "new" ? id || null : null);
  const [saving, setSaving] = useState(false);

  const sigRef = useRef<SignatureCanvas>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // 초기 로드
  useEffect(() => {
    (async () => {
      const { data: comps } = await (supabase as any).from("companies").select("*").order("sort_order");
      setCompanies(comps || []);
      if (isNew) {
        const def = (comps || []).find((c: Company) => c.is_default) || comps?.[0];
        if (def) setCompanyId(def.id);
        const { data: numData } = await (supabase as any).rpc("next_quote_number");
        setQuoteNumber(numData || "");
      }
    })();
  }, [isNew]);

  // 편집 모드: 견적서 로드
  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      const { data: q } = await (supabase as any).from("quotes").select("*").eq("id", id).maybeSingle();
      if (!q) return;
      setCompanyId(q.company_id || "");
      setQuoteNumber(q.quote_number);
      setQuoteDate(q.quote_date);
      setCustomerId(q.customer_id);
      setCustomerName(q.customer_name || "");
      setCustomerPhone(q.customer_phone || "");
      setCustomerAddress(q.customer_address || "");
      setCustomerSsn(q.customer_ssn || "");
      setTradeIn(Number(q.trade_in_amount) || 0);
      setMemo(q.memo || "");
      setSignature(q.signature_data || null);
      const { data: its } = await (supabase as any).from("quote_items").select("*").eq("quote_id", id).order("sort_order");
      setItems((its || []).map((it: any) => ({
        ...it, quantity: Number(it.quantity), unit_price: Number(it.unit_price),
        discount_rate: Number(it.discount_rate), line_total: Number(it.line_total),
      })));
    })();
  }, [id, isNew]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.line_total, 0);
    const discount = items.reduce((s, i) => s + i.quantity * i.unit_price * (i.discount_rate / 100), 0);
    return { subtotal, discount, total: subtotal - tradeIn };
  }, [items, tradeIn]);

  const selectedCompany = companies.find((c) => c.id === companyId) || null;

  const addItemRow = () => setPickProdOpen(true);
  const updateItem = (idx: number, patch: Partial<QuoteItem>) => {
    setItems((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      merged.line_total = calcLine(Number(merged.quantity) || 0, Number(merged.unit_price) || 0, Number(merged.discount_rate) || 0);
      next[idx] = merged;
      return next;
    });
  };
  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));

  const captureSignature = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setSignature(sigRef.current.getCanvas().toDataURL("image/png"));
    }
  };
  const clearSignature = () => { sigRef.current?.clear(); setSignature(null); };

  const save = async (): Promise<string | null> => {
    if (!companyId) { toast.error("사업자를 선택하세요"); return null; }
    if (!customerName) { toast.error("고객명을 입력하세요"); return null; }
    if (items.length === 0) { toast.error("제품을 최소 1개 이상 추가하세요"); return null; }
    captureSignature();
    const sig = sigRef.current && !sigRef.current.isEmpty()
      ? sigRef.current.getCanvas().toDataURL("image/png")
      : signature;

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        quote_number: quoteNumber, quote_date: quoteDate,
        company_id: companyId, customer_id: customerId,
        customer_name: customerName, customer_phone: customerPhone,
        customer_address: customerAddress, customer_ssn: customerSsn || null,
        trade_in_amount: tradeIn, memo, signature_data: sig,
        subtotal: totals.subtotal, discount_total: totals.discount, total_amount: totals.total,
        created_by: u.user?.id,
      };
      let quoteId = savedId;
      if (savedId) {
        const { error } = await (supabase as any).from("quotes").update(payload).eq("id", savedId);
        if (error) throw error;
        await (supabase as any).from("quote_items").delete().eq("quote_id", savedId);
      } else {
        const { data, error } = await (supabase as any).from("quotes").insert(payload).select("id").single();
        if (error) throw error;
        quoteId = data.id;
        setSavedId(quoteId);
      }
      const rows = items.map((it, idx) => ({
        quote_id: quoteId, product_id: it.product_id, product_name: it.product_name, spec: it.spec,
        quantity: it.quantity, unit_price: it.unit_price, discount_rate: it.discount_rate,
        line_total: it.line_total, sort_order: idx,
      }));
      if (rows.length) {
        const { error } = await (supabase as any).from("quote_items").insert(rows);
        if (error) throw error;
      }
      toast.success("저장되었습니다");
      if (isNew && quoteId) navigate(`/quotes/${quoteId}`, { replace: true });
      return quoteId;
    } catch (e: any) {
      toast.error("저장 실패: " + e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!savedId) {
      const id2 = await save();
      if (!id2) return;
    }
    // 다음 렌더 후 캡처
    setTimeout(() => setShareOpen(true), 100);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto pb-24">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h1 className="text-2xl font-bold">{isNew ? "견적서 작성" : `견적서 #${quoteNumber}`}</h1>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" />저장</Button>
          <Button onClick={handleShare} disabled={saving} variant="secondary"><Share2 className="w-4 h-4 mr-1" />이미지 공유</Button>
        </div>
      </div>

      {/* 자사 선택 */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">1. 발행 사업자</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <Label>사업자 선택</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="사업자 선택" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedCompany && (
            <div className="md:col-span-2 text-sm text-muted-foreground space-y-0.5 self-end">
              {selectedCompany.business_number && <div>사업자번호: {selectedCompany.business_number}</div>}
              {selectedCompany.address && <div>주소: {selectedCompany.address}</div>}
              {selectedCompany.phone && <div>전화: {selectedCompany.phone}</div>}
            </div>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>견적번호</Label><Input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} /></div>
          <div><Label>견적일자</Label><Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} /></div>
        </div>
      </Card>

      {/* 고객 */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">2. 고객 정보</h2>
          <Button size="sm" variant="outline" onClick={() => setPickCustOpen(true)}>
            <Search className="w-4 h-4 mr-1" />고객 검색
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>성명</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div><Label>전화번호</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>주소</Label><Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} /></div>
          <div><Label>주민등록번호</Label><Input value={customerSsn} onChange={(e) => setCustomerSsn(e.target.value)} placeholder="000000-0000000" /></div>
        </div>
      </Card>

      {/* 제품 */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">3. 제품 리스트</h2>
          <Button size="sm" onClick={addItemRow}><Plus className="w-4 h-4 mr-1" />제품 추가</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2">품명</th>
                <th className="text-left p-2 w-24">규격</th>
                <th className="p-2 w-20">수량</th>
                <th className="p-2 w-28">단가</th>
                <th className="p-2 w-20">할인%</th>
                <th className="text-right p-2 w-32">금액</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="p-1"><Input value={it.product_name} onChange={(e) => updateItem(idx, { product_name: e.target.value })} /></td>
                  <td className="p-1"><Input value={it.spec || ""} onChange={(e) => updateItem(idx, { spec: e.target.value })} /></td>
                  <td className="p-1"><Input type="number" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} className="text-right" /></td>
                  <td className="p-1"><Input type="number" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} className="text-right" /></td>
                  <td className="p-1"><Input type="number" value={it.discount_rate} onChange={(e) => updateItem(idx, { discount_rate: Number(e.target.value) })} className="text-right" /></td>
                  <td className="p-2 text-right tabular-nums font-semibold">{won(it.line_total)}</td>
                  <td><Button size="sm" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4" /></Button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-6">"제품 추가" 버튼으로 항목을 추가하세요</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 합계 */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">4. 합계</h2>
        <div className="space-y-2 max-w-md ml-auto">
          <Row label="공급가액 합계" value={won(totals.subtotal)} />
          <Row label="할인 합계" value={"-" + won(totals.discount)} muted />
          <div className="flex justify-between items-center gap-2">
            <Label className="whitespace-nowrap">중고 인수 가액</Label>
            <Input type="number" value={tradeIn} onChange={(e) => setTradeIn(Number(e.target.value) || 0)} className="text-right max-w-[180px]" />
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
            <span>최종 합계</span>
            <span className="tabular-nums text-primary">{won(totals.total)}</span>
          </div>
        </div>
      </Card>

      {/* 메모 + 필기 */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">5. 비고 / 필기</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>메모 (텍스트)</Label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={6} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>터치 필기</Label>
              <Button size="sm" variant="ghost" onClick={clearSignature}><Eraser className="w-4 h-4 mr-1" />지우기</Button>
            </div>
            <div className="border border-border rounded-lg bg-white">
              <SignatureCanvas ref={sigRef} penColor="#111" canvasProps={{ width: 500, height: 160, className: "w-full h-[160px] rounded-lg" }} />
            </div>
            {signature && !sigRef.current?.isEmpty() === false && (
              <p className="text-xs text-muted-foreground mt-1">기존 서명이 저장되어 있습니다. 지우기 후 다시 작성 가능</p>
            )}
          </div>
        </div>
      </Card>

      {/* 화면 밖 인쇄 뷰 (캡처 대상) */}
      <div style={{ position: "fixed", left: "-10000px", top: 0 }}>
        <QuotePrintView
          ref={printRef}
          company={selectedCompany}
          quote={{
            quote_number: quoteNumber, quote_date: quoteDate,
            customer_name: customerName, customer_phone: customerPhone,
            customer_address: customerAddress, customer_ssn: customerSsn,
            memo, signature_data: signature, trade_in_amount: tradeIn,
          }}
          items={items}
        />
      </div>

      <CustomerPickerDialog open={pickCustOpen} onOpenChange={setPickCustOpen} onPick={(c) => {
        setCustomerId(c.id); setCustomerName(c.name); setCustomerPhone(c.phone || ""); setCustomerAddress(c.address || "");
      }} />
      <ProductPickerDialog open={pickProdOpen} onOpenChange={setPickProdOpen} onPick={(p) => {
        setItems((prev) => [...prev, {
          product_id: p.id, product_name: p.name, spec: p.spec,
          quantity: 1, unit_price: Number(p.unit_price), discount_rate: 0,
          line_total: Number(p.unit_price), sort_order: prev.length,
        }]);
      }} />
      <ShareQuoteDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        targetRef={printRef}
        filename={`견적서_${quoteNumber}_${customerName || "고객"}`}
        phoneNumber={customerPhone}
      />
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
