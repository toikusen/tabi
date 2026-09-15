/** Key prefix of a trip member with no account (migration 015). It has no @, so it never matches a login. */
export const GUEST_PREFIX = 'guest:'

/** True for a companion added by name, with no account of their own. */
export const isGuest = (email: string) => email.startsWith(GUEST_PREFIX)
