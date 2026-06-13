import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Incidents } from './pages/Incidents';
import { IncidentDetails } from './pages/IncidentDetails';
import { Services } from './pages/Services';
import { ServiceDetails } from './pages/ServiceDetails';
import { PublicStatusLayout } from './components/layout/PublicStatusLayout';
import { StatusOverview } from './pages/public/StatusOverview';
import { PublicIncidentDetails } from './pages/public/PublicIncidentDetails';

import { Settings } from './pages/Settings';
import { AdminStatusPage } from './pages/AdminStatusPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/incidents/:id" element={<IncidentDetails />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:id" element={<ServiceDetails />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/status" element={<AdminStatusPage />} />
            </Route>
          </Route>

          {/* Unauthenticated Public Status Layout */}
          <Route element={<PublicStatusLayout />}>
            <Route path="/status/:orgId" element={<StatusOverview />} />
            <Route path="/status/:orgId/incidents/:id" element={<PublicIncidentDetails />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
