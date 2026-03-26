import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Index";
import CustomerHome from "@/pages/CustomerHome";
import MachinesList from "@/pages/MachinesList";
import MachineDetail from "@/pages/MachineDetail";
import CustomersList from "@/pages/CustomersList";
import CustomerDetail from "@/pages/CustomerDetail";
import RepairsList from "@/pages/RepairsList";
import PartsList from "@/pages/PartsList";
import RepairTemplates from "@/pages/RepairTemplates";
import ChatBot from "@/pages/ChatBot";
import UserManagement from "@/pages/UserManagement";
import MyPage from "@/pages/MyPage";
import OperationsDashboard from "@/pages/OperationsDashboard";
import OvertimeDashboard from "@/pages/OvertimeDashboard";
import RepairStats from "@/pages/RepairStats";
import OnsiteRepairs from "@/pages/OnsiteRepairs";
import NotFound from "@/pages/NotFound";
import { useUserRole } from "@/hooks/useUserRole";

const queryClient = new QueryClient();

function HomePage() {
  const { isCustomer, isLoading } = useUserRole();
  if (isLoading) return null;
  return isCustomer ? <CustomerHome /> : <Dashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
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
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
