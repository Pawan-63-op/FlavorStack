import { Result } from '../../../domain/shared/Result';
import { INotificationRepository } from '../../../domain/engagement/repositories/INotificationRepository';
import { GetNotificationHistoryDto } from '../dtos/NotificationDtos';
import { NotificationResponse, toNotificationResponse } from '../responses/NotificationResponse';

export class GetNotificationHistory {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  async execute(dto: GetNotificationHistoryDto): Promise<Result<NotificationResponse[]>> {
    const notifications = await this.notificationRepo.findByRecipient(dto.userId, {
      limit: dto.limit,
      offset: dto.offset,
    });
    return Result.ok(notifications.map(toNotificationResponse));
  }
}
