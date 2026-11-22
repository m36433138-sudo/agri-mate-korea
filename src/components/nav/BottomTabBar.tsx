import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { isActivePath, type NavItem } from "./navItems";

/** 휴대폰 아래쪽 탭. 자주 쓰는 4개 + 전체 메뉴(서랍) */
export function BottomTabBar({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const anyActive = items.some((it) => isActivePath(pathname, it.url));
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="주요 메뉴"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const active = isActivePath(pathname, it.url);
          return (
            <li key={it.url}>
              <Link
                to={it.url}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <it.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                <span className="truncate max-w-full px-1">{it.title}</span>
                {!!it.badge && it.badge > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
                    {it.badge > 99 ? "99+" : it.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className={cn(
              "flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              !anyActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} />
            전체 메뉴
          </button>
        </li>
      </ul>
    </nav>
  );
}
