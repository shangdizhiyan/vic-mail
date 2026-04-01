export type MailScene =
  | 'first_contact'
  | 'follow_up'
  | 'reply_customer'
  | 'inquiry_quote'
  | 'negotiation'
  | 'close_deal'
  | 'after_sales'
  | 'reactivation';

export type MailTone = 'professional' | 'friendly' | 'concise' | 'humorous';
export type ProviderId = 'minimaxi' | 'deepseek' | 'kimi' | 'qwen';

export interface MailRequest {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  country: string;
  language: string;
  industry: string;
  product: string;
  usp: string;
  customerCompany: string;
  customerName: string;
  customerRole: string;
  customerType: string;
  customerBackground: string;
  scene: MailScene;
  tone: MailTone;
  culturalAdaptation: boolean;
  length: 'short' | 'medium' | 'long';
  moq: string;
  priceTerms: string;
  paymentTerms: string;
  leadTime: string;
  certifications: string;
  extraRequirements: string;
  senderCompany: string;
}

export interface MailResponse {
  subject: string;
  body: string;
  followUpTip: string;
  toneNotes: string;
  model: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  model: string;
  baseUrl: string;
}

export interface ExternalOpenResult {
  ok: boolean;
}

declare global {
  interface Window {
    vicMail?: {
      generateMail: (payload: MailRequest) => Promise<MailResponse>;
      getDefaults: () => Promise<{ defaultBaseUrl: string; defaultModel: string }>;
      testConnection: (payload: Pick<MailRequest, 'apiKey' | 'baseUrl' | 'model'>) => Promise<ConnectionTestResult>;
      openGmailCompose: (payload: { subject: string; body: string }) => Promise<ExternalOpenResult>;
    };
  }
}

export {};
