import { lazy, Suspense } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { useAuthStore } from '@/store'
import type { UserRole } from '@/types'

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage'))
const MemberDashboardPage = lazy(() => import('@/pages/member/DashboardPage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/DashboardPage'))
const NotFoundPage = lazy(() => import('@/pages/shared/NotFoundPage'))
const ProtectedLayout = lazy(() => import('@/components/layout/ProtectedLayout'))

// Loading fallback
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

// ProtectedRoute component
interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/auth/login?reason=forbidden" replace />
  }

  return <Outlet />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/auth/login" replace />,
  },
  {
    path: '/auth',
    element: (
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    ),
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'callback',
        element: <AuthCallbackPage />,
      },
    ],
  },
  {
    path: '/member',
    element: (
      <Suspense fallback={<PageLoader />}>
        <ProtectedRoute allowedRoles={['Member', 'Admin', 'Manager']} />
      </Suspense>
    ),
    children: [
      {
        element: <ProtectedLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="dashboard" replace />,
          },
          {
            path: 'dashboard',
            element: <MemberDashboardPage />,
          },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<PageLoader />}>
        <ProtectedRoute allowedRoles={['Admin', 'Manager']} />
      </Suspense>
    ),
    children: [
      {
        element: <ProtectedLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="dashboard" replace />,
          },
          {
            path: 'dashboard',
            element: <AdminDashboardPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<PageLoader />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
])
