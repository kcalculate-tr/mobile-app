import React, { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BranchProvider, useBranch } from './context/BranchContext'
import { Loader2 } from 'lucide-react'

const BranchLogin  = React.lazy(() => import('./pages/BranchLogin'))
const BranchLayout = React.lazy(() => import('./pages/BranchLayout'))
const KitchenScreen = React.lazy(() => import('./pages/KitchenScreen'))
const StockScreen       = React.lazy(() => import('./pages/StockScreen'))
const ScheduledScreen = React.lazy(() => import('./pages/ScheduledScreen'))

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111]">
      <Loader2 size={32} className="animate-spin text-[#98CD00]" />
    </div>
  )
}

function BranchGuard({ children }: { children: React.ReactNode }) {
  const { branch, loading } = useBranch()
  if (loading) return <Spinner />
  if (!branch) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { branch, loading } = useBranch()

  if (loading) return <Spinner />

  return (
    <Routes>
      <Route path="/login" element={<BranchLogin />} />

      <Route
        path="/dashboard"
        element={
          <BranchGuard>
            <BranchLayout />
          </BranchGuard>
        }
      >
        <Route index element={<Navigate to="kitchen" replace />} />
        <Route path="kitchen"   element={<KitchenScreen />} />
        <Route path="scheduled" element={<ScheduledScreen />} />
        <Route path="stock"     element={<StockScreen />} />
      </Route>

      <Route path="/" element={<Navigate to={branch ? '/dashboard/kitchen' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={branch ? '/dashboard/kitchen' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BranchProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
    </BranchProvider>
  )
}
