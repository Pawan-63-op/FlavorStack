export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  avatarUrl?: string;
  createdAt: Date;
}
