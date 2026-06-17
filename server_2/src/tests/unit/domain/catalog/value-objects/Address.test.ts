import { Address as CatalogAddress } from '../../../../../domain/catalog/value-objects/Address.vo';
import { Address as IdentityAddress } from '../../../../../domain/identity/value-objects/Address.vo';

describe('Catalog Address Value Object (re-export)', () => {
  it('should re-export the identity Address VO unchanged', () => {
    expect(CatalogAddress).toBe(IdentityAddress);
  });
});
