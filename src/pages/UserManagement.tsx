import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Settings, Shield, ShieldCheck, User } from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  employee: "직원",
  customer: "고객",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  admin: ShieldCheck,
  employee: Shield,
  customer: User,
};

const PERMISSION_LABELS: Record<string, string> = {
  view_customers: "고객 목록 조회",
  edit_customers: "고객 정보 수정",
  manage_repairs: "수리 이력 관리",
  view_machines: "기계 목록 조회",
  add_machines: "기계 등록",
};

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap: Record<string, string> = {};
      roles?.forEach((r: any) => { roleMap[r.user_id] = r.role; });

      return profiles.map((p: any) => ({
        ...p,
        role: roleMap[p.id] || "customer",
      }));
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      // Delete existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);
      // Insert new role
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;

      // If changing to employee, create default permissions
      if (newRole === "employee") {
        const { data: existing } = await supabase
          .from("employee_permissions")
          .select("id")
          .eq("employee_id", userId);
        if (!existing || existing.length === 0) {
          await supabase.from("employee_permissions").insert(
            Object.keys(PERMISSION_LABELS).map((key) => ({
              employee_id: userId,
              permission_key: key,
              is_allowed: false,
            }))
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      toast({ title: "역할이 변경되었습니다." });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const filtered = users?.filter((u: any) => {
    const s = search.toLowerCase();
    return (
      u.display_name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.phone?.includes(s)
    );
  });

  const getRoleBadgeVariant = (role: string) => {
    if (role === "admin") return "default";
    if (role === "employee") return "secondary";
    return "outline";
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> 계정 생성
        </Button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="이름, 이메일, 연락처 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">이름</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">이메일</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">연락처</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">역할</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">가입일</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">설정</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((u: any) => {
                  const Icon = ROLE_ICONS[u.role] || User;
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{u.display_name || "-"}</td>
                      <td className="p-3 text-muted-foreground">{u.email || "-"}</td>
                      <td className="p-3 text-muted-foreground">{u.phone || "-"}</td>
                      <td className="p-3">
                        <Select
                          value={u.role}
                          onValueChange={(v) => changeRoleMutation.mutate({ userId: u.id, newRole: v as AppRole })}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">관리자</SelectItem>
                            <SelectItem value="employee">직원</SelectItem>
                            <SelectItem value="customer">고객</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(u.created_at).toLocaleDateString("ko-KR")}
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

function CreateAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: "", password: "", display_name: "", phone: "", role: "customer" as AppRole });

  const mutation = useMutation({
    mutationFn: async () => {
      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { display_name: form.display_name },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("사용자 생성 실패");

      // Update phone on profile
      if (form.phone) {
        await supabase.from("profiles").update({ phone: form.phone }).eq("id", data.user.id);
      }

      // Update role if not customer (trigger creates as customer by default for subsequent users)
      if (form.role !== "customer") {
        await supabase.from("user_roles").delete().eq("user_id", data.user.id);
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: form.role });

        if (form.role === "employee") {
          await supabase.from("employee_permissions").insert(
            Object.keys(PERMISSION_LABELS).map((key) => ({
              employee_id: data.user!.id,
              permission_key: key,
              is_allowed: false,
            }))
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      toast({ title: "계정이 생성되었습니다.", description: "이메일 인증 후 로그인 가능합니다." });
      onOpenChange(false);
      setForm({ email: "", password: "", display_name: "", phone: "", role: "customer" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>계정 생성</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>이름 *</Label><Input value={form.display_name} onChange={(e) => setForm(f => ({...f, display_name: e.target.value}))} /></div>
          <div><Label>이메일 *</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} /></div>
          <div><Label>비밀번호 *</Label><Input type="password" value={form.password} onChange={(e) => setForm(f => ({...f, password: e.target.value}))} minLength={6} /></div>
          <div><Label>연락처</Label><Input value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} placeholder="010-0000-0000" /></div>
          <div>
            <Label>역할</Label>
            <Select value={form.role} onValueChange={(v) => setForm(f => ({...f, role: v as AppRole}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">관리자</SelectItem>
                <SelectItem value="employee">직원</SelectItem>
                <SelectItem value="customer">고객</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!(form.email && form.password && form.display_name) || mutation.isPending}>
            {mutation.isPending ? "생성 중..." : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionsDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: perms, isLoading } = useQuery({
    queryKey: ["employee-perms", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_permissions")
        .select("*")
        .eq("employee_id", employeeId);
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", employeeId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", employeeId).single();
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ permKey, allowed }: { permKey: string; allowed: boolean }) => {
      const existing = perms?.find((p: any) => p.permission_key === permKey);
      if (existing) {
        const { error } = await supabase
          .from("employee_permissions")
          .update({ is_allowed: allowed })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_permissions").insert({
          employee_id: employeeId,
          permission_key: permKey,
          is_allowed: allowed,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-perms", employeeId] });
      toast({ title: "권한이 변경되었습니다." });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const permMap: Record<string, boolean> = {};
  perms?.forEach((p: any) => { permMap[p.permission_key] = p.is_allowed; });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{profile?.display_name || "직원"} 권한 설정</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="space-y-4">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-sm">{label}</Label>
                <Switch
                  checked={permMap[key] ?? false}
                  onCheckedChange={(checked) => toggleMutation.mutate({ permKey: key, allowed: checked })}
                />
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
