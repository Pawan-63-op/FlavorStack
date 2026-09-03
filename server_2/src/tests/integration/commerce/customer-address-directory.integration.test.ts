import { IdentityCustomerAddressDirectory } from '../../../infrastructure/services/IdentityCustomerAddressDirectory';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUserRepository } from '../../../infrastructure/repositories/UserRepository';
import { UserModel } from '../../../infrastructure/database/models/UserModel';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { buildCustomer, buildDriver } from '../identity/identity-fixtures';

/**
 * Phase 10.3: `/checkout` takes an `addressId` and resolves the delivery address (and so
 * the coordinates the delivery fee is computed from) through this directory. The unit
 * tests cover the resolution rules; this covers the part they cannot — that the lookup
 * actually round-trips a persisted `Customer.addresses` entry.
 */
describe('IdentityCustomerAddressDirectory', () => {
  let userRepo: MongoUserRepository;
  let directory: IdentityCustomerAddressDirectory;

  const savedAddress = () =>
    Address.create({
      label: 'Home',
      street: '1 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      coordinates: GeoPoint.create(12.97, 77.59).getValue(),
    }).getValue();

  beforeEach(() => {
    const txContext = new TransactionContext();
    userRepo = new MongoUserRepository(txContext);
    directory = new IdentityCustomerAddressDirectory(userRepo);
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  it('resolves a persisted address, coordinates intact', async () => {
    const customer = buildCustomer();
    const addressId = customer.addAddress(savedAddress());
    await userRepo.save(customer);

    const found = await directory.getAddress(customer._id, addressId);

    expect(found).toBeInstanceOf(Address);
    expect(found?.street).toBe('1 MG Road');
    expect(found?.pinCode).toBe('560001');
    expect(found?.coordinates.lat).toBe(12.97);
    expect(found?.coordinates.lng).toBe(77.59);
  });

  it("returns null for another customer's addressId — ownership is part of the lookup", async () => {
    const owner = buildCustomer();
    const addressId = owner.addAddress(savedAddress());
    await userRepo.save(owner);
    const other = buildCustomer();
    await userRepo.save(other);

    expect(await directory.getAddress(other._id, addressId)).toBeNull();
  });

  it('returns null for an unknown addressId', async () => {
    const customer = buildCustomer();
    customer.addAddress(savedAddress());
    await userRepo.save(customer);

    expect(await directory.getAddress(customer._id, 'no-such-address')).toBeNull();
  });

  it('returns null when the user is not a customer', async () => {
    const driver = buildDriver();
    await userRepo.save(driver);

    expect(await directory.getAddress(driver._id, 'any')).toBeNull();
  });

  it('returns null for an unknown user', async () => {
    expect(await directory.getAddress('no-such-user', 'any')).toBeNull();
  });
});
