import { ValueObject } from '../../../../domain/shared/ValueObject';

interface TestVoProps {
  name: string;
  count: number;
  tags: string[];
  meta?: {
    date: Date;
    flag: boolean;
  };
}

class TestValueObject extends ValueObject<TestVoProps> {
  public static create(props: TestVoProps): TestValueObject {
    return new TestValueObject(props);
  }

  get testProps() {
    return this.props;
  }
}

describe('ValueObject', () => {
  const date = new Date('2026-06-08T00:00:00Z');

  it('should freeze props on creation to prevent mutations', () => {
    const vo = TestValueObject.create({
      name: 'VO',
      count: 1,
      tags: ['tag1']
    });

    expect(Object.isFrozen(vo.testProps)).toBe(true);
    expect(() => {
      (vo.testProps as any).count = 2;
    }).toThrow();
  });

  it('should compare structural equality correctly', () => {
    const vo1 = TestValueObject.create({
      name: 'VO',
      count: 1,
      tags: ['tag1'],
      meta: { date, flag: true }
    });

    const vo2 = TestValueObject.create({
      name: 'VO',
      count: 1,
      tags: ['tag1'],
      meta: { date: new Date('2026-06-08T00:00:00Z'), flag: true }
    });

    const vo3 = TestValueObject.create({
      name: 'VO',
      count: 1,
      tags: ['tag1', 'tag2'], // different tags
      meta: { date, flag: true }
    });

    const vo4 = TestValueObject.create({
      name: 'VO',
      count: 1,
      tags: ['tag1'],
      meta: { date: new Date('2026-06-09T00:00:00Z'), flag: true } // different date
    });

    expect(vo1.equals(vo2)).toBe(true);
    expect(vo1.equals(vo3)).toBe(false);
    expect(vo1.equals(vo4)).toBe(false);
    expect(vo1.equals(undefined)).toBe(false);
    expect(vo1.equals(null)).toBe(false);
  });
});
