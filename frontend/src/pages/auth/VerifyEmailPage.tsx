import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Loader2, Mail, RefreshCw } from 'lucide-react'
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
import { verifyEmailSchema, type VerifyEmailFormValues } from '@/lib/zod-schemas'
import { authApi, type AuthApiError } from '@/api/auth.api'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [isResending, setIsResending] = useState(false)

  // Email is passed via navigation state from RegisterPage
  const email = (location.state as { email?: string } | null)?.email ?? ''

  const form = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: '' },
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (data: VerifyEmailFormValues) => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se encontró el email. Por favor regístrate de nuevo.',
      })
      navigate('/auth/register')
      return
    }

    try {
      await authApi.verifyEmail({ email, code: data.code })

      toast({
        title: '¡Cuenta activada!',
        description: 'Tu cuenta está lista. Ahora puedes iniciar sesión.',
      })

      navigate('/auth/login')
    } catch (error) {
      let message = 'Ocurrió un error al verificar tu código. Intenta de nuevo.'

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as AuthApiError | undefined
        if (body?.error?.message) {
          message = body.error.message
        } else if (error.response?.status === 400) {
          message = 'El código ingresado es incorrecto.'
        } else if (error.response?.status === 410) {
          message = 'El código ha expirado. Solicita uno nuevo.'
        } else if (error.response?.status === 429) {
          message = 'Demasiados intentos. Espera un momento e intenta de nuevo.'
        }
      }

      toast({
        variant: 'destructive',
        title: 'Verificación fallida',
        description: message,
      })
    }
  }

  const handleResend = async () => {
    if (!email || isResending) return
    setIsResending(true)
    try {
      await authApi.resendCode({ email })
      toast({
        title: 'Código reenviado',
        description: `Enviamos un nuevo código a ${email}.`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No pudimos reenviar el código. Intenta de nuevo.',
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full max-w-4xl">
        {/* ── Left: Brand panel ── */}
        <AuthBrandPanel />

        {/* ── Right: Verify email form ── */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <Mail className="h-6 w-6 text-slate-700" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Verifica tu email
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Enviamos un código de 6 dígitos a{' '}
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
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de verificación</FormLabel>
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
                          Ingresa el código de 6 dígitos enviado a tu email
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
                      'Verificar cuenta'
                    )}
                  </Button>
                </form>
              </Form>

              {/* Resend code */}
              <div className="mt-4 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-slate-900"
                  onClick={handleResend}
                  disabled={isResending}
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Reenviando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Reenviar código
                    </>
                  )}
                </Button>
              </div>

              <p className="mt-4 text-center text-sm text-slate-500">
                <Link
                  to="/auth/login"
                  className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                >
                  Volver al inicio de sesión
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
