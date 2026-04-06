import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../../src/shared/guards/roles.guard';
import { ROLES_KEY, UserRole } from '../../../../src/shared/decorators/roles.decorator';

const createMockExecutionContext = (user: object | null, roles?: UserRole[]): ExecutionContext => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) };

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    // Attach the reflector mock so the guard can use it
    _reflector: reflector,
  } as unknown as ExecutionContext;
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 'cognito:groups': ['Member'] },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['Admin'] as UserRole[]);

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 'cognito:groups': ['Admin', 'Manager'] },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['Admin', 'Manager'] as UserRole[]);

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 'cognito:groups': ['Manager'] },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['Admin'] as UserRole[]);

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 'cognito:groups': ['Member'] },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user has no groups', () => {
    reflector.getAllAndOverride.mockReturnValue(['Admin'] as UserRole[]);

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 'cognito:groups': [] },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is not present', () => {
    reflector.getAllAndOverride.mockReturnValue(['Admin'] as UserRole[]);

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: null,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should use the ROLES_KEY metadata key', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 'cognito:groups': ['Member'] },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
