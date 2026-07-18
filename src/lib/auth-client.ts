"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth browser client. baseURL defaults to the current origin, so all
 * calls hit the same-origin /api/auth/[...all] handler.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
