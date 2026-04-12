import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import GlobalSearch from "@/components/GlobalSearch";
import CursorGlow from "@/components/CursorGlow";
import { useLocation, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

// 경로 → 페이지 이름 매핑
const PAGE_LABELS: Record<string, string> = {
  "/": "대시보드",
  "/dashboard/operations": "작업현황판",
  "/dashboard/stats": "실적 현황",
  "/dashboard/overtime": "초과근무 현황",
  "/onsite-repairs": "방문수리",
  "/machines": "기계관리",
  "/customers": "고객관리",
  "/repairs": "수리이력",
  "/parts": "부품관리",
  "/repair-templates": "수리 템플릿",
  "/chat": "AI 어시스턴트",
  "/users": "사용자 관리",
  "/my-page": "마이페이지",
  "/vendors": "업체관리",
  "/assets": "자산관리",
  "/accounting": "회계관리",
  "/banking": "뱅킹연동",
};

function Breadcrumb() {
  const location = useLocation();
  const path = location.pathname;

  // 상세 페이지 처리 (예: /machines/123)
  const isDetail = path.match(/\/(machines|customers)\/[^/]+$/);
  const parentPath = isDetail ? `/${path.split("/")[1]}` : null;
  const parentLabel = parentPath ? PAGE_LABELS[parentPath] : null;

  const currentLabel =
    PAGE_LABELS[path] ??
    (isDetail
      ? path.includes("/machines/") ? "기계 상세" : "고객 상세"
      : null);

  if (!currentLabel) return null;

  return (
    <div className="flex items-center gap-1.5 text-sm min-w-0">
      {parentLabel && parentPath ? (
        <>
          <Link
            to={parentPath}
            className="text-muted-foreground hover:text-foreground/80 transition-colors truncate text-xs"
          >
            {parentLabel}
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span className="font-semibold text-foreground/90 truncate text-sm">{currentLabel}</span>
        </>
      ) : (
        <span className="font-semibold text-foreground/90 text-sm">{currentLabel}</span>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <CursorGlow />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* 헤더 */}
          <header className="h-13 flex items-center px-4 gap-3 sticky top-0 z-30 glass-header" style={{ height: 52 }}>
            <SidebarTrigger className="shrink-0" />
            <div className="w-px h-5 bg-border shrink-0" />
            <Breadcrumb />
            <div className="flex-1" />
            <GlobalSearch />
          </header>

          {/* 메인 콘텐츠 */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8 page-enter">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
