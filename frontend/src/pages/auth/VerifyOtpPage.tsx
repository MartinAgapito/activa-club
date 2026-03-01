import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
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
import { verifyOtpSchema, type VerifyOtpFormValues } from '@/lib/zod-schemas'
import { authApi, type AuthApiError } from '@/api/auth.api'
import { useAuthStore } from '@/store'

interface LocationState {
  email?: string
  session?: string
  challengeName?: string
}

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { setTokens } = useAuthStore()

  const state = (location.state as LocationState | null) ?? {}
  const { email = '', session = '' } = state

  const form = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { otp: '' },
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (data: VerifyOtpFormValues) => {
    if (!email || !session) {
      toast({
        variant: 'destructive',
        title: 'Sesión inválida',
        description: 'La sesión expiró. Por favor inicia sesión de nuevo.',
      })
      navigate('/auth/login')
      return
    }

    try {
      const response = await authApi.verifyOtp({
        email,
        session,
        otp: data.otp,
      })

      const { idToken } = response.data.data

      // Persist tokens and decode user from idToken
      setTokens(idToken)

      navigate('/member/dashboard', { replace: true })
    } catch (error) {
      let message = 'Ocurrió un error al verificar el código. Intenta de nuevo.'

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as AuthApiError | undefined
        if (body?.error?.message) {
          message = body.error.message
        } else if (error.response?.status === 400) {
          message = 'El código OTP ingresado es incorrecto.'
        } else if (error.response?.status === 410) {
          message = 'La sesión ha expirado (3 minutos). Por favor inicia sesión de nuevo.'
        } else if (error.response?.status === 429) {
          message = 'Demasiados intentos incorrectos. Inicia sesión de nuevo.'
        }
      }

      toast({
        variant: 'destructive',
        title: 'Verificación fallida',
        description: message,
      })

      // On session expiry or too many attempts, redirect to login
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 410 || error.response?.status === 429)
      ) {
        navigate('/auth/login')
      }
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full max-w-4xl">
        {/* ── Left: Brand panel ── */}
        <AuthBrandPanel />

        {/* ── Right: Verify OTP form ── */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <ShieldCheck className="h-6 w-6 text-slate-700" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Verificación de seguridad
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Enviamos un código de acceso a{' '}
                  <span className="font-medium text-slate-700">{email || 'tu email'}</span>
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
                  {/* OTP code */}
                  <FormField
                    control={form.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de acceso</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123456"
                            inputMode="numeric"
                            maxLength={6}
                            autoComplete="one-time-code"
                            className="text-center text-xl tracking-widest font-mono h-12"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Ingresa el código de 6 dígitos. Válido por 3 minutos.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-slate-950 hover:bg-slate-800 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      'Ingresar'
                    )}
                  </Button>
                </form>
              </Form>

              <p className="mt-6 text-center text-sm text-slate-500">
                ¿Código no recibido?{' '}
                <Link
                  to="/auth/login"
                  className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                >
                  Volver e intentar de nuevo
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
