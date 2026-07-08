import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { NotificationChannelValue } from '../enums/notification-channel.enum';

export interface NotificationTemplateProps {
  key: string;
  channel: NotificationChannelValue;
  locale: string;
  titleTemplate: string;
  bodyTemplate: string;
  active: boolean;
}

export interface CreateNotificationTemplateInput {
  key: string;
  channel: NotificationChannelValue;
  locale: string;
  titleTemplate: string;
  bodyTemplate: string;
  id?: UniqueEntityId;
}

const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

export class NotificationTemplate extends AggregateRoot<NotificationTemplateProps> {
  private constructor(props: NotificationTemplateProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get key(): string {
    return this.props.key;
  }
  get channel(): NotificationChannelValue {
    return this.props.channel;
  }
  get locale(): string {
    return this.props.locale;
  }
  get titleTemplate(): string {
    return this.props.titleTemplate;
  }
  get bodyTemplate(): string {
    return this.props.bodyTemplate;
  }
  get active(): boolean {
    return this.props.active;
  }

  public static create(input: CreateNotificationTemplateInput): Result<NotificationTemplate> {
    const keyCheck = Guard.againstEmptyString(input.key, 'TemplateKey');
    if (keyCheck.isFailure) return Result.fail<NotificationTemplate>(keyCheck.getError());

    const localeCheck = Guard.againstEmptyString(input.locale, 'Locale');
    if (localeCheck.isFailure) return Result.fail<NotificationTemplate>(localeCheck.getError());

    const titleCheck = Guard.againstEmptyString(input.titleTemplate, 'TitleTemplate');
    if (titleCheck.isFailure) return Result.fail<NotificationTemplate>(titleCheck.getError());

    const bodyCheck = Guard.againstEmptyString(input.bodyTemplate, 'BodyTemplate');
    if (bodyCheck.isFailure) return Result.fail<NotificationTemplate>(bodyCheck.getError());

    return Result.ok<NotificationTemplate>(
      new NotificationTemplate(
        {
          key: input.key,
          channel: input.channel,
          locale: input.locale,
          titleTemplate: input.titleTemplate,
          bodyTemplate: input.bodyTemplate,
          active: true,
        },
        input.id
      )
    );
  }

  /** Simple {{var}} substitution; unknown placeholders are left untouched. */
  public render(vars: Record<string, string>): { title: string; body: string } {
    const substitute = (text: string) =>
      text.replace(PLACEHOLDER_PATTERN, (match, varName) => (varName in vars ? vars[varName] : match));

    return {
      title: substitute(this.props.titleTemplate),
      body: substitute(this.props.bodyTemplate),
    };
  }

  public activate(): void {
    this.props.active = true;
  }

  public deactivate(): void {
    this.props.active = false;
  }

  public static reconstitute(props: NotificationTemplateProps, id: UniqueEntityId): NotificationTemplate {
    return new NotificationTemplate({ ...props }, id);
  }
}
