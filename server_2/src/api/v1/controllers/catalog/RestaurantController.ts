// Thin HTTP delivery for the restaurant owner-write use-cases. Builds the use-case
// DTO from validated body/params + the verified actor, maps Result → HTTP, and
// delegates ALL business logic (incl. ownership) to the use-cases. Zero logic here.
import { Request, Response, NextFunction } from 'express';
import { CreateRestaurant } from '../../../../application/catalog/use-cases/CreateRestaurant';
import { UpdateRestaurant } from '../../../../application/catalog/use-cases/UpdateRestaurant';
import { PublishRestaurant } from '../../../../application/catalog/use-cases/PublishRestaurant';
import { PauseRestaurant } from '../../../../application/catalog/use-cases/PauseRestaurant';
import { CloseRestaurant } from '../../../../application/catalog/use-cases/CloseRestaurant';
import { DeleteRestaurant } from '../../../../application/catalog/use-cases/DeleteRestaurant';
import { SetRestaurantVisibility } from '../../../../application/catalog/use-cases/SetRestaurantVisibility';
import { SetOpeningHours } from '../../../../application/catalog/use-cases/SetOpeningHours';
import { AddCategory } from '../../../../application/catalog/use-cases/AddCategory';
import { UpdateCategory } from '../../../../application/catalog/use-cases/UpdateCategory';
import { ReorderCategories } from '../../../../application/catalog/use-cases/ReorderCategories';
import { RemoveCategory } from '../../../../application/catalog/use-cases/RemoveCategory';
import { ManageDeliveryZone } from '../../../../application/catalog/use-cases/ManageDeliveryZone';
import { IImageStorage } from '../../../../domain/catalog/services/IImageStorage';
import { actorFrom } from './actor';

export interface RestaurantControllerDeps {
  createRestaurant: CreateRestaurant;
  updateRestaurant: UpdateRestaurant;
  publishRestaurant: PublishRestaurant;
  pauseRestaurant: PauseRestaurant;
  closeRestaurant: CloseRestaurant;
  deleteRestaurant: DeleteRestaurant;
  setRestaurantVisibility: SetRestaurantVisibility;
  setOpeningHours: SetOpeningHours;
  addCategory: AddCategory;
  updateCategory: UpdateCategory;
  reorderCategories: ReorderCategories;
  removeCategory: RemoveCategory;
  manageDeliveryZone: ManageDeliveryZone;
  imageStorage: IImageStorage;
}

export class RestaurantController {
  constructor(private readonly deps: RestaurantControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.createRestaurant.execute({ ...actorFrom(req), ...req.body });
    if (result.isFailure) return next(result.getError());
    res.status(201).json(result.getValue());
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.updateRestaurant.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      ...req.body,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.publishRestaurant.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  pause = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.pauseRestaurant.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.closeRestaurant.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.deleteRestaurant.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
    });
    if (result.isFailure) return next(result.getError());
    res.status(204).send();
  };

  setVisibility = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.setRestaurantVisibility.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      visibility: req.body.visibility,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  setOpeningHours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.setOpeningHours.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      schedule: req.body.schedule,
      holidays: req.body.holidays,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  addCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.addCategory.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      label: req.body.label,
      sortOrder: req.body.sortOrder,
    });
    if (result.isFailure) return next(result.getError());
    res.status(201).json(result.getValue());
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.updateCategory.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      categoryId: req.params.categoryId as string,
      ...req.body,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  reorderCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.reorderCategories.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      orderedCategoryIds: req.body.orderedCategoryIds,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  removeCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.removeCategory.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      categoryId: req.params.categoryId as string,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  manageZone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.manageDeliveryZone.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      ...req.body,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  // Upload binary → IImageStorage, then persist the returned URL on the restaurant
  // via the ownership-checked UpdateRestaurant use-case. Domain stores only the URL.
  uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Empty image body' } });
      return;
    }

    const uploaded = await this.deps.imageStorage.upload({
      buffer,
      folder: `restaurants/${req.params.id as string}`,
    });

    const result = await this.deps.updateRestaurant.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      imageUrl: uploaded.url,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
