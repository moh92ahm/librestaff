export const MIN_PASSWORD_LENGTH = 15

export function passwordLengthError() {
  return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
}

export function assertPasswordLength(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(passwordLengthError())
  }
}
