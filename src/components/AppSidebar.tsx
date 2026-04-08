import {
  LayoutDashboard, Tractor, Users, Wrench, Sparkles, Package,
  ListChecks, LogOut, UserCog, User, Cpu, Home, MessageSquare,
  ClipboardList, BarChart3, Clock, Truck, Briefcase, Building2, MapPin,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = { title: string; url: string; icon: any };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { role, isAdmin, isEmployee, isCustomer, hasPermission, profile } = useUserRole();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // 고객 전용 메뉴
  if (isCustomer) {
    const customerItems: NavItem[] = [
      { title: "홈", url: "/", icon: Home },
      { title: "마이페이지", url: "/my-page", icon: User },
      { title: "AI 정비 상담", url: "/chat", icon: MessageSquare },
    ];
    return (
      <Sidebar collapsible="icon">
        <SidebarContent>
          <LogoHeader collapsed={collapsed} />
          <NavGroup label="메뉴" items={customerItems} collapsed={collapsed} />
        </SidebarContent>
        <SidebarFooter>
          <FooterMenu collapsed={collapsed} profile={profile} role={role} onLogout={handleLogout} />
        </SidebarFooter>
      </Sidebar>
    );
  }

  // 업무 그룹
  const workItems: NavItem[] = [
    { title: "대시보드", url: "/", icon: LayoutDashboard },
    { title: "내 업무", url: "/workspace", icon: Briefcase },
    { title: "작업현황판", url: "/dashboard/operations", icon: ClipboardList },
    { title: "방문수리", url: "/onsite-repairs", icon: Truck },
    ...(isAdmin || isEmployee ? [{ title: "실적 현황", url: "/dashboard/stats", icon: BarChart3 }] : []),
    ...(isAdmin || isEmployee ? [{ title: "초과근무 현황", url: "/dashboard/overtime", icon: Clock }] : []),
  ];

  // 데이터관리 그룹
  const dataItems: NavItem[] = [
    ...(isAdmin || hasPermission("view_machines") ? [{ title: "기계관리", url: "/machines", icon: Tractor }] : []),
    ...(isAdmin || hasPermission("view_customers") ? [{ title: "고객관리", url: "/customers", icon: Users }] : []),
    ...(isAdmin || hasPermission("manage_repairs") ? [{ title: "수리이력", url: "/repairs", icon: Wrench }] : []),
    ...(isAdmin || isEmployee ? [{ title: "부품관리", url: "/parts", icon: Package }] : []),
    ...(isAdmin || isEmployee ? [{ title: "수리 템플릿", url: "/repair-templates", icon: ListChecks }] : []),
    ...(isAdmin || isEmployee ? [{ title: "업체관리", url: "/vendors", icon: Building2 }] : []),
  ];

  // 시스템 그룹
  const systemItems: NavItem[] = [
    { title: "AI 어시스턴트", url: "/chat", icon: Sparkles },
    ...(isAdmin ? [{ title: "위치 이력", url: "/location-history", icon: MapPin }] : []),
    ...(isAdmin ? [{ title: "사용자 관리", url: "/users", icon: UserCog }] : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <LogoHeader collapsed={collapsed} />
        <NavGroup label="업무" items={workItems} collapsed={collapsed} />
        {dataItems.length > 0 && (
          <>
            <SidebarSeparator className="mx-3 opacity-30" />
            <NavGroup label="데이터 관리" items={dataItems} collapsed={collapsed} />
          </>
        )}
        {systemItems.length > 0 && (
          <>
            <SidebarSeparator className="mx-3 opacity-30" />
            <NavGroup label="시스템" items={systemItems} collapsed={collapsed} />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <FooterMenu collapsed={collapsed} profile={profile} role={role} onLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  );
}

// 로고 헤더
function LogoHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={`px-4 py-5 ${collapsed ? "px-2" : ""}`}>
      {!collapsed ? (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground shrink-0">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground leading-none">AgriMate</h1>
            <span className="text-[10px] text-sidebar-foreground/40 font-medium tracking-widest uppercase">PRO</span>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
            <Cpu className="h-5 w-5" />
          </div>
        </div>
      )}
    </div>
  );
}

// 네비게이션 그룹
function NavGroup({ label, items, collapsed }: { label: string; items: NavItem[]; collapsed: boolean }) {
  return (
    <SidebarGroup className="py-1">
      {!collapsed && (
        <SidebarGroupLabel className="text-sidebar-foreground/35 text-[10px] uppercase tracking-widest font-semibold px-4 mb-1">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                <NavLink
                  to={item.url}
                  end={item.url === "/" || item.url === "/my-page"}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg mx-1 hover:bg-sidebar-accent transition-colors duration-150 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                >
                  <item.icon className="h-[17px] w-[17px] shrink-0" style={{ strokeWidth: 1.8 }} />
                  {!collapsed && <span className="text-sm leading-none">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// 하단 프로필 + 로그아웃
function FooterMenu({ collapsed, profile, role, onLogout }: {
  collapsed: boolean;
  profile: any;
  role: string | null;
  onLogout: () => void;
}) {
  const roleLabel = role === "admin" ? "관리자" : role === "employee" ? "직원" : "고객";

  return (
    <SidebarMenu>
      {!collapsed && profile && (
        <SidebarMenuItem>
          <div className="mx-2 mb-2 px-3 py-2.5 rounded-lg bg-sidebar-accent/60 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-sidebar-primary">
                {profile.display_name?.[0] ?? "?"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground/90 truncate leading-none">
                {profile.display_name}
              </p>
              <p className="text-[11px] text-sidebar-primary font-medium mt-0.5">{roleLabel}</p>
            </div>
          </div>
        </SidebarMenuItem>
      )}
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={onLogout}
          tooltip={collapsed ? "로그아웃" : undefined}
          className="flex items-center gap-2.5 mx-1 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors duration-150"
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" style={{ strokeWidth: 1.8 }} />
          {!collapsed && <span className="text-sm">로그아웃</span>}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
