import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Tag,
  Users,
  Settings,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore, useUIStore } from '@/store'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: UserRole[]
}

const memberNavItems: NavItem[] = [
  {
    label: 'Panel principal',
    href: '/member/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['Member', 'Admin', 'Manager'],
  },
  {
    label: 'Reservas',
    href: '/member/reservations',
    icon: <CalendarDays className="h-5 w-5" />,
    roles: ['Member', 'Admin', 'Manager'],
  },
  {
    label: 'Promociones',
    href: '/member/promotions',
    icon: <Tag className="h-5 w-5" />,
    roles: ['Member', 'Admin', 'Manager'],
  },
]

const adminNavItems: NavItem[] = [
  {
    label: 'Panel de administración',
    href: '/admin/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['Admin', 'Manager'],
  },
  {
    label: 'Socios',
    href: '/admin/members',
    icon: <Users className="h-5 w-5" />,
    roles: ['Admin', 'Manager'],
  },
  {
    label: 'Reservas',
    href: '/admin/reservations',
    icon: <CalendarDays className="h-5 w-5" />,
    roles: ['Admin', 'Manager'],
  },
  {
    label: 'Promociones',
    href: '/admin/promotions',
    icon: <Tag className="h-5 w-5" />,
    roles: ['Admin', 'Manager'],
  },
  {
    label: 'Configuración',
    href: '/admin/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['Admin'],
  },
]

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  )
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user } = useAuthStore()
  const userRole = user?.role ?? 'Member'
  const visibleMemberItems = memberNavItems.filter((item) => item.roles.includes(userRole))
  const visibleAdminItems = adminNavItems.filter((item) => item.roles.includes(userRole))
  const showAdminSection = ['Admin', 'Manager'].includes(userRole)

  return (
    <>
      <div className="flex h-16 items-center border-b px-6">
        <Activity className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-primary">ActivaClub</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4" onClick={onClose}>
        {visibleMemberItems.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Socio
            </p>
            {visibleMemberItems.map((item) => (
              <NavItemLink key={item.href} item={item} />
            ))}
          </div>
        )}

        {showAdminSection && visibleAdminItems.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Administración
            </p>
            {visibleAdminItems.map((item) => (
              <NavItemLink key={item.href} item={item} />
            ))}
          </div>
        )}
      </nav>
    </>
  )
}

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  return (
    <>
      {/* Desktop sidebar — always mounted, visibility controlled by sidebarOpen */}
      {sidebarOpen && (
        <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
          <SidebarContent />
        </aside>
      )}

      {/* Mobile drawer — full-screen overlay below md */}
      {sidebarOpen && (
        <div className="md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r bg-background shadow-lg">
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
