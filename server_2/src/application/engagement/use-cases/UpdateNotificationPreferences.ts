import { Result } from '../../../domain/shared/Result';
import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { INotificationPreferenceRepository } from '../../../domain/engagement/repositories/INotificationPreferenceRepository';
import { UpdateNotificationPreferencesDto } from '../dtos/NotificationDtos';
import {
  NotificationPreferenceResponse,
  toNotificationPreferenceResponse,
} from '../responses/NotificationPreferenceResponse';

export class UpdateNotificationPreferences {
  constructor(private readonly preferenceRepo: INotificationPreferenceRepository) {}

  async execute(dto: UpdateNotificationPreferencesDto): Promise<Result<NotificationPreferenceResponse>> {
    const preference =
      (await this.preferenceRepo.findByUserId(dto.userId)) ?? NotificationPreference.createDefault(dto.userId);

    for (const change of dto.changes) {
      const applied = preference.setChannel(change.category, change.channel, change.enabled);
      if (applied.isFailure) return Result.fail(applied.getError());
    }

    await this.preferenceRepo.save(preference);

    return Result.ok(toNotificationPreferenceResponse(preference));
  }
}
