import { Result } from '../../../domain/shared/Result';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { LogoutDto } from '../dtos/LogoutDto';

export class Logout {
  constructor(private sessionStore: ISessionStore) {}

  async execute(dto: LogoutDto): Promise<Result<void>> {
    await this.sessionStore.invalidate(dto.userId, dto.sessionId);
    return Result.ok();
  }
}
