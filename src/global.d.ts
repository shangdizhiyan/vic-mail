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
export type ProviderId = 'minimaxi' | 'deepseek' | 'kimi' | 'qwen' | 'openai' | 'claude' | 'gemini';
export type LanguageMode = 'auto' | 'single' | 'bilingual';
export type CustomerStage = 'prospecting' | 'contacted' | 'engaged' | 'quoting' | 'negotiating' | 'closing' | 'after_sales' | 'revival';
export type ResponseStatus = 'new' | 'no_reply' | 'replied' | 'interested' | 'quoted' | 'negotiating' | 'inactive';

export interface MailRequest {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  country: string;
  languageMode: LanguageMode;
  language: string;
  secondaryLanguage: string;
  industry: string;
  industryPack: string;
  product: string;
  usp: string;
  sceneStrategy: string;
  customerCompany: string;
  customerName: string;
  customerRole: string;
  customerType: string;
  customerSource: string;
  customerBackground: string;
  customerStage: CustomerStage;
  responseStatus: ResponseStatus;
  followUpCount: number;
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

export interface ExportMailPayload {
  subject: string;
  body: string;
  customerCompany?: string;
  customerName?: string;
  scene?: MailScene;
}

export interface SavedProviderSettings {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  senderCompany: string;
}

export interface GrammarCheckPayload {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  language: string;
  subject: string;
  body: string;
}

export interface GrammarCheckResult {
  verdict: 'correct' | 'needs_fix';
  summary: string;
  issues: string[];
}

export interface GrammarFixResult {
  subject: string;
  body: string;
  summary: string;
}

declare global {
  interface Window {
    vicMail?: {
      generateMail: (payload: MailRequest) => Promise<MailResponse>;
      getDefaults: () => Promise<{ defaultBaseUrl: string; defaultModel: string }>;
      testConnection: (payload: Pick<MailRequest, 'apiKey' | 'baseUrl' | 'model'>) => Promise<ConnectionTestResult>;
      openGmailCompose: (payload: { subject: string; body: string }) => Promise<ExternalOpenResult>;
      getSavedProviderSettings: () => Promise<Partial<SavedProviderSettings>>;
      saveProviderSettings: (payload: SavedProviderSettings) => Promise<{ ok: boolean }>;
      exportTxt: (payload: ExportMailPayload) => Promise<{ ok: boolean; filePath?: string }>;
      exportDocx: (payload: ExportMailPayload) => Promise<{ ok: boolean; filePath?: string }>;
      checkGrammar: (payload: GrammarCheckPayload) => Promise<GrammarCheckResult>;
      fixGrammar: (payload: GrammarCheckPayload) => Promise<GrammarFixResult>;
    };
  }
}

export {};
