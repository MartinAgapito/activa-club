import { z } from 'zod'

// ─── Registration schema ─────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    dni: z
      .string()
      .min(7, 'El DNI debe tener al menos 7 dígitos')
      .max(8, 'El DNI no debe exceder 8 dígitos')
      .regex(/^\d+$/, 'El DNI solo debe contener números'),
    email: z
      .string()
      .min(1, 'El email es requerido')
      .email('Ingresa una dirección de email válida'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(128, 'La contraseña no debe exceder 128 caracteres')
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
        'Debe contener mayúscula, minúscula, número y carácter especial'
      ),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

// ─── Verify email OTP schema ─────────────────────────────────────────────────

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .length(6, 'El código debe tener exactamente 6 dígitos')
    .regex(/^\d+$/, 'El código solo debe contener números'),
})

export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>

// ─── Verify OTP (login step 2) schema ────────────────────────────────────────

export const verifyOtpSchema = z.object({
  otp: z
    .string()
    .length(6, 'El código debe tener exactamente 6 dígitos')
    .regex(/^\d+$/, 'El código solo debe contener números'),
})

export type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>

// ─── Auth schemas ─────────────────────────────────────────────────────────────

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

export const dniVerificationSchema = z.object({
  dni: z
    .string()
    .min(7, 'DNI must be at least 7 characters')
    .max(8, 'DNI must not exceed 8 characters')
    .regex(/^\d+$/, 'DNI must contain only numbers'),
})

export type DniVerificationFormValues = z.infer<typeof dniVerificationSchema>

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

// Reservation schemas
export const reservationSchema = z.object({
  areaId: z.string().min(1, 'Please select an area'),
  date: z.string().min(1, 'Please select a date'),
  startTime: z.string().min(1, 'Please select a start time'),
  endTime: z.string().min(1, 'Please select an end time'),
  guestCount: z.number().min(0).max(10, 'Maximum 10 guests allowed'),
})

export type ReservationFormValues = z.infer<typeof reservationSchema>

// Member profile schema
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
