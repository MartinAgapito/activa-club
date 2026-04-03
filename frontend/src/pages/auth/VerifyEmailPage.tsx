import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Loader2, MailCheck } from 'lucide-react'
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
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const email = searchParams.get('email') ?? ''

  const form = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: '' },
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (data: VerifyEmailFormValues) => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email faltante',
        description: 'Falta el email. Volvé al registro.',
      })
      navigate('/auth/register')
      return
    }

    try {
      await authApi.verifyEmail({ email, code: data.code })

      toast({
        title: 'Email verificado',
        description: 'Tu cuenta está lista. Ya podés iniciar sesión.',
      })

      navigate('/auth/login')
    } catch (error) {
      let message = 'Ocurrió un error. Intentá de nuevo.'

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as AuthApiError | undefined
        if (body?.error?.message) {
          message = body.error.message
        } else if (error.response?.status === 400) {
          message = 'El código de verificación es incorrecto o expiró.'
        } else if (error.response?.status === 410) {
          message = 'El código expiró. Solicitá uno nuevo.'
        }
      }

      toast({
        variant: 'destructive',
        title: 'Error en la verificación',
        description: message,
      })
    }
  }

  const handleResend = async () => {
    if (!email) return

    try {
      await authApi.resendCode({ email })
      toast({
        title: 'Código reenviado',
        description: 'Se envió un nuevo código de verificación a tu email.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'No se pudo reenviar el código',
        description: 'Intentá de nuevo en unos momentos.',
      })
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full max-w-4xl">
        {/* Left: Brand panel */}
        <AuthBrandPanel />

        {/* Right: Verify email form */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="space-y-3 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <MailCheck className="h-6 w-6 text-slate-700" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    Verificá tu email
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Enviamos un código de 6 dígitos a{' '}
                    <span className="font-medium text-slate-700">{email || 'your email'}</span>
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
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
                              className="text-center text-xl tracking-widest font-mono h-12 border-slate-200 placeholder:text-slate-300"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Revisá tu bandeja de entrada — el código es válido por 24 horas
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
                        'Verificar email'
                      )}
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 space-y-2 text-center text-sm text-slate-500">
                  <p>
                    ¿No recibiste el código?{' '}
                    <button
                      type="button"
                      onClick={handleResend}
                      className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                    >
                      Reenviar código
                    </button>
                  </p>
                  <p>
                    <Link
                      to="/auth/register"
                      className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                    >
                      Volver al registro
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
