export interface IPushProvider {
  sendPush(token: string, title: string, body: string, data?: Record<string, string>): Promise<void>;
}
