// UC: GetUnreadCount — number of unread notifications for a recipient (engagement_module.md §5).
import { Result } from '../../../domain/shared/Result';
import { INotificationRepository } from '../../../domain/engagement/repositories/INotificationRepository';
import { GetUnreadCountDto, UnreadCountResponse } from '../dtos/NotificationDtos';

export class GetUnreadCount {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  async execute(dto: GetUnreadCountDto): Promise<Result<UnreadCountResponse>> {
    const count = await this.notificationRepo.countUnread(dto.userId);
    return Result.ok({ count });
  }
}
