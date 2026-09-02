export interface ComposedEmail {
  subject: string;
  body: string;
}

/**
 * Renders an identity email from the shared `notification_templates` store.
 *
 * Identity owns this port; the implementation lives over the Engagement-owned template
 * repository, mirroring `ICatalogGateway` (Phase 2) and `IFulfillmentGateway` (Phase 4) —
 * Identity never touches `NotificationTemplateModel` directly.
 *
 * Rendering happens in the API process at enqueue time so the email worker stays a dumb
 * transport with no copy and no Mongo dependency.
 */
export interface IEmailComposer {
  /** Returns `null` when no active EMAIL template exists for `templateKey`. */
  compose(templateKey: string, vars: Record<string, string>): Promise<ComposedEmail | null>;
}
