import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy'

export const UserFormSchema = z
  .object({
    email: z.string().min(1, 'Please enter a valid email address'),
    username: z.string().min(1, 'Username is required'),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`)
      .optional(),
    confirmPassword: z.string().min(MIN_PASSWORD_LENGTH, 'Confirm password is required').optional(),
    fullName: z.string().min(1, 'Full name is required'),
    photo: z
      .custom<File | string | null>((v) => v === null || v instanceof File || typeof v === 'string')
      .optional(),
    departmentId: z.string().optional().default(''),
    dottedManagers: z.array(z.string()).default([]).optional(),
    role: z.string().optional(),
    jobTitle: z.string().optional().default(''),
    birthDate: z
      .string()
      .min(1, 'Birth date is required')
      .refine((val) => !Number.isNaN(new Date(val).getTime()), 'Invalid date'),
    primaryPhone: z.string().min(1, 'Primary phone is required'),
    secondaryPhone: z.string().optional().default(''),
    secondaryEmail: z
      .string()
      .email('Please enter a valid email address')
      .optional()
      .or(z.literal(''))
      .optional(),
    documents: z
      .array(z.union([z.string(), z.custom<File>(() => true), z.any()]))
      .optional()
      .default([]),
    isActive: z.boolean().default(true),
    personType: z
      .enum(['employee', 'contractor', 'consultant', 'external', 'serviceAccount'] as const)
      .default('employee'),
    includeInHeadcount: z.boolean().default(true),
    visibleInTeamDirectory: z.boolean().default(true),
    joinedAt: z.string().optional(),
    employmentType: z.enum(['citizen', 'workPermit', 'other'] as const).default('other'),
    nationality: z.string().optional().default(''),
    identityNumber: z.string().optional().default(''),
    employmentNote: z.string().optional().default(''),
    employmentStartDate: z.string().optional(),
    address: z.string().optional().default('Write the address here...'),
    // Employment fields
  })
  .superRefine((data, ctx) => {
    // If either password field is provided, enforce both present and equality
    const hasPwd = typeof data.password === 'string' && data.password.length > 0
    const hasConfirm = typeof data.confirmPassword === 'string' && data.confirmPassword.length > 0
    if (hasPwd || hasConfirm) {
      if (!hasPwd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['password'],
          message: 'Password is required',
        })
      }
      if (!hasConfirm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmPassword'],
          message: 'Confirm your password',
        })
      }
      if (hasPwd && hasConfirm && data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmPassword'],
          message: 'Passwords do not match',
        })
      }
    }
  })

export type UserFormValues = z.infer<typeof UserFormSchema>
