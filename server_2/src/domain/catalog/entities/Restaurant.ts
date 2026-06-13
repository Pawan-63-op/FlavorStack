import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { NotFoundError } from '../../shared/errors/NotFoundError';
import { ConflictError } from '../../shared/errors/ConflictError';

import { Address } from '../../identity/value-objects/Address.vo';
import { GeoPoint } from '../../identity/value-objects/GeoPoint.vo';
import { GeoPolygon } from '../value-objects/GeoPolygon.vo';
import { OpeningHours } from '../value-objects/OpeningHours.vo';
import { DeliveryFeeMatrix } from '../value-objects/DeliveryFeeMatrix.vo';
import { CuisineType } from '../value-objects/CuisineType.vo';
import { CatalogVisibility } from '../value-objects/CatalogVisibility.vo';
import { RestaurantStatus } from '../value-objects/RestaurantStatus.vo';
import { RESTAURANT_STATUS } from '../enums/restaurant-status.enum';
import { CATALOG_VISIBILITY } from '../enums/catalog-visibility.enum';
import { Money } from '../../shared/Money';

import { Category } from './Category';
import { DeliveryZone } from './DeliveryZone';
import { CreateRestaurantInput } from '../types/CreateRestaurantInput';

import { RestaurantCreated } from '../events/RestaurantCreated';
import { RestaurantUpdated } from '../events/RestaurantUpdated';
import { RestaurantStatusChanged } from '../events/RestaurantStatusChanged';
import { CategoryAdded } from '../events/CategoryAdded';
import { CategoryUpdated } from '../events/CategoryUpdated';
import { DeliveryZoneChanged } from '../events/DeliveryZoneChanged';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface RestaurantProps {
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  cuisineTypes: CuisineType[];
  address: Address;
  location: GeoPoint;
  phone: string;
  imageUrl?: string;
  status: RestaurantStatus;
  visibility: CatalogVisibility;
  categories: Category[];
  openingHours?: OpeningHours;
  deliveryZones: DeliveryZone[];
  version: number;
  deletedAt: Date | null;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class Restaurant extends AggregateRoot<RestaurantProps> {
  // The `version` present when this aggregate was loaded from persistence (0 for a
  // freshly created one). `touch()` advances `props.version` past this on each
  // mutation; the repository uses it as the optimistic-lock guard while writing the
  // new `version`. See MongoRestaurantRepository.update.
  private readonly _persistedVersion: number;

  private constructor(props: RestaurantProps, id?: UniqueEntityId) {
    super(props, id);
    this._persistedVersion = props.version;
  }

  get persistedVersion(): number {
    return this._persistedVersion;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get cuisineTypes(): CuisineType[] {
    return [...this.props.cuisineTypes];
  }

  get address(): Address {
    return this.props.address;
  }

  get location(): GeoPoint {
    return this.props.location;
  }

  get phone(): string {
    return this.props.phone;
  }

  get imageUrl(): string | undefined {
    return this.props.imageUrl;
  }

  get status(): RestaurantStatus {
    return this.props.status;
  }

  get visibility(): CatalogVisibility {
    return this.props.visibility;
  }

  get categories(): Category[] {
    return [...this.props.categories];
  }

  get openingHours(): OpeningHours | undefined {
    return this.props.openingHours;
  }

  get deliveryZones(): DeliveryZone[] {
    return [...this.props.deliveryZones];
  }

  get version(): number {
    return this.props.version;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  private touch(): void {
    this.props.version += 1;
  }

  public static create(input: CreateRestaurantInput, id?: UniqueEntityId): Result<Restaurant> {
    const nameCheck = Guard.againstEmptyString(input.name, 'Name');
    if (nameCheck.isFailure) return Result.fail<Restaurant>(nameCheck.getError());

    const phoneCheck = Guard.againstEmptyString(input.phone, 'Phone');
    if (phoneCheck.isFailure) return Result.fail<Restaurant>(phoneCheck.getError());

    const ownerIdCheck = Guard.againstEmptyString(input.ownerId, 'OwnerId');
    if (ownerIdCheck.isFailure) return Result.fail<Restaurant>(ownerIdCheck.getError());

    if (!(input.address instanceof Address)) {
      return Result.fail<Restaurant>(new ValidationError('Address must be a valid Address value object'));
    }

    if (!(input.location instanceof GeoPoint)) {
      return Result.fail<Restaurant>(new ValidationError('Location must be a valid GeoPoint value object'));
    }

    if (!Array.isArray(input.cuisineTypes)) {
      return Result.fail<Restaurant>(new ValidationError('CuisineTypes must be an array'));
    }

    const cuisineTypes: CuisineType[] = [];
    for (const raw of input.cuisineTypes) {
      const cuisineResult = CuisineType.create(raw as any);
      if (cuisineResult.isFailure) return Result.fail<Restaurant>(cuisineResult.getError());
      cuisineTypes.push(cuisineResult.getValue());
    }

    let slug: string;
    if (input.slug !== undefined) {
      if (!SLUG_RE.test(input.slug)) {
        return Result.fail<Restaurant>(
          new ValidationError('Slug must be lowercase alphanumeric with single hyphen separators')
        );
      }
      slug = input.slug;
    } else {
      slug = slugify(input.name);
      if (!slug) {
        return Result.fail<Restaurant>(new ValidationError('Unable to derive a slug from the name'));
      }
    }

    const statusResult = RestaurantStatus.create(RESTAURANT_STATUS.DRAFT);
    if (statusResult.isFailure) return Result.fail<Restaurant>(statusResult.getError());

    const visibilityResult = CatalogVisibility.create(CATALOG_VISIBILITY.HIDDEN);
    if (visibilityResult.isFailure) return Result.fail<Restaurant>(visibilityResult.getError());

    const restaurant = new Restaurant(
      {
        ownerId: input.ownerId,
        name: input.name.trim(),
        slug,
        description: input.description,
        cuisineTypes,
        address: input.address,
        location: input.location,
        phone: input.phone.trim(),
        imageUrl: input.imageUrl,
        status: statusResult.getValue(),
        visibility: visibilityResult.getValue(),
        categories: [],
        deliveryZones: [],
        version: 0,
        deletedAt: null,
      },
      id
    );

    restaurant.addDomainEvent(
      new RestaurantCreated(restaurant.id.toString(), restaurant.ownerId, restaurant.name, restaurant.slug)
    );

    return Result.ok<Restaurant>(restaurant);
  }

  /**
   * Rebuild a Restaurant from already-valid persisted state. Unlike `create()`,
   * this raises no domain events and forces no initial status/visibility/version —
   * it is the repository's rehydration entry point. Callers (mappers) own
   * reconstructing the value objects from the stored document.
   */
  public static reconstitute(props: RestaurantProps, id: UniqueEntityId): Restaurant {
    return new Restaurant(props, id);
  }

  public updateProfile(changes: {
    name?: string;
    description?: string;
    cuisineTypes?: string[];
    address?: Address;
    location?: GeoPoint;
    phone?: string;
    imageUrl?: string;
  }): Result<void> {
    const changedFields: string[] = [];

    let nextName = this.props.name;
    if (changes.name !== undefined) {
      const nameCheck = Guard.againstEmptyString(changes.name, 'Name');
      if (nameCheck.isFailure) return Result.fail<void>(nameCheck.getError());
      nextName = changes.name.trim();
    }

    let nextPhone = this.props.phone;
    if (changes.phone !== undefined) {
      const phoneCheck = Guard.againstEmptyString(changes.phone, 'Phone');
      if (phoneCheck.isFailure) return Result.fail<void>(phoneCheck.getError());
      nextPhone = changes.phone.trim();
    }

    let nextCuisineTypes = this.props.cuisineTypes;
    if (changes.cuisineTypes !== undefined) {
      if (!Array.isArray(changes.cuisineTypes)) {
        return Result.fail<void>(new ValidationError('CuisineTypes must be an array'));
      }
      const cuisineTypes: CuisineType[] = [];
      for (const raw of changes.cuisineTypes) {
        const cuisineResult = CuisineType.create(raw as any);
        if (cuisineResult.isFailure) return Result.fail<void>(cuisineResult.getError());
        cuisineTypes.push(cuisineResult.getValue());
      }
      nextCuisineTypes = cuisineTypes;
    }

    if (changes.address !== undefined && !(changes.address instanceof Address)) {
      return Result.fail<void>(new ValidationError('Address must be a valid Address value object'));
    }

    if (changes.location !== undefined && !(changes.location instanceof GeoPoint)) {
      return Result.fail<void>(new ValidationError('Location must be a valid GeoPoint value object'));
    }

    if (changes.name !== undefined) {
      this.props.name = nextName;
      changedFields.push('name');
    }
    if (changes.description !== undefined) {
      this.props.description = changes.description;
      changedFields.push('description');
    }
    if (changes.cuisineTypes !== undefined) {
      this.props.cuisineTypes = nextCuisineTypes;
      changedFields.push('cuisineTypes');
    }
    if (changes.address !== undefined) {
      this.props.address = changes.address;
      changedFields.push('address');
    }
    if (changes.location !== undefined) {
      this.props.location = changes.location;
      changedFields.push('location');
    }
    if (changes.phone !== undefined) {
      this.props.phone = nextPhone;
      changedFields.push('phone');
    }
    if (changes.imageUrl !== undefined) {
      this.props.imageUrl = changes.imageUrl;
      changedFields.push('imageUrl');
    }

    if (changedFields.length === 0) {
      return Result.ok<void>();
    }

    this.touch();
    this.addDomainEvent(new RestaurantUpdated(this.id.toString(), changedFields));
    return Result.ok<void>();
  }

  // ── Status transitions ──────────────────────────────────────

  private hasActiveCategory(): boolean {
    return this.props.categories.some((c) => c.isActive);
  }

  public publish(): Result<void> {
    if (!this.hasActiveCategory()) {
      return Result.fail<void>(new ValidationError('Restaurant must have at least one active category to be published'));
    }

    const previous = this.props.status.value;
    const transitionResult = this.props.status.transitionTo(RESTAURANT_STATUS.ACTIVE);
    if (transitionResult.isFailure) return Result.fail<void>(transitionResult.getError());

    this.props.status = transitionResult.getValue();
    this.touch();
    this.addDomainEvent(new RestaurantStatusChanged(this.id.toString(), previous, RESTAURANT_STATUS.ACTIVE));
    return Result.ok<void>();
  }

  public pause(): Result<void> {
    const previous = this.props.status.value;
    const transitionResult = this.props.status.transitionTo(RESTAURANT_STATUS.PAUSED);
    if (transitionResult.isFailure) return Result.fail<void>(transitionResult.getError());

    this.props.status = transitionResult.getValue();
    this.touch();
    this.addDomainEvent(new RestaurantStatusChanged(this.id.toString(), previous, RESTAURANT_STATUS.PAUSED));
    return Result.ok<void>();
  }

  public close(): Result<void> {
    const previous = this.props.status.value;
    const transitionResult = this.props.status.transitionTo(RESTAURANT_STATUS.CLOSED);
    if (transitionResult.isFailure) return Result.fail<void>(transitionResult.getError());

    this.props.status = transitionResult.getValue();
    this.touch();
    this.addDomainEvent(new RestaurantStatusChanged(this.id.toString(), previous, RESTAURANT_STATUS.CLOSED));
    return Result.ok<void>();
  }

  public setVisibility(visibility: CatalogVisibility): Result<void> {
    if (!(visibility instanceof CatalogVisibility)) {
      return Result.fail<void>(new ValidationError('Visibility must be a valid CatalogVisibility value object'));
    }

    this.props.visibility = visibility;
    this.touch();
    this.addDomainEvent(new RestaurantUpdated(this.id.toString(), ['visibility']));
    return Result.ok<void>();
  }

  // ── Opening hours ───────────────────────────────────────────

  public setOpeningHours(openingHours: OpeningHours): Result<void> {
    if (!(openingHours instanceof OpeningHours)) {
      return Result.fail<void>(new ValidationError('OpeningHours must be a valid OpeningHours value object'));
    }

    this.props.openingHours = openingHours;
    this.touch();
    this.addDomainEvent(new RestaurantUpdated(this.id.toString(), ['openingHours']));
    return Result.ok<void>();
  }

  // ── Category management ─────────────────────────────────────

  public addCategory(label: string, sortOrder?: number): Result<Category> {
    const order = sortOrder ?? this.props.categories.length;
    const categoryResult = Category.create({ restaurantId: this.id.toString(), label, sortOrder: order });
    if (categoryResult.isFailure) return Result.fail<Category>(categoryResult.getError());

    const category = categoryResult.getValue();
    this.props.categories.push(category);
    this.touch();
    this.addDomainEvent(new CategoryAdded(this.id.toString(), category.id.toString(), category.label));
    return Result.ok<Category>(category);
  }

  private findCategory(categoryId: string): Category | undefined {
    return this.props.categories.find((c) => c.id.toString() === categoryId);
  }

  public updateCategory(
    categoryId: string,
    changes: { label?: string; sortOrder?: number; isActive?: boolean }
  ): Result<void> {
    const category = this.findCategory(categoryId);
    if (!category) {
      return Result.fail<void>(new NotFoundError(`Category not found: ${categoryId}`));
    }

    if (
      changes.isActive === false &&
      category.isActive &&
      this.props.status.value === RESTAURANT_STATUS.ACTIVE &&
      this.props.categories.filter((c) => c.isActive).length === 1
    ) {
      return Result.fail<void>(
        new ConflictError('Cannot deactivate the last active category while the restaurant is ACTIVE')
      );
    }

    if (changes.label !== undefined) {
      const labelResult = category.updateLabel(changes.label);
      if (labelResult.isFailure) return Result.fail<void>(labelResult.getError());
    }

    if (changes.sortOrder !== undefined) {
      const sortOrderResult = category.updateSortOrder(changes.sortOrder);
      if (sortOrderResult.isFailure) return Result.fail<void>(sortOrderResult.getError());
    }

    if (changes.isActive !== undefined) {
      if (changes.isActive) {
        category.activate();
      } else {
        category.deactivate();
      }
    }

    this.touch();
    this.addDomainEvent(new CategoryUpdated(this.id.toString(), categoryId, 'UPDATED'));
    return Result.ok<void>();
  }

  public reorderCategories(orderedCategoryIds: string[]): Result<void> {
    const currentIds = this.props.categories.map((c) => c.id.toString());

    if (orderedCategoryIds.length !== currentIds.length) {
      return Result.fail<void>(new ValidationError('Ordered category ids must match the restaurant\'s categories'));
    }

    const currentIdSet = new Set(currentIds);
    for (const id of orderedCategoryIds) {
      if (!currentIdSet.has(id)) {
        return Result.fail<void>(new ValidationError(`Unknown category id: ${id}`));
      }
    }

    orderedCategoryIds.forEach((id, index) => {
      const category = this.findCategory(id);
      category!.updateSortOrder(index);
    });

    this.touch();
    this.addDomainEvent(new CategoryUpdated(this.id.toString(), null, 'REORDERED'));
    return Result.ok<void>();
  }

  public removeCategory(categoryId: string): Result<void> {
    const category = this.findCategory(categoryId);
    if (!category) {
      return Result.fail<void>(new NotFoundError(`Category not found: ${categoryId}`));
    }

    if (
      category.isActive &&
      this.props.status.value === RESTAURANT_STATUS.ACTIVE &&
      this.props.categories.filter((c) => c.isActive).length === 1
    ) {
      return Result.fail<void>(
        new ConflictError('Cannot remove the last active category while the restaurant is ACTIVE')
      );
    }

    this.props.categories = this.props.categories.filter((c) => c.id.toString() !== categoryId);
    this.touch();
    this.addDomainEvent(new CategoryUpdated(this.id.toString(), categoryId, 'REMOVED'));
    return Result.ok<void>();
  }

  // ── Delivery zone management ────────────────────────────────

  public addZone(props: { polygon: GeoPolygon; feeMatrix: DeliveryFeeMatrix; minOrder: Money }): Result<DeliveryZone> {
    const zoneResult = DeliveryZone.create({
      restaurantId: this.id.toString(),
      polygon: props.polygon,
      feeMatrix: props.feeMatrix,
      minOrder: props.minOrder,
    });
    if (zoneResult.isFailure) return Result.fail<DeliveryZone>(zoneResult.getError());

    const zone = zoneResult.getValue();
    this.props.deliveryZones.push(zone);
    this.touch();
    this.addDomainEvent(new DeliveryZoneChanged(this.id.toString(), zone.id.toString(), 'ADDED'));
    return Result.ok<DeliveryZone>(zone);
  }

  private findZone(zoneId: string): DeliveryZone | undefined {
    return this.props.deliveryZones.find((z) => z.id.toString() === zoneId);
  }

  public updateZone(
    zoneId: string,
    changes: { polygon?: GeoPolygon; feeMatrix?: DeliveryFeeMatrix; minOrder?: Money }
  ): Result<void> {
    const zone = this.findZone(zoneId);
    if (!zone) {
      return Result.fail<void>(new NotFoundError(`Delivery zone not found: ${zoneId}`));
    }

    if (changes.polygon !== undefined) {
      if (!(changes.polygon instanceof GeoPolygon)) {
        return Result.fail<void>(new ValidationError('Polygon must be a valid GeoPolygon'));
      }
      zone.updatePolygon(changes.polygon);
    }

    if (changes.feeMatrix !== undefined) {
      if (!(changes.feeMatrix instanceof DeliveryFeeMatrix)) {
        return Result.fail<void>(new ValidationError('FeeMatrix must be a valid DeliveryFeeMatrix'));
      }
      zone.updateFeeMatrix(changes.feeMatrix);
    }

    if (changes.minOrder !== undefined) {
      if (!(changes.minOrder instanceof Money)) {
        return Result.fail<void>(new ValidationError('MinOrder must be a valid Money value'));
      }
      zone.updateMinOrder(changes.minOrder);
    }

    this.touch();
    this.addDomainEvent(new DeliveryZoneChanged(this.id.toString(), zoneId, 'UPDATED'));
    return Result.ok<void>();
  }

  public removeZone(zoneId: string): Result<void> {
    const zone = this.findZone(zoneId);
    if (!zone) {
      return Result.fail<void>(new NotFoundError(`Delivery zone not found: ${zoneId}`));
    }

    this.props.deliveryZones = this.props.deliveryZones.filter((z) => z.id.toString() !== zoneId);
    this.touch();
    this.addDomainEvent(new DeliveryZoneChanged(this.id.toString(), zoneId, 'REMOVED'));
    return Result.ok<void>();
  }

  // ── Soft delete ──────────────────────────────────────────────

  public softDelete(): Result<void> {
    if (this.props.deletedAt !== null) {
      return Result.fail<void>(new ConflictError('Restaurant is already deleted'));
    }

    this.props.deletedAt = new Date();
    this.touch();
    return Result.ok<void>();
  }
}
