import { randomUUID } from 'crypto';

export class UniqueEntityId {
  private readonly value: string;

  constructor(id?: string) {
    this.value = id || randomUUID();
  }

  public toString(): string {
    return this.value;
  }

  public equals(other?: UniqueEntityId | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (!(other instanceof UniqueEntityId)) {
      return false;
    }
    return this.value === other.value;
  }
}
