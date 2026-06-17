import { RestaurantStatus } from '../../../../../domain/catalog/value-objects/RestaurantStatus.vo';
import { RESTAURANT_STATUS } from '../../../../../domain/catalog/enums/restaurant-status.enum';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

describe('RestaurantStatus Value Object', () => {
  it('should create a valid status', () => {
    const result = RestaurantStatus.create(RESTAURANT_STATUS.DRAFT);
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().value).toBe(RESTAURANT_STATUS.DRAFT);
  });

  it('should fail for an unknown status value', () => {
    const result = RestaurantStatus.create('ARCHIVED' as any);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('should allow DRAFT -> ACTIVE', () => {
    const status = RestaurantStatus.create(RESTAURANT_STATUS.DRAFT).getValue();
    const result = status.transitionTo(RESTAURANT_STATUS.ACTIVE);
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().value).toBe(RESTAURANT_STATUS.ACTIVE);
  });

  it('should allow ACTIVE <-> PAUSED', () => {
    const active = RestaurantStatus.create(RESTAURANT_STATUS.ACTIVE).getValue();
    expect(active.transitionTo(RESTAURANT_STATUS.PAUSED).isSuccess).toBe(true);

    const paused = RestaurantStatus.create(RESTAURANT_STATUS.PAUSED).getValue();
    expect(paused.transitionTo(RESTAURANT_STATUS.ACTIVE).isSuccess).toBe(true);
  });

  it('should allow ACTIVE -> CLOSED and PAUSED -> CLOSED', () => {
    const active = RestaurantStatus.create(RESTAURANT_STATUS.ACTIVE).getValue();
    expect(active.transitionTo(RESTAURANT_STATUS.CLOSED).isSuccess).toBe(true);

    const paused = RestaurantStatus.create(RESTAURANT_STATUS.PAUSED).getValue();
    expect(paused.transitionTo(RESTAURANT_STATUS.CLOSED).isSuccess).toBe(true);
  });

  it('should reject DRAFT -> PAUSED, DRAFT -> CLOSED, and any transition out of CLOSED', () => {
    const draft = RestaurantStatus.create(RESTAURANT_STATUS.DRAFT).getValue();
    expect(draft.transitionTo(RESTAURANT_STATUS.PAUSED).isFailure).toBe(true);
    expect(draft.transitionTo(RESTAURANT_STATUS.CLOSED).isFailure).toBe(true);

    const closed = RestaurantStatus.create(RESTAURANT_STATUS.CLOSED).getValue();
    expect(closed.transitionTo(RESTAURANT_STATUS.ACTIVE).isFailure).toBe(true);
    expect(closed.transitionTo(RESTAURANT_STATUS.DRAFT).isFailure).toBe(true);
  });

  it('transitionTo failure should return a ValidationError', () => {
    const draft = RestaurantStatus.create(RESTAURANT_STATUS.DRAFT).getValue();
    const result = draft.transitionTo(RESTAURANT_STATUS.CLOSED);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });
});
