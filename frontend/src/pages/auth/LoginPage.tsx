import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import axios from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await authApi.login({ email: data.email, password: data.password })
      const { session, challengeName } = response.data.data

      // Navigate to OTP verification step, carrying session + email
      navigate('/auth/verify-otp', {
        state: { email: data.email, session, challengeName },
      })
    } catch (error) {
      let message = 'Ocurrió un error al iniciar sesión. Intenta de nuevo.'

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as AuthApiError | undefined
        if (body?.error?.message) {
          message = body.error.message
        } else if (error.response?.status === 401) {
          message = 'Email o contraseña incorrectos.'
        } else if (error.response?.status === 403) {
          message = 'Tu cuenta no está confirmada o está deshabilitada.'
        } else if (error.response?.status === 429) {
          message = 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
        }
      }

      toast({
        variant: 'destructive',
        title: 'Inicio de sesión fallido',
        description: message,
      })
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full max-w-4xl">
        {/* ── Left: Brand panel ── */}
        <AuthBrandPanel />

        {/* ── Right: Login form ── */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-md">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-slate-900">
                Iniciar sesión
              </CardTitle>
              <CardDescription className="text-slate-500">
                Ingresa tus credenciales para acceder a tu cuenta
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="tu@email.com"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Tu dirección de correo electrónico registrada
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
                          <Input
                            type="password"
                            placeholder="••••••••"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Tu contraseña de acceso a Activa Club
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
                        Verificando...
                      </>
                    ) : (
                      'Continuar'
                    )}
                  </Button>
                </form>
              </Form>

              <p className="mt-6 text-center text-sm text-slate-500">
                ¿No tienes cuenta?{' '}
                <Link
                  to="/auth/register"
                  className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                >
                  Regístrate
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
