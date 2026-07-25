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
import ReviewInventory from './pages/ReviewInventory';
import RequestConsumables from './pages/RequestConsumables';
import ManageRequests from './pages/ManageRequests';
import DispatchPage from './pages/DispatchPage';
import ReceivePage from './pages/ReceivePage';
import Reports from './pages/Reports';
import QuarterlyReports from './pages/QuarterlyReports';
import Facilities from './pages/Facilities';
import ApproveRequests from './pages/ApproveRequests';
import Settings from './pages/Settings';
import DailyUsagePage from './pages/DailyUsagePage';
import StockTransfer from './pages/StockTransfer';
import Procurement from './pages/Procurement';
import Suppliers from './pages/Suppliers';
import StockAdjustmentPage from './pages/StockAdjustmentPage';
import BatchExpiryPage from './pages/BatchExpiryPage';
import UserManagement from './pages/UserManagement';
import ActivityLog from './pages/ActivityLog';
import Alerts from './pages/Alerts';

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
            <Route path="review-inventory" element={<ReviewInventory />} />
            <Route path="daily-usage" element={<DailyUsagePage />} />
            <Route path="stock-transfer" element={<StockTransfer />} />
            <Route path="procurement" element={<Procurement />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="warehouse" element={<Facilities />} />
            <Route path="facilities" element={<Facilities />} />
            <Route path="stock-adjustments" element={<StockAdjustmentPage />} />
            <Route path="batch-expiry" element={<BatchExpiryPage />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="activity-log" element={<ActivityLog />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="requests" element={<RequestConsumables />} />
            <Route path="request" element={<RequestConsumables />} />
            <Route path="manage-requests" element={<ManageRequests />} />
            <Route path="dispatch" element={<DispatchPage />} />
            <Route path="receive" element={<ReceivePage />} />
            <Route path="reports" element={<Reports />} />
            <Route path="quarterly-reports" element={<QuarterlyReports />} />
            <Route path="approve-requests" element={<ApproveRequests />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}