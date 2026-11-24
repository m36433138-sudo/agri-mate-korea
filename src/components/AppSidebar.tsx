import { useState } from "react";
import { LogOut, ChevronDown, Tractor } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnreadCount } from "@/hooks/useMessenger";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { customerNavItems, isActivePath, staffNavGroups, type NavGroup, type NavItem } from "@/components/nav/navItems";

const OPEN_KEY = "agrimate-nav-open";

function readOpenGroups(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) || "{}");
  } catch {
    return {};
  }
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { role, isAdmin, isCustomer, hasPermission, profile } = useUserRole();
  const unreadMessages = useUnreadCount();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const groups: NavGroup[] = isCustomer
    ? [{ id: "customer", label: "메뉴", items: customerNavItems }]
    : staffNavGroups({ isAdmin, hasPermission, unreadMessages });

  // 묶음 펼침 상태는 기기에 기억한다. 처음엔 홈·수리 묶음만 펼친다.
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ home: true, field: true, customer: true, ...readOpenGroups() }));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* 저장 못 해도 화면은 동작 */ }
      return next;
    });

  // 지금 보고 있는 화면이 든 묶음은 항상 펼친다 (접어도 지금 화면 메뉴가 사라지지 않게)
  const activeGroup = groups.find((g) => g.items.some((it) => isActivePath(pathname, it.url)))?.id;

  return (
    <Sidebar collapsible="icon" variant="floating" className="p-3 pr-0">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <LogoHeader collapsed={collapsed} />
      </SidebarHeader>
      <SidebarContent className="gap-0 px-2">
        {groups.map((g, i) => (
          <NavSection
            key={g.id}
            group={g}
            collapsed={collapsed}
            open={!!open[g.id] || g.id === activeGroup || groups.length === 1}
            locked={g.id === activeGroup || groups.length === 1}
            onToggle={() => toggle(g.id)}
            first={i === 0}
          />
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <FooterMenu collapsed={collapsed} profile={profile} role={role} onLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  );
}

function LogoHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
      <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-primary text-primary-foreground shadow-sm">
        <Tractor className="h-5 w-5" strokeWidth={2.2} />
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold tracking-tight text-sidebar-foreground leading-tight">CSGM</p>
          <p className="text-[11px] font-medium text-muted-foreground leading-tight">Customer Service Gwangmun</p>
        </div>
      )}
    </div>
  );
}

function NavSection({ group, collapsed, open, locked, onToggle, first }: {
  group: NavGroup; collapsed: boolean; open: boolean; locked: boolean; onToggle: () => void; first: boolean;
}) {
  // 핸드폰에서는 메뉴를 고르면 서랍을 닫아 바뀐 화면이 바로 보이게 한다
  const { isMobile, setOpenMobile } = useSidebar();
  const showItems = collapsed || open;
  return (
    <SidebarGroup className={cn("py-0.5", !first && collapsed && "border-t border-sidebar-border mt-1 pt-1.5")}>
      {!collapsed && (
        <button
          type="button"
          onClick={locked ? undefined : onToggle}
          aria-expanded={open}
          aria-disabled={locked || undefined}
          title={locked ? "지금 보는 화면이 든 묶음이라 펼쳐 둬요" : undefined}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-sidebar-foreground transition-colors"
        >
          {group.label}
          {!locked && <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />}
        </button>
      )}
      {showItems && (
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {group.items.map((item) => (
              <NavRow key={item.url} item={item} collapsed={collapsed} onPick={() => { if (isMobile) setOpenMobile(false); }} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

function NavRow({ item, collapsed, onPick }: { item: NavItem; collapsed: boolean; onPick: () => void }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={collapsed ? item.title : undefined}
        className="h-11 p-0 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:!p-0"
      >
        <NavLink
          to={item.url}
          end={item.url === "/" || item.url === "/my-page"}
          onClick={onPick}
          className="group/nav flex items-center gap-3 pl-1.5 pr-3 rounded-full text-sidebar-foreground/85 hover:bg-foreground/[0.05] hover:text-sidebar-foreground transition-colors duration-150"
          activeClassName="nav-active bg-sidebar-accent !text-sidebar-accent-foreground font-semibold shadow-sm hover:!bg-sidebar-accent"
        >
          <span className="nav-icon w-8 h-8 shrink-0 rounded-full bg-foreground/[0.06] flex items-center justify-center transition-colors">
            <item.icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          {!collapsed && <span className="text-[14px] leading-none flex-1 truncate">{item.title}</span>}
          {!!item.badge && item.badge > 0 && (
            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-white text-[11px] font-bold flex items-center justify-center">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function FooterMenu({ collapsed, profile, role, onLogout }: {
  collapsed: boolean;
  profile: any;
  role: string | null;
  onLogout: () => void;
}) {
  const roleLabel = role === "admin" ? "관리자" : role === "employee" ? "직원" : "고객";
  if (collapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={onLogout} tooltip="로그아웃" className="h-10">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border px-2.5 py-2">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-primary">{profile?.display_name?.[0] ?? "?"}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">{profile?.display_name ?? "-"}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{roleLabel}</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        title="로그아웃"
        aria-label="로그아웃"
        className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
