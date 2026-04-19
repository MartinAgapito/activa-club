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

// ─── Reservation schema (legacy — kept for backward compatibility) ────────────

export const reservationSchema = z.object({
  areaId: z.string().min(1, 'Seleccioná un área'),
  date: z.string().min(1, 'Seleccioná una fecha'),
  startTime: z.string().min(1, 'Seleccioná una hora de inicio'),
  endTime: z.string().min(1, 'Seleccioná una hora de fin'),
  guestCount: z.number().min(0).max(10, 'Máximo 10 invitados permitidos'),
})

export type ReservationFormValues = z.infer<typeof reservationSchema>

// ─── AC-012: Create reservation wizard schema ─────────────────────────────────

/**
 * Zod schema for the AC-012 create-reservation wizard.
 * Each step validates a subset of the full payload.
 * The full schema is used for the final mutation payload validation.
 */
export const createReservationSchema = z.object({
  /** Step 1: ULID of the selected area */
  areaId: z.string().min(1, 'Seleccioná un área'),

  /** Step 2: Selected date in YYYY-MM-DD format */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),

  /** Step 3: Selected slot start time — must be an hourly boundary (HH:00) */
  startTime: z
    .string()
    .regex(/^\d{2}:00$/, 'La hora debe ser en punto (ej. 09:00)'),

  /** Step 3: Duration in minutes — multiples of 60, max 240 (VIP) */
  durationMinutes: z
    .number({ invalid_type_error: 'Seleccioná una duración' })
    .multipleOf(60, 'La duración debe ser múltiplo de 60 minutos')
    .min(60, 'La duración mínima es 60 minutos')
    .max(240, 'La duración máxima es 240 minutos'),
})

export type CreateReservationFormValues = z.infer<typeof createReservationSchema>

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

// ─── Cancel reservation schema (manager — reason required) ───────────────────

export const managerCancelReservationSchema = z.object({
  reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres').max(500),
})

export type ManagerCancelReservationFormValues = z.infer<typeof managerCancelReservationSchema>

// ─── Create area block schema ─────────────────────────────────────────────────

export const createAreaBlockSchema = z.object({
  areaId: z.string().min(1, 'Seleccioná un área'),
  date: z.string().min(1, 'Seleccioná una fecha'),
  startTime: z.string().min(1, 'Seleccioná una hora de inicio'),
  endTime: z.string().min(1, 'Seleccioná una hora de fin'),
  reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres').max(500),
})

export type CreateAreaBlockFormValues = z.infer<typeof createAreaBlockSchema>
