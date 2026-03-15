import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Index";
import MachinesList from "@/pages/MachinesList";
import MachineDetail from "@/pages/MachineDetail";
import CustomersList from "@/pages/CustomersList";
import CustomerDetail from "@/pages/CustomerDetail";
import RepairsList from "@/pages/RepairsList";
import PartsList from "@/pages/PartsList";
import RepairTemplates from "@/pages/RepairTemplates";
import ChatBot from "@/pages/ChatBot";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

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
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/machines" element={<MachinesList />} />
                    <Route path="/machines/:id" element={<MachineDetail />} />
                    <Route path="/customers" element={<CustomersList />} />
                    <Route path="/customers/:id" element={<CustomerDetail />} />
                    <Route path="/repairs" element={<RepairsList />} />
                    <Route path="/parts" element={<PartsList />} />
                    <Route path="/repair-templates" element={<RepairTemplates />} />
                    <Route path="/chat" element={<ChatBot />} />
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
