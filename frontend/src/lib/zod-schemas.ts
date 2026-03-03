import { z } from 'zod'

// ─── Registration schema ──────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    dni: z
      .string()
      .min(7, 'DNI must be at least 7 digits')
      .max(8, 'DNI must not exceed 8 digits')
      .regex(/^\d+$/, 'DNI must contain only numbers'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

// ─── Verify email OTP schema (post-registration) ──────────────────────────────

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d+$/, 'Code must contain only numbers'),
})

export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>

// ─── Verify OTP schema (login step 2 — CUSTOM_AUTH) ──────────────────────────

export const verifyOtpSchema = z.object({
  otp: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d+$/, 'Code must contain only numbers'),
})

export type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>

// ─── Login schema ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

// ─── DNI verification schema ──────────────────────────────────────────────────

export const dniVerificationSchema = z.object({
  dni: z
    .string()
    .min(7, 'DNI must be at least 7 characters')
    .max(8, 'DNI must not exceed 8 characters')
    .regex(/^\d+$/, 'DNI must contain only numbers'),
})

export type DniVerificationFormValues = z.infer<typeof dniVerificationSchema>

// ─── Change password schema ───────────────────────────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

// ─── Reservation schema ───────────────────────────────────────────────────────

export const reservationSchema = z.object({
  areaId: z.string().min(1, 'Please select an area'),
  date: z.string().min(1, 'Please select a date'),
  startTime: z.string().min(1, 'Please select a start time'),
  endTime: z.string().min(1, 'Please select an end time'),
  guestCount: z.number().min(0).max(10, 'Maximum 10 guests allowed'),
})

export type ReservationFormValues = z.infer<typeof reservationSchema>

// ─── Member profile schema ────────────────────────────────────────────────────

export const memberProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Please enter a valid email address'),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\+?[\d\s\-()]{7,20}$/.test(val),
      'Please enter a valid phone number'
    ),
})

export type MemberProfileFormValues = z.infer<typeof memberProfileSchema>
