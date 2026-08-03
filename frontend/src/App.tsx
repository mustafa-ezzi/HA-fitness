import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AdmitMemberPage } from './pages/AdmitMemberPage';
import { DashboardPage } from './pages/DashboardPage';
import { FeesPage } from './pages/FeesPage';
import { LoginPage } from './pages/LoginPage';
import { MemberDetailPage } from './pages/MemberDetailPage';
import { MembersPage } from './pages/MembersPage';
import { PackagesPage } from './pages/PackagesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { AlertsPage } from './pages/AlertsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrainerPackagesPage } from './pages/TrainerPackagesPage';
import { TrainersPage } from './pages/TrainersPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/new" element={<AdmitMemberPage />} />
              <Route path="members/:id" element={<MemberDetailPage />} />
              <Route path="packages" element={<PackagesPage />} />
              <Route path="trainer-packages" element={<TrainerPackagesPage />} />
              <Route path="trainers" element={<TrainersPage />} />
              <Route path="fees" element={<FeesPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
