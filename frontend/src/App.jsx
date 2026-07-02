import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import DispatchPage from './pages/DispatchPage';
import ReceivePage from './pages/ReceivePage';
import Reports from './pages/Reports';
import RequestConsumables from './pages/RequestConsumables';
import ApproveRequests from './pages/ApproveRequests';
import Facilities from './pages/Facilities';
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';
import StockTransfer from './pages/StockTransfer';
import Procurement from './pages/Procurement';
import UserManagement from './pages/UserManagement';
import ActivityLog from './pages/ActivityLog';
import StockAdjustmentPage from './pages/StockAdjustmentPage';
import BatchExpiryPage from './pages/BatchExpiryPage';
import DailyUsagePage from './pages/DailyUsagePage';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-green-600">Loading ECEWS Consumables & Logistics Management System...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-green-600">Loading ECEWS Consumables & Logistics Management System...</p>
      </div>
    </div>
  );
  const role = (user?.role || '').toLowerCase();
  return (role === 'admin' || role === 'super_admin') ? children : <Navigate to="/dashboard" />;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" /> : children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="receive" element={<ReceivePage />} />
            <Route path="dispatch" element={<AdminRoute><DispatchPage /></AdminRoute>} />
            <Route path="stock-transfer" element={<AdminRoute><StockTransfer /></AdminRoute>} />
            <Route path="stock-adjustments" element={<PrivateRoute><StockAdjustmentPage /></PrivateRoute>} />
            <Route path="batch-expiry" element={<PrivateRoute><BatchExpiryPage /></PrivateRoute>} />
            <Route path="daily-usage" element={<PrivateRoute><DailyUsagePage /></PrivateRoute>} />
            <Route path="procurement" element={<AdminRoute><Procurement /></AdminRoute>} />
            <Route path="suppliers" element={<AdminRoute><Suppliers /></AdminRoute>} />
            <Route path="warehouse" element={<AdminRoute><Facilities /></AdminRoute>} />
            <Route path="requests" element={<RequestConsumables />} />
            <Route path="approve-requests" element={<AdminRoute><ApproveRequests /></AdminRoute>} />
            <Route path="reports" element={<Reports />} />
            <Route path="quarterly-reports" element={<AdminRoute><Reports /></AdminRoute>} />
            <Route path="user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
            <Route path="activity-log" element={<AdminRoute><ActivityLog /></AdminRoute>} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}