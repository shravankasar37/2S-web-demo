import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BillingPage from './pages/BillingPage';
import StockPage from './pages/StockPage';
import SavingSchemePage from './pages/SavingSchemePage';
import GoldLoanPage from './pages/GoldLoanPage';
import ReportsPage from './pages/ReportsPage';
import SearchPage from './pages/SearchPage';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuthStore();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcf9f8] flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-[#570000] border-t-transparent border-b-[#735c00] border-l-transparent animate-spin" />
        <p className="font-serif text-[10px] font-bold text-[#570000] tracking-widest uppercase animate-pulse">
          Decrypting Ledger Keys...
        </p>
      </div>
    );
  }
  
  if (!session) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

export default function App() {
  const { initialize, session, loading } = useAuthStore();
  
  useEffect(() => {
    initialize();
  }, [initialize]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcf9f8] flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-[#570000] border-t-transparent border-b-[#735c00] border-l-transparent animate-spin" />
        <p className="font-serif text-[10px] font-bold text-[#570000] tracking-widest uppercase animate-pulse">
          Decrypting Ledger Keys...
        </p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
        <Route path="/stock" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
        <Route path="/savings" element={<ProtectedRoute><SavingSchemePage /></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute><GoldLoanPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
