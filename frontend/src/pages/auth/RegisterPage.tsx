import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link } from 'react-router-dom'
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
import { registerSchema, type RegisterFormValues } from '@/lib/zod-schemas'
import { authApi, type AuthApiError } from '@/api/auth.api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      dni: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await authApi.register({
        dni: data.dni,
        email: data.email,
        password: data.password,
      })

      toast({
        title: 'Account created',
        description: 'Please check your email for the verification code.',
      })

      // Pass email via query param so VerifyEmailPage can pre-fill the field
      navigate(`/auth/verify-email?email=${encodeURIComponent(data.email)}`)
    } catch (error) {
      let message = 'An error occurred during registration. Please try again.'

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as AuthApiError | undefined
        if (body?.error?.message) {
          message = body.error.message
        } else if (error.response?.status === 400) {
          message = 'Invalid data. Please check all fields and try again.'
        } else if (error.response?.status === 404) {
          message = 'The DNI entered was not found in our records.'
        } else if (error.response?.status === 409) {
          message = 'An account with this email already exists.'
        }
      }

      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: message,
      })
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full max-w-4xl">
        {/* Left: Brand panel */}
        <AuthBrandPanel />

        {/* Right: Registration form */}
        <div className="flex justify-center lg:justify-start">
          <div className="w-full max-w-md">
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Create your account
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Fill in your details to register. Your DNI must match our records.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
                    {/* DNI */}
                    <FormField
                      control={form.control}
                      name="dni"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>DNI</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="12345678"
                              inputMode="numeric"
                              maxLength={8}
                              autoComplete="off"
                              className="border-slate-200 placeholder:text-slate-400"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Use your DNI to validate your membership (7–8 digits)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email address</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              autoComplete="email"
                              className="border-slate-200 placeholder:text-slate-400"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            We will send you a verification code to this address
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="border-slate-200 placeholder:text-slate-400"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum 8 characters — uppercase, lowercase, number and special character
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Confirm password */}
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="border-slate-200 placeholder:text-slate-400"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Re-enter your password to confirm
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
                          Creating account...
                        </>
                      ) : (
                        'Create account'
                      )}
                    </Button>
                  </form>
                </Form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  Already have an account?{' '}
                  <Link
                    to="/auth/login"
                    className="font-medium text-slate-900 underline underline-offset-4 hover:text-slate-700"
                  >
                    Sign in
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
