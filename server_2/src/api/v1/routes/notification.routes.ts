import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import {
  updatePreferencesSchema,
  notificationHistoryQuery,
  notificationIdParam,
} from '../validators/notification.validator';

export interface NotificationRoutesDeps {
  controller: NotificationController;
  tokenService: ITokenService;
}

export function createNotificationRoutes(deps: NotificationRoutesDeps): Router {
  const router = Router();
  const ctrl = deps.controller;
  const auth = authenticate(deps.tokenService);

  router.get('/me/notification-preferences', auth, ctrl.getPreferences);

  router.put(
    '/me/notification-preferences',
    auth,
    validate(updatePreferencesSchema, 'body'),
    ctrl.updatePreferences
  );

  router.get('/me/notifications', auth, validate(notificationHistoryQuery, 'query'), ctrl.getHistory);

  router.get('/me/notifications/unread-count', auth, ctrl.getUnreadCount);

  router.patch(
    '/me/notifications/:id/read',
    auth,
    validate(notificationIdParam, 'params'),
    ctrl.markRead
  );

  return router;
}
