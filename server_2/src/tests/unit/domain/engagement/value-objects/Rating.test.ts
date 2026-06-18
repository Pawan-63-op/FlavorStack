import { Rating } from '../../../../../domain/engagement/value-objects/Rating';

describe('Rating', () => {
  it.each([1, 2, 3, 4, 5])('accepts %i', (value) => {
    const result = Rating.create(value);
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().value).toBe(value);
  });

  it.each([0, 6, -1, 1.5])('rejects %s', (value) => {
    const result = Rating.create(value as number);
    expect(result.isFailure).toBe(true);
  });

  it('is equal by value', () => {
    const a = Rating.create(4).getValue();
    const b = Rating.create(4).getValue();
    expect(a.equals(b)).toBe(true);
  });
});
