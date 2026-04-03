import { z } from 'zod'

// ─── Registration schema ──────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    dni: z
      .string()
      .min(7, 'El DNI debe tener al menos 7 dígitos')
      .max(8, 'El DNI no debe superar 8 dígitos')
      .regex(/^\d+$/, 'El DNI solo debe contener números'),
    email: z
      .string()
      .min(1, 'El email es obligatorio')
      .email('Ingresá un email válido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(128, 'La contraseña no debe superar 128 caracteres')
      .regex(
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
        'La contraseña debe tener al menos una mayúscula, una minúscula, un número y un carácter especial'
      ),
    confirmPassword: z.string().min(1, 'Confirmá tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

// ─── Verify OTP schema (login step 2 — CUSTOM_AUTH) ──────────────────────────

export const verifyOtpSchema = z.object({
  otp: z
    .string()
    .length(6, 'El código debe tener exactamente 6 dígitos')
    .regex(/^\d+$/, 'El código solo debe contener números'),
})

export type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>

// ─── Login schema ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es obligatorio')
    .email('Ingresá un email válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no debe superar 128 caracteres'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

// ─── DNI verification schema ──────────────────────────────────────────────────

export const dniVerificationSchema = z.object({
  dni: z
    .string()
    .min(7, 'El DNI debe tener al menos 7 caracteres')
    .max(8, 'El DNI no debe superar 8 caracteres')
    .regex(/^\d+$/, 'El DNI solo debe contener números'),
})

export type DniVerificationFormValues = z.infer<typeof dniVerificationSchema>

// ─── Change password schema ───────────────────────────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
    newPassword: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(128, 'La contraseña no debe superar 128 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'La contraseña debe tener al menos una mayúscula, una minúscula y un número'
      ),
    confirmPassword: z.string().min(1, 'Confirmá tu contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

// ─── Reservation schema ───────────────────────────────────────────────────────

export const reservationSchema = z.object({
  areaId: z.string().min(1, 'Seleccioná un área'),
  date: z.string().min(1, 'Seleccioná una fecha'),
  startTime: z.string().min(1, 'Seleccioná una hora de inicio'),
  endTime: z.string().min(1, 'Seleccioná una hora de fin'),
  guestCount: z.number().min(0).max(10, 'Máximo 10 invitados permitidos'),
})

export type ReservationFormValues = z.infer<typeof reservationSchema>

// ─── Member profile schema ────────────────────────────────────────────────────

export const memberProfileSchema = z.object({
  firstName: z.string().min(1, 'El nombre es obligatorio').max(50),
  lastName: z.string().min(1, 'El apellido es obligatorio').max(50),
  email: z.string().email('Ingresá un email válido'),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\+?[\d\s\-()]{7,20}$/.test(val),
      'Ingresá un número de teléfono válido'
    ),
})

export type MemberProfileFormValues = z.infer<typeof memberProfileSchema>
