import { countChargeableLeaveDays, type LeavePolicySettings } from '@/lib/leave-policy'
import { documentMimeTypes, imageMimeTypes, saveUploadedMedia } from '@/lib/media-storage'

const VALID_LEAVE_TYPES = new Set(['annual', 'sick', 'unpaid', 'other'])
const VALID_LEAVE_STATUSES = new Set(['requested', 'approved', 'rejected', 'cancelled'])

function indexedFormValues(formData: FormData, name: string) {
  return Array.from(formData.entries())
    .filter(([key]) => key === name || key.startsWith(`${name}[`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)
}

export async function resolveLeaveAttachmentIds(
  formData: FormData,
  allowedExistingIds: Iterable<string> = [],
) {
  const attachmentIds: string[] = []
  const allowedIds = new Set(allowedExistingIds)

  for (const value of indexedFormValues(formData, 'attachments').slice(0, 5)) {
    if (value instanceof File && value.size > 0) {
      const media = await saveUploadedMedia({
        file: value,
        category: 'leave-attachments',
        allowedMimeTypes: [...imageMimeTypes, ...documentMimeTypes],
        alt: value.name,
      })
      attachmentIds.push(media.id)
      continue
    }

    const id = String(value || '').trim()
    if (id && allowedIds.has(id)) attachmentIds.push(id)
  }

  return Array.from(new Set(attachmentIds))
}

type ParseLeaveFormOptions = {
  policy: LeavePolicySettings
  canOverrideDays: boolean
  holidayDates?: Iterable<string>
  defaultUserId?: string
  defaultStatus?: string
}

export function parseLeaveFormData(formData: FormData, options: ParseLeaveFormOptions) {
  const userId = options.defaultUserId || String(formData.get('user') || '')
  const type = String(formData.get('type') || '')
  const startDate = String(formData.get('startDate') || '')
  const endDate = String(formData.get('endDate') || '')
  const status = String(formData.get('status') || options.defaultStatus || 'requested')
  const reason = String(formData.get('reason') || '').trim()
  const note = String(formData.get('note') || '').trim()
  const autoCalculatedDays = countChargeableLeaveDays(
    startDate,
    endDate,
    options.policy,
    options.holidayDates,
  )
  const wantsManualDayCount =
    options.canOverrideDays && String(formData.get('isManualDayCount') || '') === 'true'
  const manualDayCountReason = String(formData.get('manualDayCountReason') || '').trim()
  const submittedTotalDays = Number(formData.get('totalDays') || autoCalculatedDays)

  if (!userId) {
    throw new Error('User is required')
  }

  if (!VALID_LEAVE_TYPES.has(type)) {
    throw new Error('Leave type is invalid')
  }

  if (!startDate || !endDate || endDate < startDate) {
    throw new Error('Leave date range is invalid')
  }

  if (!VALID_LEAVE_STATUSES.has(status)) {
    throw new Error('Leave status is invalid')
  }

  if (!reason) {
    throw new Error('Reason is required')
  }

  if (wantsManualDayCount && !manualDayCountReason) {
    throw new Error('Manual charged-day override requires a reason')
  }

  if (wantsManualDayCount && (!Number.isFinite(submittedTotalDays) || submittedTotalDays < 0)) {
    throw new Error('Manual charged days must be a valid non-negative number')
  }

  return {
    userId,
    type: type as 'annual' | 'sick' | 'unpaid' | 'other',
    startDate,
    endDate,
    totalDays: wantsManualDayCount ? submittedTotalDays : autoCalculatedDays,
    autoCalculatedDays,
    isManualDayCount: wantsManualDayCount,
    manualDayCountReason: wantsManualDayCount ? manualDayCountReason : null,
    status: status as 'requested' | 'approved' | 'rejected' | 'cancelled',
    reason,
    note: note || null,
  }
}
