import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './api/queryClient';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { PublicStatusLayout } from './components/layout/PublicStatusLayout';
import { PageLoader } from './components/ui/PageLoader';

const LoginPage = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Register').then((m) => ({ default: m.RegisterPage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Incidents = lazy(() => import('./pages/Incidents').then((m) => ({ default: m.Incidents })));
const IncidentDetails = lazy(() => import('./pages/IncidentDetails').then((m) => ({ default: m.IncidentDetails })));
const Services = lazy(() => import('./pages/Services').then((m) => ({ default: m.Services })));
const ServiceDetails = lazy(() => import('./pages/ServiceDetails').then((m) => ({ default: m.ServiceDetails })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const AdminStatusPage = lazy(() => import('./pages/AdminStatusPage').then((m) => ({ default: m.AdminStatusPage })));
const StatusOverview = lazy(() => import('./pages/public/StatusOverview').then((m) => ({ default: m.StatusOverview })));
const PublicIncidentDetails = lazy(() =>
  import('./pages/public/PublicIncidentDetails').then((m) => ({ default: m.PublicIncidentDetails }))
);
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
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

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#18181b',
            color: '#f4f4f5',
            border: '1px solid #27272a',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#18181b' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#18181b' },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
