// Thin HTTP delivery for the public catalog read/query use-cases. No auth, no
// actor context. Validated query params are already coerced to the right types
// by the route's `validate(schema, 'query')`; the query use-cases filter out
// non-public / closed / unavailable rows.
import { Request, Response, NextFunction } from 'express';
import { GetRestaurant } from '../../../../application/catalog/use-cases/GetRestaurant';
import { ListRestaurants } from '../../../../application/catalog/use-cases/ListRestaurants';
import { GetRestaurantMenu } from '../../../../application/catalog/use-cases/GetRestaurantMenu';
import { GetMenuItem } from '../../../../application/catalog/use-cases/GetMenuItem';
import { GetItemsSnapshot } from '../../../../application/catalog/use-cases/GetItemsSnapshot';
import { CheckServiceability } from '../../../../application/catalog/use-cases/CheckServiceability';
import { SearchRestaurants } from '../../../../application/catalog/use-cases/SearchRestaurants';
import { SearchMenuItems } from '../../../../application/catalog/use-cases/SearchMenuItems';
import { GetNearbyRestaurants } from '../../../../application/catalog/use-cases/GetNearbyRestaurants';

const DEFAULT_RADIUS_METERS = 5000;

export interface DiscoveryControllerDeps {
  getRestaurant: GetRestaurant;
  listRestaurants: ListRestaurants;
  getRestaurantMenu: GetRestaurantMenu;
  getMenuItem: GetMenuItem;
  getItemsSnapshot: GetItemsSnapshot;
  checkServiceability: CheckServiceability;
  searchRestaurants: SearchRestaurants;
  searchMenuItems: SearchMenuItems;
  getNearbyRestaurants: GetNearbyRestaurants;
}

export class DiscoveryController {
  constructor(private readonly deps: DiscoveryControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const result = await this.deps.listRestaurants.execute({
      cuisineTypes: q.cuisineTypes as never,
      isOpen: q.isOpen as boolean | undefined,
      cursor: q.cursor as string | undefined,
      limit: q.limit as number | undefined,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getRestaurant.execute({ restaurantId: req.params.id as string });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  getMenu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getRestaurantMenu.execute({ restaurantId: req.params.id as string });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getMenuItem.execute({ itemId: req.params.id as string });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  itemsSnapshot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const result = await this.deps.getItemsSnapshot.execute({ itemIds: q.ids as string[] });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  searchRestaurants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const result = await this.deps.searchRestaurants.execute({
      query: q.q as string,
      cuisineTypes: q.cuisineTypes as never,
      isOpenNow: q.isOpenNow as boolean | undefined,
      cursor: q.cursor as string | undefined,
      limit: q.limit as number | undefined,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  searchItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const result = await this.deps.searchMenuItems.execute({
      query: q.q as string,
      dietary: q.dietary as never,
      isAvailable: q.isAvailable as boolean | undefined,
      restaurantId: q.restaurantId as string | undefined,
      cursor: q.cursor as string | undefined,
      limit: q.limit as number | undefined,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  nearby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const result = await this.deps.getNearbyRestaurants.execute({
      lat: q.lat as number,
      lng: q.lng as number,
      radiusMeters: (q.radiusMeters as number | undefined) ?? DEFAULT_RADIUS_METERS,
      cuisineTypes: q.cuisineTypes as never,
      isOpenNow: q.isOpenNow as boolean | undefined,
      cursor: q.cursor as string | undefined,
      limit: q.limit as number | undefined,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  serviceability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const result = await this.deps.checkServiceability.execute({
      lat: q.lat as number,
      lng: q.lng as number,
      subtotalAmount: q.subtotalAmount as number | undefined,
      currency: q.currency as string | undefined,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
