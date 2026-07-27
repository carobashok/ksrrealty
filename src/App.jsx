import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import PlotInventory from './pages/PlotInventory'
import Customers from './pages/Customers'
import Bookings from './pages/Bookings'
import BookingDetail from './pages/BookingDetail'
import NewBooking from './pages/NewBooking'
import Payments from './pages/Payments'
import Employees from './pages/Employees'
import QuotationView from './pages/QuotationView'
import ReceiptView from './pages/ReceiptView'
import Settings from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,      // 1 minute
      retry: 1,
    },
  },
})

function ProtectedRoute({ children }) {
  const { session } = useAuth()
  const location = useLocation()

  if (session === undefined) {
    // Still checking whether a session exists — avoid a flash redirect to /login
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>
  }
  if (session === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"                  element={<Dashboard />} />
              <Route path="projects"                   element={<Projects />} />
              <Route path="projects/:projectId"        element={<ProjectDetail />} />
              <Route path="projects/:projectId/inventory" element={<PlotInventory />} />
              <Route path="customers"                  element={<Customers />} />
              <Route path="bookings"                   element={<Bookings />} />
              <Route path="bookings/new"               element={<NewBooking />} />
              <Route path="bookings/:bookingId"        element={<BookingDetail />} />
              <Route path="bookings/:bookingId/quotation" element={<QuotationView />} />
              <Route path="bookings/:bookingId/payments/:paymentId/receipt" element={<ReceiptView />} />
              <Route path="payments"                   element={<Payments />} />
              <Route path="employees"                  element={<Employees />} />
              <Route path="settings"                   element={<Settings />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
