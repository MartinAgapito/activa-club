import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import axios from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { useToast } from '@/hooks/useToast'
import { loginSchema, type LoginFormValues } from '@/lib/zod-schemas'
import { authApi, type AuthApiError } from '@/api/auth.api'
import { useAuthStore } from '@/store'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { isAuthenticated } = useAuthStore()

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    '/member/dashboard'

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const { isSubmitting } = form.formState

  const REFRESH_TOKEN_STORAGE_KEY = 'activa-club-refresh-token'

  // AC-010: show spinner only if there is a stored refresh token AND the user
  // did not just explicitly log out (flag in sessionStorage, cleared on browser close).
  const [isSilentRefreshing, setIsSilentRefreshing] = useState<boolean>(() => {
    if (sessionStorage.getItem('activa-club-logged-out')) return false
    return !!localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  })

  // AC-010: on mount, try silent re-authentication via stored refresh token
  useEffect(() => {
    // User just logged out — show the form and clear the flag so the next
    // navigation (or fresh browser session) behaves normally.
    if (sessionStorage.getItem('activa-club-logged-out')) {
      sessionStorage.removeItem('activa-club-logged-out')
      setIsSilentRefreshing(false)
      return
    }

    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    if (!storedRefreshToken || isAuthenticated) {
      setIsSilentRefreshing(false)
      return
    }

    authApi
      .refreshToken(storedRefreshToken)
      .then((response) => {
        const { idToken, accessToken } = response.data.data
        const { setTokens } = useAuthStore.getState()
        setTokens(idToken, accessToken)
        const { user } = useAuthStore.getState()
        const destination =
          user?.role === 'Admin' || user?.role === 'Manager'
            ? '/admin/dashboard'
            : '/member/dashboard'
        navigate(destination, { replace: true })
      })
      .catch(() => {
        // Refresh token expired or revoked — clear it and show the login form
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
        setIsSilentRefreshing(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (data: LoginFormValues) => {
    // AC-010: if this device has a stored refresh token, use it instead of the
    // normal email+password → OTP flow. This is the "remember device" mechanism:
    // the user proves they have previously authenticated on this device, so no
    // OTP challenge is needed. If the refresh fails (expired/revoked), fall
    // through to the normal login flow which will require OTP.
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    if (storedRefreshToken) {
      try {
        const refreshResponse = await authApi.refreshToken(storedRefreshToken)
        const { idToken, accessToken } = refreshResponse.data.data
        const { setTokens } = useAuthStore.getState()
        setTokens(idToken, accessToken)
        const { user } = useAuthStore.getState()
        const destination =
          user?.role === 'Admin' || user?.role === 'Manager'
            ? '/admin/dashboard'
            : '/member/dashboard'
        navigate(destination, { replace: true })
        return
      } catch {
        // Token expired or revoked — remove it and continue with normal login
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
      }
    }

    try {
      const response = await authApi.login({
        email: data.email,
        password: data.password,
      })
      const { session, challengeName } = response.data.data

      navigate('/auth/verify-otp', {
        state: { email: data.email, session, challengeName },
      })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const body = error.response?.data as AuthApiError | undefined
        const code = body?.error?.code ?? body?.error

        if (code === 'ACCOUNT_NOT_CONFIRMED') {
          navigate(`/auth/verify-email?email=${encodeURIComponent(data.email)}`)
          return
        }

        let message = 'Ocurrió un error al iniciar sesión. Intentá de nuevo.'
        if (body?.error?.message) {
          message = body.error.message
        } else if (error.response?.status === 401) {
          message = 'Email o contraseña incorrectos.'
        } else if (error.response?.status === 403) {
          message = 'Tu cuenta fue deshabilitada. Contactá al administrador del club.'
        } else if (error.response?.status === 429) {
          message = 'Demasiados intentos. Esperá un momento e intentá de nuevo.'
        }

        toast({
          variant: 'destructive',
          title: 'Error al iniciar sesión',
          description: message,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al iniciar sesión',
          description: 'Ocurrió un error al iniciar sesión. Intentá de nuevo.',
        })
      }
    }
  }

  // AC-010: show a spinner while the silent refresh is in progress
  if (isSilentRefreshing) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full max-w-4xl">
        {/* Left: Brand panel */}
        <AuthBrandPanel />

        {/* Right: Login form */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-md">
            {/* Mobile-only brand header — AuthBrandPanel is hidden below lg */}
            <div className="lg:hidden text-center mb-10">
              <h1 className="text-3xl font-bold text-slate-900">Activa Club</h1>
              <p className="text-slate-500 text-sm mt-1">Tu club deportivo de confianza</p>
            </div>
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Iniciar sesión
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Ingresá tus credenciales para acceder a tu cuenta
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
                    {/* Email */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Correo electrónico</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="vos@ejemplo.com"
                              autoComplete="email"
                              className="border-slate-200 placeholder:text-slate-400"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Te enviaremos un código de verificación a esta dirección
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Password */}
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contraseña</FormLabel>
                          <FormControl>
                            <PasswordInput
                              placeholder="••••••••"
                              autoComplete="current-password"
                              className="border-slate-200 placeholder:text-slate-400"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Mínimo 8 caracteres
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full bg-slate-950 hover:bg-slate-800 text-white mt-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Iniciando sesión...
                        </>
                      ) : (
                        'Continuar'
                      )}
                    </Button>
                  </form>
                </Form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  ¿No tenés cuenta?{' '}
                  <Link
                    to="/auth/register"
                    className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                  >
                    Registrate
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
