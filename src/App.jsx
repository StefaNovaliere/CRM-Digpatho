// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Layout
import { MainLayout } from './components/layout/MainLayout';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MyDay } from './pages/MyDay';
import { Contacts } from './pages/Contacts';
import { ContactDetail } from './pages/ContactDetail';
import { Institutions } from './pages/Institutions';
import { Settings } from './pages/Settings';
import { BulkEmail } from './pages/BulkEmail';
import { GrowthSystem } from './pages/GrowthSystem';
import { Seguimientos } from './pages/Seguimientos';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mi-dia" element={<MyDay />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:id" element={<ContactDetail />} />
          <Route path="/seguimientos" element={<Seguimientos />} />
          <Route path="/institutions" element={<Institutions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/bulk-email" element={<BulkEmail />} />
          <Route path="/growth" element={<GrowthSystem />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
