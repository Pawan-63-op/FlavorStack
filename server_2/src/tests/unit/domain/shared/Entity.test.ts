import { Entity } from '../../../../src/domain/shared/Entity';
import { UniqueEntityId } from '../../../../src/domain/shared/UniqueEntityId';

interface TestEntityProps {
  name: string;
  age: number;
}

class TestEntity extends Entity<TestEntityProps> {
  public static create(props: TestEntityProps, id?: UniqueEntityId): TestEntity {
    return new TestEntity(props, id);
  }
}

class DifferentEntity extends Entity<TestEntityProps> {
  public static create(props: TestEntityProps, id?: UniqueEntityId): DifferentEntity {
    return new DifferentEntity(props, id);
  }
}

describe('Entity', () => {
  it('should auto-generate a UniqueEntityId if not provided', () => {
    const entity = TestEntity.create({ name: 'Bob', age: 30 });
    expect(entity.id).toBeInstanceOf(UniqueEntityId);
    expect(entity.id.toString()).toBeDefined();
  });

  it('should use the provided UniqueEntityId', () => {
    const customId = new UniqueEntityId();
    const entity = TestEntity.create({ name: 'Bob', age: 30 }, customId);
    expect(entity.id).toBe(customId);
  });

  it('should evaluate equality based on class and id', () => {
    const commonId = new UniqueEntityId('common-id');
    const entity1 = TestEntity.create({ name: 'Bob', age: 30 }, commonId);
    const entity2 = TestEntity.create({ name: 'Alice', age: 25 }, commonId); // different props, same ID
    const entity3 = TestEntity.create({ name: 'Bob', age: 30 }); // different ID
    const diffEntity = DifferentEntity.create({ name: 'Bob', age: 30 }, commonId); // different class, same ID

    expect(entity1.equals(entity2)).toBe(true);
    expect(entity1.equals(entity3)).toBe(false);
    expect(entity1.equals(diffEntity)).toBe(false);
    expect(entity1.equals(null as any)).toBe(false);
    expect(entity1.equals(undefined as any)).toBe(false);
  });

  it('should serialize to JSON correctly', () => {
    const customId = new UniqueEntityId('bob-id');
    const entity = TestEntity.create({ name: 'Bob', age: 30 }, customId);

    expect(entity.toJSON()).toEqual({
      id: 'bob-id',
      name: 'Bob',
      age: 30
    });
  });
});
