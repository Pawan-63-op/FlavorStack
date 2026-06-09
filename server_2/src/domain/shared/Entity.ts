import { UniqueEntityId } from './UniqueEntityId';

export abstract class Entity<T> {
  // Private so subclasses cannot shadow it; access via the `id` getter only.
  private readonly _entityId: UniqueEntityId;
  protected readonly props: T;

  protected constructor(props: T, id?: UniqueEntityId) {
    this._entityId = id || new UniqueEntityId();
    this.props = props;
  }

  get id(): UniqueEntityId {
    return this._entityId;
  }

  public equals(other?: Entity<T> | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    if (Object.getPrototypeOf(this) !== Object.getPrototypeOf(other)) {
      return false;
    }
    return this._entityId.equals((other as any)._entityId);
  }

  public toJSON(): any {
    return {
      id: this._entityId.toString(),
      ...this.props
    };
  }
}
