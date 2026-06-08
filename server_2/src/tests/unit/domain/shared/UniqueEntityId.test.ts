import { UniqueEntityId } from '../../../../domain/shared/UniqueEntityId';

describe('UniqueEntityId', () => {
  it('should auto-generate a v4 UUID when no id is provided', () => {
    const id1 = new UniqueEntityId();
    const id2 = new UniqueEntityId();

    expect(id1.toString()).toBeDefined();
    expect(id1.toString().length).toBe(36); // standard UUID v4 length
    expect(id1.toString()).not.toBe(id2.toString());
  });

  it('should wrap the provided id string', () => {
    const customId = 'my-custom-id-123';
    const id = new UniqueEntityId(customId);

    expect(id.toString()).toBe(customId);
  });

  it('should verify equality', () => {
    const id1 = new UniqueEntityId('id-1');
    const id2 = new UniqueEntityId('id-1');
    const id3 = new UniqueEntityId('id-2');

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });

  it('should handle null or undefined or other classes in equality', () => {
    const id = new UniqueEntityId('id-1');

    expect(id.equals(null as any)).toBe(false);
    expect(id.equals(undefined as any)).toBe(false);
    expect(id.equals('id-1' as any)).toBe(false);
  });
});
