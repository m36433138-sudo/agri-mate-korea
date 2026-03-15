import { LayoutDashboard, Tractor, Users, Wrench, Sparkles, Package, ListChecks, LogOut, UserCog, User } from "lucide-react";
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

  // Build menu items based on role
  const items: { title: string; url: string; icon: any }[] = [];

  if (isCustomer) {
    items.push({ title: "마이페이지", url: "/my-page", icon: User });
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
          {!collapsed && (
            <h1 className="text-lg font-bold text-sidebar-foreground">
              얀마 관리 시스템
            </h1>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <Tractor className="h-6 w-6 text-sidebar-primary" />
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/" || item.url === "/my-page"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-5 w-5" style={{ strokeWidth: 1.5 }} />
                      {!collapsed && <span>{item.title}</span>}
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
              <div className="px-3 py-2 text-xs text-sidebar-foreground/50">
                <p className="font-medium text-sidebar-foreground/70">{profile.display_name}</p>
                <p>{role === "admin" ? "관리자" : role === "employee" ? "직원" : "고객"}</p>
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="hover:bg-sidebar-accent text-sidebar-foreground/70">
              <LogOut className="mr-2 h-5 w-5" style={{ strokeWidth: 1.5 }} />
              {!collapsed && <span>로그아웃</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
