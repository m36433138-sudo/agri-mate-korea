import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Tractor, Users, Wrench, Sparkles, Package, ListChecks, UserCog, User, Home,
  MessageSquare, ClipboardList, BarChart3, Clock, Truck, Briefcase, Building2, MapPin, Landmark,
  FileText, BookOpen, ShieldCheck, Wallet, Map, AlertTriangle, Receipt, ShoppingCart, Cog,
} from "lucide-react";

export type NavItem = { title: string; url: string; icon: LucideIcon; badge?: number };
export type NavGroup = { id: string; label: string; items: NavItem[] };

type Access = { isAdmin: boolean; hasPermission: (key: string) => boolean; unreadMessages: number };

/** 직원 메뉴. 하는 일 기준으로 묶어 긴 목록 대신 접히는 묶음으로 보여 준다. 권한 없는 메뉴는 빠진다. */
export function staffNavGroups({ isAdmin, hasPermission: can, unreadMessages }: Access): NavGroup[] {
  const pick = (cond: boolean, item: NavItem) => (cond ? [item] : []);
  const groups: NavGroup[] = [
    {
      id: "home",
      label: "홈",
      items: [
        { title: "대시보드", url: "/", icon: LayoutDashboard },
        { title: "내 업무", url: "/workspace", icon: Briefcase },
        { title: "사내 메신저", url: "/messenger", icon: MessageSquare, badge: unreadMessages },
      ],
    },
    {
      id: "field",
      label: "수리 · 현장",
      items: [
        ...pick(can("view_operations"), { title: "작업현황판", url: "/dashboard/operations", icon: ClipboardList }),
        ...pick(can("view_onsite"), { title: "방문수리", url: "/onsite-repairs", icon: Truck }),
        ...pick(can("view_repairs") || can("manage_repairs"), { title: "수리이력", url: "/repairs", icon: Wrench }),
        ...pick(can("view_insurance"), { title: "보험수리", url: "/insurance-repairs", icon: ShieldCheck }),
        ...pick(can("view_repairs"), { title: "에러코드 기록", url: "/error-codes", icon: AlertTriangle }),
        ...pick(can("view_repair_templates"), { title: "수리 템플릿", url: "/repair-templates", icon: ListChecks }),
      ],
    },
    {
      id: "customers",
      label: "고객 · 기계",
      items: [
        ...pick(can("view_customers"), { title: "고객관리", url: "/customers", icon: Users }),
        ...pick(can("view_machines"), { title: "기계관리", url: "/machines", icon: Tractor }),
        ...pick(can("view_attachments"), { title: "작업기 관리", url: "/attachments", icon: Cog }),
      ],
    },
    {
      id: "parts",
      label: "부품",
      items: [
        ...pick(can("view_parts"), { title: "부품관리", url: "/parts", icon: Package }),
        ...pick(can("view_part_sales"), { title: "부품 판매", url: "/part-sales", icon: ShoppingCart }),
        ...pick(can("view_parts"), { title: "부품 도면", url: "/diagrams", icon: Map }),
      ],
    },
    {
      id: "money",
      label: "돈 · 경영",
      items: [
        ...pick(can("view_receivables"), { title: "미수금 관리", url: "/receivables", icon: Wallet }),
        ...pick(can("view_quotes"), { title: "견적서 관리", url: "/quotes", icon: FileText }),
        ...pick(can("view_expenses"), { title: "지출 관리", url: "/expenses", icon: Receipt }),
        ...pick(can("view_stats"), { title: "실적 현황", url: "/dashboard/stats", icon: BarChart3 }),
        ...pick(can("view_overtime"), { title: "초과근무 현황", url: "/dashboard/overtime", icon: Clock }),
        ...pick(can("view_vendors"), { title: "업체관리", url: "/vendors", icon: Building2 }),
        ...pick(can("view_assets"), { title: "자산관리", url: "/assets", icon: Landmark }),
      ],
    },
    {
      id: "tools",
      label: "도구 · 설정",
      items: [
        { title: "AI 어시스턴트", url: "/chat", icon: Sparkles },
        ...pick(can("view_knowledge"), { title: "지식베이스", url: "/knowledge", icon: BookOpen }),
        ...pick(isAdmin, { title: "위치 이력", url: "/location-history", icon: MapPin }),
        ...pick(isAdmin, { title: "사용자 관리", url: "/users", icon: UserCog }),
      ],
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export const customerNavItems: NavItem[] = [
  { title: "홈", url: "/", icon: Home },
  { title: "마이페이지", url: "/my-page", icon: User },
  { title: "AI 정비 상담", url: "/chat", icon: MessageSquare },
];

/** 주소가 이 메뉴에 해당하는지 (상세 페이지 /machines/123 도 기계관리로 본다) */
export function isActivePath(pathname: string, url: string) {
  if (url === "/" || url === "/my-page") return pathname === url;
  return pathname === url || pathname.startsWith(url + "/");
}
