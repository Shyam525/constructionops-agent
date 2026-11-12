import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getAuth } from "@clerk/express";
import type { AuthenticatedActor } from "../auth.js";
import type { UserRepository } from "../domain/user-repository.js";

declare global {
  namespace Express {
    interface Request {
      actor?: AuthenticatedActor;
    }
  }
}

export interface AuthenticateOptions {
  userRepository: UserRepository;
  getAuthFn?: (req: Request) => { userId?: string | null } | null | undefined;
}

export function createAuthenticateMiddleware(options: AuthenticateOptions): RequestHandler {
  const resolveAuth = options.getAuthFn ?? ((req: Request) => {
    try {
      return getAuth(req);
    } catch {
      return null;
    }
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = resolveAuth(req);
      const clerkUserId = auth?.userId ? auth.userId.trim() : null;

      if (!clerkUserId) {
        res.status(401).json({
          error: "Unauthorized: Missing or invalid authentication token"
        });
        return;
      }

      const actor = await options.userRepository.findActorByClerkUserId(clerkUserId);
      if (!actor) {
        res.status(403).json({
          error: "Forbidden: User is not authorized or not associated with an active tenant"
        });
        return;
      }

      req.actor = actor;
      next();
    } catch {
      res.status(500).json({
        error: "Internal server error during authentication"
      });
    }
  };
}

