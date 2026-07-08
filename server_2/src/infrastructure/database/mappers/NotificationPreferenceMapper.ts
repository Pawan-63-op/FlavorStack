import {
  NotificationPreference,
  NotificationPreferenceProps,
} from '../../../domain/engagement/entities/NotificationPreference';
import { ChannelToggle } from '../../../domain/engagement/value-objects/ChannelToggle';
import { NotificationCategoryValue } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import {
  NotificationPreferenceDocument,
  ChannelToggleDocument,
} from '../models/NotificationPreferenceModel';
import { rebuildOrThrow } from './rebuildOrThrow';

function toggleToPersistence(toggle: ChannelToggle): ChannelToggleDocument {
  return {
    push: toggle.isEnabled(NOTIFICATION_CHANNEL.PUSH),
    email: toggle.isEnabled(NOTIFICATION_CHANNEL.EMAIL),
  };
}

export class NotificationPreferenceMapper {
  static toPersistence(preference: NotificationPreference): NotificationPreferenceDocument {
    const channels: Record<string, ChannelToggleDocument> = {};
    for (const [category, toggle] of Object.entries(preference.channels)) {
      channels[category] = toggleToPersistence(toggle);
    }

    return {
      _id: preference.id.toString(),
      userId: preference.userId,
      channels,
      updatedAt: preference.updatedAt,
    };
  }

  static toDomain(doc: NotificationPreferenceDocument): NotificationPreference {
    const channels: Record<NotificationCategoryValue, ChannelToggle> = {} as Record<
      NotificationCategoryValue,
      ChannelToggle
    >;
    for (const [category, toggleDoc] of Object.entries(doc.channels)) {
      channels[category as NotificationCategoryValue] = rebuildOrThrow(
        ChannelToggle.create({ push: toggleDoc.push, email: toggleDoc.email }),
        `NotificationPreference channel ${category} (${doc._id})`
      );
    }

    const props: NotificationPreferenceProps = {
      userId: doc.userId,
      channels,
      updatedAt: doc.updatedAt,
    };

    return NotificationPreference.reconstitute(props, new UniqueEntityId(doc._id));
  }
}
