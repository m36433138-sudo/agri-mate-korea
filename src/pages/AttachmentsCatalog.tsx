import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tractor, Search, Tags } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

type CatalogItem = {
  id: string;
  brand: string;
  name: string;
  model: string | null;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type Brand = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

const CATEGORIES = ["로터리", "쟁기", "파종기", "제초기", "베일러", "살포기", "적재기", "붐스프레이어", "기타"];

export default function AttachmentsCatalog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin, isEmployee } = useUserRole();
  const canEdit = isAdmin || isEmployee;

  const [search, setSearch] = useState("");
  const [brandTab, setBrandTab] = useState<string>("전체");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["attachment-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("attachment_catalog")
        .select("*")
        .order("brand")
        .order("name");
      if (error) throw error;
      return data as CatalogItem[];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["attachment-brands"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("attachment_brands")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data as Brand[];
    },
  });

  const activeBrandNames = useMemo(
    () => brands.filter(b => b.is_active).map(b => b.name),
    [brands]
  );

  const brandTabs = useMemo(() => {
    const set = new Set<string>(activeBrandNames);
    items.forEach(i => set.add(i.brand));
    return ["전체", ...Array.from(set)];
  }, [items, activeBrandNames]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (brandTab !== "전체" && i.brand !== brandTab) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          i.name.toLowerCase().includes(s) ||
          (i.model || "").toLowerCase().includes(s) ||
          (i.category || "").toLowerCase().includes(s) ||
          i.brand.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [items, search, brandTab]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("attachment_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attachment-catalog"] });
      toast({ title: "삭제되었습니다." });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tractor className="h-6 w-6 text-primary" /> 작업기 관리
        </h1>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBrandDialogOpen(true)}>
              <Tags className="h-4 w-4 mr-1" /> 브랜드 설정
            </Button>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> 작업기 등록
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="작업기명, 모델, 종류 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <Tabs value={brandTab} onValueChange={setBrandTab}>
            <TabsList className="flex flex-wrap h-auto">
              {brandTabs.map(b => (
                <TabsTrigger key={b} value={b}>{b}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">등록된 작업기가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(item => (
                <div key={item.id} className="border rounded-lg p-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline">{item.brand}</Badge>
                        {item.category && <Badge variant="secondary" className="text-xs">{item.category}</Badge>}
                        {!item.is_active && <Badge variant="destructive" className="text-xs">비활성</Badge>}
                      </div>
                      <div className="font-medium truncate">{item.name}</div>
                      {item.model && <div className="text-xs text-muted-foreground">모델: {item.model}</div>}
                      {item.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.notes}</div>}
                    </div>
                    {canEdit && (
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditing(item); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (confirm(`"${item.name}" 을(를) 삭제하시겠습니까?`)) deleteMut.mutate(item.id);
                            }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CatalogFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        brandOptions={activeBrandNames}
      />
      <BrandManagerDialog
        open={brandDialogOpen}
        onOpenChange={setBrandDialogOpen}
        brands={brands}
        canDelete={isAdmin}
      />
    </div>
  );
}

function CatalogFormDialog({ open, onOpenChange, editing, brandOptions }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: CatalogItem | null; brandOptions: string[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    brand: "", name: "", model: "", category: "", notes: "", is_active: true,
  });

  useEffect(() => {
    if (open) {
      setForm({
        brand: editing?.brand || "",
        name: editing?.name || "",
        model: editing?.model || "",
        category: editing?.category || "",
        notes: editing?.notes || "",
        is_active: editing?.is_active ?? true,
      });
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        brand: form.brand.trim(),
        name: form.name.trim(),
        model: form.model.trim() || null,
        category: form.category || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await (supabase as any).from("attachment_catalog").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("attachment_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attachment-catalog"] });
      toast({ title: editing ? "수정되었습니다." : "등록되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const brandChoices = useMemo(() => {
    const set = new Set(brandOptions);
    if (form.brand) set.add(form.brand);
    return Array.from(set);
  }, [brandOptions, form.brand]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "작업기 수정" : "작업기 등록"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>브랜드 *</Label>
            <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
              <SelectTrigger><SelectValue placeholder="브랜드 선택" /></SelectTrigger>
              <SelectContent>
                {brandChoices.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    브랜드가 없습니다. 상단 "브랜드 설정"에서 추가하세요.
                  </div>
                ) : brandChoices.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>작업기명 *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="예: 로터리 1.8m" />
          </div>
          <div>
            <Label>모델명</Label>
            <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
          </div>
          <div>
            <Label>종류</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>비고</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            활성 (기계 등록 시 선택 가능)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => save.mutate()} disabled={!form.brand || !form.name || save.isPending}>
            {save.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrandManagerDialog({ open, onOpenChange, brands, canDelete }: {
  open: boolean; onOpenChange: (v: boolean) => void; brands: Brand[]; canDelete: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["attachment-brands"] });

  const addMut = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("브랜드명을 입력하세요.");
      const maxOrder = brands.reduce((m, b) => Math.max(m, b.sort_order), 0);
      const { error } = await (supabase as any).from("attachment_brands")
        .insert({ name: trimmed, sort_order: maxOrder + 10 });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setNewName(""); toast({ title: "브랜드가 추가되었습니다." }); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async (b: Brand) => {
      const { error } = await (supabase as any).from("attachment_brands")
        .update({ is_active: !b.is_active }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("브랜드명을 입력하세요.");
      const { error } = await (supabase as any).from("attachment_brands")
        .update({ name: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "브랜드명이 변경되었습니다." }); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("attachment_brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "삭제되었습니다." }); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tags className="h-4 w-4" /> 브랜드 설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="새 브랜드명"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addMut.mutate(newName); }}
            />
            <Button onClick={() => addMut.mutate(newName)} disabled={!newName.trim() || addMut.isPending}>
              <Plus className="h-4 w-4 mr-1" /> 추가
            </Button>
          </div>
          <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
            {brands.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">등록된 브랜드가 없습니다.</div>
            ) : brands.map(b => (
              <BrandRow
                key={b.id}
                brand={b}
                onRename={(name) => renameMut.mutate({ id: b.id, name })}
                onToggle={() => toggleMut.mutate(b)}
                onDelete={canDelete ? () => {
                  if (confirm(`"${b.name}" 브랜드를 삭제하시겠습니까?\n(등록된 작업기의 브랜드명은 유지됩니다.)`))
                    deleteMut.mutate(b.id);
                } : undefined}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            비활성 브랜드는 작업기 등록 시 목록에 표시되지 않습니다.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrandRow({ brand, onRename, onToggle, onDelete }: {
  brand: Brand;
  onRename: (name: string) => void;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(brand.name);
  useEffect(() => { setValue(brand.name); }, [brand.name]);

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { onRename(value); setEditing(false); }
            if (e.key === "Escape") { setValue(brand.name); setEditing(false); }
          }}
          className="h-8"
        />
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`truncate ${brand.is_active ? "" : "text-muted-foreground line-through"}`}>{brand.name}</span>
          {!brand.is_active && <Badge variant="outline" className="text-xs">비활성</Badge>}
        </div>
      )}
      <div className="flex items-center gap-1">
        {editing ? (
          <>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { onRename(value); setEditing(false); }}>저장</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setValue(brand.name); setEditing(false); }}>취소</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-7" onClick={onToggle}>
              {brand.is_active ? "비활성" : "활성"}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {onDelete && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
