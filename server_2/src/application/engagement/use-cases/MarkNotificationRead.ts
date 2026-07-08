import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { INotificationRepository } from '../../../domain/engagement/repositories/INotificationRepository';
import { MarkNotificationReadDto } from '../dtos/NotificationDtos';
import { NotificationResponse, toNotificationResponse } from '../responses/NotificationResponse';

export class MarkNotificationRead {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  async execute(dto: MarkNotificationReadDto): Promise<Result<NotificationResponse>> {
    const notification = await this.notificationRepo.findById(dto.notificationId);
    if (!notification) return Result.fail(new NotFoundError('notification_not_found'));

    if (notification.recipientUserId !== dto.userId) {
      return Result.fail(new ForbiddenError('notification_not_owned'));
    }

    const read = notification.markRead();
    if (read.isFailure) return Result.fail(read.getError());

    await this.notificationRepo.update(notification);

    return Result.ok(toNotificationResponse(notification));
  }
}
