import { LayoutDashboard, Tractor, Users, Wrench, Sparkles, Package, ListChecks, LogOut, UserCog, User, Cpu, Home, MessageSquare } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
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
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { role, isAdmin, isEmployee, isCustomer, hasPermission, profile } = useUserRole();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const items: { title: string; url: string; icon: any }[] = [];

  if (isCustomer) {
    items.push({ title: "홈", url: "/", icon: Home });
    items.push({ title: "마이페이지", url: "/my-page", icon: User });
    items.push({ title: "AI 정비 상담", url: "/chat", icon: MessageSquare });
  } else {
    items.push({ title: "대시보드", url: "/", icon: LayoutDashboard });

    if (isAdmin || hasPermission("view_machines")) {
      items.push({ title: "기계관리", url: "/machines", icon: Tractor });
    }
    if (isAdmin || hasPermission("view_customers")) {
      items.push({ title: "고객관리", url: "/customers", icon: Users });
    }
    if (isAdmin || hasPermission("manage_repairs")) {
      items.push({ title: "수리이력", url: "/repairs", icon: Wrench });
    }
    if (isAdmin || isEmployee) {
      items.push({ title: "부품관리", url: "/parts", icon: Package });
      items.push({ title: "수리 템플릿", url: "/repair-templates", icon: ListChecks });
    }
    if (isAdmin || isEmployee) {
      items.push({ title: "AI 어시스턴트", url: "/chat", icon: Sparkles });
    }
    if (isAdmin) {
      items.push({ title: "사용자 관리", url: "/users", icon: UserCog });
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`px-4 py-6 ${collapsed ? "px-2" : ""}`}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground shrink-0">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-sidebar-foreground leading-none">
                  AgriMate
                </h1>
                <span className="text-[10px] text-sidebar-foreground/40 font-medium tracking-wider uppercase">PRO</span>
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider font-semibold">메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/" || item.url === "/my-page"}
                      className="hover:bg-sidebar-accent rounded-xl transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-[18px] w-[18px]" style={{ strokeWidth: 1.8 }} />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {!collapsed && profile && (
            <SidebarMenuItem>
              <div className="px-3 py-3 mx-2 mb-2 rounded-xl bg-sidebar-accent/50">
                <p className="font-semibold text-sm text-sidebar-foreground/90">{profile.display_name}</p>
                <p className="text-[11px] text-sidebar-primary font-medium">
                  {role === "admin" ? "관리자" : role === "employee" ? "직원" : "고객"}
                </p>
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="hover:bg-sidebar-accent text-sidebar-foreground/60 rounded-xl">
              <LogOut className="mr-2 h-[18px] w-[18px]" style={{ strokeWidth: 1.8 }} />
              {!collapsed && <span className="text-sm">로그아웃</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
