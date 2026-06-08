import { UniqueEntityId } from './UniqueEntityId';

export abstract class Entity<T> {
  protected readonly _id: UniqueEntityId;
  protected readonly props: T;

  protected constructor(props: T, id?: UniqueEntityId) {
    this._id = id || new UniqueEntityId();
    this.props = props;
  }

  get id(): UniqueEntityId {
    return this._id;
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
    return this._id.equals(other._id);
  }

  public toJSON(): any {
    return {
      id: this._id.toString(),
      ...this.props
    };
  }
}
