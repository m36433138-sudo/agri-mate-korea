import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import GlobalSearch from "@/components/GlobalSearch";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b bg-card px-3 gap-3">
            <SidebarTrigger />
            <GlobalSearch />
          </header>
          <main className="flex-1 overflow-auto">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
