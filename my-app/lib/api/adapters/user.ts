/**
 * server_2 user DTO → app user view-model.
 *
 * Mapping source: INTEGRATION_BLUEPRINT.md §3.1 / §7. Implemented in Phase 1
 * (authentication core), the first consumer of this adapter.
 */
export type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";

/** server_2 `GET/PATCH /users/me` response shape. */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
}

/**
 * FE-shaped user view-model. Mirrors the legacy `authStore` `User` shape
 * (Key Decision 1, Phase_1.md) so existing guard/header/profile consumers
 * keep compiling without edits.
 */
export interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  avatar?: string;
  isAdmin: boolean;
  createdAt: string;
}

/**
 * Fields server_2 does not model on `UserResponse`. Kept client-side only,
 * never sent to the server (Phase_1.md §Key Decision 3).
 */
export interface ProfileExtras {
  phone?: string;
  bio?: string;
  birthday?: string;
  occupation?: string;
  location?: string;
}

export type UserViewModel = User;

export function userAdapter(dto: UserResponse): User {
  return {
    _id: dto.id,
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: dto.role,
    isVerified: dto.isEmailVerified,
    avatar: dto.avatarUrl,
    isAdmin: dto.role === "ADMIN",
    createdAt: dto.createdAt,
  };
}

/** Merges local-only `profileExtras` onto the server-backed `User` for display. */
export function mergeProfile(user: User, extras: ProfileExtras): User & ProfileExtras {
  return { ...user, ...extras };
}
