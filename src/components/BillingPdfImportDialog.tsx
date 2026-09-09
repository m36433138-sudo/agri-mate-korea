import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/formatters";
import { FileUp, Loader2, Search, X } from "lucide-react";

type ParsedPart = {
  part_code: string;
  part_name: string;
  quantity: number;
  unit_price: number;
};

type ParsedGroup = {
  date: string;
  machine_type: string;
  model: string;
  serial: string;
  operating_hours: number | null;
  technician: string;
  labor_cost: number;
  description: string;
  notes: string;
  parts: ParsedPart[];
};

type Row = ParsedGroup & {
  include: boolean;
  machine_id: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function BillingPdfImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [parsedName, setParsedName] = useState("");
  const [branch, setBranch] = useState<"장흥" | "강진">("장흥");

  // customer picking
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");

  const { data: machines } = useQuery({
    queryKey: ["import-customer-machines", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id, model_name, serial_number, machine_type, classification")
        .eq("customer_id", customerId);
      if (error) throw error;
      return data || [];
    },
  });

  const reset = () => {
    setRows(null);
    setParsedName("");
    setCustomerId("");
    setCustomerName("");
    setCustomerSearch("");
    setCustomerResults([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const searchCustomers = async (q: string) => {
    setCustomerSearch(q);
    if (!q.trim()) {
      setCustomerResults([]);
      return;
    }
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone")
      .ilike("name", `%${q}%`)
      .limit(8);
    setCustomerResults(data || []);
  };

  const autoMatchCustomer = async (name: string) => {
    const candidates = name
      .replace(/[()]/g, " ")
      .split(/[\s,/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    for (const c of candidates) {
      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .ilike("name", `%${c}%`)
        .limit(1);
      if (data && data[0]) {
        setCustomerId(data[0].id);
        setCustomerName(data[0].name);
        return;
      }
    }
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-billing-pdf", {
        body: { file: dataUrl, mime: file.type, filename: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const groups: ParsedGroup[] = data?.groups || [];
      if (groups.length === 0) throw new Error("읽어낼 수리 내역이 없습니다.");

      setParsedName(data?.customer_name || "");
      setRows(groups.map((g) => ({ ...g, include: true, machine_id: "" })));
      if (data?.customer_name) await autoMatchCustomer(data.customer_name);
      toast({ title: `${groups.length}건의 수리 내역을 읽었습니다.` });
    } catch (e: any) {
      toast({ title: "PDF 분석 실패", description: e.message, variant: "destructive" });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // auto-assign machines once machine list arrives
  const assignMachines = () => {
    if (!rows || !machines) return;
    setRows((prev) =>
      (prev || []).map((r) => {
        if (r.machine_id) return r;
        const bySerial = r.serial
          ? machines.find((m: any) =>
              (m.serial_number || "").toUpperCase().includes(r.serial.toUpperCase()),
            )
          : null;
        const byModel = r.model
          ? machines.find((m: any) =>
              (m.model_name || "").toUpperCase().includes(r.model.toUpperCase()),
            )
          : null;
        const single = machines.length === 1 ? machines[0] : null;
        const matched = bySerial || byModel || single;
        return matched ? { ...r, machine_id: matched.id } : r;
      }),
    );
  };

  // run auto-assign whenever machines load for a new customer
  const machinesKey = machines ? machines.map((m: any) => m.id).join(",") : "";
  const lastKeyRef = useRef("");
  if (machinesKey && machinesKey !== lastKeyRef.current && rows) {
    lastKeyRef.current = machinesKey;
    setTimeout(assignMachines, 0);
  }

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => (prev || []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const groupTotal = (r: Row) =>
    (Number(r.labor_cost) || 0) +
    r.parts.reduce((s, p) => s + (Number(p.unit_price) || 0) * (Number(p.quantity) || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selected = (rows || []).filter((r) => r.include);
      if (selected.length === 0) throw new Error("등록할 항목을 선택해 주세요.");
      const missing = selected.filter((r) => !r.machine_id);
      if (missing.length > 0) throw new Error("기계가 선택되지 않은 항목이 있습니다.");

      const partIdCache = new Map<string, string>();
      const resolvePartId = async (p: ParsedPart) => {
        const code = p.part_code || p.part_name;
        if (partIdCache.has(code)) return partIdCache.get(code)!;
        const { data: existing } = await supabase
          .from("parts")
          .select("id")
          .eq("part_number", code)
          .maybeSingle();
        let id = existing?.id;
        if (!id) {
          const { data: created, error } = await supabase
            .from("parts")
            .insert({ part_number: code, part_name: p.part_name || code, unit: "EA" })
            .select("id")
            .single();
          if (error) throw error;
          id = created.id;
        }
        partIdCache.set(code, id!);
        return id!;
      };

      let saved = 0;
      for (const r of selected) {
        const content =
          r.description?.trim() ||
          (r.parts.length > 0 ? `부품 교체 (${r.parts.length}종)` : "수리");

        const { data: repair, error } = await supabase
          .from("repairs")
          .insert({
            machine_id: r.machine_id,
            repair_date: r.date,
            repair_content: content,
            technician: r.technician || null,
            labor_cost: Number(r.labor_cost) || 0,
            total_cost: groupTotal(r),
            operating_hours: r.operating_hours || null,
            notes: [r.notes?.trim(), "천년경영 청구서 가져오기"].filter(Boolean).join("\n"),
            accounting_posted: true,
          })
          .select("id")
          .single();
        if (error) throw error;

        if (r.parts.length > 0) {
          const payload: any[] = [];
          for (const p of r.parts) {
            payload.push({
              repair_id: repair.id,
              part_id: await resolvePartId(p),
              quantity: p.quantity,
              unit_price: p.unit_price,
              branch,
              is_imported: true,
            });
          }
          const { error: pe } = await (supabase as any).from("repair_parts").insert(payload);
          if (pe) throw pe;
        }
        saved += 1;
      }
      return saved;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["repairs"] });
      toast({ title: `${saved}건의 수리이력이 등록되었습니다.` });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "등록 실패", description: e.message, variant: "destructive" }),
  });

  const selectedCount = (rows || []).filter((r) => r.include).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>청구서 PDF로 수리이력 가져오기</DialogTitle>
          <DialogDescription>
            천년경영 청구서 PDF를 올리면 날짜·기계별로 수리 건을 나누어 보여줍니다. 확인·수정한 뒤
            등록하세요. 부품 재고는 차감되지 않습니다.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="space-y-4 py-4">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button
              className="w-full h-24 border-dashed"
              variant="outline"
              disabled={parsing}
              onClick={() => fileRef.current?.click()}
            >
              {parsing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> 청구서를 읽고 있습니다...
                </>
              ) : (
                <>
                  <FileUp className="h-5 w-5 mr-2" /> 청구서 PDF 선택
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Customer */}
            <div className="relative">
              <Label>
                고객 {parsedName && <span className="text-muted-foreground">(청구서: {parsedName})</span>}
              </Label>
              {customerId ? (
                <div className="flex items-center gap-2">
                  <Input value={customerName} disabled className="bg-muted flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setCustomerId("");
                      setCustomerName("");
                      lastKeyRef.current = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="고객 이름 검색..."
                      value={customerSearch}
                      onChange={(e) => searchCustomers(e.target.value)}
                    />
                  </div>
                  {customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      {customerResults.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setCustomerId(c.id);
                            setCustomerName(c.name);
                            setCustomerResults([]);
                            setCustomerSearch("");
                            lastKeyRef.current = "";
                          }}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="w-40">
              <Label>부품 지점 표기</Label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as "장흥" | "강진")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="장흥">장흥</option>
                <option value="강진">강진</option>
              </select>
            </div>

            {/* Groups */}
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg border bg-card p-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={r.include}
                      onCheckedChange={(v) => updateRow(i, { include: !!v })}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">수리일</Label>
                          <Input
                            type="date"
                            value={r.date}
                            onChange={(e) => updateRow(i, { date: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">기사</Label>
                          <Input
                            value={r.technician}
                            onChange={(e) => updateRow(i, { technician: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">공임비</Label>
                          <Input
                            type="number"
                            value={r.labor_cost}
                            onChange={(e) =>
                              updateRow(i, { labor_cost: parseInt(e.target.value) || 0 })
                            }
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">사용시간</Label>
                          <Input
                            type="number"
                            value={r.operating_hours ?? ""}
                            onChange={(e) =>
                              updateRow(i, { operating_hours: parseInt(e.target.value) || null })
                            }
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">
                          기계 {r.model && <span className="text-muted-foreground">(청구서: {r.machine_type} {r.model} {r.serial})</span>}
                        </Label>
                        <select
                          value={r.machine_id}
                          onChange={(e) => updateRow(i, { machine_id: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">
                            {customerId ? "기계를 선택하세요" : "먼저 고객을 선택하세요"}
                          </option>
                          {(machines || []).map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.classification || m.machine_type} {m.model_name} ({m.serial_number})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs">수리 내용</Label>
                        <Input
                          value={r.description}
                          onChange={(e) => updateRow(i, { description: e.target.value })}
                          className="h-9"
                        />
                      </div>

                      {r.parts.length > 0 && (
                        <div className="rounded-md bg-muted/40 p-2 space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">
                            사용 부품 {r.parts.length}종
                          </p>
                          {r.parts.map((p, pi) => (
                            <div key={pi} className="flex items-center gap-2 text-xs">
                              <span className="flex-1 truncate">
                                {p.part_name}{" "}
                                <span className="font-mono text-muted-foreground">{p.part_code}</span>
                              </span>
                              <span className="w-12 text-right">{p.quantity}개</span>
                              <span className="w-24 text-right">{formatPrice(p.unit_price)}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  updateRow(i, { parts: r.parts.filter((_, x) => x !== pi) })
                                }
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {r.notes && (
                        <div>
                          <Label className="text-xs">메모</Label>
                          <Textarea
                            value={r.notes}
                            onChange={(e) => updateRow(i, { notes: e.target.value })}
                            rows={2}
                            className="text-xs"
                          />
                        </div>
                      )}

                      <p className="text-xs text-right font-semibold">
                        합계 {formatPrice(groupTotal(r))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 sticky bottom-0 bg-background py-3 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedCount}건 선택 / 총 {rows.length}건
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                  다시 올리기
                </Button>
                <Button
                  disabled={!customerId || selectedCount === 0 || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> 등록 중...
                    </>
                  ) : (
                    `${selectedCount}건 수리이력 등록`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
