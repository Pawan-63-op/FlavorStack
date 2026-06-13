import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Weekday, WEEKDAY } from '../enums/weekday.enum';

export interface DayInterval {
  open: string; // "HH:mm" 24-hour
  close: string; // "HH:mm" 24-hour
}

export type WeeklySchedule = Record<Weekday, DayInterval[]>;

interface OpeningHoursProps {
  schedule: WeeklySchedule;
  holidays: string[]; // "YYYY-MM-DD"
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_ORDER: Weekday[] = [
  WEEKDAY.SUNDAY,
  WEEKDAY.MONDAY,
  WEEKDAY.TUESDAY,
  WEEKDAY.WEDNESDAY,
  WEEKDAY.THURSDAY,
  WEEKDAY.FRIDAY,
  WEEKDAY.SATURDAY,
];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export class OpeningHours extends ValueObject<OpeningHoursProps> {
  private constructor(props: OpeningHoursProps) {
    super(props);
  }

  get schedule(): WeeklySchedule {
    return this.props.schedule;
  }

  get holidays(): string[] {
    return this.props.holidays;
  }

  public static create(props: { schedule: WeeklySchedule; holidays: string[] }): Result<OpeningHours> {
    if (!props || typeof props.schedule !== 'object' || props.schedule === null) {
      return Result.fail<OpeningHours>(new ValidationError('Schedule is required'));
    }

    for (const day of Object.values(WEEKDAY)) {
      const intervals = props.schedule[day];
      if (!Array.isArray(intervals)) {
        return Result.fail<OpeningHours>(new ValidationError(`Schedule for ${day} must be an array of intervals`));
      }

      const ranges: Array<{ open: number; close: number }> = [];
      for (const interval of intervals) {
        if (!interval || !TIME_RE.test(interval.open) || !TIME_RE.test(interval.close)) {
          return Result.fail<OpeningHours>(new ValidationError(`Invalid time format for ${day}, expected HH:mm`));
        }
        const open = toMinutes(interval.open);
        const close = toMinutes(interval.close);
        if (close <= open) {
          return Result.fail<OpeningHours>(new ValidationError(`Closing time must be after opening time for ${day}`));
        }
        ranges.push({ open, close });
      }

      ranges.sort((a, b) => a.open - b.open);
      for (let i = 1; i < ranges.length; i++) {
        if (ranges[i].open < ranges[i - 1].close) {
          return Result.fail<OpeningHours>(new ValidationError(`Opening hour intervals overlap on ${day}`));
        }
      }
    }

    if (!Array.isArray(props.holidays)) {
      return Result.fail<OpeningHours>(new ValidationError('Holidays must be an array of YYYY-MM-DD dates'));
    }
    for (const holiday of props.holidays) {
      if (typeof holiday !== 'string' || !DATE_RE.test(holiday)) {
        return Result.fail<OpeningHours>(new ValidationError('Holiday dates must be in YYYY-MM-DD format'));
      }
    }

    return Result.ok<OpeningHours>(
      new OpeningHours({ schedule: props.schedule, holidays: [...props.holidays] })
    );
  }

  /**
   * @param datetime UTC instant to check.
   * @param tzOffsetMinutes offset (in minutes) added to UTC to obtain local time, e.g. +330 for IST.
   */
  public isOpenAt(datetime: Date, tzOffsetMinutes = 0): boolean {
    const local = new Date(datetime.getTime() + tzOffsetMinutes * 60_000);
    const dateStr = local.toISOString().slice(0, 10);
    if (this.props.holidays.includes(dateStr)) {
      return false;
    }

    const weekday = WEEKDAY_ORDER[local.getUTCDay()];
    const minutesOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();

    return this.props.schedule[weekday].some(
      (interval) => minutesOfDay >= toMinutes(interval.open) && minutesOfDay < toMinutes(interval.close)
    );
  }
}
