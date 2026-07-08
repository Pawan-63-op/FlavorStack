import { Result } from '../../../domain/shared/Result';
import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { INotificationPreferenceRepository } from '../../../domain/engagement/repositories/INotificationPreferenceRepository';
import { GetNotificationPreferencesDto } from '../dtos/NotificationDtos';
import {
  NotificationPreferenceResponse,
  toNotificationPreferenceResponse,
} from '../responses/NotificationPreferenceResponse';

export class GetNotificationPreferences {
  constructor(private readonly preferenceRepo: INotificationPreferenceRepository) {}

  async execute(dto: GetNotificationPreferencesDto): Promise<Result<NotificationPreferenceResponse>> {
    const preference =
      (await this.preferenceRepo.findByUserId(dto.userId)) ?? NotificationPreference.createDefault(dto.userId);
    return Result.ok(toNotificationPreferenceResponse(preference));
  }
}
