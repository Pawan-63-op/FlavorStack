import { InMemoryUserRepository } from '../../../mocks/identity.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { Driver } from '../../../../domain/identity/entities/Driver';
import { VehicleInfo } from '../../../../domain/identity/value-objects/VehicleInfo.vo';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { ListCustomerAddresses } from '../../../../application/identity/use-cases/ListCustomerAddresses';
import { AddCustomerAddress } from '../../../../application/identity/use-cases/AddCustomerAddress';
import { UpdateCustomerAddress } from '../../../../application/identity/use-cases/UpdateCustomerAddress';
import { DeleteCustomerAddress } from '../../../../application/identity/use-cases/DeleteCustomerAddress';
import { SetDefaultCustomerAddress } from '../../../../application/identity/use-cases/SetDefaultCustomerAddress';

function makeCustomer(): Customer {
  const c = Customer.create({
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  c.pullDomainEvents();
  return c;
}

function makeDriver(): Driver {
  const vehicle = VehicleInfo.create({
    type: 'BIKE',
    brand: 'Honda',
    model: 'Activa',
    licensePlate: 'KA05XY9911',
    rcDocumentUrl: 'https://example.com/rc.png',
    insuranceUrl: 'https://example.com/ins.png',
  }).getValue();
  const d = Driver.create({
    name: 'Driver Dan',
    email: 'dan@example.com',
    phone: '+919811111111',
    passwordHash: 'hashed:Password1!',
    vehicle,
  });
  d.pullDomainEvents();
  return d;
}

const validInput = {
  label: 'Home',
  recipientName: 'Asha Rao',
  phone: '+919876543210',
  street: '100 Feet Road',
  city: 'Bangalore',
  state: 'Karnataka',
  pinCode: '560038',
  landmark: 'Near metro',
  deliveryInstructions: 'Ring twice',
  lat: 12.97,
  lng: 77.59,
};

describe('Customer address use-cases', () => {
  let userRepo: InMemoryUserRepository;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
  });

  describe('AddCustomerAddress', () => {
    it('adds an address, returns the list, and marks the first as default', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await new AddCustomerAddress(userRepo).execute({
        userId: customer._id,
        ...validInput,
      });

      expect(result.isSuccess).toBe(true);
      const list = result.getValue();
      expect(list).toHaveLength(1);
      expect(list[0].recipientName).toBe('Asha Rao');
      expect(list[0].landmark).toBe('Near metro');
      expect(list[0].coordinates).toEqual({ lat: 12.97, lng: 77.59 });
      expect(list[0].isDefault).toBe(true);

      const persisted = (await userRepo.findById(customer._id)) as Customer;
      expect(persisted.addresses).toHaveLength(1);
    });

    it('honours isDefault=true on a later address', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const add = new AddCustomerAddress(userRepo);

      await add.execute({ userId: customer._id, ...validInput });
      const result = await add.execute({
        userId: customer._id,
        ...validInput,
        label: 'Work',
        isDefault: true,
      });

      const list = result.getValue();
      expect(list).toHaveLength(2);
      const work = list.find((a) => a.label === 'Work')!;
      expect(work.isDefault).toBe(true);
      expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    });

    it('fails with ValidationError on a bad pin code', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await new AddCustomerAddress(userRepo).execute({
        userId: customer._id,
        ...validInput,
        pinCode: '123',
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('fails with NotFoundError for an unknown user', async () => {
      const result = await new AddCustomerAddress(userRepo).execute({
        userId: 'ghost',
        ...validInput,
      });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when the user is not a customer', async () => {
      const driver = makeDriver();
      await userRepo.save(driver);

      const result = await new AddCustomerAddress(userRepo).execute({
        userId: driver._id,
        ...validInput,
      });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
    });
  });

  describe('ListCustomerAddresses', () => {
    it('returns the saved addresses', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      await new AddCustomerAddress(userRepo).execute({ userId: customer._id, ...validInput });

      const result = await new ListCustomerAddresses(userRepo).execute({ userId: customer._id });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toHaveLength(1);
    });
  });

  describe('UpdateCustomerAddress', () => {
    it('replaces an existing address and keeps its id', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const added = (await new AddCustomerAddress(userRepo).execute({ userId: customer._id, ...validInput })).getValue();
      const id = added[0].id;

      const result = await new UpdateCustomerAddress(userRepo).execute({
        userId: customer._id,
        addressId: id,
        ...validInput,
        label: 'Work',
        city: 'Mysore',
      });

      const list = result.getValue();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(id);
      expect(list[0].label).toBe('Work');
      expect(list[0].city).toBe('Mysore');
    });

    it('fails with NotFoundError for an unknown addressId', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await new UpdateCustomerAddress(userRepo).execute({
        userId: customer._id,
        addressId: 'nope',
        ...validInput,
      });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('DeleteCustomerAddress', () => {
    it('removes the address and returns the remaining list', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const added = (await new AddCustomerAddress(userRepo).execute({ userId: customer._id, ...validInput })).getValue();

      const result = await new DeleteCustomerAddress(userRepo).execute({
        userId: customer._id,
        addressId: added[0].id,
      });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toHaveLength(0);
    });
  });

  describe('SetDefaultCustomerAddress', () => {
    it('switches the default flag to the chosen address', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);
      const add = new AddCustomerAddress(userRepo);
      await add.execute({ userId: customer._id, ...validInput });
      const second = (await add.execute({ userId: customer._id, ...validInput, label: 'Work' })).getValue();
      const workId = second.find((a) => a.label === 'Work')!.id;

      const result = await new SetDefaultCustomerAddress(userRepo).execute({
        userId: customer._id,
        addressId: workId,
      });

      const list = result.getValue();
      expect(list.find((a) => a.id === workId)!.isDefault).toBe(true);
      expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    });

    it('fails with NotFoundError for an unknown addressId', async () => {
      const customer = makeCustomer();
      await userRepo.save(customer);

      const result = await new SetDefaultCustomerAddress(userRepo).execute({
        userId: customer._id,
        addressId: 'nope',
      });
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });
  });
});
