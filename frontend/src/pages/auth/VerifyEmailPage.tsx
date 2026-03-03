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
        title: 'Missing email',
        description: 'Email address is missing. Please go back to registration.',
      })
      navigate('/auth/register')
      return
    }

    try {
      await authApi.verifyEmail({ email, code: data.code })

      toast({
        title: 'Email verified',
        description: 'Your account is ready. You can now sign in.',
      })

      navigate('/auth/login')
    } catch (error) {
      let message = 'An error occurred. Please try again.'

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as AuthApiError | undefined
        if (body?.error?.message) {
          message = body.error.message
        } else if (error.response?.status === 400) {
          message = 'The verification code is incorrect or has expired.'
        } else if (error.response?.status === 410) {
          message = 'The code has expired. Please request a new one.'
        }
      }

      toast({
        variant: 'destructive',
        title: 'Verification failed',
        description: message,
      })
    }
  }

  const handleResend = async () => {
    if (!email) return

    try {
      await authApi.resendCode({ email })
      toast({
        title: 'Code resent',
        description: 'A new verification code has been sent to your email.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Could not resend code',
        description: 'Please try again in a few moments.',
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
                    Verify your email
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    We sent a 6-digit code to{' '}
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
                          <FormLabel>Verification code</FormLabel>
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
                            Check your email inbox — the code is valid for 24 hours
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
                          Verifying...
                        </>
                      ) : (
                        'Verify email'
                      )}
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 space-y-2 text-center text-sm text-slate-500">
                  <p>
                    Didn&apos;t receive a code?{' '}
                    <button
                      type="button"
                      onClick={handleResend}
                      className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                    >
                      Resend code
                    </button>
                  </p>
                  <p>
                    <Link
                      to="/auth/register"
                      className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                    >
                      Back to registration
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
