import { Result } from '../../../domain/shared/Result';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { GetActiveSessionsDto } from '../dtos/GetActiveSessionsDto';
import { SessionResponse } from '../responses/SessionResponse';
import { toSessionResponse } from '../responses/mappers';

export class GetActiveSessions {
  constructor(private sessionStore: ISessionStore) {}

  async execute(dto: GetActiveSessionsDto): Promise<Result<SessionResponse[]>> {
    const sessions = await this.sessionStore.list(dto.userId);
    return Result.ok(sessions.map(toSessionResponse));
  }
}
