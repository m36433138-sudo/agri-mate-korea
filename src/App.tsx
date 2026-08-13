import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import BackendHealthMonitor from "@/components/BackendHealthMonitor";
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
const WorkspacePage = lazy(() => import("@/components/workspace/WorkspacePage"));
const VendorsList = lazy(() => import("@/pages/VendorsList"));
const VendorDetail = lazy(() => import("@/pages/VendorDetail"));
const AssetsPage = lazy(() => import("@/pages/AssetsPage"));
const LocationHistory = lazy(() => import("@/pages/LocationHistory"));
const QuotesList = lazy(() => import("@/pages/QuotesList"));
const QuoteEditor = lazy(() => import("@/pages/QuoteEditor"));
const QuoteProducts = lazy(() => import("@/pages/QuoteProducts"));
const QuoteCompanies = lazy(() => import("@/pages/QuoteCompanies"));
const AttachmentsCatalog = lazy(() => import("@/pages/AttachmentsCatalog"));
const KnowledgeBase = lazy(() => import("@/pages/KnowledgeBase"));
const InsuranceRepairs = lazy(() => import("@/pages/InsuranceRepairs"));

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
   <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="agrimate-theme">
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <BackendHealthMonitor />
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
                        <Route path="/dashboard/operations" element={<ProtectedRoute requiredPermission="view_operations"><OperationsDashboard /></ProtectedRoute>} />
                        <Route path="/dashboard/stats" element={<ProtectedRoute requiredPermission="view_stats"><RepairStats /></ProtectedRoute>} />
                        <Route path="/dashboard/overtime" element={<ProtectedRoute requiredPermission="view_overtime"><OvertimeDashboard /></ProtectedRoute>} />
                        <Route path="/onsite-repairs" element={<ProtectedRoute requiredPermission="view_onsite"><OnsiteRepairs /></ProtectedRoute>} />
                        <Route path="/machines" element={<ProtectedRoute requiredPermission="view_machines"><MachinesList /></ProtectedRoute>} />
                        <Route path="/machines/:id" element={<ProtectedRoute requiredPermission="view_machines"><MachineDetail /></ProtectedRoute>} />
                        <Route path="/attachments" element={<ProtectedRoute requiredPermission="view_attachments"><AttachmentsCatalog /></ProtectedRoute>} />
                        <Route path="/customers" element={<ProtectedRoute requiredPermission="view_customers"><CustomersList /></ProtectedRoute>} />
                        <Route path="/customers/:id" element={<ProtectedRoute requiredPermission="view_customers"><CustomerDetail /></ProtectedRoute>} />
                        <Route path="/repairs" element={<ProtectedRoute requiredPermission="view_repairs"><RepairsList /></ProtectedRoute>} />
                        <Route path="/parts" element={<ProtectedRoute requiredPermission="view_parts"><PartsList /></ProtectedRoute>} />
                        <Route path="/repair-templates" element={<ProtectedRoute requiredPermission="view_repair_templates"><RepairTemplates /></ProtectedRoute>} />
                        <Route path="/chat" element={<ChatBot />} />
                        <Route path="/knowledge" element={<ProtectedRoute requiredPermission="view_knowledge"><KnowledgeBase /></ProtectedRoute>} />
                        <Route path="/users" element={
                          <ProtectedRoute allowedRoles={["admin"]}>
                            <UserManagement />
                          </ProtectedRoute>
                        } />
                        <Route path="/workspace" element={<WorkspacePage />} />
                        <Route path="/vendors" element={<ProtectedRoute requiredPermission="view_vendors"><VendorsList /></ProtectedRoute>} />
                        <Route path="/vendors/:id" element={<ProtectedRoute requiredPermission="view_vendors"><VendorDetail /></ProtectedRoute>} />
                        <Route path="/assets" element={<ProtectedRoute requiredPermission="view_assets"><AssetsPage /></ProtectedRoute>} />

                        <Route path="/location-history" element={
                          <ProtectedRoute allowedRoles={["admin"]}>
                            <LocationHistory />
                          </ProtectedRoute>
                        } />
                        <Route path="/my-page" element={<MyPage />} />
                        <Route path="/insurance-repairs" element={<ProtectedRoute requiredPermission="view_insurance"><InsuranceRepairs /></ProtectedRoute>} />
                        <Route path="/quotes" element={<ProtectedRoute requiredPermission="view_quotes"><QuotesList /></ProtectedRoute>} />
                        <Route path="/quotes/new" element={<ProtectedRoute requiredPermission="manage_quotes"><QuoteEditor /></ProtectedRoute>} />
                        <Route path="/quotes/products" element={<ProtectedRoute requiredPermission="manage_quotes"><QuoteProducts /></ProtectedRoute>} />
                        <Route path="/quotes/companies" element={
                          <ProtectedRoute allowedRoles={["admin"]}><QuoteCompanies /></ProtectedRoute>
                        } />
                        <Route path="/quotes/:id" element={<ProtectedRoute requiredPermission="view_quotes"><QuoteEditor /></ProtectedRoute>} />

                        <Route path="/accounting" element={<Navigate to="/" replace />} />
                        <Route path="/banking" element={<Navigate to="/" replace />} />
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
   </ThemeProvider>
  </QueryClientProvider>
);

export default App;
