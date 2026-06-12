// Resend API key, from address, and app base URL for email links
export interface EmailConfig {
  apiKey: string;
  from: string;
  appBaseUrl: string;
}

export function getEmailConfig(): EmailConfig {
  return {
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'no-reply@flavorstack.app',
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  };
}
