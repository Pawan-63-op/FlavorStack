import { Request, Response, NextFunction } from 'express';
import { AddMenuItem } from '../../../../application/catalog/use-cases/AddMenuItem';
import { UpdateMenuItem } from '../../../../application/catalog/use-cases/UpdateMenuItem';
import { ToggleMenuItemAvailability } from '../../../../application/catalog/use-cases/ToggleMenuItemAvailability';
import { RemoveMenuItem } from '../../../../application/catalog/use-cases/RemoveMenuItem';
import { SetItemVariants } from '../../../../application/catalog/use-cases/SetItemVariants';
import { IImageStorage } from '../../../../domain/catalog/services/IImageStorage';
import { actorFrom } from './actor';

export interface MenuControllerDeps {
  addMenuItem: AddMenuItem;
  updateMenuItem: UpdateMenuItem;
  toggleMenuItemAvailability: ToggleMenuItemAvailability;
  removeMenuItem: RemoveMenuItem;
  setItemVariants: SetItemVariants;
  imageStorage: IImageStorage;
}

export class MenuController {
  constructor(private readonly deps: MenuControllerDeps) {}

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.addMenuItem.execute({
      ...actorFrom(req),
      restaurantId: req.params.id as string,
      ...req.body,
    });
    if (result.isFailure) return next(result.getError());
    res.status(201).json(result.getValue());
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.updateMenuItem.execute({
      ...actorFrom(req),
      itemId: req.params.id as string,
      ...req.body,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  toggleAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.toggleMenuItemAvailability.execute({
      ...actorFrom(req),
      itemId: req.params.id as string,
      ...req.body,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.removeMenuItem.execute({
      ...actorFrom(req),
      itemId: req.params.id as string,
    });
    if (result.isFailure) return next(result.getError());
    res.status(204).send();
  };

  setVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.setItemVariants.execute({
      ...actorFrom(req),
      itemId: req.params.id as string,
      groups: req.body.groups,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Empty image body' } });
      return;
    }

    const uploaded = await this.deps.imageStorage.upload({
      buffer,
      folder: `items/${req.params.id as string}`,
    });

    const result = await this.deps.updateMenuItem.execute({
      ...actorFrom(req),
      itemId: req.params.id as string,
      imageUrl: uploaded.url,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
