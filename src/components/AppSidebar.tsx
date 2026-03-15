import { LayoutDashboard, Tractor, Users, Wrench, Sparkles, Package, ListChecks, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

const items = [
  { title: "대시보드", url: "/", icon: LayoutDashboard },
  { title: "기계관리", url: "/machines", icon: Tractor },
  { title: "고객관리", url: "/customers", icon: Users },
  { title: "수리이력", url: "/repairs", icon: Wrench },
  { title: "부품관리", url: "/parts", icon: Package },
  { title: "수리 템플릿", url: "/repair-templates", icon: ListChecks },
  { title: "AI 어시스턴트", url: "/chat", icon: Sparkles },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

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
                      end={item.url === "/"}
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
    </Sidebar>
  );
}
