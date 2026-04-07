import { useEffect } from 'react'
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

  const DEVICE_KEY_STORAGE_KEY = 'activa-club-device-key'
  const DEVICE_GROUP_KEY_STORAGE_KEY = 'activa-club-device-group-key'
  const DEVICE_PASSWORD_STORAGE_KEY = 'activa-club-device-password'

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const storedDeviceKey = localStorage.getItem(DEVICE_KEY_STORAGE_KEY)
      const storedDeviceGroupKey = localStorage.getItem(DEVICE_GROUP_KEY_STORAGE_KEY)
      const storedDevicePassword = localStorage.getItem(DEVICE_PASSWORD_STORAGE_KEY)

      const response = await authApi.login({
        email: data.email,
        password: data.password,
        deviceKey: storedDeviceKey ?? null,
        deviceGroupKey: storedDeviceGroupKey ?? null,
        devicePassword: storedDevicePassword ?? null,
      })
      const { session, challengeName, idToken } = response.data.data

      // AC-010: device challenge passed — tokens returned directly, skip OTP screen
      if ((!challengeName || challengeName === null) && idToken) {
        const { setTokens } = useAuthStore.getState()
        setTokens(idToken)
        const { user } = useAuthStore.getState()
        const destination =
          user?.role === 'Admin' || user?.role === 'Manager'
            ? '/admin/dashboard'
            : '/member/dashboard'
        navigate(destination, { replace: true })
        return
      }

      // Navigate to OTP verification step, carrying session + email
      navigate('/auth/verify-otp', {
        state: { email: data.email, session, challengeName },
      })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const body = error.response?.data as AuthApiError | undefined
        // The shared Lambda filter returns error as a string; the members filter
        // returns it as an object with a code property. Handle both shapes.
        const code = body?.error?.code ?? body?.error

        // Account exists but email not verified → send user to verify-email page
        if (code === 'ACCOUNT_NOT_CONFIRMED') {
          navigate(`/auth/verify-email?email=${encodeURIComponent(data.email)}`)
          return
        }

        // Device credentials are stale — clear them and retry without device key
        if (code === 'DEVICE_AUTH_FAILED') {
          localStorage.removeItem(DEVICE_KEY_STORAGE_KEY)
          localStorage.removeItem(DEVICE_GROUP_KEY_STORAGE_KEY)
          localStorage.removeItem(DEVICE_PASSWORD_STORAGE_KEY)
          try {
            const retryResponse = await authApi.login({
              email: data.email,
              password: data.password,
              deviceKey: null,
              deviceGroupKey: null,
              devicePassword: null,
            })
            const { session, challengeName } = retryResponse.data.data
            navigate('/auth/verify-otp', {
              state: { email: data.email, session, challengeName },
            })
          } catch {
            // Retry also failed — fall through to generic error
          }
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full max-w-4xl">
        {/* Left: Brand panel */}
        <AuthBrandPanel />

        {/* Right: Login form */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-md">
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
