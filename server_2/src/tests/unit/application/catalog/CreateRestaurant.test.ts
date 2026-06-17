import { CreateRestaurant } from '../../../../application/catalog/use-cases/CreateRestaurant';
import { InMemoryRestaurantRepository } from '../../../mocks/catalog.mocks';
import { InMemoryUnitOfWork, InMemoryOutboxStore } from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { CreateRestaurantDto } from '../../../../application/catalog/dtos/CreateRestaurantDto';
import { RESTAURANT_STATUS } from '../../../../domain/catalog/enums/restaurant-status.enum';
import { CATALOG_VISIBILITY } from '../../../../domain/catalog/enums/catalog-visibility.enum';
import { CUISINE_TYPE } from '../../../../domain/catalog/enums/cuisine-type.enum';

function dto(overrides: Partial<CreateRestaurantDto> = {}): CreateRestaurantDto {
  return {
    actorId: 'owner-1',
    name: 'Spice Garden',
    cuisineTypes: [CUISINE_TYPE.NORTH_INDIAN],
    address: {
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      coordinates: { lat: 12.97, lng: 77.59 },
    },
    location: { lat: 12.97, lng: 77.59 },
    phone: '+919876543210',
    ...overrides,
  };
}

describe('CreateRestaurant use-case', () => {
  let restaurantRepo: InMemoryRestaurantRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: CreateRestaurant;

  beforeEach(() => {
    restaurantRepo = new InMemoryRestaurantRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new CreateRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus);
  });

  it('creates a DRAFT/HIDDEN restaurant owned by the actor and emits RestaurantCreated', async () => {
    const result = await useCase.execute(dto());

    expect(result.isSuccess).toBe(true);
    const response = result.getValue();
    expect(response.status).toBe(RESTAURANT_STATUS.DRAFT);
    expect(response.visibility).toBe(CATALOG_VISIBILITY.HIDDEN);

    const saved = await restaurantRepo.findById(response.id);
    expect(saved!.ownerId).toBe('owner-1'); // ownerId from actor, not body

    expect(outboxStore.appended).toHaveLength(1);
    expect(outboxStore.appended[0].eventName).toBe('RestaurantCreated');
    expect(eventBus.publishedEvents).toHaveLength(1);
  });

  it('ignores any ownerId in the body — owner is always the verified actor', async () => {
    // CreateRestaurantDto has no ownerId field; force one to prove it is not used.
    const result = await useCase.execute({ ...dto(), ownerId: 'attacker' } as unknown as CreateRestaurantDto);

    const saved = await restaurantRepo.findById(result.getValue().id);
    expect(saved!.ownerId).toBe('owner-1');
  });

  it('fails when the location coordinates are invalid (no persistence, no events)', async () => {
    const result = await useCase.execute(dto({ location: { lat: 999, lng: 77.59 } }));

    expect(result.isFailure).toBe(true);
    expect(outboxStore.appended).toHaveLength(0);
    expect(eventBus.publishedEvents).toHaveLength(0);
  });

  it('fails when the address coordinates are invalid', async () => {
    const result = await useCase.execute(
      dto({
        address: {
          street: '12 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pinCode: '560001',
          coordinates: { lat: 0, lng: 999 },
        },
      })
    );

    expect(result.isFailure).toBe(true);
    expect(outboxStore.appended).toHaveLength(0);
  });
});
