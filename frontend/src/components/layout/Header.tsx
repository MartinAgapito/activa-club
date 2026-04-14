import { LogOut, Menu, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store'
import { useToast } from '@/hooks/useToast'

export function Header() {
  const { user, signOut } = useAuth()
  const { toggleSidebar } = useUIStore()
  const { toast } = useToast()
  const navigate = useNavigate()

  const userInitials = user
    ? `${user.username.charAt(0).toUpperCase()}`
    : 'U'

  const handleSignOut = async () => {
    try {
      await signOut()
      // Navigate via React Router (no full page reload) so the store's
      // in-memory state (isAuthenticated: false) is already correct when
      // LoginPage mounts — avoids the sessionStorage hydration race condition.
      navigate('/auth/login', { replace: true })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error al cerrar sesión',
        description: 'No se pudo conectar con el servidor. Intentá de nuevo.',
      })
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background px-4 shadow-sm md:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Alternar barra lateral"
        className="mr-4"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex flex-1 items-center">
        <span className="text-xl font-bold text-primary">ActivaClub</span>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <span className="hidden text-sm text-muted-foreground md:inline-block">
            {user.email}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menú de usuario" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.username ?? 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email ?? ''}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
