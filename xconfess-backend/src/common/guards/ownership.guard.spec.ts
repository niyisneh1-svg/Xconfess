import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CapabilityPolicyService } from '../../auth/capabilities/capability-policy.service';
import { CAPABILITY_ADMIN } from '../../auth/capabilities/capability.constants';
import { OwnershipGuard } from './ownership.guard';
import { OWNERSHIP_META, OwnershipMeta } from '../decorators/ownership.decorator';

describe('OwnershipGuard branch coverage', () => {
  const handler = () => undefined;
  const controller = class OwnershipController {};
  const createGuard = (meta?: OwnershipMeta) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(meta),
    };
    const guard = new OwnershipGuard(reflector as unknown as Reflector);
    return { guard, reflector };
  };
  const createContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it('is a no-op when ownership metadata is absent', () => {
    const { guard, reflector } = createGuard();
    expect(guard.canActivate(createContext({}))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      OWNERSHIP_META,
      [handler, controller],
    );
  });

  it('fails closed for missing users and missing principal identifiers', () => {
    const { guard } = createGuard({ paramKey: 'ownerId' });
    expect(() => guard.canActivate(createContext({ params: { ownerId: '4' } })))
      .toThrow('Not authenticated');
    expect(() => guard.canActivate(createContext({
      user: {},
      params: { ownerId: '4' },
    }))).toThrow('Not authenticated');
  });

  it('permits a matching owner from params, body, or query using id or sub', () => {
    const { guard } = createGuard({ paramKey: 'ownerId' });
    expect(guard.canActivate(createContext({
      user: { id: 4 },
      params: { ownerId: '4' },
    }))).toBe(true);
    expect(guard.canActivate(createContext({
      user: { sub: '5' },
      body: { ownerId: 5 },
    }))).toBe(true);
    expect(guard.canActivate(createContext({
      user: { id: '6' },
      query: { ownerId: '6' },
    }))).toBe(true);
  });

  it('allows a capability-authorized admin bypass', () => {
    const hasCapability = jest.spyOn(CapabilityPolicyService, 'hasCapability')
      .mockReturnValue(true);
    try {
      const { guard } = createGuard({
        paramKey: 'ownerId',
        adminBypass: true,
        adminBypassCapability: CAPABILITY_ADMIN,
      });
      expect(guard.canActivate(createContext({
        user: { id: 1, role: 'admin' },
        params: { ownerId: 'different-user' },
      }))).toBe(true);
    } finally {
      hasCapability.mockRestore();
    }
  });

  it('continues owner validation when bypass is disabled or not authorized', () => {
    const hasCapability = jest.spyOn(CapabilityPolicyService, 'hasCapability')
      .mockReturnValue(false);
    try {
      const { guard } = createGuard({ paramKey: 'ownerId', adminBypass: true });
      expect(guard.canActivate(createContext({
        user: { id: 4, role: 'user' },
        params: { ownerId: '4' },
      }))).toBe(true);
      expect(() => guard.canActivate(createContext({
        user: { id: 4, role: 'user' },
        params: { ownerId: '5' },
      }))).toThrow('Access denied');
    } finally {
      hasCapability.mockRestore();
    }
  });

  it('denies a request when no resource owner ID is present', () => {
    const { guard } = createGuard({ paramKey: 'ownerId' });
    expect(() => guard.canActivate(createContext({ user: { id: 4 } })))
      .toThrow('missing resource ID');
  });
});
