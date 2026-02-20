import { z } from 'zod'

// Auth schemas
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
