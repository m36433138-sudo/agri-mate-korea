/**
 * 직원(employee) 세부 권한 정의.
 * admin 은 항상 모든 권한을 가지며, customer 는 권한 대상이 아님.
 */

export type PermissionKey = string;

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  /** 이 권한이 없으면 의미가 없는 상위(조회) 권한 */
  requires?: PermissionKey;
}

export interface PermissionGroup {
  group: string;
  items: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "작업 현황",
    items: [
      { key: "view_operations", label: "작업현황판 조회" },
      { key: "manage_operations", label: "작업현황판 등록·수정", requires: "view_operations" },
      { key: "view_onsite", label: "방문수리 조회" },
      { key: "manage_onsite", label: "방문수리 등록·수정", requires: "view_onsite" },
    ],
  },
  {
    group: "고객",
    items: [
      { key: "view_customers", label: "고객 목록 조회" },
      { key: "edit_customers", label: "고객 등록·수정", requires: "view_customers" },
      { key: "delete_customers", label: "고객 삭제", requires: "view_customers" },
    ],
  },
  {
    group: "기계 · 작업기",
    items: [
      { key: "view_machines", label: "기계 목록 조회" },
      { key: "add_machines", label: "기계 등록", requires: "view_machines" },
      { key: "edit_machines", label: "기계 수정 (판매·중고인수)", requires: "view_machines" },
      { key: "delete_machines", label: "기계 삭제", requires: "view_machines" },
      { key: "view_attachments", label: "작업기 카탈로그 조회" },
      { key: "manage_attachments", label: "작업기 카탈로그 관리", requires: "view_attachments" },
    ],
  },
  {
    group: "수리",
    items: [
      { key: "view_repairs", label: "수리이력 조회" },
      { key: "manage_repairs", label: "수리이력 등록", requires: "view_repairs" },
      { key: "edit_repairs", label: "수리이력 수정", requires: "view_repairs" },
      { key: "delete_repairs", label: "수리이력 삭제", requires: "view_repairs" },
      { key: "view_repair_templates", label: "수리 템플릿 조회" },
      { key: "manage_repair_templates", label: "수리 템플릿 관리", requires: "view_repair_templates" },
    ],
  },
  {
    group: "부품 · 재고",
    items: [
      { key: "view_parts", label: "부품·재고 조회" },
      { key: "edit_parts", label: "부품 등록·가격 수정", requires: "view_parts" },
      { key: "adjust_inventory", label: "재고 조정 · 시트 동기화", requires: "view_parts" },
    ],
  },
  {
    group: "업체 · 매입",
    items: [
      { key: "view_vendors", label: "업체 조회" },
      { key: "manage_vendors", label: "업체·매입 등록", requires: "view_vendors" },
    ],
  },
  {
    group: "보험수리",
    items: [
      { key: "view_insurance", label: "보험수리 조회" },
      { key: "manage_insurance", label: "보험수리 등록·수정", requires: "view_insurance" },
    ],
  },
  {
    group: "견적 · 자산",
    items: [
      { key: "view_quotes", label: "견적서 조회" },
      { key: "manage_quotes", label: "견적서 작성·수정", requires: "view_quotes" },
      { key: "view_assets", label: "자산 조회" },
      { key: "manage_assets", label: "자산 등록·수정", requires: "view_assets" },
    ],
  },
  {
    group: "통계 · 근태",
    items: [
      { key: "view_stats", label: "실적 현황 조회" },
      { key: "view_overtime", label: "초과근무 현황 조회" },
    ],
  },
  {
    group: "AI · 지식베이스",
    items: [
      { key: "view_knowledge", label: "지식베이스 조회" },
      { key: "manage_knowledge", label: "지식베이스 자료 업로드·삭제", requires: "view_knowledge" },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_GROUPS.flatMap((g) => g.items);

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PERMISSIONS.map((p) => [p.key, p.label]),
);

/** 팀별 권장 프리셋 */
export const PERMISSION_PRESETS: Record<string, { label: string; keys: PermissionKey[] }> = {
  기사팀: {
    label: "기사팀 기본",
    keys: [
      "view_operations", "manage_operations", "view_onsite", "manage_onsite",
      "view_customers", "view_machines", "add_machines", "edit_machines",
      "view_repairs", "manage_repairs", "edit_repairs",
      "view_parts", "adjust_inventory",
      "view_repair_templates", "view_attachments",
      "view_stats", "view_overtime", "view_knowledge",
    ],
  },
  영업팀: {
    label: "영업팀 기본",
    keys: [
      "view_operations", "view_customers", "edit_customers",
      "view_machines", "add_machines", "edit_machines",
      "view_repairs", "view_parts",
      "view_quotes", "manage_quotes",
      "view_attachments", "view_stats", "view_knowledge",
    ],
  },
  사무팀: {
    label: "사무팀 기본",
    keys: [
      "view_operations", "manage_operations",
      "view_customers", "edit_customers",
      "view_machines", "view_repairs", "edit_repairs",
      "view_parts", "edit_parts", "adjust_inventory",
      "view_vendors", "manage_vendors",
      "view_quotes", "manage_quotes",
      "view_assets", "manage_assets",
      "view_stats", "view_overtime",
      "view_knowledge", "manage_knowledge",
      "view_repair_templates", "manage_repair_templates",
    ],
  },
  최소: { label: "최소 권한 (조회만)", keys: ["view_operations", "view_machines", "view_repairs"] },
};
