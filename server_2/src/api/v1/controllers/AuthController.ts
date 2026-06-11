// Thin HTTP delivery for the auth use-cases — Result -> HTTP, cookie management. Zero business logic.
import { Request, Response, NextFunction } from 'express';
import { RegisterUser } from '../../../application/identity/use-cases/RegisterUser';
import { Login } from '../../../application/identity/use-cases/Login';
import { RefreshToken } from '../../../application/identity/use-cases/RefreshToken';
import { Logout } from '../../../application/identity/use-cases/Logout';
import { LogoutAllSessions } from '../../../application/identity/use-cases/LogoutAllSessions';
import { GetActiveSessions } from '../../../application/identity/use-cases/GetActiveSessions';
import { ForgotPassword } from '../../../application/identity/use-cases/ForgotPassword';
import { ResetPassword } from '../../../application/identity/use-cases/ResetPassword';
import { ChangePassword } from '../../../application/identity/use-cases/ChangePassword';
import { SendEmailOtp } from '../../../application/identity/use-cases/SendEmailOtp';
import { VerifyEmailOtp } from '../../../application/identity/use-cases/VerifyEmailOtp';
import { SendPhoneOtp } from '../../../application/identity/use-cases/SendPhoneOtp';
import { VerifyPhoneOtp } from '../../../application/identity/use-cases/VerifyPhoneOtp';
import { RegisterUserDto } from '../../../application/identity/dtos/RegisterUserDto';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { REFRESH_TOKEN_COOKIE, setAuthCookies, clearAuthCookies } from '../http/cookies';

export interface AuthControllerDeps {
  registerUser: RegisterUser;
  login: Login;
  refreshToken: RefreshToken;
  logout: Logout;
  logoutAllSessions: LogoutAllSessions;
  getActiveSessions: GetActiveSessions;
  forgotPassword: ForgotPassword;
  resetPassword: ResetPassword;
  changePassword: ChangePassword;
  sendEmailOtp: SendEmailOtp;
  verifyEmailOtp: VerifyEmailOtp;
  sendPhoneOtp: SendPhoneOtp;
  verifyPhoneOtp: VerifyPhoneOtp;
}

export class AuthController {
  constructor(private readonly deps: AuthControllerDeps) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.registerUser.execute(req.body as RegisterUserDto);
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(201).json(result.getValue());
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.login.execute({
      email: req.body.email,
      password: req.body.password,
      device: req.context.device,
      ip: req.context.ip,
      userAgent: req.context.userAgent,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    const auth = result.getValue();
    setAuthCookies(res, auth.accessToken, auth.refreshToken);
    res.status(200).json(auth);
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      next(new ForbiddenError('invalid_token'));
      return;
    }

    const result = await this.deps.refreshToken.execute({
      refreshToken,
      device: req.context.device,
      ip: req.context.ip,
      userAgent: req.context.userAgent,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    const auth = result.getValue();
    setAuthCookies(res, auth.accessToken, auth.refreshToken);
    res.status(200).json(auth);
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.logout.execute({
      userId: req.user!.userId,
      sessionId: req.user!.sessionId,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    clearAuthCookies(res);
    res.status(204).send();
  };

  logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.logoutAllSessions.execute({ userId: req.user!.userId });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    clearAuthCookies(res);
    res.status(204).send();
  };

  listSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getActiveSessions.execute({ userId: req.user!.userId });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.logout.execute({
      userId: req.user!.userId,
      sessionId: req.params.sessionId as string,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  sendEmailOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.sendEmailOtp.execute({ userId: req.user!.userId });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  verifyEmailOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.verifyEmailOtp.execute({
      userId: req.user!.userId,
      code: req.body.code,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  sendPhoneOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.sendPhoneOtp.execute({
      userId: req.user!.userId,
      phone: req.body.phone,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  verifyPhoneOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.verifyPhoneOtp.execute({
      userId: req.user!.userId,
      code: req.body.code,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.forgotPassword.execute({ email: req.body.email });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.resetPassword.execute({
      email: req.body.email,
      code: req.body.code,
      newPassword: req.body.newPassword,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.changePassword.execute({
      userId: req.user!.userId,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    clearAuthCookies(res);
    res.status(204).send();
  };
}
