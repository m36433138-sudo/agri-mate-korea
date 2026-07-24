import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/types/database";
import { withRetry, classifyTransient, describeReason } from "@/lib/retry";
import { useToast } from "@/hooks/use-toast";

export type AppRole = "admin" | "employee" | "customer";

// Re-export for backward compatibility
export type UserProfile = Profile;

export function useUserRole() {
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const notifiedRef = useRef<Set<string>>(new Set());

  const notifyOnce = (key: string, reason: ReturnType<typeof classifyTransient>) => {
    if (!reason) return;
    if (notifiedRef.current.has(key)) return;
    notifiedRef.current.add(key);
    toast({
      title: "사용자 정보 조회 지연",
      description: `${describeReason(reason)} 자동 재시도 후에도 실패하면 새로고침해주세요.`,
      variant: "destructive",
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", userId],
    enabled: !!userId,
    retry: false, // withRetry가 내부 재시도 담당
    queryFn: async () => {
      try {
        const { data, error } = await withRetry(() =>
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId!)
            .limit(1)
            .single(),
        );
        if (error) return "customer" as AppRole;
        return data.role as AppRole;
      } catch (e) {
        notifyOnce("role", classifyTransient(e));
        return "customer" as AppRole;
      }
    },
  });

  const { data: permissions, isLoading: permLoading } = useQuery({
    queryKey: ["user-permissions", userId],
    enabled: !!userId && role === "employee",
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await withRetry(() =>
          supabase
            .from("employee_permissions")
            .select("permission_key, is_allowed")
            .eq("employee_id", userId!),
        );
        if (error) return {};
        const map: Record<string, boolean> = {};
        data.forEach((p: any) => { map[p.permission_key] = p.is_allowed; });
        return map;
      } catch (e) {
        notifyOnce("perm", classifyTransient(e));
        return {};
      }
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile", userId],
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await withRetry(() =>
          supabase
            .from("profiles")
            .select("*")
            .eq("id", userId!)
            .single(),
        );
        if (error) return null;
        return data as UserProfile;
      } catch (e) {
        notifyOnce("profile", classifyTransient(e));
        return null;
      }
    },
  });

  const isAdmin = role === "admin";
  const isEmployee = role === "employee";
  const isCustomer = role === "customer";

  const hasPermission = (key: string) => {
    if (isAdmin) return true;
    if (isEmployee) return permissions?.[key] ?? false;
    return false;
  };

  return {
    userId,
    role: role ?? null,
    isAdmin,
    isEmployee,
    isCustomer,
    hasPermission,
    permissions: permissions ?? {},
    profile,
    isLoading: roleLoading || permLoading,
  };
}
