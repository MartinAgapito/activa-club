/**
 * Domain exceptions for the Members service.
 *
 * These classes contain no HTTP knowledge — status code mapping happens
 * in the GlobalExceptionFilter at the infrastructure boundary.
 */

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
