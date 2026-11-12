import type { AuthenticatedActor } from "../auth.js";

export interface UserRepository {
  findActorByClerkUserId(clerkUserId: string): Promise<AuthenticatedActor | null>;
}

