/**
 * Domain exceptions for the Members service.
 *
 * These classes contain no HTTP knowledge — status code mapping happens
 * in the GlobalExceptionFilter at the infrastructure boundary.
 *
 * AC-001 exceptions: registration flow
 * AC-002 exceptions: login + OTP flow
 */

// ─── AC-001: Registration Exceptions ────────────────────────────────────────

export class DniNotFoundException extends Error {
  readonly code = 'DNI_NOT_FOUND';

  constructor() {
    super('The provided DNI is not registered in our system. Please contact club administration.');
    this.name = 'DniNotFoundException';
  }
}

export class AccountInactiveException extends Error {
  readonly code = 'ACCOUNT_INACTIVE';

  constructor() {
    super(
      'Your membership is currently inactive. Please contact club administration to resolve any outstanding balance.',
    );
    this.name = 'AccountInactiveException';
  }
}

export class DniAlreadyRegisteredException extends Error {
  readonly code = 'DNI_ALREADY_REGISTERED';

  constructor() {
    super('An account with this DNI already exists. Please sign in instead.');
    this.name = 'DniAlreadyRegisteredException';
  }
}

export class EmailAlreadyInUseException extends Error {
  readonly code = 'EMAIL_ALREADY_IN_USE';

  constructor() {
    super(
      'This email address is already associated with an account. Please sign in or use a different email.',
    );
    this.name = 'EmailAlreadyInUseException';
  }
}

export class PasswordPolicyViolationException extends Error {
  readonly code = 'PASSWORD_POLICY_VIOLATION';

  constructor(message?: string) {
    super(message ?? 'Password does not meet security requirements.');
    this.name = 'PasswordPolicyViolationException';
  }
}

export class InvalidCodeException extends Error {
  readonly code = 'INVALID_CODE';

  constructor() {
    super('The verification code is incorrect. Please check your email and try again.');
    this.name = 'InvalidCodeException';
  }
}

export class CodeExpiredException extends Error {
  readonly code = 'CODE_EXPIRED';

  constructor() {
    super('The verification code has expired. Please request a new code and try again.');
    this.name = 'CodeExpiredException';
  }
}

export class TooManyAttemptsException extends Error {
  readonly code = 'TOO_MANY_ATTEMPTS';

  constructor(message?: string) {
    super(message ?? 'Too many attempts. Please wait a few minutes before trying again.');
    this.name = 'TooManyAttemptsException';
  }
}

export class UserNotFoundException extends Error {
  readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('No unconfirmed account was found for this email address.');
    this.name = 'UserNotFoundException';
  }
}

// ─── AC-002: Login + OTP Exceptions ─────────────────────────────────────────

/**
 * InvalidCredentialsException — HTTP 401.
 * Used for both wrong password (NotAuthorizedException) and unknown email
 * (UserNotFoundException) to prevent user enumeration attacks.
 */
export class InvalidCredentialsException extends Error {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('The email or password is incorrect. Please try again.');
    this.name = 'InvalidCredentialsException';
  }
}

/**
 * AccountNotConfirmedException — HTTP 403.
 * Cognito user exists but is in UNCONFIRMED state.
 */
export class AccountNotConfirmedException extends Error {
  readonly code = 'ACCOUNT_NOT_CONFIRMED';

  constructor() {
    super(
      'Your account email has not been verified. Please complete registration to activate your account.',
    );
    this.name = 'AccountNotConfirmedException';
  }
}

/**
 * AccountDisabledException — HTTP 403.
 * Cognito user has been administratively disabled.
 */
export class AccountDisabledException extends Error {
  readonly code = 'ACCOUNT_DISABLED';

  constructor() {
    super('Your account has been disabled. Please contact club administration.');
    this.name = 'AccountDisabledException';
  }
}

/**
 * InvalidOtpException — HTTP 400.
 * The supplied OTP code does not match the one Cognito issued.
 */
export class InvalidOtpException extends Error {
  readonly code = 'INVALID_OTP';

  constructor() {
    super('The verification code is incorrect. Please try again.');
    this.name = 'InvalidOtpException';
  }
}

/**
 * SessionExpiredException — HTTP 410.
 * The Cognito challenge session has expired (3-minute TTL).
 */
export class SessionExpiredException extends Error {
  readonly code = 'SESSION_EXPIRED';

  constructor() {
    super('Your verification session has expired. Please start the login process again.');
    this.name = 'SessionExpiredException';
  }
}

/**
 * UnexpectedAuthChallengeException — HTTP 500.
 * Cognito returned a challenge type other than EMAIL_OTP.
 */
export class UnexpectedAuthChallengeException extends Error {
  readonly code = 'INTERNAL_ERROR';

  constructor(challengeName?: string) {
    super(
      `Unexpected authentication challenge received${challengeName ? `: ${challengeName}` : ''}. Please contact support.`,
    );
    this.name = 'UnexpectedAuthChallengeException';
  }
}
