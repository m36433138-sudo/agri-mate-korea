import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const INSURANCE_STATUSES = [
  "수리대기",
  "수리중",
  "수리완료",
  "청구완료",
  "입금완료",
  "완료",
] as const;

export type InsuranceStatus = (typeof INSURANCE_STATUSES)[number];

/** 칸반에 표시할 진행 단계 (완료는 별도 탭) */
export const BOARD_STATUSES = INSURANCE_STATUSES.filter((s) => s !== "완료");

export type InsuranceCompany = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

export type InsuranceRepair = {
  id: string;
  customer_id: string | null;
  machine_id: string | null;
  insurance_company_id: string | null;
  branch: string | null;
  technician: string | null;
  accident_date: string | null;
  claim_number: string | null;
  status: InsuranceStatus;
  description: string | null;
  notes: string | null;
  quote_id: string | null;
  estimate_amount: number | null;
  claim_amount: number | null;
  deductible: number | null;
  paid_amount: number | null;
  repair_started_at: string | null;
  repair_done_at: string | null;
  claimed_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: { id: string; name: string; phone: string | null } | null;
  machines?: { id: string; model_name: string; serial_number: string } | null;
  insurance_companies?: {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
  } | null;
  quotes?: { id: string; quote_number: string; total_amount: number } | null;
};

const REPAIR_SELECT = `
  *,
  customers ( id, name, phone ),
  machines ( id, model_name, serial_number ),
  insurance_companies ( id, name, contact_person, phone ),
  quotes ( id, quote_number, total_amount )
`;

// ── 보험사 주소록 ──
export function useInsuranceCompanies() {
  return useQuery({
    queryKey: ["insurance-companies"],
    queryFn: async () => {
      const { data, error } = await db
        .from("insurance_companies")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as InsuranceCompany[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveInsuranceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<InsuranceCompany>) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await db.from("insurance_companies").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db.from("insurance_companies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-companies"] }),
  });
}

export function useDeleteInsuranceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("insurance_companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-companies"] }),
  });
}

// ── 보험수리 건 ──
export function useInsuranceRepairs() {
  return useQuery({
    queryKey: ["insurance-repairs"],
    queryFn: async () => {
      const { data, error } = await db
        .from("insurance_repairs")
        .select(REPAIR_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as InsuranceRepair[];
    },
    staleTime: 1000 * 60,
  });
}

export function useSaveInsuranceRepair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await db.from("insurance_repairs").update(rest).eq("id", id);
        if (error) throw error;
        return id as string;
      }
      const { data, error } = await db
        .from("insurance_repairs")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-repairs"] }),
  });
}

/** 상태 변경 시 관련 날짜를 자동으로 채운다 */
export function statusSideEffects(status: InsuranceStatus) {
  const today = new Date().toISOString().slice(0, 10);
  switch (status) {
    case "수리중":
      return { repair_started_at: today };
    case "수리완료":
      return { repair_done_at: today };
    case "청구완료":
      return { claimed_at: today };
    case "입금완료":
      return { paid_at: today };
    case "완료":
      return { completed_at: new Date().toISOString() };
    default:
      return {};
  }
}

export function useUpdateInsuranceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InsuranceStatus }) => {
      const { error } = await db
        .from("insurance_repairs")
        .update({ status, ...statusSideEffects(status) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-repairs"] }),
  });
}

export function useDeleteInsuranceRepair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("insurance_repairs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-repairs"] }),
  });
}

// ── 수리 사진 ──
export type InsuranceAttachmentKind = "수리전" | "수리후" | "기타" | "견적서";

export type InsurancePhoto = {
  id: string;
  repair_id: string;
  file_path: string;
  kind: InsuranceAttachmentKind;
  caption: string | null;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
  url?: string;
};

const BUCKET = "insurance-photos";

export function useInsurancePhotos(repairId?: string | null) {
  return useQuery({
    queryKey: ["insurance-photos", repairId],
    enabled: !!repairId,
    queryFn: async () => {
      const { data, error } = await db
        .from("insurance_repair_photos")
        .select("*")
        .eq("repair_id", repairId)
        .order("created_at");
      if (error) throw error;
      const rows = (data || []) as InsurancePhoto[];
      const withUrls = await Promise.all(
        rows.map(async (r) => {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(r.file_path, 60 * 60);
          return { ...r, url: signed?.signedUrl };
        }),
      );
      return withUrls;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useUploadInsurancePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      repairId,
      file,
      kind,
    }: {
      repairId: string;
      file: File;
      kind: InsurancePhoto["kind"];
    }) => {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${repairId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;
      const { error } = await db.from("insurance_repair_photos").insert({
        repair_id: repairId,
        file_path: path,
        kind,
        file_name: file.name,
        mime_type: file.type || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["insurance-photos", v.repairId] }),
  });
}

export function useDeleteInsurancePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: InsurancePhoto) => {
      await supabase.storage.from(BUCKET).remove([photo.file_path]);
      const { error } = await db.from("insurance_repair_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["insurance-photos", v.repair_id] }),
  });
}
