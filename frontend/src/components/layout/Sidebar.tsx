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

export function Sidebar() {
  const { user } = useAuthStore()
  const { sidebarOpen } = useUIStore()

  if (!sidebarOpen) return null

  const userRole = user?.role ?? 'Member'

  const visibleMemberItems = memberNavItems.filter((item) => item.roles.includes(userRole))
  const visibleAdminItems = adminNavItems.filter((item) => item.roles.includes(userRole))
  const showAdminSection = ['Admin', 'Manager'].includes(userRole)

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <Activity className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-primary">ActivaClub</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
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
    </aside>
  )
}
