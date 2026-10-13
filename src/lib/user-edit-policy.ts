export interface UserEditCapabilities {
  canEditAdministrativeFields: boolean
  canEditRole: boolean
}

export function getUserEditCapabilities({
  actorUserId,
  targetUserId,
  actorIsAdmin,
}: {
  actorUserId: string
  targetUserId: string
  actorIsAdmin: boolean
}): UserEditCapabilities {
  return {
    // Scoped managers may maintain records for the people they manage, but a
    // non-admin must never turn their own profile edit into an HR/account edit.
    canEditAdministrativeFields: actorIsAdmin || actorUserId !== targetUserId,
    // Role assignment is always an administrator operation.
    canEditRole: actorIsAdmin,
  }
}
