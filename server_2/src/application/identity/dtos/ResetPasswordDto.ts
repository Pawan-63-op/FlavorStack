export interface ResetPasswordDto {
  email: string;
  code: string;
  newPassword: string; // plaintext — hashed inside use-case
}
