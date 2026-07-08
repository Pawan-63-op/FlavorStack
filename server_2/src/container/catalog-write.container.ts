import type { Connection } from 'mongoose';
import { IEventBus } from '../application/shared/events/IEventBus';

import { MongoRestaurantRepository } from '../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../infrastructure/repositories/MenuItemRepository';
import { MongoUnitOfWork } from '../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../infrastructure/database/MongoOutboxStore';
import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { InMemoryImageStorage } from '../infrastructure/external/storage/InMemoryImageStorage';
import { CloudinaryImageStorage } from '../infrastructure/external/cloudinary/CloudinaryImageStorage';
import { RealCloudinaryClient } from '../infrastructure/external/cloudinary/RealCloudinaryClient';
import { getCloudinaryConfig } from '../config/cloudinary';
import { IImageStorage } from '../domain/catalog/services/IImageStorage';

import { CreateRestaurant } from '../application/catalog/use-cases/CreateRestaurant';
import { ListOwnerRestaurants } from '../application/catalog/use-cases/ListOwnerRestaurants';
import { UpdateRestaurant } from '../application/catalog/use-cases/UpdateRestaurant';
import { PublishRestaurant } from '../application/catalog/use-cases/PublishRestaurant';
import { PauseRestaurant } from '../application/catalog/use-cases/PauseRestaurant';
import { CloseRestaurant } from '../application/catalog/use-cases/CloseRestaurant';
import { DeleteRestaurant } from '../application/catalog/use-cases/DeleteRestaurant';
import { SetRestaurantVisibility } from '../application/catalog/use-cases/SetRestaurantVisibility';
import { SetOpeningHours } from '../application/catalog/use-cases/SetOpeningHours';
import { AddCategory } from '../application/catalog/use-cases/AddCategory';
import { UpdateCategory } from '../application/catalog/use-cases/UpdateCategory';
import { ReorderCategories } from '../application/catalog/use-cases/ReorderCategories';
import { RemoveCategory } from '../application/catalog/use-cases/RemoveCategory';
import { ManageDeliveryZone } from '../application/catalog/use-cases/ManageDeliveryZone';
import { AddMenuItem } from '../application/catalog/use-cases/AddMenuItem';
import { UpdateMenuItem } from '../application/catalog/use-cases/UpdateMenuItem';
import { ToggleMenuItemAvailability } from '../application/catalog/use-cases/ToggleMenuItemAvailability';
import { RemoveMenuItem } from '../application/catalog/use-cases/RemoveMenuItem';
import { SetItemVariants } from '../application/catalog/use-cases/SetItemVariants';

export interface CatalogCommandUseCases {
  createRestaurant: CreateRestaurant;
  listOwnerRestaurants: ListOwnerRestaurants;
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
  addMenuItem: AddMenuItem;
  updateMenuItem: UpdateMenuItem;
  toggleMenuItemAvailability: ToggleMenuItemAvailability;
  removeMenuItem: RemoveMenuItem;
  setItemVariants: SetItemVariants;
}

export interface CatalogWriteContainer {
  imageStorage: IImageStorage;
  commands: CatalogCommandUseCases;
}

export function createCatalogWriteContainer(
  connection: Connection,
  eventBus: IEventBus,
): CatalogWriteContainer {
  const txContext = new TransactionContext();
  const restaurantRepo = new MongoRestaurantRepository(txContext);
  const menuItemRepo = new MongoMenuItemRepository(txContext);
  const unitOfWork = new MongoUnitOfWork(connection, txContext);
  const outboxStore = new MongoOutboxStore(txContext);

  const cloudinaryConfig = getCloudinaryConfig();
  const imageStorage: IImageStorage = cloudinaryConfig
    ? new CloudinaryImageStorage(new RealCloudinaryClient(cloudinaryConfig))
    : new InMemoryImageStorage();

  return {
    imageStorage,
    commands: {
      createRestaurant: new CreateRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus),
      listOwnerRestaurants: new ListOwnerRestaurants(restaurantRepo),
      updateRestaurant: new UpdateRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus),
      publishRestaurant: new PublishRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus),
      pauseRestaurant: new PauseRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus),
      closeRestaurant: new CloseRestaurant(restaurantRepo, unitOfWork, outboxStore, eventBus),
      deleteRestaurant: new DeleteRestaurant(restaurantRepo, unitOfWork),
      setRestaurantVisibility: new SetRestaurantVisibility(
        restaurantRepo,
        unitOfWork,
        outboxStore,
        eventBus,
      ),
      setOpeningHours: new SetOpeningHours(restaurantRepo, unitOfWork, outboxStore, eventBus),
      addCategory: new AddCategory(restaurantRepo, unitOfWork, outboxStore, eventBus),
      updateCategory: new UpdateCategory(restaurantRepo, unitOfWork, outboxStore, eventBus),
      reorderCategories: new ReorderCategories(restaurantRepo, unitOfWork, outboxStore, eventBus),
      removeCategory: new RemoveCategory(restaurantRepo, unitOfWork, outboxStore, eventBus),
      manageDeliveryZone: new ManageDeliveryZone(restaurantRepo, unitOfWork, outboxStore, eventBus),
      addMenuItem: new AddMenuItem(restaurantRepo, menuItemRepo, unitOfWork, outboxStore, eventBus),
      updateMenuItem: new UpdateMenuItem(
        restaurantRepo,
        menuItemRepo,
        unitOfWork,
        outboxStore,
        eventBus,
      ),
      toggleMenuItemAvailability: new ToggleMenuItemAvailability(
        restaurantRepo,
        menuItemRepo,
        unitOfWork,
        outboxStore,
        eventBus,
      ),
      removeMenuItem: new RemoveMenuItem(restaurantRepo, menuItemRepo, unitOfWork),
      setItemVariants: new SetItemVariants(
        restaurantRepo,
        menuItemRepo,
        unitOfWork,
        outboxStore,
        eventBus,
      ),
    },
  };
}
