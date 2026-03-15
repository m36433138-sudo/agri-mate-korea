import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export type AppRole = "admin" | "employee" | "customer";

export interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  memo: string | null;
  created_at: string;
}

export function useUserRole() {
  const [userId, setUserId] = useState<string | null>(null);

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .limit(1)
        .single();
      if (error) return "customer" as AppRole;
      return data.role as AppRole;
    },
  });

  const { data: permissions, isLoading: permLoading } = useQuery({
    queryKey: ["user-permissions", userId],
    enabled: !!userId && role === "employee",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_permissions")
        .select("permission_key, is_allowed")
        .eq("employee_id", userId!);
      if (error) return {};
      const map: Record<string, boolean> = {};
      data.forEach((p: any) => { map[p.permission_key] = p.is_allowed; });
      return map;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .single();
      if (error) return null;
      return data as UserProfile;
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
