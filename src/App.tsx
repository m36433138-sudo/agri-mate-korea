import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUserRole } from "@/hooks/useUserRole";

// 페이지 lazy loading - 첫 방문 시에만 JS 로드
const Auth = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Index"));
const CustomerHome = lazy(() => import("@/pages/CustomerHome"));
const MachinesList = lazy(() => import("@/pages/MachinesList"));
const MachineDetail = lazy(() => import("@/pages/MachineDetail"));
const CustomersList = lazy(() => import("@/pages/CustomersList"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const RepairsList = lazy(() => import("@/pages/RepairsList"));
const PartsList = lazy(() => import("@/pages/PartsList"));
const RepairTemplates = lazy(() => import("@/pages/RepairTemplates"));
const ChatBot = lazy(() => import("@/pages/ChatBot"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const MyPage = lazy(() => import("@/pages/MyPage"));
const OperationsDashboard = lazy(() => import("@/pages/OperationsDashboard"));
const OvertimeDashboard = lazy(() => import("@/pages/OvertimeDashboard"));
const RepairStats = lazy(() => import("@/pages/RepairStats"));
const OnsiteRepairs = lazy(() => import("@/pages/OnsiteRepairs"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// QueryClient - 캐시 설정으로 페이지 이동 시 재요청 최소화
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2분간 fresh → 페이지 재방문 시 즉시 표시
      gcTime: 1000 * 60 * 10,     // 10분간 캐시 유지
      retry: 1,                    // 실패 시 1회만 재시도
      refetchOnWindowFocus: false, // 탭 전환 시 불필요한 재요청 방지
    },
  },
});

// 페이지 전환 로딩 스피너
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function HomePage() {
  const { isCustomer, isLoading } = useUserRole();
  if (isLoading) return <PageLoader />;
  return isCustomer ? <CustomerHome /> : <Dashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/dashboard/operations" element={<OperationsDashboard />} />
                        <Route path="/dashboard/stats" element={<RepairStats />} />
                        <Route path="/dashboard/overtime" element={<OvertimeDashboard />} />
                        <Route path="/onsite-repairs" element={<OnsiteRepairs />} />
                        <Route path="/machines" element={<MachinesList />} />
                        <Route path="/machines/:id" element={<MachineDetail />} />
                        <Route path="/customers" element={<CustomersList />} />
                        <Route path="/customers/:id" element={<CustomerDetail />} />
                        <Route path="/repairs" element={<RepairsList />} />
                        <Route path="/parts" element={<PartsList />} />
                        <Route path="/repair-templates" element={<RepairTemplates />} />
                        <Route path="/chat" element={<ChatBot />} />
                        <Route path="/users" element={
                          <ProtectedRoute allowedRoles={["admin"]}>
                            <UserManagement />
                          </ProtectedRoute>
                        } />
                        <Route path="/my-page" element={<MyPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
