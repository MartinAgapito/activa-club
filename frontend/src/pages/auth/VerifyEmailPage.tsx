import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Loader2, MailCheck, CheckCircle2, XCircle } from 'lucide-react'
import axios from 'axios'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { useToast } from '@/hooks/useToast'
import { authApi, type AuthApiError } from '@/api/auth.api'

type PageState = 'confirming' | 'success' | 'error' | 'waiting'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const email = searchParams.get('email') ?? ''
  const token = searchParams.get('token') ?? ''

  const [pageState, setPageState] = useState<PageState>(token ? 'confirming' : 'waiting')
  const [errorMessage, setErrorMessage] = useState('')
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    if (!token) return

    const confirm = async () => {
      try {
        await authApi.verifyEmail({ email, token })
        setPageState('success')
      } catch (error) {
        let message = 'Ocurrió un error al verificar tu cuenta. Intentá de nuevo.'

        if (axios.isAxiosError(error)) {
          const body = error.response?.data as AuthApiError | undefined
          if (body?.error?.message) {
            message = body.error.message
          } else if (error.response?.status === 400) {
            message = 'El link de verificación es inválido o ya fue utilizado.'
          } else if (error.response?.status === 410) {
            message = 'El link de verificación expiró. Solicitá uno nuevo.'
          } else if (error.response?.status === 429) {
            message = 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
          }
        }

        setErrorMessage(message)
        setPageState('error')
      }
    }

    confirm()
  }, [email, token])

  const handleResend = async () => {
    if (!email) return
    setIsResending(true)
    try {
      await authApi.resendCode({ email })
      toast({
        title: 'Link reenviado',
        description: 'Revisá tu bandeja de entrada y hacé clic en el nuevo link.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'No se pudo reenviar',
        description: 'Intentá de nuevo en unos momentos.',
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full max-w-4xl">
        <AuthBrandPanel />

        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
            <Card className="border-slate-200 shadow-sm bg-white">

              {/* Estado: confirmando */}
              {pageState === 'confirming' && (
                <>
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                      <Loader2 className="h-6 w-6 text-slate-700 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-bold text-slate-900">
                        Verificando tu cuenta...
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Esto tomará solo un momento.
                      </CardDescription>
                    </div>
                  </CardHeader>
                </>
              )}

              {/* Estado: éxito */}
              {pageState === 'success' && (
                <>
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-bold text-slate-900">
                        ¡Cuenta verificada!
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Tu cuenta está lista. Ya podés iniciar sesión.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-slate-950 hover:bg-slate-800 text-white"
                      onClick={() => navigate('/auth/login')}
                    >
                      Ir al inicio de sesión
                    </Button>
                  </CardContent>
                </>
              )}

              {/* Estado: error */}
              {pageState === 'error' && (
                <>
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                      <XCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-bold text-slate-900">
                        Link inválido
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        {errorMessage}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      className="w-full bg-slate-950 hover:bg-slate-800 text-white"
                      onClick={handleResend}
                      disabled={isResending || !email}
                    >
                      {isResending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reenviando...</>
                      ) : (
                        'Reenviar link de verificación'
                      )}
                    </Button>
                    <p className="text-center text-sm text-slate-500">
                      <Link to="/auth/register" className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700">
                        Volver al registro
                      </Link>
                    </p>
                  </CardContent>
                </>
              )}

              {/* Estado: esperando (no hay token en URL) */}
              {pageState === 'waiting' && (
                <>
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                      <MailCheck className="h-6 w-6 text-slate-700" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-bold text-slate-900">
                        Revisá tu email
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Enviamos un link de verificación a{' '}
                        <span className="font-medium text-slate-700">{email || 'tu email'}</span>.
                        Hacé clic en el link para activar tu cuenta.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-500 text-center">
                      El link vence en <strong>24 horas</strong>.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleResend}
                      disabled={isResending || !email}
                    >
                      {isResending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reenviando...</>
                      ) : (
                        '¿No recibiste el link? Reenviar'
                      )}
                    </Button>
                    <p className="text-center text-sm text-slate-500">
                      ¿Ya verificaste tu cuenta?{' '}
                      <Link to="/auth/login" className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700">
                        Iniciá sesión
                      </Link>
                    </p>
                    <p className="text-center text-sm text-slate-500">
                      <Link to="/auth/register" className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700">
                        Volver al registro
                      </Link>
                    </p>
                  </CardContent>
                </>
              )}

            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
