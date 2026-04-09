import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Laptop, Car, MapPin, Wrench, CalendarDays,
  Gauge, Banknote, PackageOpen, Map, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";

// ── 타입 ─────────────────────────────────────────────────────

interface Equipment {
  id: string; name: string; category: string; serial_number: string | null;
  purchase_date: string | null; purchase_price: number | null; vendor: string | null;
  status: string; notes: string | null; created_at: string;
}
interface Vehicle {
  id: string; name: string; plate_number: string | null;
  purchase_date: string | null; purchase_price: number | null;
  current_mileage: number | null; status: string; notes: string | null; created_at: string;
}
interface Maintenance {
  id: string; vehicle_id: string; maintenance_type: string; date: string;
  mileage: number | null; cost: number | null; notes: string | null; created_at: string;
}
interface Property {
  id: string; name: string; property_type: string; address: string | null;
  area: number | null; area_unit: string; purchase_date: string | null;
  purchase_price: number | null; latitude: number | null; longitude: number | null;
  notes: string | null; created_at: string;
}

// ── 공통 유틸 ─────────────────────────────────────────────────

const EQUIP_CATEGORIES = ["노트북", "디지털장비", "기타"];
const EQUIP_STATUSES   = ["사용중", "보관", "폐기"];
const VEHICLE_STATUSES = ["사용중", "매각", "폐차"];
const PROPERTY_TYPES   = ["토지", "건물", "창고", "기타"];
const MAINT_TYPES      = ["엔진오일교환", "타이어교환", "수리", "정기점검", "기타"];

const EQUIP_STATUS_STYLE: Record<string, string> = {
  "사용중": "bg-green-100 text-green-700",
  "보관":   "bg-amber-100 text-amber-700",
  "폐기":   "bg-red-100 text-red-600",
};
const VEHICLE_STATUS_STYLE: Record<string, string> = {
  "사용중": "bg-blue-100 text-blue-700",
  "매각":   "bg-amber-100 text-amber-700",
  "폐차":   "bg-red-100 text-red-600",
};
const PROPERTY_TYPE_STYLE: Record<string, string> = {
  "토지":  "bg-emerald-100 text-emerald-700",
  "건물":  "bg-blue-100 text-blue-700",
  "창고":  "bg-amber-100 text-amber-700",
  "기타":  "bg-gray-100 text-gray-600",
};

function Badge({ text, style }: { text: string; style: string }) {
  return <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-bold ${style}`}>{text}</span>;
}

function openKakaoMap(address?: string | null, lat?: number | null, lng?: number | null) {
  if (lat && lng) {
    window.open(`https://map.kakao.com/link/map/${lat},${lng}`, "_blank");
  } else if (address) {
    window.open(`https://map.kakao.com/?q=${encodeURIComponent(address)}`, "_blank");
  }
}

function openGoogleMap(address?: string | null, lat?: number | null, lng?: number | null) {
  if (lat && lng) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  } else if (address) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address!)}`, "_blank");
  }
}

// ══════════════════════════════════════════════════════════════
// ── 전자장비 탭
// ══════════════════════════════════════════════════════════════

function EquipmentTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);

  const emptyForm = () => ({ name: "", category: "노트북", serial_number: "", purchase_date: "", purchase_price: "", vendor: "", status: "사용중", notes: "" });
  const [form, setForm] = useState(emptyForm());
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["assets_equipment"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("assets_equipment").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const openAdd = () => { setEditTarget(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (item: Equipment) => {
    setEditTarget(item);
    setForm({
      name: item.name, category: item.category, serial_number: item.serial_number || "",
      purchase_date: item.purchase_date || "", purchase_price: item.purchase_price ? String(item.purchase_price) : "",
      vendor: item.vendor || "", status: item.status, notes: item.notes || "",
    });
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, category: form.category,
        serial_number: form.serial_number || null, purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price ? parseInt(form.purchase_price) : null,
        vendor: form.vendor || null, status: form.status, notes: form.notes || null,
      };
      if (editTarget) {
        const { error } = await (supabase as any).from("assets_equipment").update(payload).eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("assets_equipment").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets_equipment"] }); toast({ title: editTarget ? "수정 완료" : "등록 완료" }); setFormOpen(false); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("assets_equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets_equipment"] }); toast({ title: "삭제되었습니다." }); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground font-medium">{isLoading ? "..." : `전체 ${items.length}개`}</p>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> 장비 등록</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">등록된 장비가 없습니다</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Laptop className="h-4.5 w-4.5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight truncate">{item.name}</p>
                    <Badge text={item.category} style="bg-blue-100 text-blue-700" />
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {item.serial_number && <p className="text-xs text-muted-foreground font-mono">S/N: {item.serial_number}</p>}
                {item.vendor && <p className="text-xs text-muted-foreground">제조사/업체: {item.vendor}</p>}
                {item.purchase_date && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" /> 구매일: {formatDate(item.purchase_date)}
                  </div>
                )}
                {item.purchase_price && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Banknote className="h-3 w-3 text-muted-foreground" /> {formatPrice(item.purchase_price)}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <Badge text={item.status} style={EQUIP_STATUS_STYLE[item.status] || "bg-gray-100 text-gray-600"} />
                {item.notes && <p className="text-[11px] text-muted-foreground truncate ml-2 max-w-[120px]">{item.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editTarget ? "장비 수정" : "장비 등록"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>장비명 *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="MacBook Pro 14" /></div>
            <div>
              <Label>분류</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EQUIP_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>상태</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EQUIP_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>시리얼 번호 (S/N)</Label><Input value={form.serial_number} onChange={e => set("serial_number", e.target.value)} className="font-mono" /></div>
            <div className="col-span-2"><Label>제조사 / 구매처</Label><Input value={form.vendor} onChange={e => set("vendor", e.target.value)} /></div>
            <div><Label>구매일</Label><Input type="date" value={form.purchase_date} onChange={e => set("purchase_date", e.target.value)} /></div>
            <div><Label>구매가 (원)</Label><Input type="number" value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} /></div>
            <div className="col-span-2"><Label>비고</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "저장 중..." : editTarget ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>장비를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name} 장비 정보가 영구 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── 차량 탭
// ══════════════════════════════════════════════════════════════

function VehiclesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintVehicle, setMaintVehicle] = useState<Vehicle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const emptyForm = () => ({ name: "", plate_number: "", purchase_date: "", purchase_price: "", current_mileage: "", status: "사용중", notes: "" });
  const [form, setForm] = useState(emptyForm());
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["assets_vehicles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("assets_vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const { data: allMaint = [] } = useQuery({
    queryKey: ["assets_vehicle_maintenance"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("assets_vehicle_maintenance").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Maintenance[];
    },
  });

  const openAdd = () => { setEditTarget(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (v: Vehicle) => {
    setEditTarget(v);
    setForm({
      name: v.name, plate_number: v.plate_number || "", purchase_date: v.purchase_date || "",
      purchase_price: v.purchase_price ? String(v.purchase_price) : "",
      current_mileage: v.current_mileage ? String(v.current_mileage) : "",
      status: v.status, notes: v.notes || "",
    });
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, plate_number: form.plate_number || null, purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price ? parseInt(form.purchase_price) : null,
        current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
        status: form.status, notes: form.notes || null,
      };
      if (editTarget) {
        const { error } = await (supabase as any).from("assets_vehicles").update(payload).eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("assets_vehicles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets_vehicles"] }); toast({ title: editTarget ? "수정 완료" : "등록 완료" }); setFormOpen(false); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("assets_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets_vehicles"] }); toast({ title: "삭제되었습니다." }); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground font-medium">{isLoading ? "..." : `전체 ${vehicles.length}대`}</p>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> 차량 등록</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div>
      ) : vehicles.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">등록된 차량이 없습니다</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vehicles.map(v => {
            const maint = allMaint.filter(m => m.vehicle_id === v.id);
            const lastMaint = maint[0];
            const expanded = expandedId === v.id;
            return (
              <div key={v.id} className="bg-white rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                        <Car className="h-4.5 w-4.5 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-base leading-tight">{v.name}</p>
                        {v.plate_number && <p className="text-xs text-muted-foreground font-mono">{v.plate_number}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setDeleteTarget(v)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {v.current_mileage && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold tabular-nums">{v.current_mileage.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">km</span>
                      </div>
                    )}
                    {v.purchase_price && (
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatPrice(v.purchase_price)}
                      </div>
                    )}
                  </div>

                  {lastMaint && (
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 rounded-xl">
                      <Wrench className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-800">마지막 정비: {lastMaint.maintenance_type}</p>
                        <p className="text-[11px] text-amber-600">{formatDate(lastMaint.date)}{lastMaint.mileage ? ` · ${lastMaint.mileage.toLocaleString()}km` : ""}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <Badge text={v.status} style={VEHICLE_STATUS_STYLE[v.status] || "bg-gray-100 text-gray-600"} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2.5"
                        onClick={() => { setMaintVehicle(v); setMaintOpen(true); }}>
                        <Plus className="h-3 w-3 mr-1" /> 정비 기록
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
                        onClick={() => setExpandedId(expanded ? null : v.id)}>
                        정비이력 {maint.length > 0 && <span className="ml-1 opacity-60">{maint.length}</span>}
                        {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 정비 이력 펼치기 */}
                {expanded && maint.length > 0 && (
                  <div className="border-t border-border/40 bg-muted/30 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">정비 이력</p>
                    {maint.map(m => (
                      <MaintenanceRow key={m.id} m={m} onDelete={() => qc.invalidateQueries({ queryKey: ["assets_vehicle_maintenance"] })} />
                    ))}
                  </div>
                )}
                {expanded && maint.length === 0 && (
                  <div className="border-t border-border/40 bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
                    정비 이력이 없습니다
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 차량 등록/수정 */}
      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editTarget ? "차량 수정" : "차량 등록"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>차명 *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="현대 포터II" /></div>
            <div className="col-span-2"><Label>차량번호</Label><Input value={form.plate_number} onChange={e => set("plate_number", e.target.value)} placeholder="123가 4567" className="font-mono" /></div>
            <div>
              <Label>상태</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VEHICLE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>현재 주행거리 (km)</Label><Input type="number" value={form.current_mileage} onChange={e => set("current_mileage", e.target.value)} /></div>
            <div><Label>구매일</Label><Input type="date" value={form.purchase_date} onChange={e => set("purchase_date", e.target.value)} /></div>
            <div><Label>구매가 (원)</Label><Input type="number" value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} /></div>
            <div className="col-span-2"><Label>비고</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "저장 중..." : editTarget ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 정비 기록 추가 */}
      {maintVehicle && (
        <MaintenanceDialog
          open={maintOpen}
          onClose={() => setMaintOpen(false)}
          vehicle={maintVehicle}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["assets_vehicle_maintenance"] })}
        />
      )}

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>차량을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name} 차량 및 정비 이력이 모두 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MaintenanceRow({ m, onDelete }: { m: Maintenance; onDelete: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("assets_vehicle_maintenance").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets_vehicle_maintenance"] }); toast({ title: "삭제되었습니다." }); onDelete(); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="flex items-start gap-2 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">{m.maintenance_type}</span>
          <span className="text-[11px] text-muted-foreground">{formatDate(m.date)}</span>
          {m.mileage && <span className="text-[11px] text-muted-foreground">{m.mileage.toLocaleString()}km</span>}
          {m.cost && <span className="text-[11px] font-semibold">{formatPrice(m.cost)}</span>}
        </div>
        {m.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{m.notes}</p>}
      </div>
      <button onClick={() => deleteMut.mutate()} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50">
        <Trash2 className="h-3 w-3 text-destructive" />
      </button>
    </div>
  );
}

function MaintenanceDialog({ open, onClose, vehicle, onSuccess }: { open: boolean; onClose: () => void; vehicle: Vehicle; onSuccess: () => void }) {
  const { toast } = useToast();
  const emptyForm = () => ({ maintenance_type: "엔진오일교환", date: new Date().toISOString().split("T")[0], mileage: "", cost: "", notes: "" });
  const [form, setForm] = useState(emptyForm());
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("assets_vehicle_maintenance").insert({
        vehicle_id: vehicle.id, maintenance_type: form.maintenance_type,
        date: form.date, mileage: form.mileage ? parseInt(form.mileage) : null,
        cost: form.cost ? parseInt(form.cost) : null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { onSuccess(); toast({ title: "정비 기록이 추가되었습니다." }); onClose(); setForm(emptyForm()); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{vehicle.name} · 정비 기록 추가</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>정비 유형</Label>
            <Select value={form.maintenance_type} onValueChange={v => set("maintenance_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MAINT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>날짜 *</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>주행거리 (km)</Label><Input type="number" value={form.mileage} onChange={e => set("mileage", e.target.value)} /></div>
            <div><Label>비용 (원)</Label><Input type="number" value={form.cost} onChange={e => set("cost", e.target.value)} /></div>
          </div>
          <div><Label>비고</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.date || mutation.isPending}>
            {mutation.isPending ? "저장 중..." : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// ── 토지 및 부동산 탭
// ══════════════════════════════════════════════════════════════

function PropertiesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);

  const emptyForm = () => ({
    name: "", property_type: "토지", address: "", area: "", area_unit: "평",
    purchase_date: "", purchase_price: "", latitude: "", longitude: "", notes: "",
  });
  const [form, setForm] = useState(emptyForm());
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["assets_properties"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("assets_properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Property[];
    },
  });

  const openAdd = () => { setEditTarget(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (item: Property) => {
    setEditTarget(item);
    setForm({
      name: item.name, property_type: item.property_type, address: item.address || "",
      area: item.area ? String(item.area) : "", area_unit: item.area_unit,
      purchase_date: item.purchase_date || "", purchase_price: item.purchase_price ? String(item.purchase_price) : "",
      latitude: item.latitude ? String(item.latitude) : "", longitude: item.longitude ? String(item.longitude) : "",
      notes: item.notes || "",
    });
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, property_type: form.property_type, address: form.address || null,
        area: form.area ? parseFloat(form.area) : null, area_unit: form.area_unit,
        purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price ? parseInt(form.purchase_price) : null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        notes: form.notes || null,
      };
      if (editTarget) {
        const { error } = await (supabase as any).from("assets_properties").update(payload).eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("assets_properties").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets_properties"] }); toast({ title: editTarget ? "수정 완료" : "등록 완료" }); setFormOpen(false); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("assets_properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets_properties"] }); toast({ title: "삭제되었습니다." }); setDeleteTarget(null); },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground font-medium">{isLoading ? "..." : `전체 ${items.length}건`}</p>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> 부동산 등록</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">등록된 토지/부동산이 없습니다</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <MapPin className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight truncate">{item.name}</p>
                    <Badge text={item.property_type} style={PROPERTY_TYPE_STYLE[item.property_type] || "bg-gray-100 text-gray-600"} />
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {item.address && (
                  <div className="flex items-start gap-1.5 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-foreground leading-snug">{item.address}</span>
                  </div>
                )}
                {item.area && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <PackageOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{item.area.toLocaleString()} {item.area_unit}</span>
                  </div>
                )}
                {item.purchase_price && (
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatPrice(item.purchase_price)}
                    {item.purchase_date && <span className="text-xs font-normal text-muted-foreground">({formatDate(item.purchase_date)} 취득)</span>}
                  </div>
                )}
                {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
              </div>

              {/* 지도 버튼 */}
              {(item.address || item.latitude) && (
                <div className="flex gap-2 pt-1 border-t border-border/40">
                  <button
                    onClick={() => openKakaoMap(item.address, item.latitude, item.longitude)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-500 transition-colors text-xs font-bold text-yellow-900"
                  >
                    <Map className="h-3.5 w-3.5" /> 카카오맵
                  </button>
                  <button
                    onClick={() => openGoogleMap(item.address, item.latitude, item.longitude)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors text-xs font-bold text-white"
                  >
                    <Map className="h-3.5 w-3.5" /> 구글맵
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTarget ? "부동산 수정" : "부동산 등록"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>이름 *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="예: 장흥 본사 창고 부지" /></div>
            <div className="col-span-2">
              <Label>유형</Label>
              <Select value={form.property_type} onValueChange={v => set("property_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>주소</Label><Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="전라남도 장흥군 ..." /></div>
            <div>
              <Label>면적</Label>
              <Input type="number" value={form.area} onChange={e => set("area", e.target.value)} placeholder="100" />
            </div>
            <div>
              <Label>단위</Label>
              <Select value={form.area_unit} onValueChange={v => set("area_unit", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="평">평</SelectItem>
                  <SelectItem value="㎡">㎡</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>취득일</Label><Input type="date" value={form.purchase_date} onChange={e => set("purchase_date", e.target.value)} /></div>
            <div><Label>매입가 (원)</Label><Input type="number" value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} /></div>

            {/* 좌표 입력 */}
            <div className="col-span-2">
              <Label className="flex items-center gap-1.5">
                <Map className="h-3.5 w-3.5 text-muted-foreground" />
                GPS 좌표 (선택)
              </Label>
              <p className="text-[11px] text-muted-foreground mb-1.5">
                카카오맵/구글맵에서 우클릭 → 좌표 복사 후 입력
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={form.latitude}
                  onChange={e => set("latitude", e.target.value)}
                  placeholder="위도 (예: 34.684)"
                  className="font-mono text-sm"
                />
                <Input
                  value={form.longitude}
                  onChange={e => set("longitude", e.target.value)}
                  placeholder="경도 (예: 126.906)"
                  className="font-mono text-sm"
                />
              </div>
              {form.latitude && form.longitude && (
                <div className="flex gap-2 mt-2">
                  <a href={`https://map.kakao.com/link/map/${form.latitude},${form.longitude}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-yellow-400 text-yellow-900 text-xs font-bold hover:bg-yellow-500 transition-colors">
                    <Map className="h-3 w-3" /> 카카오맵 미리보기
                  </a>
                  <a href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors">
                    <Map className="h-3 w-3" /> 구글맵 미리보기
                  </a>
                </div>
              )}
            </div>

            <div className="col-span-2"><Label>비고</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "저장 중..." : editTarget ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>부동산을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name} 정보가 영구 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── 메인 페이지
// ══════════════════════════════════════════════════════════════

export default function AssetsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Banknote className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">자산 관리</h1>
          <p className="text-sm text-muted-foreground">전자장비 · 차량 · 토지 및 부동산</p>
        </div>
      </div>

      <Tabs defaultValue="equipment">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="equipment" className="flex items-center gap-1.5">
            <Laptop className="h-4 w-4" /> 전자장비
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-1.5">
            <Car className="h-4 w-4" /> 차량
          </TabsTrigger>
          <TabsTrigger value="properties" className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> 토지·부동산
          </TabsTrigger>
        </TabsList>
        <TabsContent value="equipment" className="mt-4"><EquipmentTab /></TabsContent>
        <TabsContent value="vehicles" className="mt-4"><VehiclesTab /></TabsContent>
        <TabsContent value="properties" className="mt-4"><PropertiesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
