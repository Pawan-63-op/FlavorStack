import { INotificationTemplateRepository } from '../../../domain/engagement/repositories/INotificationTemplateRepository';
import { seedNotificationTemplates } from './notification-templates.seed';

export { seedNotificationTemplates } from './notification-templates.seed';

/** Dependencies the registered seeds need (repositories already bound to the live connection). */
export interface SeedDeps {
  notificationTemplateRepo: INotificationTemplateRepository;
}

/** Per-seed creation counts, surfaced so bootstrap can log what (if anything) was created. */
export interface SeedResult {
  notificationTemplatesCreated: number;
}

/**
 * Run every registered seed in order. Idempotent: existing rows are left untouched, so this is
 * safe to invoke on each boot of whichever process owns seeding. Returns the per-seed creation
 * counts (0 when everything already existed).
 */
export async function runSeeds(deps: SeedDeps): Promise<SeedResult> {
  const notificationTemplatesCreated = await seedNotificationTemplates(deps.notificationTemplateRepo);
  return { notificationTemplatesCreated };
}
