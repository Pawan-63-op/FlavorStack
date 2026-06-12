export interface ChangePasswordDto {
  userId: string;
  currentPassword: string;
  newPassword: string; // plaintext — hashed inside use-case
}
