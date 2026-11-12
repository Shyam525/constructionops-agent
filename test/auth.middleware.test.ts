import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { createAuthenticateMiddleware } from "../src/middleware/authenticate.js";
import type { UserRepository } from "../src/domain/user-repository.js";
import type { AuthenticatedActor } from "../src/auth.js";

function createMockResponse() {
  const res: Partial<Response> = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((_data: any) => res);
  return res as Response;
}

describe("createAuthenticateMiddleware", () => {
  it("returns 401 when no Clerk user is present in the session", async () => {
    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn()
    };
    const middleware = createAuthenticateMiddleware({
      userRepository,
      getAuthFn: () => ({ userId: null })
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/Unauthorized/i) })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.actor).toBeUndefined();
  });

  it("returns 401 when the Clerk identity is an empty string", async () => {
    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn()
    };
    const middleware = createAuthenticateMiddleware({
      userRepository,
      getAuthFn: () => ({ userId: "   " })
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.actor).toBeUndefined();
  });

  it("returns 403 when the Clerk user is authenticated but not mapped to an internal database user", async () => {
    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(null)
    };
    const middleware = createAuthenticateMiddleware({
      userRepository,
      getAuthFn: () => ({ userId: "clerk_user_unmapped" })
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(userRepository.findActorByClerkUserId).toHaveBeenCalledWith("clerk_user_unmapped");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/Forbidden/i) })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.actor).toBeUndefined();
  });

  it("returns 403 when the internal user is inactive", async () => {
    // Inactive user returns null from the database lookup
    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(null)
    };
    const middleware = createAuthenticateMiddleware({
      userRepository,
      getAuthFn: () => ({ userId: "clerk_inactive_user" })
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.actor).toBeUndefined();
  });

  it("returns 403 when the user's tenant is inactive", async () => {
    // Inactive tenant also returns null from the database lookup
    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(null)
    };
    const middleware = createAuthenticateMiddleware({
      userRepository,
      getAuthFn: () => ({ userId: "clerk_user_inactive_tenant" })
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.actor).toBeUndefined();
  });

  it("attaches req.actor and calls next() when user mapping is active and valid", async () => {
    const expectedActor: AuthenticatedActor = {
      userId: "user_internal_99",
      tenantId: "tenant_acme_corp"
    };
    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(expectedActor)
    };
    const middleware = createAuthenticateMiddleware({
      userRepository,
      getAuthFn: () => ({ userId: "clerk_valid_user" })
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(userRepository.findActorByClerkUserId).toHaveBeenCalledWith("clerk_valid_user");
    expect(req.actor).toEqual(expectedActor);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking error details when user repository throws", async () => {
    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockRejectedValue(new Error("FATAL: database connection refused"))
    };
    const middleware = createAuthenticateMiddleware({
      userRepository,
      getAuthFn: () => ({ userId: "clerk_db_error_user" })
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error during authentication"
    });
    expect(next).not.toHaveBeenCalled();
    expect(req.actor).toBeUndefined();
  });
});

