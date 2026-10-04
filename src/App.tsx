import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { Toaster } from "./components/ui/sonner";

import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import VenuesPage from "./pages/VenuesPage";
import VenueDetailPage from "./pages/VenueDetailPage";
import EventsPage from "./pages/EventsPage";
import PlayersPage from "./pages/PlayersPage";
import ProfilePage from "./pages/ProfilePage";
import BookingConfirmedPage from "./pages/BookingConfirmedPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminAuditPage from "./pages/admin/AdminAuditPage";
import AdminAlertsPage from "./pages/admin/AdminAlertsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading session...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Verifying permissions...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/venues" element={<VenuesPage />} />
                <Route path="/venues/:id" element={<VenueDetailPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/players" element={<PlayersPage />} />

                {/* User Protected Routes */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/booking-confirmed/:id"
                  element={
                    <ProtectedRoute>
                      <BookingConfirmedPage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Protected Routes */}
                <Route
                  path="/admin/users"
                  element={
                    <AdminRoute>
                      <AdminUsersPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/audit"
                  element={
                    <AdminRoute>
                      <AdminAuditPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/alerts"
                  element={
                    <AdminRoute>
                      <AdminAlertsPage />
                    </AdminRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
