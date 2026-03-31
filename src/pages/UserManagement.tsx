import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Settings, Shield, ShieldCheck, User,
  Briefcase, Wrench, ClipboardList, Pencil, Trash2,
  UserCheck, Calendar, MapPin, Phone, Banknote, Link2,
} from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";
import type { Customer } from "@/types/database";

type TeamType = "영업팀" | "기사팀" | "사무팀";

const ROLE_ICONS: Record<string, typeof Shield> = {
  admin: ShieldCheck,
  employee: Shield,
  customer: User,
};

const TEAM_CONFIG: Record<TeamType, { color: string; bg: string; icon: typeof Briefcase }> = {
  영업팀: { color: "text-blue-700", bg: "bg-blue-50", icon: Briefcase },
  기사팀: { color: "text-orange-700", bg: "bg-orange-50", icon: Wrench },
  사무팀: { color: "text-purple-700", bg: "bg-purple-50", icon: ClipboardList },
};

const PERMISSION_LABELS: Record<string, string> = {
  view_customers: "고객 목록 조회",
  edit_customers: "고객 정보 수정",
  manage_repairs: "수리 이력 관리",
  view_machines: "기계 목록 조회",
  add_machines: "기계 등록",
};

// ─── 직원 타입 ───────────────────────────────────────────────
type Employee = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  resident_number: string | null;
  team: string | null;
  position: string | null;
  salary: number | null;
  join_date: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function UserManagement() {
  const [tab, setTab] = useState<"accounts" | "employees">("accounts");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">사용자 관리</h1>
      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="accounts" className="gap-1.5">
            <Shield className="h-4 w-4" /> 계정 관리
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-1.5">
            <UserCheck className="h-4 w-4" /> 직원 관리
          </TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="employees" className="mt-4">
          <EmployeesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── 계정 관리 탭 ─────────────────────────────────────────────
function AccountsTab() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap: Record<string, string> = {};
      roles?.forEach((r: any) => { roleMap[r.user_id] = r.role; });
      return profiles.map((p: any) => ({ ...p, role: roleMap[p.id] || "customer" }));
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;
      if (newRole === "employee") {
        const { data: existing } = await supabase.from("employee_permissions").select("id").eq("employee_id", userId);
        if (!existing || existing.length === 0) {
          await supabase.from("employee_permissions").insert(
            Object.keys(PERMISSION_LABELS).map(key => ({ employee_id: userId, permission_key: key, is_allowed: false }))
          );
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-users"] }); toast({ title: "역할이 변경되었습니다." }); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const changeTeamMutation = useMutation({
    mutationFn: async ({ userId, team }: { userId: string; team: string | null }) => {
      const { error } = await supabase.from("profiles").update({ team }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-users"] }); toast({ title: "팀이 변경되었습니다." }); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const filtered = users?.filter((u: any) => {
    const s = search.toLowerCase();
    return u.display_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.phone?.includes(s) || u.team?.includes(s);
  });

  const teamStats = {
    영업팀: users?.filter((u: any) => u.team === "영업팀").length ?? 0,
    기사팀: users?.filter((u: any) => u.team === "기사팀").length ?? 0,
    사무팀: users?.filter((u: any) => u.team === "사무팀").length ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">전체 {users?.length ?? 0}명</p>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> 계정 생성
        </Button>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(TEAM_CONFIG) as [TeamType, typeof TEAM_CONFIG[TeamType]][]).map(([team, cfg]) => {
            const Icon = cfg.icon;
            return (
              <Card key={team} className="border-0 shadow-card">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{team}</p>
                    <p className="text-xl font-bold tabular-nums">{teamStats[team]}명</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="이름, 이메일, 팀 검색..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">이름</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">이메일</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">연락처</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">팀</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">역할</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">설정</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((u: any) => {
                  const RoleIcon = ROLE_ICONS[u.role] || User;
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-medium">{u.display_name || "-"}</td>
                      <td className="p-3 text-muted-foreground text-xs">{u.email || "-"}</td>
                      <td className="p-3 text-muted-foreground hidden sm:table-cell">{u.phone || "-"}</td>
                      <td className="p-3">
                        {u.role === "employee" ? (
                          <Select value={u.team || "__none__"} onValueChange={v => changeTeamMutation.mutate({ userId: u.id, team: v === "__none__" ? null : v })}>
                            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="팀 없음" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">팀 없음</SelectItem>
                              <SelectItem value="영업팀">영업팀</SelectItem>
                              <SelectItem value="기사팀">기사팀</SelectItem>
                              <SelectItem value="사무팀">사무팀</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="p-3">
                        <Select value={u.role} onValueChange={v => changeRoleMutation.mutate({ userId: u.id, newRole: v as AppRole })}>
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <div className="flex items-center gap-1.5"><RoleIcon className="h-3.5 w-3.5" /><SelectValue /></div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">관리자</SelectItem>
                            <SelectItem value="employee">직원</SelectItem>
                            <SelectItem value="customer">고객</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-right">
                        {u.role === "employee" && (
                          <Button variant="ghost" size="sm" onClick={() => setPermOpen(u.id)}>
                            <Settings className="h-4 w-4 mr-1" /> 권한
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} />
      {permOpen && <PermissionsDialog employeeId={permOpen} onClose={() => setPermOpen(null)} />}
    </div>
  );
}

// ─── 직원 관리 탭 ─────────────────────────────────────────────
function EmployeesTab() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [showResidentNumber, setShowResidentNumber] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // 계정 연동된 직원 확인용
  const { data: profiles } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, email");
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast({ title: "직원이 삭제되었습니다." }); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const filtered = employees?.filter(e => {
    const s = search.toLowerCase();
    return e.name.toLowerCase().includes(s) || e.phone?.includes(s) || e.team?.includes(s) || e.position?.includes(s);
  }) ?? [];

  const teamStats = {
    영업팀: employees?.filter(e => e.team === "영업팀").length ?? 0,
    기사팀: employees?.filter(e => e.team === "기사팀").length ?? 0,
    사무팀: employees?.filter(e => e.team === "사무팀").length ?? 0,
  };

  const maskResident = (num: string | null) => {
    if (!num) return "-";
    return num.length >= 7 ? num.slice(0, 7) + "******" : num;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">전체 {employees?.length ?? 0}명</p>
        <Button onClick={() => { setEditTarget(null); setAddOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" /> 직원 등록
        </Button>
      </div>

      {/* 팀별 현황 */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(TEAM_CONFIG) as [TeamType, typeof TEAM_CONFIG[TeamType]][]).map(([team, cfg]) => {
            const Icon = cfg.icon;
            return (
              <Card key={team} className="border-0 shadow-card">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}><Icon className={`h-4 w-4 ${cfg.color}`} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">{team}</p>
                    <p className="text-xl font-bold tabular-nums">{teamStats[team]}명</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="이름, 연락처, 팀 검색..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {search ? `"${search}"에 해당하는 직원이 없습니다.` : "등록된 직원이 없습니다."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(emp => {
            const teamCfg = emp.team ? TEAM_CONFIG[emp.team as TeamType] : null;
            const linkedProfile = profiles?.find((p: any) => p.id === emp.user_id);
            const isResidentVisible = showResidentNumber === emp.id;

            return (
              <Card key={emp.id} className="border-0 shadow-card overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* 아바타 + 기본정보 */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: teamCfg ? (emp.team === "영업팀" ? "#3b82f6" : emp.team === "기사팀" ? "#f97316" : "#a855f7") : "#94a3b8" }}
                      >
                        {emp.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{emp.name}</p>
                          {emp.position && <span className="text-xs text-muted-foreground">{emp.position}</span>}
                          {teamCfg && (
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${teamCfg.bg} ${teamCfg.color}`}>
                              {emp.team}
                            </span>
                          )}
                          {linkedProfile && (
                            <span className="text-[11px] flex items-center gap-0.5 text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md">
                              <Link2 className="h-3 w-3" /> 계정연동
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          {emp.phone && (
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{emp.phone}</span>
                          )}
                          {emp.join_date && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3 shrink-0" />입사 {emp.join_date}</span>
                          )}
                          {emp.address && (
                            <span className="flex items-center gap-1 sm:col-span-2"><MapPin className="h-3 w-3 shrink-0" />{emp.address}</span>
                          )}
                          {emp.salary && (
                            <span className="flex items-center gap-1"><Banknote className="h-3 w-3 shrink-0" />{emp.salary.toLocaleString()}원</span>
                          )}
                          {emp.resident_number && (
                            <span className="flex items-center gap-1">
                              <button
                                className="underline text-primary/70 hover:text-primary text-xs"
                                onClick={() => setShowResidentNumber(isResidentVisible ? null : emp.id)}
                              >
                                주민번호: {isResidentVisible ? emp.resident_number : maskResident(emp.resident_number)}
                              </button>
                            </span>
                          )}
                        </div>
                        {emp.notes && <p className="mt-1 text-xs text-muted-foreground/70 italic">{emp.notes}</p>}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditTarget(emp); setAddOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`${emp.name} 직원을 삭제하시겠습니까?`)) deleteMutation.mutate(emp.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EmployeeFormDialog
        open={addOpen}
        onOpenChange={v => { setAddOpen(v); if (!v) setEditTarget(null); }}
        editTarget={editTarget}
      />
    </div>
  );
}

// ─── 직원 등록/수정 다이얼로그 ───────────────────────────────
type EmployeeForm = {
  name: string; phone: string; address: string; resident_number: string;
  team: string; position: string; salary: string; join_date: string; notes: string;
};

const emptyForm = (): EmployeeForm => ({
  name: "", phone: "", address: "", resident_number: "",
  team: "", position: "", salary: "", join_date: "", notes: "",
});

function EmployeeFormDialog({ open, onOpenChange, editTarget }: {
  open: boolean; onOpenChange: (v: boolean) => void; editTarget: Employee | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!editTarget;
  const [form, setForm] = useState<EmployeeForm>(emptyForm());

  // editTarget이나 open이 바뀔 때 폼 초기화
  useEffect(() => {
    if (open && editTarget) {
      setForm({
        name: editTarget.name,
        phone: editTarget.phone ?? "",
        address: editTarget.address ?? "",
        resident_number: editTarget.resident_number ?? "",
        team: editTarget.team ?? "",
        position: editTarget.position ?? "",
        salary: editTarget.salary ? String(editTarget.salary) : "",
        join_date: editTarget.join_date ?? "",
        notes: editTarget.notes ?? "",
      });
    } else if (open) {
      setForm(emptyForm());
    }
  }, [open, editTarget]);

  const f = (field: keyof EmployeeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        resident_number: form.resident_number || null,
        team: form.team || null,
        position: form.position || null,
        salary: form.salary ? parseInt(form.salary.replace(/,/g, "")) : null,
        join_date: form.join_date || null,
        notes: form.notes || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editTarget!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["unlinked-employees"] });
      toast({ title: isEdit ? "직원 정보가 수정되었습니다." : "직원이 등록되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "직원 정보 수정" : "직원 등록"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-1">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>이름 *</Label><Input value={form.name} onChange={f("name")} placeholder="홍길동" /></div>
              <div><Label>연락처</Label><Input value={form.phone} onChange={f("phone")} placeholder="010-0000-0000" /></div>
              <div><Label>입사일</Label><Input type="date" value={form.join_date} onChange={f("join_date")} /></div>
              <div className="col-span-2"><Label>주소</Label><Input value={form.address} onChange={f("address")} placeholder="전남 장흥군..." /></div>
              <div className="col-span-2">
                <Label>주민등록번호</Label>
                <Input value={form.resident_number} onChange={f("resident_number")} placeholder="000000-0000000" />
                <p className="text-xs text-muted-foreground mt-1">화면에는 앞 7자리만 표시됩니다.</p>
              </div>
            </div>

            {/* 직책 / 팀 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>팀</Label>
                <Select value={form.team || "__none__"} onValueChange={v => setForm(p => ({ ...p, team: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="팀 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">미지정</SelectItem>
                    <SelectItem value="영업팀">영업팀</SelectItem>
                    <SelectItem value="기사팀">기사팀</SelectItem>
                    <SelectItem value="사무팀">사무팀</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>직책</Label><Input value={form.position} onChange={f("position")} placeholder="기사, 과장..." /></div>
            </div>

            {/* 급여 */}
            <div>
              <Label>급여 (월, 원)</Label>
              <Input value={form.salary} onChange={f("salary")} placeholder="3000000" type="number" />
            </div>

            {/* 비고 */}
            <div>
              <Label>비고</Label>
              <Input value={form.notes} onChange={f("notes")} placeholder="특이사항 등" />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending}>
            {mutation.isPending ? (isEdit ? "수정 중..." : "등록 중...") : (isEdit ? "수정" : "등록")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 계정 생성 다이얼로그 ────────────────────────────────────
function CreateAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    loginId: "", email: "", password: "", display_name: "", phone: "",
    role: "employee" as AppRole, team: "" as TeamType | "", customer_id: "", employee_id: "",
  });

  const isCustomerRole = form.role === "customer";
  const isEmployeeRole = form.role === "employee";

  const { data: unlinkedCustomers } = useQuery({
    queryKey: ["unlinked-customers"],
    enabled: open && isCustomerRole,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").is("user_id", null).order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  // 계정 미연동 직원 목록
  const { data: unlinkedEmployees } = useQuery({
    queryKey: ["unlinked-employees"],
    enabled: open && isEmployeeRole,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").is("user_id", null).order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const autoGenerateId = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const last4 = digits.slice(-4);
    return last4 ? `ym${last4}` : "";
  };

  const handlePhoneChange = (phone: string) => {
    const updates: any = { phone };
    if (isCustomerRole) { updates.loginId = autoGenerateId(phone); updates.password = autoGenerateId(phone); }
    setForm(f => ({ ...f, ...updates }));
  };

  const handleRoleChange = (role: AppRole) => {
    const updates: any = { role, customer_id: "", employee_id: "", team: "" };
    if (role === "customer") { updates.loginId = autoGenerateId(form.phone); updates.password = autoGenerateId(form.phone); updates.email = ""; }
    else { updates.loginId = ""; }
    setForm(f => ({ ...f, ...updates }));
  };

  const handleEmployeeSelect = (empId: string) => {
    if (empId === "__new__") { setForm(f => ({ ...f, employee_id: "" })); return; }
    const emp = unlinkedEmployees?.find(e => e.id === empId);
    if (emp) {
      setForm(f => ({
        ...f, employee_id: empId,
        display_name: f.display_name || emp.name,
        phone: f.phone || emp.phone || "",
        team: (emp.team as TeamType) || f.team,
      }));
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    if (customerId === "__new__") { setForm(f => ({ ...f, customer_id: "" })); return; }
    const customer = unlinkedCustomers?.find(c => c.id === customerId);
    if (customer) {
      setForm(f => ({
        ...f, customer_id: customerId,
        display_name: f.display_name || customer.name,
        phone: f.phone || customer.phone,
        loginId: autoGenerateId(f.phone || customer.phone),
        password: autoGenerateId(f.phone || customer.phone),
      }));
    }
  };

  const getEmail = () => isCustomerRole ? `${form.loginId}@ym.local` : form.email;

  const isValid = () => {
    if (!form.display_name || !form.password || form.password.length < 6) return false;
    if (isCustomerRole) return !!form.loginId && /^[a-zA-Z0-9]+$/.test(form.loginId);
    return !!form.email && /\S+@\S+\.\S+/.test(form.email);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인이 필요합니다.");
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: getEmail(), password: form.password, display_name: form.display_name,
          phone: form.phone || null, role: form.role,
          customer_id: form.customer_id || null,
          employee_id: form.employee_id || null,
          team: isEmployeeRole && form.team ? form.team : null,
        },
      });
      if (res.error) throw new Error(res.error.message || "사용자 생성 실패");
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["unlinked-customers"] });
      qc.invalidateQueries({ queryKey: ["unlinked-employees"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "계정이 생성되었습니다.", description: isCustomerRole ? `로그인 ID: ${form.loginId}` : form.team ? `팀: ${form.team}` : "" });
      onOpenChange(false);
      setForm({ loginId: "", email: "", password: "", display_name: "", phone: "", role: "employee", team: "", customer_id: "", employee_id: "" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>계정 생성</DialogTitle></DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-1">
            <div>
              <Label>역할</Label>
              <Select value={form.role} onValueChange={v => handleRoleChange(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="employee">직원</SelectItem>
                  <SelectItem value="customer">고객</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 직원 연동 */}
            {isEmployeeRole && (
              <>
                {unlinkedEmployees && unlinkedEmployees.length > 0 && (
                  <div>
                    <Label>기존 직원 연동 (선택)</Label>
                    <Select value={form.employee_id || "__new__"} onValueChange={handleEmployeeSelect}>
                      <SelectTrigger><SelectValue placeholder="새로 생성" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">직원 연동 없이 생성</SelectItem>
                        {unlinkedEmployees.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name} {e.team ? `(${e.team})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">직원 관리에 등록된 직원과 계정을 연결합니다.</p>
                  </div>
                )}
                <div>
                  <Label>팀</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {(["영업팀", "기사팀", "사무팀"] as TeamType[]).map(team => {
                      const cfg = TEAM_CONFIG[team];
                      const Icon = cfg.icon;
                      const selected = form.team === team;
                      return (
                        <button key={team} type="button"
                          onClick={() => setForm(f => ({ ...f, team: selected ? "" : team }))}
                          className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${selected ? `border-primary bg-primary/5 ${cfg.color}` : "border-border text-muted-foreground hover:border-primary/40"}`}
                        >
                          <Icon className="h-4 w-4" />{team}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* 고객 연동 */}
            {isCustomerRole && unlinkedCustomers && unlinkedCustomers.length > 0 && (
              <div>
                <Label>기존 고객 연동 (선택)</Label>
                <Select value={form.customer_id || "__new__"} onValueChange={handleCustomerSelect}>
                  <SelectTrigger><SelectValue placeholder="새 고객으로 생성" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">새 고객으로 생성</SelectItem>
                    {unlinkedCustomers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div><Label>이름 *</Label><Input value={form.display_name} onChange={e => setForm(f => ({...f, display_name: e.target.value}))} placeholder="홍길동" /></div>
            <div>
              <Label>연락처{isCustomerRole ? " *" : ""}</Label>
              <Input value={form.phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="010-0000-0000" />
            </div>

            {isCustomerRole ? (
              <div>
                <Label>로그인 ID *</Label>
                <Input value={form.loginId} onChange={e => setForm(f => ({...f, loginId: e.target.value}))} placeholder="ym1234" />
                <p className="text-xs text-muted-foreground mt-1">연락처 입력 시 자동 생성 (ym + 뒷자리 4자리)</p>
              </div>
            ) : (
              <div>
                <Label>이메일 *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="example@email.com" />
                {form.email && !/\S+@\S+\.\S+/.test(form.email) && <p className="text-xs text-destructive mt-1">올바른 이메일 형식을 입력하세요.</p>}
              </div>
            )}

            <div>
              <Label>비밀번호 * (6자 이상)</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} minLength={6} />
              {form.password && form.password.length < 6 && <p className="text-xs text-destructive mt-1">비밀번호는 6자 이상이어야 합니다.</p>}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!isValid() || mutation.isPending}>
            {mutation.isPending ? "생성 중..." : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 권한 설정 다이얼로그 ─────────────────────────────────────
function PermissionsDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: perms, isLoading } = useQuery({
    queryKey: ["employee-perms", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_permissions").select("*").eq("employee_id", employeeId);
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", employeeId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, team").eq("id", employeeId).single();
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ permKey, allowed }: { permKey: string; allowed: boolean }) => {
      const existing = perms?.find((p: any) => p.permission_key === permKey);
      if (existing) {
        const { error } = await supabase.from("employee_permissions").update({ is_allowed: allowed }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_permissions").insert({ employee_id: employeeId, permission_key: permKey, is_allowed: allowed });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-perms", employeeId] }); toast({ title: "권한이 변경되었습니다." }); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const permMap: Record<string, boolean> = {};
  perms?.forEach((p: any) => { permMap[p.permission_key] = p.is_allowed; });

  const teamCfg = profile?.team ? TEAM_CONFIG[profile.team as TeamType] : null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {profile?.display_name || "직원"} 권한 설정
            {teamCfg && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${teamCfg.bg} ${teamCfg.color}`}>{profile?.team}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-32 w-full" /> : (
          <div className="space-y-4">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-sm">{label}</Label>
                <Switch checked={permMap[key] ?? false} onCheckedChange={checked => toggleMutation.mutate({ permKey: key, allowed: checked })} />
              </div>
            ))}
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>닫기</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
