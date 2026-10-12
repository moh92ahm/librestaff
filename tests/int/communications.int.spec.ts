import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('communication recipient utilities', () => {
  it('deduplicates recipient IDs and validates target selections', async () => {
    const { assertTargetSelection, dedupeRecipients, uniqueIds } = await import(
      '@/lib/communication-recipients'
    )

    expect(uniqueIds([' user-1 ', 'user-1', '', 'user-2'])).toEqual(['user-1', 'user-2'])
    expect(
      dedupeRecipients([
        { id: 'user-1', fullName: 'Ada', email: 'ada@example.com' },
        { id: 'user-1', fullName: 'Ada', email: 'ada@example.com' },
        { id: 'user-2', fullName: 'Grace', email: 'grace@example.com' },
      ]),
    ).toHaveLength(2)
    expect(() => assertTargetSelection({ targetType: 'departments', departmentIds: [] })).toThrow(
      'Select at least one department.',
    )
    expect(() => assertTargetSelection({ targetType: 'users', userIds: [] })).toThrow(
      'Select at least one user.',
    )
  })
})

describe('notification fan-out', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('creates one notification and skipped email delivery per recipient when email is disabled', async () => {
    const notificationValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: 'notification-1',
          recipientUserId: 'user-1',
        },
        {
          id: 'notification-2',
          recipientUserId: 'user-2',
        },
      ]),
    })
    const deliveryValues = vi.fn()
    const insert = vi.fn((_table) => {
      if (insert.mock.calls.length === 1) {
        return { values: notificationValues }
      }

      return { values: deliveryValues }
    })
    const transaction = vi.fn(async (callback) => callback({ insert }))

    vi.doMock('@/db', () => ({
      db: { transaction },
    }))
    vi.doMock('@/lib/email-settings', () => ({
      getEnabledEmailSettings: vi.fn().mockResolvedValue(null),
      validateEmailSettingsValues: vi.fn(),
    }))
    vi.doMock('@/lib/email-sender', () => ({
      sendEmail: vi.fn(),
    }))

    const { createSourceNotifications } = await import('@/lib/notifications')

    await createSourceNotifications({
      sourceType: 'announcement',
      sourceId: 'announcement-1',
      title: 'Policy update',
      message: 'Please review the update.',
      linkUrl: '/announcements/announcement-1/edit',
      recipients: [
        { id: 'user-1', fullName: 'Ada', email: 'ada@example.com' },
        { id: 'user-2', fullName: 'Grace', email: 'grace@example.com' },
      ],
    })

    expect(notificationValues).toHaveBeenCalledWith([
      expect.objectContaining({ recipientUserId: 'user-1' }),
      expect.objectContaining({ recipientUserId: 'user-2' }),
    ])
    expect(deliveryValues).toHaveBeenCalledWith([
      expect.objectContaining({
        notificationId: 'notification-1',
        recipientEmail: 'ada@example.com',
        status: 'skipped',
      }),
      expect.objectContaining({
        notificationId: 'notification-2',
        recipientEmail: 'grace@example.com',
        status: 'skipped',
      }),
    ])
  })

  it('requires at least one recipient', async () => {
    vi.doMock('@/db', () => ({
      db: { transaction: vi.fn() },
    }))
    vi.doMock('@/lib/email-settings', () => ({
      getEnabledEmailSettings: vi.fn().mockResolvedValue(null),
      validateEmailSettingsValues: vi.fn(),
    }))
    vi.doMock('@/lib/email-sender', () => ({
      sendEmail: vi.fn(),
    }))

    const { createSourceNotifications } = await import('@/lib/notifications')

    await expect(
      createSourceNotifications({
        sourceType: 'event',
        sourceId: 'event-1',
        title: 'Town hall',
        message: 'Join the town hall.',
        linkUrl: '/calendar',
        recipients: [],
      }),
    ).rejects.toThrow('No recipients found.')
  })

  it('processes announcement outbox rows directly instead of workflows', async () => {
    const row = {
      id: 'outbox-1',
      eventType: 'announcement.posted',
      sourceType: 'announcement',
      sourceId: 'announcement-1',
      actorUserId: 'user-1',
      recipients: [{ id: 'user-2', fullName: 'Grace Hopper', email: 'grace@example.com' }],
      payload: {
        title: 'Policy update',
        body: 'Please read it.',
        linkUrl: '/announcements/announcement-1',
      },
      delivery: { inApp: true, email: true },
      status: 'pending',
    }
    const createRenderedNotifications = vi.fn().mockResolvedValue([])
    const processWorkflowEvent = vi.fn()
    const returning = vi.fn().mockResolvedValue([{ ...row, status: 'processed' }])
    const updateWhere = vi.fn(() => ({ returning }))
    const updateSet = vi.fn(() => ({ where: updateWhere }))
    const update = vi.fn(() => ({ set: updateSet }))
    const selectLimit = vi.fn().mockResolvedValue([row])
    const selectWhere = vi.fn(() => ({ limit: selectLimit }))
    const selectFrom = vi.fn(() => ({ where: selectWhere }))
    const select = vi.fn(() => ({ from: selectFrom }))

    vi.doMock('@/db', () => ({
      db: { select, update },
    }))
    vi.doMock('@/lib/notifications', () => ({
      createRenderedNotifications,
    }))
    vi.doMock('@/lib/workflows', () => ({
      processWorkflowEvent,
    }))

    const { processNotificationEventOutboxRow } = await import('@/lib/notification-events')
    await processNotificationEventOutboxRow('outbox-1')

    expect(processWorkflowEvent).not.toHaveBeenCalled()
    expect(createRenderedNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'announcement.posted',
        title: 'Policy update',
        message: 'Please read it.',
        delivery: { inApp: true, email: true },
      }),
    )
  })
})

describe('announcement comment reactions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('toggles the current user reaction on a comment', async () => {
    const existingReaction = { id: 'reaction-1', emoji: '👍' }
    const limit = vi.fn().mockResolvedValue([existingReaction])
    const whereAfterSelect = vi.fn().mockReturnValue({ limit })
    const from = vi.fn().mockReturnValue({ where: whereAfterSelect })
    const select = vi.fn().mockReturnValue({ from })
    const whereAfterDelete = vi.fn()
    const deleteTable = vi.fn().mockReturnValue({ where: whereAfterDelete })
    const insert = vi.fn()

    vi.doMock('@/db', () => ({
      db: {
        select,
        delete: deleteTable,
        insert,
      },
    }))
    vi.doMock('@/lib/auth-guards', () => ({
      requireAuth: vi.fn().mockResolvedValue({ id: 'user-1' }),
      requireAdmin: vi.fn(),
      requireFullAccess: vi.fn(),
    }))
    vi.doMock('next/cache', () => ({
      revalidatePath: vi.fn(),
    }))

    const { toggleCommentReactionAction } = await import('@/lib/actions/announcement-feed')

    const formData = new FormData()
    formData.set('commentId', 'comment-1')
    formData.set('emoji', '👍')

    await toggleCommentReactionAction(formData)

    expect(select).toHaveBeenCalled()
    expect(deleteTable).toHaveBeenCalled()
    expect(whereAfterDelete).toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('replaces the current user reaction on a comment when a different emoji is selected', async () => {
    const existingReaction = { id: 'reaction-1', emoji: '👍' }
    const limit = vi.fn().mockResolvedValue([existingReaction])
    const whereAfterSelect = vi.fn().mockReturnValue({ limit })
    const from = vi.fn().mockReturnValue({ where: whereAfterSelect })
    const select = vi.fn().mockReturnValue({ from })
    const whereAfterDelete = vi.fn()
    const deleteTable = vi.fn().mockReturnValue({ where: whereAfterDelete })
    const values = vi.fn()
    const insert = vi.fn().mockReturnValue({ values })

    vi.doMock('@/db', () => ({
      db: {
        select,
        delete: deleteTable,
        insert,
      },
    }))
    vi.doMock('@/lib/auth-guards', () => ({
      requireAuth: vi.fn().mockResolvedValue({ id: 'user-1' }),
      requireAdmin: vi.fn(),
      requireFullAccess: vi.fn(),
    }))
    vi.doMock('next/cache', () => ({
      revalidatePath: vi.fn(),
    }))

    const { toggleCommentReactionAction } = await import('@/lib/actions/announcement-feed')

    const formData = new FormData()
    formData.set('commentId', 'comment-1')
    formData.set('emoji', '❤️')

    await toggleCommentReactionAction(formData)

    expect(deleteTable).toHaveBeenCalled()
    expect(values).toHaveBeenCalledWith({
      commentId: 'comment-1',
      userId: 'user-1',
      emoji: '❤️',
    })
  })
})

function announcementFormData(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }
  return formData
}

function createAnnouncementActionMocks({
  visible = true,
  announcementCreatedBy = 'user-1',
  announcementStatus = 'draft',
  recipients = [],
}: {
  visible?: boolean
  announcementCreatedBy?: string
  announcementStatus?: 'draft' | 'sent'
  recipients?: Array<{ id: string; fullName: string; email?: string | null }>
} = {}) {
  const user = {
    id: 'user-1',
    name: 'Ada',
    role: { id: 'role-member', name: 'member', displayName: 'Member' },
  }
  const channel = {
    id: 'channel-1',
    name: 'General',
    color: '#94a3b8',
    visibility: 'public' as const,
    createdById: null,
    notifyInApp: true,
    notifyEmail: false,
    departmentIds: [],
    userIds: [],
  }
  const insertValues = vi.fn(() => ({
    returning: vi.fn().mockResolvedValue([
      {
        id: 'announcement-1',
        title: 'Hello',
        body: 'Body',
      },
    ]),
  }))
  const insert = vi.fn(() => ({ values: insertValues }))
  const updateWhere = vi.fn().mockResolvedValue(undefined)
  const updateSet = vi.fn(() => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set: updateSet }))
  const deleteWhere = vi.fn().mockResolvedValue(undefined)
  const deleteTable = vi.fn(() => ({ where: deleteWhere }))
  const selectResults = [
    [
      {
        id: 'announcement-1',
        createdById: announcementCreatedBy,
        categoryId: 'channel-1',
        status: announcementStatus,
      },
    ],
    [],
  ]
  const selectWhere = vi.fn(() => {
    const result = selectResults.shift() || []
    return {
      limit: vi.fn(async () => result),
      then: (resolve: (value: unknown[]) => unknown, reject: (reason?: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    }
  })
  const selectFrom = vi.fn(() => ({
    where: selectWhere,
  }))
  const select = vi.fn(() => ({ from: selectFrom }))
  const transaction = vi.fn(async (callback) =>
    callback({
      delete: deleteTable,
      insert,
    }),
  )

  vi.doMock('@/db', () => ({
    db: {
      insert,
      update,
      delete: deleteTable,
      select,
      transaction,
    },
  }))
  vi.doMock('@/lib/auth-guards', () => ({
    requireAuth: vi.fn().mockResolvedValue(user),
    requireAdmin: vi.fn(),
    requireFullAccess: vi.fn(),
  }))
  vi.doMock('@/lib/announcement-categories', () => ({
    getAnnouncementChannelById: vi.fn().mockResolvedValue(channel),
    getVisibleAnnouncementChannels: vi.fn().mockResolvedValue(visible ? [channel] : []),
    isGeneralAnnouncementCategory: vi.fn((category) => category.name === 'General'),
    resolveAnnouncementCategoryId: vi.fn(async (value) => value || 'channel-1'),
    resolveAnnouncementChannelRecipients: vi.fn().mockResolvedValue(recipients),
  }))
  const emitNotificationEvent = vi.fn()
  vi.doMock('@/lib/notification-events', () => ({
    emitNotificationEvent,
    NOTIFICATION_EVENTS: {
      announcementPosted: 'announcement.posted',
      announcementMentioned: 'announcement.mentioned',
      announcementCommentCreated: 'announcement.comment.created',
      announcementCommentMentioned: 'announcement.comment.mentioned',
    },
    toNotificationRecipients: vi.fn((recipients) => recipients),
  }))
  vi.doMock('next/cache', () => ({
    revalidatePath: vi.fn(),
  }))
  vi.doMock('next/navigation', () => ({
    redirect: vi.fn(),
  }))

  return {
    insert,
    insertValues,
    update,
    updateSet,
    emitNotificationEvent,
  }
}

describe('announcement action permissions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('lets an authenticated member post in a visible channel without announcement create permission', async () => {
    const mocks = createAnnouncementActionMocks()
    const { postAnnouncementAction } = await import('@/lib/actions/announcement-feed')

    await postAnnouncementAction(
      announcementFormData({
        title: 'Hello',
        body: 'Body',
        categoryId: 'channel-1',
        intent: 'post',
      }),
    )

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hello',
        body: 'Body',
        categoryId: 'channel-1',
        createdById: 'user-1',
      }),
    )
  })

  it('always emits in-app announcement notifications and uses the post email checkbox', async () => {
    const mocks = createAnnouncementActionMocks({
      recipients: [{ id: 'user-2', fullName: 'Grace Hopper', email: 'grace@example.com' }],
    })
    const { postAnnouncementAction } = await import('@/lib/actions/announcement-feed')

    await postAnnouncementAction(
      announcementFormData({
        title: 'Hello',
        body: 'Body',
        categoryId: 'channel-1',
        intent: 'post',
        notifyByEmail: 'on',
      }),
    )

    expect(mocks.emitNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'announcement.posted',
        delivery: { inApp: true, email: true },
      }),
    )
  })

  it('does not email announcement posts when the post email checkbox is unchecked', async () => {
    const mocks = createAnnouncementActionMocks({
      recipients: [{ id: 'user-2', fullName: 'Grace Hopper', email: 'grace@example.com' }],
    })
    const { postAnnouncementAction } = await import('@/lib/actions/announcement-feed')

    await postAnnouncementAction(
      announcementFormData({
        title: 'Hello',
        body: 'Body',
        categoryId: 'channel-1',
        intent: 'post',
      }),
    )

    expect(mocks.emitNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'announcement.posted',
        delivery: { inApp: true, email: false },
      }),
    )
  })

  it('rejects posting in a channel the authenticated user cannot see', async () => {
    const mocks = createAnnouncementActionMocks({ visible: false })
    const { postAnnouncementAction } = await import('@/lib/actions/announcement-feed')

    await expect(
      postAnnouncementAction(
        announcementFormData({
          title: 'Hello',
          body: 'Body',
          categoryId: 'channel-1',
          intent: 'post',
        }),
      ),
    ).rejects.toThrow('You cannot post in this channel.')
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('lets the creator edit their own announcement in a visible channel', async () => {
    const mocks = createAnnouncementActionMocks()
    const { updateAnnouncementAction } = await import('@/lib/actions/announcement-feed')

    await updateAnnouncementAction(
      announcementFormData({
        id: 'announcement-1',
        title: 'Updated',
        body: 'Updated body',
        categoryId: 'channel-1',
      }),
    )

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated',
        body: 'Updated body',
        categoryId: 'channel-1',
      }),
    )
  })

  it('rejects editing another user announcement', async () => {
    createAnnouncementActionMocks({ announcementCreatedBy: 'user-2' })
    const { updateAnnouncementAction } = await import('@/lib/actions/announcement-feed')

    await expect(
      updateAnnouncementAction(
        announcementFormData({
          id: 'announcement-1',
          title: 'Updated',
          body: 'Updated body',
          categoryId: 'channel-1',
        }),
      ),
    ).rejects.toThrow('Only the creator can edit this announcement.')
  })

  it('lets an authenticated user pin a visible announcement', async () => {
    const mocks = createAnnouncementActionMocks()
    const { pinAnnouncementAction } = await import('@/lib/actions/announcement-feed')

    await pinAnnouncementAction(
      announcementFormData({
        id: 'announcement-1',
        pinned: 'true',
      }),
    )

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        pinned: true,
      }),
    )
  })

  it('rejects pinning an announcement outside visible channels', async () => {
    const mocks = createAnnouncementActionMocks({ visible: false })
    const { pinAnnouncementAction } = await import('@/lib/actions/announcement-feed')

    await expect(
      pinAnnouncementAction(
        announcementFormData({
          id: 'announcement-1',
          pinned: 'true',
        }),
      ),
    ).rejects.toThrow('You cannot access this channel.')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('keeps announcement create permission for channel creation', async () => {
    const requirePermission = vi.fn().mockRejectedValue(new Error('forbidden'))
    vi.doMock('@/lib/permissions', () => ({
      requirePermission,
    }))
    vi.doMock('@/db', () => ({
      db: {},
    }))
    vi.doMock('next/cache', () => ({
      revalidatePath: vi.fn(),
    }))
    vi.doMock('next/navigation', () => ({
      redirect: vi.fn(),
    }))

    const { saveCategoryAction } = await import('@/lib/actions/announcement-feed')

    await expect(
      saveCategoryAction(
        announcementFormData({
          name: 'Product',
          visibility: 'public',
        }),
      ),
    ).rejects.toThrow('forbidden')
    expect(requirePermission).toHaveBeenCalledWith('announcements', 'create')
  })

  it('keeps announcement edit permission for channel editing', async () => {
    const requirePermission = vi.fn().mockRejectedValue(new Error('forbidden'))
    vi.doMock('@/lib/permissions', () => ({
      requirePermission,
    }))
    vi.doMock('@/db', () => ({
      db: {},
    }))
    vi.doMock('next/cache', () => ({
      revalidatePath: vi.fn(),
    }))
    vi.doMock('next/navigation', () => ({
      redirect: vi.fn(),
    }))

    const { saveCategoryAction } = await import('@/lib/actions/announcement-feed')

    await expect(
      saveCategoryAction(
        announcementFormData({
          id: 'channel-1',
          name: 'Product',
          visibility: 'public',
        }),
      ),
    ).rejects.toThrow('forbidden')
    expect(requirePermission).toHaveBeenCalledWith('announcements', 'edit')
  })

  it('uses announcement delete permission for channel deletion', async () => {
    const requirePermission = vi.fn().mockRejectedValue(new Error('forbidden'))
    vi.doMock('@/lib/permissions', () => ({
      requirePermission,
    }))
    vi.doMock('@/db', () => ({
      db: {},
    }))
    vi.doMock('next/cache', () => ({
      revalidatePath: vi.fn(),
    }))
    vi.doMock('next/navigation', () => ({
      redirect: vi.fn(),
    }))

    const { deleteCategoryAction } = await import('@/lib/actions/announcement-feed')

    await expect(
      deleteCategoryAction(
        announcementFormData({
          id: 'channel-1',
        }),
      ),
    ).rejects.toThrow('forbidden')
    expect(requirePermission).toHaveBeenCalledWith('announcements', 'delete')
  })
})
