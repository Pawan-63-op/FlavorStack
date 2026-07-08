import { Request, Response, NextFunction } from 'express';
import { GetProfile } from '../../../application/identity/use-cases/GetProfile';
import { UpdateProfile } from '../../../application/identity/use-cases/UpdateProfile';
import { AssignRole } from '../../../application/identity/use-cases/AssignRole';
import { GrantPermission } from '../../../application/identity/use-cases/GrantPermission';
import { BanUser } from '../../../application/identity/use-cases/BanUser';
import { UnbanUser } from '../../../application/identity/use-cases/UnbanUser';
import { SetDriverAvailability } from '../../../application/identity/use-cases/SetDriverAvailability';
import { VerifyDriver } from '../../../application/identity/use-cases/VerifyDriver';
import { ListDrivers } from '../../../application/identity/use-cases/ListDrivers';
import { ListUsers } from '../../../application/identity/use-cases/ListUsers';
import { ListCustomerAddresses } from '../../../application/identity/use-cases/ListCustomerAddresses';
import { AddCustomerAddress } from '../../../application/identity/use-cases/AddCustomerAddress';
import { UpdateCustomerAddress } from '../../../application/identity/use-cases/UpdateCustomerAddress';
import { DeleteCustomerAddress } from '../../../application/identity/use-cases/DeleteCustomerAddress';
import { SetDefaultCustomerAddress } from '../../../application/identity/use-cases/SetDefaultCustomerAddress';

export interface IdentityControllerDeps {
  getProfile: GetProfile;
  updateProfile: UpdateProfile;
  assignRole: AssignRole;
  grantPermission: GrantPermission;
  banUser: BanUser;
  unbanUser: UnbanUser;
  setDriverAvailability: SetDriverAvailability;
  verifyDriver: VerifyDriver;
  listDrivers: ListDrivers;
  listUsers: ListUsers;
  listCustomerAddresses: ListCustomerAddresses;
  addCustomerAddress: AddCustomerAddress;
  updateCustomerAddress: UpdateCustomerAddress;
  deleteCustomerAddress: DeleteCustomerAddress;
  setDefaultCustomerAddress: SetDefaultCustomerAddress;
}

export class IdentityController {
  constructor(private readonly deps: IdentityControllerDeps) {}

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getProfile.execute({ userId: req.user!.userId });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.updateProfile.execute({
      userId: req.user!.userId,
      name: req.body.name,
      avatarUrl: req.body.avatarUrl,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  setAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.setDriverAvailability.execute({
      userId: req.user!.userId,
      available: req.body.available,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  listAddresses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.listCustomerAddresses.execute({ userId: req.user!.userId });
    if (result.isFailure) {
      next(result.getError());
      return;
    }
    res.status(200).json(result.getValue());
  };

  addAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.addCustomerAddress.execute({
      userId: req.user!.userId,
      ...req.body,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }
    res.status(201).json(result.getValue());
  };

  updateAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.updateCustomerAddress.execute({
      userId: req.user!.userId,
      addressId: req.params.addressId as string,
      ...req.body,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }
    res.status(200).json(result.getValue());
  };

  deleteAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.deleteCustomerAddress.execute({
      userId: req.user!.userId,
      addressId: req.params.addressId as string,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }
    res.status(200).json(result.getValue());
  };

  setDefaultAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.setDefaultCustomerAddress.execute({
      userId: req.user!.userId,
      addressId: req.params.addressId as string,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }
    res.status(200).json(result.getValue());
  };

  verifyDriver = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.verifyDriver.execute({
      driverId: req.params.id as string,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  listDrivers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.listDrivers.execute({
      status: req.query.status as string | undefined,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const q = req.query as { page?: number; limit?: number; role?: string; search?: string };
    const limit = q.limit ?? 20;
    const page = q.page ?? 1;
    const result = await this.deps.listUsers.execute({
      limit,
      offset: (page - 1) * limit,
      role: q.role,
      search: q.search,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.assignRole.execute({
      actorId: req.user!.userId,
      targetUserId: req.params.userId as string,
      role: req.body.role,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  grantPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.grantPermission.execute({
      actorId: req.user!.userId,
      targetAdminId: req.params.adminId as string,
      resource: req.body.resource,
      action: req.body.action,
      scope: req.body.scope,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  banUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.banUser.execute({
      actorId: req.user!.userId,
      targetUserId: req.params.userId as string,
      reason: req.body.reason,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };

  unbanUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.unbanUser.execute({
      actorId: req.user!.userId,
      targetUserId: req.params.userId as string,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(204).send();
  };
}
