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
    inbox: toggle.isEnabled(NOTIFICATION_CHANNEL.INBOX),
    email: toggle.isEnabled(NOTIFICATION_CHANNEL.EMAIL),
  };
}

/**
 * Tolerant read (Phase 5 Batch 2). Documents written before the `channels.*.push → .inbox`
 * `$rename` still carry `push`; default-allow matches `NotificationPreference.isEnabled`. This
 * makes the migration order-independent — a boot before or after the rename both work.
 */
function toggleFromPersistence(doc: ChannelToggleDocument): { inbox: boolean; email: boolean } {
  return { inbox: doc.inbox ?? doc.push ?? true, email: doc.email ?? true };
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
        ChannelToggle.create(toggleFromPersistence(toggleDoc)),
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
