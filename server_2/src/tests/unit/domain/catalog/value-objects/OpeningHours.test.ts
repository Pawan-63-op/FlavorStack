import { OpeningHours } from '../../../../../domain/catalog/value-objects/OpeningHours.vo';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';
import { WEEKDAY } from '../../../../../domain/catalog/enums/weekday.enum';

describe('OpeningHours Value Object', () => {
  const validSchedule = {
    [WEEKDAY.MONDAY]: [{ open: '09:00', close: '22:00' }],
    [WEEKDAY.TUESDAY]: [{ open: '09:00', close: '22:00' }],
    [WEEKDAY.WEDNESDAY]: [{ open: '09:00', close: '22:00' }],
    [WEEKDAY.THURSDAY]: [{ open: '09:00', close: '22:00' }],
    [WEEKDAY.FRIDAY]: [{ open: '09:00', close: '23:00' }],
    [WEEKDAY.SATURDAY]: [{ open: '10:00', close: '23:00' }],
    [WEEKDAY.SUNDAY]: [],
  };

  it('should create valid opening hours', () => {
    const result = OpeningHours.create({ schedule: validSchedule, holidays: ['2026-12-25'] });
    expect(result.isSuccess).toBe(true);
  });

  it('should fail when close <= open for an interval', () => {
    const schedule = { ...validSchedule, [WEEKDAY.MONDAY]: [{ open: '10:00', close: '09:00' }] };
    const result = OpeningHours.create({ schedule, holidays: [] });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail with invalid HH:mm time format', () => {
    const schedule = { ...validSchedule, [WEEKDAY.MONDAY]: [{ open: '9:00', close: '22:00' }] };
    const result = OpeningHours.create({ schedule, holidays: [] });

    expect(result.isFailure).toBe(true);
  });

  it('should fail when intervals overlap on the same day', () => {
    const schedule = {
      ...validSchedule,
      [WEEKDAY.MONDAY]: [
        { open: '09:00', close: '14:00' },
        { open: '13:00', close: '20:00' },
      ],
    };
    const result = OpeningHours.create({ schedule, holidays: [] });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should fail with invalid holiday date format', () => {
    const result = OpeningHours.create({ schedule: validSchedule, holidays: ['25-12-2026'] });
    expect(result.isFailure).toBe(true);
  });

  it('should report open/closed correctly based on weekday and time', () => {
    const hours = OpeningHours.create({ schedule: validSchedule, holidays: [] }).getValue();

    // 2026-06-15 is a Monday
    expect(hours.isOpenAt(new Date('2026-06-15T10:00:00Z'))).toBe(true);
    expect(hours.isOpenAt(new Date('2026-06-15T23:00:00Z'))).toBe(false);

    // Sunday has no intervals -> always closed
    expect(hours.isOpenAt(new Date('2026-06-14T12:00:00Z'))).toBe(false);
  });

  it('should report closed on a holiday even within normal hours', () => {
    const hours = OpeningHours.create({ schedule: validSchedule, holidays: ['2026-12-25'] }).getValue();

    // 2026-12-25 is a Friday, normally open 09:00-23:00
    expect(hours.isOpenAt(new Date('2026-12-25T10:00:00Z'))).toBe(false);
  });

  it('should support a tz offset in minutes', () => {
    const hours = OpeningHours.create({ schedule: validSchedule, holidays: [] }).getValue();

    // 2026-06-15T22:30:00Z is Monday 22:30 UTC -> closed (closes 22:00)
    // With +60min offset -> local time 23:30 Monday -> still closed (22:00 close)
    // With -60min offset -> local time 21:30 Monday -> open
    expect(hours.isOpenAt(new Date('2026-06-15T22:30:00Z'), -60)).toBe(true);
    expect(hours.isOpenAt(new Date('2026-06-15T22:30:00Z'), 60)).toBe(false);
  });
});
