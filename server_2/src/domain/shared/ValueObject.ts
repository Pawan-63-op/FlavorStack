export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze({ ...props });
  }

  public equals(vo?: ValueObject<T> | null): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return this.deepEquals(this.props, vo.props);
  }

  private deepEquals(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
      return false;
    }

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEquals(a[key], b[key])) return false;
    }
    return true;
  }
}
