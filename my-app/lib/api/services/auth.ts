import { registerAdapter, type RegisterInput } from "../adapters/register";
import { type User, type UserResponse, userAdapter } from "../adapters/user";
import { client } from "../client/http";

interface LoginResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** `POST /auth/register` 201 body — no cookies set; tokens are empty placeholders. */
interface RegisterResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ResetPasswordInput {
  email: string;
  code: string;
  newPassword: string;
}

/** Fields server_2 allows on `PATCH /users/me` (`updateMeSchema`). */
interface UpdateMeInput {
  name?: string;
  avatarUrl?: string;
}

/**
 * Authentication service — login/refresh/guards/profile over the composed API
 * client (single-flight 401 refresh applied).
 */
class AuthService {
  /** Composed transport with transparent token refresh. */
  private readonly http = client;

  /** POST /auth/login → cookies set, returns userAdapter(dto). */
  async login(credentials: { email: string; password: string }): Promise<User> {
    const res = await this.http.post<LoginResponse>("/auth/login", {
      body: credentials,
    });
    return userAdapter(res.user);
  }

  /** POST /auth/logout → clears session cookies. */
  async logout(): Promise<void> {
    await this.http.post<void>("/auth/logout");
  }

  /** GET /users/me → current profile via userAdapter. */
  async me(): Promise<User> {
    const dto = await this.http.get<UserResponse>("/users/me");
    return userAdapter(dto);
  }

  /** PATCH /users/me → only `name`/`avatarUrl` are sent (whitelisted). */
  async updateMe(updates: UpdateMeInput): Promise<User> {
    const body: UpdateMeInput = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.avatarUrl !== undefined) body.avatarUrl = updates.avatarUrl;

    const dto = await this.http.patch<UserResponse>("/users/me", { body });
    return userAdapter(dto);
  }

  /** POST /auth/register → 201, no cookies (empty tokens). Returns the adapted user. */
  async register(input: RegisterInput): Promise<User> {
    const res = await this.http.post<RegisterResponse>("/auth/register", {
      body: registerAdapter(input),
    });
    return userAdapter(res.user);
  }

  /** POST /auth/email-otp/send → 204 (authed; server uses the current session). */
  async sendEmailOtp(): Promise<void> {
    await this.http.post<void>("/auth/email-otp/send");
  }

  /** POST /auth/email-otp/verify → 204. */
  async verifyEmailOtp(code: string): Promise<void> {
    await this.http.post<void>("/auth/email-otp/verify", { body: { code } });
  }

  /** POST /auth/phone-otp/send → 204 (authed). */
  async sendPhoneOtp(phone: string): Promise<void> {
    await this.http.post<void>("/auth/phone-otp/send", { body: { phone } });
  }

  /** POST /auth/phone-otp/verify → 204. */
  async verifyPhoneOtp(code: string): Promise<void> {
    await this.http.post<void>("/auth/phone-otp/verify", { body: { code } });
  }

  /** POST /auth/forgot-password → always 204 (no user enumeration). */
  async forgotPassword(email: string): Promise<void> {
    await this.http.post<void>("/auth/forgot-password", { body: { email } });
  }

  /** POST /auth/reset-password → 204. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await this.http.post<void>("/auth/reset-password", { body: input });
  }
}

export const authService = new AuthService();
