/**
 * Register member command.
 *
 * Carries only the fields the member explicitly provides (DNI, email, password).
 * Full name, phone and membership_type are sourced from SeedMembersTable
 * at verify-email time — they are never sent by the client at registration.
 */
export class RegisterMemberCommand {
  constructor(
    public readonly dni: string,
    public readonly email: string,
    public readonly password: string,
  ) {}
}
