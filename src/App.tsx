
import { useEffect, useMemo, useState } from 'react';
import './app.css';
import brandIcon from './assets/vic-mail-icon.png';
import type { CustomerStage, GrammarCheckResult, GrammarFixResult, LanguageMode, MailRequest, MailResponse, MailScene, MailTone, ProviderId, ResponseStatus, SavedProviderSettings } from './global';

type WorkspaceView = 'workspace' | 'history' | 'templates' | 'customers' | 'settings';

interface HistoryRecord {
  id: string;
  createdAt: string;
  provider: ProviderId;
  model: string;
  scene: MailScene;
  tone: MailTone;
  country: string;
  language: string;
  product: string;
  customerCompany: string;
  customerName: string;
  subject: string;
  body: string;
  followUpTip: string;
  toneNotes: string;
}

interface TemplateRecord {
  id: string;
  name: string;
  category: 'system' | 'custom';
  createdAt: string;
  updatedAt: string;
  provider: ProviderId;
  scene: MailScene;
  tone: MailTone;
  language: string;
  industry: string;
  industryPack: string;
  source: string;
  sceneStrategy: string;
  subject: string;
  body: string;
  notes: string;
}

interface CustomerRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  company: string;
  contactName: string;
  source: string;
  country: string;
  language: string;
  role: string;
  customerType: string;
  stage: CustomerStage;
  responseStatus: ResponseStatus;
  followUpCount: number;
  industry: string;
  notes: string;
}

interface ReviewItem {
  id: string;
  level: 'good' | 'watch' | 'risk';
  title: string;
  detail: string;
}

interface SequenceStep {
  id: string;
  dayLabel: string;
  title: string;
  angle: string;
  cta: string;
}

interface SubjectVariant {
  id: string;
  style: string;
  value: string;
}

interface GoalSignal {
  id: string;
  label: string;
  status: 'strong' | 'partial' | 'missing';
  detail: string;
}

interface BatchDraft {
  id: string;
  customerId: string;
  customerCompany: string;
  scene: MailScene;
  status: 'success' | 'failed';
  error?: string;
  request: MailRequest;
  response?: MailResponse;
}

interface IndustryPack {
  id: string;
  label: string;
  helper: string;
  defaultIndustry: string;
  suggestedUSP: string;
}

interface SourcePack {
  id: string;
  label: string;
  helper: string;
}

const FORM_STORAGE_KEY = 'vic-mail-form';
const HISTORY_STORAGE_KEY = 'vic-mail-history';
const TEMPLATE_STORAGE_KEY = 'vic-mail-templates';
const CUSTOMER_STORAGE_KEY = 'vic-mail-customers';

const providerPresets = [
  { id: 'minimaxi', label: 'MiniMax', helper: '国内版默认预设', baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-M2.1' },
  { id: 'deepseek', label: 'DeepSeek', helper: 'DeepSeek 官方兼容接口', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'kimi', label: 'Kimi', helper: 'Moonshot 官方接口', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2' },
  { id: 'qwen', label: 'Qwen', helper: '阿里云百炼兼容接口', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'openai', label: 'ChatGPT', helper: 'OpenAI 官方接口', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini' },
  { id: 'claude', label: 'Claude', helper: 'Anthropic 官方接口', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  { id: 'gemini', label: 'Gemini', helper: 'Google Gemini OpenAI 兼容接口', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.5-flash' },
] satisfies Array<{ id: ProviderId; label: string; helper: string; baseUrl: string; model: string }>;

const scenes = [
  { value: 'first_contact', label: '首次开发信', helper: '陌生客户初次触达' },
  { value: 'follow_up', label: '跟进信', helper: '未回复客户二次推进' },
  { value: 'reply_customer', label: '回复客户', helper: '接住客户意向继续沟通' },
  { value: 'inquiry_quote', label: '询价 / 报价信', helper: '规格、条款、报价回复' },
  { value: 'negotiation', label: '谈判信', helper: '价格、MOQ、付款方式博弈' },
  { value: 'close_deal', label: '催单成交信', helper: '推动确认、PI、下单' },
  { value: 'after_sales', label: '售后维护信', helper: '发货、回访、复购引导' },
  { value: 'reactivation', label: '老客户唤醒', helper: '沉睡客户重新激活' },
] satisfies Array<{ value: MailScene; label: string; helper: string }>;

const sceneStrategies: Record<MailScene, Array<{ value: string; label: string; helper: string }>> = {
  first_contact: [
    { value: 'value_intro', label: '价值切入', helper: '先讲客户可能关心的产品价值点' },
    { value: 'sample_offer', label: '样品切入', helper: '以可寄样、规格确认、试单切入' },
    { value: 'relationship_soft', label: '关系型切入', helper: '更柔和，不显得过于推销' },
  ],
  follow_up: [
    { value: 'fresh_angle', label: '换新角度', helper: '补一个新信息点，不重复第一封' },
    { value: 'short_push', label: '短促推进', helper: '更短更直接，降低阅读负担' },
    { value: 'soft_checkin', label: '轻提醒', helper: '礼貌低压力地确认是否有兴趣' },
  ],
  reply_customer: [
    { value: 'answer_and_push', label: '解答并推进', helper: '先回应问题，再推动下一步' },
    { value: 'trust_build', label: '建立信任', helper: '加强资质、案例、交付能力' },
    { value: 'fast_close', label: '快速推进', helper: '帮助客户更快进入样品或报价环节' },
  ],
  inquiry_quote: [
    { value: 'structured_quote', label: '结构化报价', helper: '把规格、条款、交期写清楚' },
    { value: 'option_quote', label: '多方案报价', helper: '给客户不同规格或条款选项' },
    { value: 'clarify_first', label: '先澄清后报价', helper: '对信息不足的询盘先问关键问题' },
  ],
  negotiation: [
    { value: 'protect_margin', label: '守利润', helper: '解释价格逻辑，不轻易降价' },
    { value: 'trade_off', label: '交换让步', helper: '用 MOQ、包装、付款换条件' },
    { value: 'relationship_keep', label: '保关系谈判', helper: '避免太强硬，重在长期合作' },
  ],
  close_deal: [
    { value: 'pi_push', label: 'PI 推进', helper: '重点推动 PI、确认项和付款动作' },
    { value: 'urgency_light', label: '轻度紧迫感', helper: '适度提醒排产、价格窗口、交期' },
    { value: 'easy_confirmation', label: '降低确认门槛', helper: '让客户很容易回复确认' },
  ],
  after_sales: [
    { value: 'feedback_first', label: '先收反馈', helper: '优先问体验和满意度' },
    { value: 'reorder_soft', label: '柔和带复购', helper: '售后中自然带出下次合作' },
    { value: 'care_and_service', label: '服务型回访', helper: '重点体现配合度和服务能力' },
  ],
  reactivation: [
    { value: 'new_update', label: '新动态唤醒', helper: '用新品、价格、认证更新重启联系' },
    { value: 'simple_question', label: '低门槛提问', helper: '只问一个简单问题，提高回复率' },
    { value: 'relationship_reconnect', label: '关系重连', helper: '更像重新打招呼，不急着推销' },
  ],
};

const tones = [
  { value: 'professional', label: '专业严谨', helper: '正式商务表达，适合作为默认风格' },
  { value: 'friendly', label: '亲切友好', helper: '更容易建立信任感和沟通温度' },
  { value: 'concise', label: '简洁高效', helper: '适合忙碌采购，快速抓住重点' },
  { value: 'humorous', label: '幽默风趣', helper: '轻度幽默，仍保持商务安全' },
] satisfies Array<{ value: MailTone; label: string; helper: string }>;

const customerStages = [
  { value: 'prospecting', label: '待开发', helper: '还在找切入点，适合首次开发' },
  { value: 'contacted', label: '已触达', helper: '已经发过开发信，等待回应' },
  { value: 'engaged', label: '已互动', helper: '客户有回复，适合继续承接' },
  { value: 'quoting', label: '报价阶段', helper: '进入询价和正式报价' },
  { value: 'negotiating', label: '谈判阶段', helper: '价格、MOQ、条款博弈' },
  { value: 'closing', label: '成交推进', helper: '推动 PI、确认订单、付款' },
  { value: 'after_sales', label: '售后维护', helper: '发货、回访、复购' },
  { value: 'revival', label: '唤醒阶段', helper: '老客户重启联系' },
] satisfies Array<{ value: CustomerStage; label: string; helper: string }>;

const responseStatuses = [
  { value: 'new', label: '首次触达前' },
  { value: 'no_reply', label: '未回复' },
  { value: 'replied', label: '已回复' },
  { value: 'interested', label: '有兴趣' },
  { value: 'quoted', label: '已报价' },
  { value: 'negotiating', label: '谈判中' },
  { value: 'inactive', label: '沉默中' },
] satisfies Array<{ value: ResponseStatus; label: string }>;

const industryPacks: IndustryPack[] = [
  {
    id: 'general',
    label: '通用外贸',
    helper: '适合尚未细分行业时使用',
    defaultIndustry: 'General export trade',
    suggestedUSP: 'Reliable supply, responsive communication, export-ready support, flexible cooperation',
  },
  {
    id: 'food',
    label: '食品 / 冻品',
    helper: '强调认证、冷链、稳定供货、包装',
    defaultIndustry: 'Food export',
    suggestedUSP: 'Halal/HACCP support, stable cold-chain supply, export documents ready, flexible packaging options',
  },
  {
    id: 'machinery',
    label: '机械设备',
    helper: '强调参数、耐用性、售后和备件',
    defaultIndustry: 'Machinery equipment',
    suggestedUSP: 'Stable quality, customizable specs, spare-parts support, technical response, long-term service',
  },
  {
    id: 'packaging',
    label: '包装制品',
    helper: '强调定制、交期、印刷、MOQ',
    defaultIndustry: 'Packaging products',
    suggestedUSP: 'Custom printing, flexible MOQ, stable lead time, OEM/ODM support, export packaging experience',
  },
  {
    id: 'building',
    label: '建材',
    helper: '强调规格、项目配套、耐用性',
    defaultIndustry: 'Building materials',
    suggestedUSP: 'Project-ready specs, reliable quality, durable performance, container optimization, export coordination',
  },
  {
    id: 'pet',
    label: '宠物用品 / 宠物食品',
    helper: '强调安全、适口性、包装和新品',
    defaultIndustry: 'Pet products',
    suggestedUSP: 'Stable quality, pet-safe materials or ingredients, attractive packaging, flexible private label support',
  },
];

const sourcePacks: SourcePack[] = [
  { id: 'customs_data', label: '海关数据客户', helper: '开场更适合引用对方已有进口动作或采购相关性' },
  { id: 'trade_show', label: '展会客户', helper: '开场更适合引用展会接触、摊位交流、名片交换' },
  { id: 'website', label: '官网客户', helper: '开场更适合引用官网产品、市场或采购范围' },
  { id: 'linkedin', label: 'LinkedIn 客户', helper: '开场更适合个人化、关系化，不宜太硬推销' },
  { id: 'old_customer', label: '老客户 / 沉睡客户', helper: '开场更适合基于过往合作或历史联系重连' },
  { id: 'referral', label: '转介绍客户', helper: '开场适合明确转介绍来源，快速建立信任' },
  { id: 'manual_search', label: '手动搜索开发', helper: '适合通用冷开发逻辑，强调匹配度和价值点' },
];

const defaultProvider = providerPresets[0];

const languageOptions = [
  'English',
  'Chinese',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Arabic',
  'Russian',
  'Japanese',
  'Korean',
] as const;

const countryOptions = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Brazil',
  'Mexico',
  'Russia',
  'Saudi Arabia',
  'United Arab Emirates',
  'Turkey',
  'Japan',
  'South Korea',
  'Singapore',
  'Thailand',
  'Vietnam',
] as const;

const countryLanguageRules = [
  { match: ['united states', 'usa', 'u.s.', 'united kingdom', 'uk', 'australia', 'canada', 'singapore', 'new zealand'], language: 'English' },
  { match: ['spain', 'mexico', 'argentina', 'colombia', 'chile', 'peru', 'ecuador'], language: 'Spanish' },
  { match: ['brazil', 'portugal'], language: 'Portuguese' },
  { match: ['france', 'belgium', 'morocco', 'algeria', 'tunisia'], language: 'French' },
  { match: ['germany', 'austria', 'switzerland'], language: 'German' },
  { match: ['italy'], language: 'Italian' },
  { match: ['russia', 'belarus', 'kazakhstan'], language: 'Russian' },
  { match: ['saudi', 'uae', 'united arab emirates', 'qatar', 'kuwait', 'oman', 'bahrain', 'egypt', 'iraq', 'jordan'], language: 'Arabic' },
  { match: ['japan'], language: 'Japanese' },
  { match: ['korea', 'south korea'], language: 'Korean' },
  { match: ['turkey'], language: 'Turkish' },
  { match: ['netherlands'], language: 'Dutch' },
  { match: ['poland'], language: 'Polish' },
  { match: ['thailand'], language: 'Thai' },
  { match: ['vietnam'], language: 'Vietnamese' },
  { match: ['indonesia'], language: 'Indonesian' },
  { match: ['malaysia', 'philippines', 'india', 'pakistan'], language: 'English' },
];

const initialForm: MailRequest = {
  provider: defaultProvider.id,
  apiKey: '',
  baseUrl: defaultProvider.baseUrl,
  model: defaultProvider.model,
  country: 'United States',
  languageMode: 'auto',
  language: 'English',
  secondaryLanguage: 'Chinese',
  industry: 'Food export',
  industryPack: 'food',
  product: 'Frozen halal lamb cuts',
  usp: 'Halal certified, stable supply, flexible packaging, export-ready documents',
  sceneStrategy: 'value_intro',
  customerCompany: '',
  customerName: '',
  customerRole: 'Purchasing Manager',
  customerType: 'Importer / Distributor',
  customerSource: 'manual_search',
  customerBackground: '',
  customerStage: 'prospecting',
  responseStatus: 'new',
  followUpCount: 0,
  scene: 'first_contact',
  tone: 'professional',
  culturalAdaptation: true,
  length: 'medium',
  moq: '1 x 20ft container',
  priceTerms: 'FOB / CIF available',
  paymentTerms: '30% deposit, 70% before shipment',
  leadTime: '15-20 days after order confirmation',
  certifications: 'Halal, HACCP, ISO if needed',
  extraRequirements: '',
  senderCompany: 'Gansu Huamu Foods Co., Ltd.',
};

function readLocalArray<T>(storageKey: string): T[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function serializeFormForStorage(form: MailRequest) {
  const { apiKey, ...rest } = form;
  return rest;
}

function normalizeErrorMessage(message: string) {
  if (message.includes('401')) return '连接失败：API Key 无效，或当前 key 不具备该接口权限。请检查提供商、Key 类型和账户状态。';
  if (message.includes('403')) return '连接失败：账号或模型权限不足，请检查套餐、模型权限或账户状态。';
  if (message.includes('404')) return '连接失败：模型名或接口地址不正确，请确认 Base URL 和模型名。';
  if (message.includes('429')) return '当前接口调用过于频繁，系统已建议稍后重试，或切换到其他 AI 提供商。';
  if (message.includes('529')) return '当前 AI 服务集群负载较高，系统已自动重试；如果仍失败，请稍后再试或切换备用提供商。';
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return '当前 AI 服务暂时不稳定，系统已自动重试；如果仍失败，请稍后再试。';
  if (message.includes('anthropic-version')) return '连接失败：Claude 接口请求头或地址不正确，请检查 Base URL 是否为官方 Anthropic 地址。';
  return message;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function recommendLanguage(country: string) {
  const normalized = country.trim().toLowerCase();
  if (!normalized) return 'English';
  for (const rule of countryLanguageRules) {
    if (rule.match.some((item) => normalized.includes(item))) {
      return rule.language;
    }
  }
  return 'English';
}

function buildIndustryHints(packId: string) {
  const pack = industryPacks.find((item) => item.id === packId);
  if (!pack) return [];
  const map: Record<string, string[]> = {
    general: ['突出供应稳定性', '强调响应速度', '写清下一步动作'],
    food: ['突出认证与合规', '强调冷链与稳定供货', '可带样品或包装方案'],
    machinery: ['突出参数和耐用性', '强调售后与备件', '适合写技术支持能力'],
    packaging: ['突出定制与印刷能力', '强调 MOQ 和交期灵活', '适合给多方案选项'],
    building: ['突出项目规格和耐用性', '强调装柜与交期配合', '适合写工程配套经验'],
    pet: ['突出安全和包装吸引力', '强调私标与新品能力', '适合带适口性或终端卖点'],
  };
  return map[pack.id] || [];
}

function buildSourceHints(sourceId: string) {
  const map: Record<string, string[]> = {
    customs_data: ['可以提对方既有采购动作', '开场要显得研究过客户', '不要写得像群发模板'],
    trade_show: ['适合提展会接触点', '可延续面对面交流语气', '更容易直接推进样品或报价'],
    website: ['引用官网产品线或市场', '强调你为何匹配', '避免空泛自我介绍'],
    linkedin: ['更适合轻量、个人化', '先建立连接感再推进业务', '避免过重的报价式开场'],
    old_customer: ['重连比推销更重要', '可引用历史合作或历史询盘', '适合带更新信息重启话题'],
    referral: ['先点明介绍关系', '尽快建立信任', '更适合直接推进下一步'],
    manual_search: ['适合标准冷开发', '先写匹配点再讲产品', 'CTA 要低门槛'],
  };
  return map[sourceId] || [];
}

function buildQualityReview(form: MailRequest, result: MailResponse | null): ReviewItem[] {
  if (!result) return [];
  const items: ReviewItem[] = [];
  const bodyLength = result.body.trim().length;
  const paragraphs = result.body.split(/\n+/).filter(Boolean).length;
  const hasQuestion = /\?/.test(result.body);
  const hasCommercialTerms = [form.moq, form.priceTerms, form.paymentTerms, form.leadTime].some((value) => value.trim().length > 0);

  if (form.scene === 'first_contact' && bodyLength > 1400) {
    items.push({ id: 'cold-too-long', level: 'watch', title: '首次开发略长', detail: '冷开发邮件过长会降低打开后继续阅读的概率，建议控制在更易扫读的长度。' });
  } else if (bodyLength >= 350 && bodyLength <= 1200) {
    items.push({ id: 'length-balanced', level: 'good', title: '长度较平衡', detail: '当前正文长度更适合大多数采购快速浏览，不容易显得过短或过重。' });
  }

  if (!hasQuestion && !/please|let me know|reply|share|confirm|advise/i.test(result.body)) {
    items.push({ id: 'cta-missing', level: 'risk', title: 'CTA 不够明确', detail: '正文里缺少明显的下一步动作引导，客户可能看完也不知道怎么回复你。' });
  } else {
    items.push({ id: 'cta-present', level: 'good', title: '下一步动作明确', detail: '正文里已经有回复、确认、分享需求或推进下一步的动作指引。' });
  }

  if ((form.scene === 'inquiry_quote' || form.scene === 'negotiation' || form.scene === 'close_deal') && !hasCommercialTerms) {
    items.push({ id: 'terms-thin', level: 'risk', title: '商业条件偏弱', detail: '报价或谈判场景最好明确 MOQ、报价条件、付款方式或交期，避免客户需要二次追问。' });
  }

  if (form.followUpCount >= 2 && form.scene === 'follow_up' && paragraphs <= 2) {
    items.push({ id: 'followup-fresh', level: 'good', title: '跟进节奏干净', detail: '多次跟进时保持简短直接是好策略，当前结构比较适合继续推进。' });
  } else if (form.followUpCount >= 2 && form.scene === 'follow_up') {
    items.push({ id: 'followup-angle', level: 'watch', title: '建议换新角度', detail: '已经跟进多次时，最好加入新样品、新价格点、行业趋势或可执行下一步，不要只是重复提醒。' });
  }

  if (form.languageMode === 'bilingual') {
    items.push({ id: 'bilingual-mode', level: 'good', title: '适合内部审核', detail: '双语模式更适合内部确认或老板审稿，正式发客户时建议保留单语版本。' });
  }

  return items.slice(0, 5);
}

function buildWorkflowSuggestion(form: MailRequest) {
  if (form.scene === 'first_contact') return '建议在 3 到 5 天后准备第二封跟进，并换一个新角度，比如样品、规格亮点或市场案例。';
  if (form.scene === 'follow_up' && form.followUpCount <= 1) return '下一封跟进建议补一个新信息点，不要只重复“just following up”。';
  if (form.scene === 'follow_up' && form.followUpCount >= 2) return '连续多次未回复时，建议缩短正文，并加入一个更低门槛的 CTA，比如“是否方便告诉我目前是否有相关采购计划”。';
  if (form.scene === 'inquiry_quote') return '报价发出后建议尽快准备一封“报价追踪信”，重点问客户更关注价格、MOQ 还是交期。';
  if (form.scene === 'negotiation') return '谈判阶段建议把可让步项和不可让步项拆开准备，避免邮件里一次性让步过多。';
  if (form.scene === 'close_deal') return '催单阶段最好准备 PI、付款信息和交期确认话术，让客户顺手就能进入下单动作。';
  if (form.scene === 'after_sales') return '售后邮件发出后可以在几天后补一个满意度跟进，并顺势带出复购或新品推荐。';
  return '根据客户当前反馈决定下一步，尽量让每封邮件都带一个清晰且可执行的动作。';
}

function buildFollowUpSequence(form: MailRequest, result: MailResponse | null): SequenceStep[] {
  if (!result) return [];

  if (form.scene === 'after_sales') {
    return [
      { id: 'after-1', dayLabel: '2-3 天后', title: '确认收货和状态', angle: '先确认对方是否顺利收到货，包装、温控、单证或运输体验是否正常。', cta: 'Ask whether everything arrived in good condition.' },
      { id: 'after-2', dayLabel: '7 天后', title: '收集反馈', angle: '引导客户分享产品使用反馈、市场反馈或终端反应，增强后续复购依据。', cta: 'Invite feedback on product performance or market response.' },
      { id: 'after-3', dayLabel: '2-3 周后', title: '带出复购或新品', angle: '在售后稳定后自然带出下一批采购节奏，或者引出相近规格/新品。', cta: 'Check whether they want pricing for the next order or related items.' },
    ];
  }

  if (form.scene === 'inquiry_quote' || form.scene === 'negotiation' || form.scene === 'close_deal') {
    return [
      { id: 'deal-1', dayLabel: '1-2 天后', title: '确认关注点', angle: '围绕价格、MOQ、交期、付款方式中的一个关键点追问，不要泛泛地问“any update”。', cta: 'Ask which point they want adjusted first.' },
      { id: 'deal-2', dayLabel: '3-5 天后', title: '给出推进方案', angle: '提出一个可执行选项，比如样品、分阶报价、替代规格或装柜方案。', cta: 'Offer one concrete next-step option they can approve quickly.' },
      { id: 'deal-3', dayLabel: '5-7 天后', title: '缩短成交路径', angle: '把 PI、付款信息、确认项准备好，让客户只需要回复确认即可进入下一步。', cta: 'Ask for confirmation so you can issue PI or reserve production/shipping.' },
    ];
  }

  if (form.scene === 'reactivation') {
    return [
      { id: 'rev-1', dayLabel: '3-4 天后', title: '补一个新理由', angle: '不要重复第一封，改用新品、价格窗口、供应稳定、认证更新等新角度。', cta: 'Ask whether the update is relevant to their current sourcing plan.' },
      { id: 'rev-2', dayLabel: '7 天后', title: '降低回复门槛', angle: '让客户只需回答是/否或当前是否还有相关采购计划。', cta: 'Ask a very simple yes/no style question.' },
      { id: 'rev-3', dayLabel: '10-14 天后', title: '礼貌收口', angle: '如果仍未回复，可以发一封不打扰式收口邮件，为以后再次联系保留空间。', cta: 'Say you will pause follow-up unless they want you to share updates later.' },
    ];
  }

  return [
    { id: 'cold-1', dayLabel: '3-5 天后', title: '第二封跟进', angle: '不要重复第一封正文，换一个新切入点，比如主打规格、样品、认证、交期或包装灵活度。', cta: 'Ask whether they would like specs, price indication, or sample details.' },
    { id: 'cold-2', dayLabel: '7-10 天后', title: '第三封跟进', angle: '正文更短，强调一个最具体的利益点，降低阅读负担。', cta: 'Ask a low-friction question they can answer quickly.' },
    { id: 'cold-3', dayLabel: '10-14 天后', title: '最后一次轻提醒', angle: '保持礼貌，不再强推，给客户留下专业印象，必要时说明后续可按需再联系。', cta: 'Offer to pause follow-up and reconnect when timing is better.' },
  ];
}

function buildSubjectVariants(form: MailRequest, result: MailResponse | null): SubjectVariant[] {
  if (!result?.subject) return [];
  const productShort = form.product.split(',')[0].trim().slice(0, 42) || 'your sourcing plan';
  const company = form.customerCompany.trim();
  const current = result.subject.trim();

  return [
    { id: 'subject-main', style: '当前主版本', value: current },
    { id: 'subject-direct', style: '简洁直给', value: `${productShort} supply for ${company || form.country}`.slice(0, 88) },
    { id: 'subject-value', style: '价值导向', value: `Stable ${productShort} with export-ready support`.slice(0, 88) },
    { id: 'subject-soft', style: '低压力跟进', value: form.scene === 'follow_up' ? `Quick follow-up on ${productShort}`.slice(0, 88) : `Checking if ${productShort} is relevant for your team`.slice(0, 88) },
  ];
}

function buildGoalSignals(form: MailRequest, result: MailResponse | null): GoalSignal[] {
  if (!result) return [];
  const text = `${result.subject}\n${result.body}`.toLowerCase();
  const hasValue = [form.usp, 'certified', 'stable', 'custom', 'flexible', 'lead time', 'export'].some((token) => token && text.includes(String(token).toLowerCase().split(',')[0].trim()));
  const hasTrust = [form.certifications, form.senderCompany, 'factory', 'halal', 'haccp', 'iso'].some((token) => token && text.includes(String(token).toLowerCase().split(',')[0].trim()));
  const hasCTA = /reply|let me know|share|confirm|advise|sample|quote|quotation|catalog/.test(text);
  const hasCommercial = [form.moq, form.priceTerms, form.paymentTerms, form.leadTime].some((token) => token && text.includes(String(token).toLowerCase().split(',')[0].trim()));

  return [
    {
      id: 'goal-value',
      label: '客户价值点',
      status: hasValue ? 'strong' : 'partial',
      detail: hasValue ? '正文里已经带出产品优势或供应价值点。' : '价值主张偏弱，建议更明确写出客户为什么要继续看下去。',
    },
    {
      id: 'goal-trust',
      label: '信任建立',
      status: hasTrust ? 'strong' : 'partial',
      detail: hasTrust ? '邮件里有一定的资质、公司或供应可靠性线索。' : '可以再加入认证、出口经验或稳定供货等信任要素。',
    },
    {
      id: 'goal-cta',
      label: '回复动作',
      status: hasCTA ? 'strong' : 'missing',
      detail: hasCTA ? '邮件已经告诉客户该如何继续下一步。' : '缺少清晰回复动作，客户容易看完不回。',
    },
    {
      id: 'goal-commercial',
      label: '商业信息',
      status: hasCommercial ? 'strong' : form.scene === 'first_contact' ? 'partial' : 'missing',
      detail: hasCommercial ? '正文中已经包含部分 MOQ、价格条件、付款或交期信息。' : form.scene === 'first_contact' ? '首次开发可以先轻一些，但后续需要尽快补充商业条件。' : '当前场景更适合带上商业条件，否则客户需要反复确认。',
    },
  ];
}

function buildStageSummary(customers: CustomerRecord[]) {
  return customerStages.map((stage) => ({
    ...stage,
    count: customers.filter((customer) => customer.stage === stage.value).length,
  }));
}

function suggestSceneForCustomer(customer: CustomerRecord): MailScene {
  return customer.stage === 'quoting' ? 'inquiry_quote'
    : customer.stage === 'negotiating' ? 'negotiation'
    : customer.stage === 'closing' ? 'close_deal'
    : customer.stage === 'after_sales' ? 'after_sales'
    : customer.stage === 'revival' ? 'reactivation'
    : customer.followUpCount > 0 ? 'follow_up'
    : 'first_contact';
}

function parseBulkCustomerInput(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\t,|]/).map((item) => item.trim());
      return {
        company: parts[0] || '',
        contactName: parts[1] || '',
        country: parts[2] || '',
        language: parts[3] || '',
        industry: parts[4] || '',
        source: parts[5] || 'manual_search',
        notes: parts.slice(6).join(' / '),
      };
    })
    .filter((item) => item.company);
}

function buildSystemTemplates(): TemplateRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'system-food-customs-first',
      category: 'system',
      name: '食品行业 / 海关数据 / 首次开发',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'professional',
      language: 'English',
      industry: 'Food export',
      industryPack: 'food',
      source: 'customs_data',
      sceneStrategy: 'value_intro',
      subject: 'Reliable halal frozen lamb supply for your sourcing plan',
      body: 'Hello [Name],\n\nI noticed your team is active in imported food sourcing, so I wanted to briefly introduce our frozen halal lamb range.\n\nWe focus on stable supply, export-ready documentation, flexible packaging, and smooth coordination for overseas shipments. If useful, I can share key specs, packaging options, and an initial price indication based on your target market.\n\nIf lamb products are currently on your sourcing list, I would be glad to send a concise offer for review.\n\nBest regards,\n[Your Name]',
      notes: '适合食品、冷冻肉类、海关数据来源的冷开发模板。',
    },
    {
      id: 'system-packaging-website-quote',
      category: 'system',
      name: '包装行业 / 官网客户 / 结构化报价',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'inquiry_quote',
      tone: 'professional',
      language: 'English',
      industry: 'Packaging products',
      industryPack: 'packaging',
      source: 'website',
      sceneStrategy: 'structured_quote',
      subject: 'Quotation for custom packaging options',
      body: 'Hello [Name],\n\nThank you for your interest in custom packaging solutions.\n\nBased on your request, we can offer options covering material, printing, MOQ, and lead time. We can also support OEM/ODM requirements and provide suggestions to balance unit cost and packaging effect.\n\nIf you confirm your preferred size, printing requirement, and estimated quantity, I can send a clearer quotation structure with the most suitable options.\n\nBest regards,\n[Your Name]',
      notes: '适合包装行业官网线索和结构化报价场景。',
    },
    {
      id: 'system-machinery-linkedin-followup',
      category: 'system',
      name: '机械行业 / LinkedIn / 跟进推进',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'follow_up',
      tone: 'concise',
      language: 'English',
      industry: 'Machinery equipment',
      industryPack: 'machinery',
      source: 'linkedin',
      sceneStrategy: 'fresh_angle',
      subject: 'Quick follow-up on machinery specs and support',
      body: 'Hello [Name],\n\nJust following up with one additional point that may be relevant to your team.\n\nBesides standard specs, we can support customization, spare parts, and post-sales coordination for export orders, which may help reduce downstream service pressure after installation.\n\nIf useful, I can send a compact technical sheet or suggest a configuration based on your target application.\n\nBest regards,\n[Your Name]',
      notes: '适合 LinkedIn 来源的机械客户二次推进。',
    },
    {
      id: 'system-food-middle-east-first',
      category: 'system',
      name: '清真冻品 / 中东市场 / 首次开发',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'professional',
      language: 'Arabic',
      industry: 'Frozen halal meat export',
      industryPack: 'food',
      source: 'manual_search',
      sceneStrategy: 'value_intro',
      subject: 'Reliable halal frozen lamb supply for your UAE market',
      body: 'Hello [Name],\n\nI am reaching out to introduce our frozen halal lamb cuts for your market. We focus on stable supply, halal-compliant production, export documentation readiness, and flexible packaging for importers and distributors.\n\nIf helpful, I can share product specifications, packing options, and a first quotation reference based on your target channel.\n\nPlease let me know if lamb products are currently part of your sourcing plan.\n\nBest regards,\n[Your Name]',
      notes: '适合中东市场、清真冻品、首次开发。',
    },
    {
      id: 'system-food-trade-show-followup',
      category: 'system',
      name: '食品行业 / 展会客户 / 展后跟进',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'follow_up',
      tone: 'friendly',
      language: 'English',
      industry: 'Food export',
      industryPack: 'food',
      source: 'trade_show',
      sceneStrategy: 'soft_checkin',
      subject: 'Nice meeting you at the fair - frozen halal lamb follow-up',
      body: 'Hello [Name],\n\nIt was a pleasure connecting with you at the exhibition.\n\nAs discussed, we are supplying frozen halal lamb cuts with stable export capacity, flexible packing formats, and full document support for overseas shipments. I wanted to follow up in case your team would like a concise product list or sample arrangement after the fair.\n\nIf convenient, I can send the key specifications and a quick quotation reference for your review.\n\nBest regards,\n[Your Name]',
      notes: '适合展会后的食品客户跟进。',
    },
    {
      id: 'system-food-reactivation',
      category: 'system',
      name: '食品行业 / 老客户 / 唤醒重连',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'reactivation',
      tone: 'friendly',
      language: 'English',
      industry: 'Food export',
      industryPack: 'food',
      source: 'old_customer',
      sceneStrategy: 'new_update',
      subject: 'Quick update from our halal frozen lamb line',
      body: 'Hello [Name],\n\nIt has been some time since our last contact, so I wanted to briefly reconnect.\n\nWe have recently updated our halal frozen lamb program with more flexible packing options and smoother export coordination, which may be relevant if your team is reviewing suppliers again.\n\nIf timing is right, I would be happy to send a short update with current items and shipment options.\n\nBest regards,\n[Your Name]',
      notes: '适合沉睡客户重新激活。',
    },
    {
      id: 'system-packaging-first-website',
      category: 'system',
      name: '包装行业 / 官网客户 / 首次开发',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'professional',
      language: 'English',
      industry: 'Packaging products',
      industryPack: 'packaging',
      source: 'website',
      sceneStrategy: 'relationship_soft',
      subject: 'Custom packaging support for your product line',
      body: 'Hello [Name],\n\nI came across your product line and thought our custom packaging capability may be relevant to your team.\n\nWe support printing, material selection, OEM/ODM requirements, and flexible MOQ options for export orders. If useful, I can suggest practical packaging options based on your positioning and order volume.\n\nPlease let me know what type of packaging project you are currently developing.\n\nBest regards,\n[Your Name]',
      notes: '适合官网线索的包装类冷开发。',
    },
    {
      id: 'system-packaging-negotiation',
      category: 'system',
      name: '包装行业 / 谈判 / 交换让步',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'negotiation',
      tone: 'professional',
      language: 'English',
      industry: 'Packaging products',
      industryPack: 'packaging',
      source: 'manual_search',
      sceneStrategy: 'trade_off',
      subject: 'Packaging offer adjustment for your review',
      body: 'Hello [Name],\n\nThank you for your feedback on the current packaging offer.\n\nTo help narrow the gap, we can review practical adjustment options such as MOQ, material structure, printing coverage, or packing configuration. This would allow us to improve the offer while keeping production quality and delivery reliability under control.\n\nIf you share which point matters most to your team, I can revise the offer in a more targeted way.\n\nBest regards,\n[Your Name]',
      notes: '适合包装产品谈判和条件交换。',
    },
    {
      id: 'system-machinery-first-linkedin',
      category: 'system',
      name: '机械行业 / LinkedIn / 轻量开发',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'concise',
      language: 'English',
      industry: 'Machinery equipment',
      industryPack: 'machinery',
      source: 'linkedin',
      sceneStrategy: 'relationship_soft',
      subject: 'Possible machinery fit for your application',
      body: 'Hello [Name],\n\nI wanted to make a brief introduction in case our machinery line is relevant to your application.\n\nWe support export projects with stable quality, customization options, technical response, and post-sales coordination. If your team is reviewing suppliers or comparing configurations, I can send a compact technical summary.\n\nHappy to share details if this is relevant.\n\nBest regards,\n[Your Name]',
      notes: '适合 LinkedIn 的轻量机械开发信。',
    },
    {
      id: 'system-machinery-quote',
      category: 'system',
      name: '机械行业 / 报价 / 参数确认',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'inquiry_quote',
      tone: 'professional',
      language: 'English',
      industry: 'Machinery equipment',
      industryPack: 'machinery',
      source: 'manual_search',
      sceneStrategy: 'clarify_first',
      subject: 'Quotation support for your machinery request',
      body: 'Hello [Name],\n\nThank you for your inquiry.\n\nTo prepare a quotation that is commercially useful and technically accurate, it would help to confirm a few key points first, such as target capacity, voltage, application scenario, and any preferred configuration.\n\nOnce these details are confirmed, I can send a clearer quotation with specification alignment, lead time, and spare-parts support information.\n\nBest regards,\n[Your Name]',
      notes: '适合机械询价时先澄清后报价。',
    },
    {
      id: 'system-building-first',
      category: 'system',
      name: '建材行业 / 手动开发 / 项目型开场',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'professional',
      language: 'English',
      industry: 'Building materials',
      industryPack: 'building',
      source: 'manual_search',
      sceneStrategy: 'value_intro',
      subject: 'Export-ready building materials for your projects',
      body: 'Hello [Name],\n\nI am reaching out because your market focus appears relevant to our building materials export program.\n\nWe support overseas buyers with stable specifications, reliable loading plans, export documentation, and shipment coordination for project and distribution orders. If useful, I can send a short overview of the items most suitable for your market.\n\nPlease let me know what product category or project type you are currently handling.\n\nBest regards,\n[Your Name]',
      notes: '适合建材行业的通用项目型开发。',
    },
    {
      id: 'system-pet-website-first',
      category: 'system',
      name: '宠物行业 / 官网客户 / 新品开发',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'friendly',
      language: 'English',
      industry: 'Pet products',
      industryPack: 'pet',
      source: 'website',
      sceneStrategy: 'value_intro',
      subject: 'Pet product ideas that may fit your range',
      body: 'Hello [Name],\n\nI was reviewing your product range and thought our pet product line may be relevant to your team.\n\nWe can support stable quality, attractive packaging, private label cooperation, and export execution for growing pet categories. If helpful, I can send a concise selection of products that may fit your current positioning.\n\nPlease let me know if you would like a compact catalog or a few suggested items first.\n\nBest regards,\n[Your Name]',
      notes: '适合宠物用品/宠物食品官网客户开发。',
    },
    {
      id: 'system-food-quote-followup',
      category: 'system',
      name: '食品行业 / 已报价 / 报价后跟进',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'follow_up',
      tone: 'concise',
      language: 'English',
      industry: 'Food export',
      industryPack: 'food',
      source: 'manual_search',
      sceneStrategy: 'fresh_angle',
      subject: 'Follow-up on our halal lamb quotation',
      body: 'Hello [Name],\n\nI am following up on the quotation we shared earlier for frozen halal lamb cuts.\n\nOne point that may help your review is that we can also adjust packing format and shipment planning based on your channel requirements, which may make the offer more practical on your side.\n\nIf you would like, I can revise the offer based on your target quantity or preferred packaging direction.\n\nBest regards,\n[Your Name]',
      notes: '适合报价后继续推进食品客户。',
    },
    {
      id: 'system-close-deal-easy-confirm',
      category: 'system',
      name: '成交推进 / 降低确认门槛',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'close_deal',
      tone: 'professional',
      language: 'English',
      industry: 'General export trade',
      industryPack: 'general',
      source: 'manual_search',
      sceneStrategy: 'easy_confirmation',
      subject: 'Next step to move this order forward',
      body: 'Hello [Name],\n\nTo make the next step easy, you can simply confirm the preferred specification, quantity, and shipment timing, and we will prepare the next document set for your review.\n\nIf any point still needs adjustment, we can revise it quickly before moving to PI or order confirmation.\n\nA short confirmation from your side is enough for us to proceed.\n\nBest regards,\n[Your Name]',
      notes: '适合催确认和降低回复门槛。',
    },
    {
      id: 'system-after-sales-reorder',
      category: 'system',
      name: '售后维护 / 柔和带复购',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'after_sales',
      tone: 'friendly',
      language: 'English',
      industry: 'General export trade',
      industryPack: 'general',
      source: 'old_customer',
      sceneStrategy: 'reorder_soft',
      subject: 'Checking in after the shipment',
      body: 'Hello [Name],\n\nI wanted to check in after the shipment and see whether everything is progressing smoothly on your side.\n\nIf there is any feedback on product condition, packing, or documentation, please feel free to let me know. We would also be glad to support your next replenishment or related item plan whenever timing is suitable.\n\nLooking forward to your feedback.\n\nBest regards,\n[Your Name]',
      notes: '适合售后回访并柔和带出复购。',
    },
    {
      id: 'system-arabic-first-uae',
      category: 'system',
      name: '阿拉伯语市场 / UAE / 首次开发',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'professional',
      language: 'Arabic',
      industry: 'Food export',
      industryPack: 'food',
      source: 'manual_search',
      sceneStrategy: 'value_intro',
      subject: 'توريد موثوق للحوم الضأن الحلال المجمدة',
      body: 'مرحبًا [Name]،\n\nيسعدني أن أقدم لكم منتجاتنا من لحوم الضأن الحلال المجمدة المناسبة للمستوردين والموزعين في أسواق الخليج.\n\nنركز على التوريد المستقر، والوثائق التصديرية الكاملة، وخيارات التعبئة المرنة، والتنسيق السلس للشحنات الدولية. إذا كان ذلك مناسبًا لكم، يمكنني إرسال المواصفات الأساسية وخيارات التعبئة وعرضًا أوليًا مختصرًا.\n\nيسعدني معرفة ما إذا كانت هذه الفئة ضمن خطتكم الحالية للشراء.\n\nمع خالص التحية،\n[Your Name]',
      notes: '适合阿联酋、沙特等阿语市场的单语开发模板。',
    },
    {
      id: 'system-arabic-quote-followup',
      category: 'system',
      name: '阿拉伯语市场 / 已报价 / 跟进推进',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'follow_up',
      tone: 'friendly',
      language: 'Arabic',
      industry: 'Food export',
      industryPack: 'food',
      source: 'manual_search',
      sceneStrategy: 'soft_checkin',
      subject: 'متابعة سريعة بخصوص عرض الأسعار السابق',
      body: 'مرحبًا [Name]،\n\nأود فقط المتابعة بشكل مختصر بخصوص عرض الأسعار الذي أرسلناه سابقًا.\n\nإذا كان من الأنسب لفريقكم مراجعة خيارات تعبئة مختلفة أو كمية مستهدفة مختلفة، يمكننا تعديل العرض ليكون أقرب لاحتياجاتكم الفعلية.\n\nإذا رغبتم، يمكنني إرسال نسخة محدثة ومختصرة للمراجعة.\n\nمع خالص التحية،\n[Your Name]',
      notes: '适合阿语市场报价后的礼貌跟进。',
    },
    {
      id: 'system-spanish-first-latam',
      category: 'system',
      name: '西语市场 / 拉美客户 / 首次开发',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'friendly',
      language: 'Spanish',
      industry: 'Packaging products',
      industryPack: 'packaging',
      source: 'website',
      sceneStrategy: 'relationship_soft',
      subject: 'Opciones de empaque personalizadas para su línea de productos',
      body: 'Hola [Name],\n\nHe revisado brevemente su línea de productos y pensé que nuestras soluciones de empaque personalizado podrían ser relevantes para su equipo.\n\nPodemos apoyar con impresión, materiales, MOQ flexible y coordinación de exportación para pedidos OEM/ODM. Si le resulta útil, puedo enviarle algunas opciones adecuadas para su mercado.\n\nQuedo atento si desea una propuesta breve o algunas recomendaciones iniciales.\n\nSaludos cordiales,\n[Your Name]',
      notes: '适合西语市场官网线索的包装开发模板。',
    },
    {
      id: 'system-spanish-reactivation',
      category: 'system',
      name: '西语市场 / 老客户 / 重新唤醒',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'reactivation',
      tone: 'friendly',
      language: 'Spanish',
      industry: 'General export trade',
      industryPack: 'general',
      source: 'old_customer',
      sceneStrategy: 'relationship_reconnect',
      subject: 'Un saludo y una breve actualización desde nuestro lado',
      body: 'Hola [Name],\n\nHa pasado un tiempo desde nuestro último contacto, así que quería saludarle y retomar la comunicación.\n\nRecientemente hemos actualizado algunas opciones de producto y coordinación de exportación que podrían ser de interés si su equipo está revisando nuevamente proveedores.\n\nSi le parece bien, puedo enviarle una actualización breve y práctica para su evaluación.\n\nSaludos cordiales,\n[Your Name]',
      notes: '适合西语市场沉睡客户重连。',
    },
    {
      id: 'system-russian-first-distributor',
      category: 'system',
      name: '俄语市场 / 分销客户 / 首次开发',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'first_contact',
      tone: 'professional',
      language: 'Russian',
      industry: 'Building materials',
      industryPack: 'building',
      source: 'manual_search',
      sceneStrategy: 'value_intro',
      subject: 'Надежные экспортные строительные материалы для вашего рынка',
      body: 'Здравствуйте, [Name].\n\nСвязываюсь с вами, чтобы кратко представить наше экспортное направление по строительным материалам.\n\nМы поддерживаем зарубежных покупателей стабильными спецификациями, надежной упаковкой, экспортной документацией и координацией поставок. Если это актуально для вашей компании, я могу направить краткий обзор подходящих позиций.\n\nБуду рад узнать, какие категории продукции наиболее интересны вашему рынку.\n\nС уважением,\n[Your Name]',
      notes: '适合俄语市场建材分销客户开发。',
    },
    {
      id: 'system-russian-negotiation',
      category: 'system',
      name: '俄语市场 / 谈判 / 保关系推进',
      createdAt: now,
      updatedAt: now,
      provider: 'minimaxi',
      scene: 'negotiation',
      tone: 'professional',
      language: 'Russian',
      industry: 'General export trade',
      industryPack: 'general',
      source: 'manual_search',
      sceneStrategy: 'relationship_keep',
      subject: 'Варианты корректировки предложения для дальнейшего согласования',
      body: 'Здравствуйте, [Name].\n\nСпасибо за обратную связь по нашему предложению.\n\nЧтобы приблизить условия к вашим ожиданиям, мы можем рассмотреть практические варианты корректировки, например объем, упаковку, график поставки или условия оплаты. Это позволит найти более сбалансированное решение без ущерба для стабильности исполнения.\n\nЕсли вы подскажете, какой пункт сейчас наиболее важен для вашей стороны, я подготовлю более точный вариант.\n\nС уважением,\n[Your Name]',
      notes: '适合俄语市场谈判阶段的平衡表达。',
    },
  ];
}

function App() {
  const systemTemplates = useMemo(() => buildSystemTemplates(), []);
  const [view, setView] = useState<WorkspaceView>('workspace');
  const [form, setForm] = useState<MailRequest>(initialForm);
  const [result, setResult] = useState<MailResponse | null>(null);
  const [currentOutputLanguage, setCurrentOutputLanguage] = useState('');
  const [grammarReview, setGrammarReview] = useState<GrammarCheckResult | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [customerRecords, setCustomerRecords] = useState<CustomerRecord[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateSceneFilter, setTemplateSceneFilter] = useState<'all' | MailScene>('all');
  const [templateIndustryFilter, setTemplateIndustryFilter] = useState<'all' | string>('all');
  const [templateSourceFilter, setTemplateSourceFilter] = useState<'all' | string>('all');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerStageFilter, setCustomerStageFilter] = useState<'all' | CustomerStage>('all');
  const [bulkCustomerInput, setBulkCustomerInput] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([]);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchStatus, setBatchStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [isFixingGrammar, setIsFixingGrammar] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    const restore = localStorage.getItem(FORM_STORAGE_KEY);
    if (restore) {
      try {
        const parsed = JSON.parse(restore) as Partial<MailRequest>;
        const { apiKey: _ignoredApiKey, ...safeRestore } = parsed;
        setForm((current) => ({ ...current, ...safeRestore }));
      } catch {}
    }
    setHistoryRecords(readLocalArray<HistoryRecord>(HISTORY_STORAGE_KEY));
    setTemplates(readLocalArray<TemplateRecord>(TEMPLATE_STORAGE_KEY));
    setCustomerRecords(readLocalArray<CustomerRecord>(CUSTOMER_STORAGE_KEY));
  }, []);

  useEffect(() => localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(serializeFormForStorage(form))), [form]);
  useEffect(() => localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords)), [historyRecords]);
  useEffect(() => localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates)), [templates]);
  useEffect(() => localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customerRecords)), [customerRecords]);

  useEffect(() => {
    if (!window.vicMail) return;
    window.vicMail.getDefaults().then((defaults) => {
      setForm((current) => current.provider !== 'minimaxi' ? current : {
        ...current,
        baseUrl: current.baseUrl || defaults.defaultBaseUrl,
        model: current.model || defaults.defaultModel,
      });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!window.vicMail) return;
    window.vicMail.getSavedProviderSettings().then((savedSettings) => {
      const saved = savedSettings as Partial<SavedProviderSettings>;
      if (!saved || (!saved.apiKey && !saved.baseUrl && !saved.model && !saved.provider && !saved.senderCompany)) {
        return;
      }
      setForm((current) => ({
        ...current,
        provider: saved.provider || current.provider,
        apiKey: saved.apiKey || current.apiKey,
        baseUrl: saved.baseUrl || current.baseUrl,
        model: saved.model || current.model,
        senderCompany: saved.senderCompany || current.senderCompany,
      }));
      setSaveStatus('已载入本地保存的 API 配置');
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (form.languageMode !== 'auto') return;
    const suggested = recommendLanguage(form.country);
    setForm((current) => current.language === suggested ? current : { ...current, language: suggested });
  }, [form.country, form.languageMode]);

  const filteredHistory = useMemo(() => {
    const keyword = historyQuery.trim().toLowerCase();
    if (!keyword) return historyRecords;
    return historyRecords.filter((record) => [record.customerCompany, record.customerName, record.country, record.product, record.subject].join(' ').toLowerCase().includes(keyword));
  }, [historyRecords, historyQuery]);

  const filteredTemplates = useMemo(() => {
    const keyword = templateQuery.trim().toLowerCase();
    const merged = [...systemTemplates, ...templates];
    return merged.filter((template) => {
      const matchesKeyword = !keyword || [template.name, template.industry, template.language, template.subject, template.notes].join(' ').toLowerCase().includes(keyword);
      const matchesScene = templateSceneFilter === 'all' || template.scene === templateSceneFilter;
      const matchesIndustry = templateIndustryFilter === 'all' || template.industryPack === templateIndustryFilter;
      const matchesSource = templateSourceFilter === 'all' || template.source === templateSourceFilter;
      return matchesKeyword && matchesScene && matchesIndustry && matchesSource;
    });
  }, [systemTemplates, templateQuery, templates, templateSceneFilter, templateIndustryFilter, templateSourceFilter]);

  const filteredCustomers = useMemo(() => {
    const keyword = customerQuery.trim().toLowerCase();
    const byStage = customerStageFilter === 'all'
      ? customerRecords
      : customerRecords.filter((customer) => customer.stage === customerStageFilter);
    if (!keyword) return byStage;
    return byStage.filter((customer) =>
      [customer.company, customer.contactName, customer.country, customer.language, customer.industry, customer.notes]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [customerQuery, customerRecords, customerStageFilter]);

  const recommendedLanguage = useMemo(() => recommendLanguage(form.country), [form.country]);
  const grammarTargetLanguage = useMemo(
    () => currentOutputLanguage || (form.languageMode === 'bilingual' ? form.language : recommendedLanguage),
    [currentOutputLanguage, form.language, form.languageMode, recommendedLanguage],
  );
  const qualityReview = useMemo(() => buildQualityReview(form, result), [form, result]);
  const workflowSuggestion = useMemo(() => buildWorkflowSuggestion(form), [form]);
  const followUpSequence = useMemo(() => buildFollowUpSequence(form, result), [form, result]);
  const subjectVariants = useMemo(() => buildSubjectVariants(form, result), [form, result]);
  const goalSignals = useMemo(() => buildGoalSignals(form, result), [form, result]);
  const currentStrategies = useMemo(() => sceneStrategies[form.scene] || [], [form.scene]);
  const currentIndustryPack = useMemo(() => industryPacks.find((item) => item.id === form.industryPack) || industryPacks[0], [form.industryPack]);
  const industryHints = useMemo(() => buildIndustryHints(form.industryPack), [form.industryPack]);
  const currentSourcePack = useMemo(() => sourcePacks.find((item) => item.id === form.customerSource) || sourcePacks[sourcePacks.length - 1], [form.customerSource]);
  const sourceHints = useMemo(() => buildSourceHints(form.customerSource), [form.customerSource]);
  const matchedSystemTemplates = useMemo(() => systemTemplates.filter((template) =>
    template.scene === form.scene || template.industryPack === form.industryPack || template.source === form.customerSource,
  ).slice(0, 3), [form.customerSource, form.industryPack, form.scene, systemTemplates]);
  const customerStageSummary = useMemo(() => buildStageSummary(customerRecords), [customerRecords]);
  const selectedCustomers = useMemo(
    () => customerRecords.filter((customer) => selectedCustomerIds.includes(customer.id)),
    [customerRecords, selectedCustomerIds],
  );
  const customTemplateCount = useMemo(() => templates.filter((item) => item.category === 'custom').length, [templates]);

  useEffect(() => {
    const current = sceneStrategies[form.scene] || [];
    if (!current.length) return;
    if (current.some((item) => item.value === form.sceneStrategy)) return;
    setForm((prev) => ({ ...prev, sceneStrategy: current[0].value }));
  }, [form.scene, form.sceneStrategy]);

  useEffect(() => {
    const selected = industryPacks.find((item) => item.id === form.industryPack);
    if (!selected) return;
    setForm((prev) => {
      const next = { ...prev };
      if (!prev.industry || industryPacks.some((item) => item.defaultIndustry === prev.industry)) {
        next.industry = selected.defaultIndustry;
      }
      if (!prev.usp || industryPacks.some((item) => item.suggestedUSP === prev.usp)) {
        next.usp = selected.suggestedUSP;
      }
      return next;
    });
  }, [form.industryPack]);

  const updateField = <K extends keyof MailRequest>(key: K, value: MailRequest[K]) => setForm((current) => ({ ...current, [key]: value }));

  const applyProviderPreset = (providerId: ProviderId) => {
    const preset = providerPresets.find((item) => item.id === providerId);
    if (!preset) return;
    setForm((current) => ({ ...current, provider: providerId, baseUrl: preset.baseUrl, model: preset.model }));
    setConnectionStatus('');
    setError('');
  };

  const saveHistoryRecord = (request: MailRequest, response: MailResponse) => {
    const newRecord: HistoryRecord = {
      id: uid('history'),
      createdAt: new Date().toISOString(),
      provider: request.provider,
      model: response.model,
      scene: request.scene,
      tone: request.tone,
      country: request.country,
      language: request.languageMode === 'bilingual' ? `${request.language} + ${request.secondaryLanguage}` : request.language,
      product: request.product,
      customerCompany: request.customerCompany,
      customerName: request.customerName,
      subject: response.subject,
      body: response.body,
      followUpTip: response.followUpTip,
      toneNotes: response.toneNotes,
    };
    setHistoryRecords((current) => [newRecord, ...current].slice(0, 200));
    return newRecord;
  };

  const buildRequestFromCustomer = (customer: CustomerRecord): MailRequest => ({
    ...form,
    customerCompany: customer.company,
    customerName: customer.contactName,
    customerSource: customer.source,
    country: customer.country || form.country,
    language: customer.language || recommendLanguage(customer.country || form.country),
    customerRole: customer.role || form.customerRole,
    customerType: customer.customerType || form.customerType,
    customerStage: customer.stage,
    responseStatus: customer.responseStatus,
    followUpCount: customer.followUpCount,
    industry: customer.industry || form.industry,
    customerBackground: customer.notes || form.customerBackground,
    scene: suggestSceneForCustomer(customer),
  });

  const withEffectiveLanguage = (request: MailRequest): MailRequest => ({
    ...request,
    language: request.languageMode === 'auto' ? recommendLanguage(request.country) : request.language,
  });

  const handleGenerate = async () => {
    if (!window.vicMail) {
      setError('当前环境没有加载 Electron 接口，请用桌面版运行 Vic Mail。');
      return;
    }
    setIsLoading(true);
    setError('');
    setConnectionStatus('');
    setSaveStatus('');
    setGrammarReview(null);
    try {
      const request = withEffectiveLanguage(form);
      const response = await window.vicMail.generateMail(request);
      setResult(response);
      setCurrentOutputLanguage(request.languageMode === 'bilingual' ? request.language : request.language);
      saveHistoryRecord(request, response);
      setSaveStatus('已自动保存到历史记录');
      setView('workspace');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed.';
      setError(normalizeErrorMessage(message));
    } finally {
      setIsLoading(false);
    }
  };

  const buildGrammarPayload = () => {
    if (!result) return null;
    const request = withEffectiveLanguage(form);
    return {
      provider: request.provider,
      apiKey: request.apiKey,
      baseUrl: request.baseUrl,
      model: request.model,
      language: grammarTargetLanguage,
      subject: result.subject,
      body: result.body,
    };
  };

  const handleTestConnection = async () => {
    if (!window.vicMail) {
      setError('当前环境没有加载 Electron 接口，请用桌面版运行 Vic Mail。');
      return;
    }
    setIsTesting(true);
    setError('');
    setConnectionStatus('');
    try {
      const response = await window.vicMail.testConnection({ apiKey: form.apiKey, baseUrl: form.baseUrl, model: form.model });
      setConnectionStatus(`连接成功：${response.model} @ ${response.baseUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed.';
      setConnectionStatus(normalizeErrorMessage(message));
    } finally {
      setIsTesting(false);
    }
  };

  const handleOpenGmail = async () => {
    if (!result || !window.vicMail) return;
    try {
      await window.vicMail.openGmailCompose({ subject: result.subject, body: result.body });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open Gmail.';
      setError(message);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`);
    setCopyState('done');
    window.setTimeout(() => setCopyState('idle'), 1800);
  };

  const handleExportTxt = async () => {
    if (!result || !window.vicMail) return;
    try {
      const exportResult = await window.vicMail.exportTxt({
        subject: result.subject,
        body: result.body,
        customerCompany: form.customerCompany,
        customerName: form.customerName,
        scene: form.scene,
      });
      if (exportResult.ok) {
        setSaveStatus(`TXT 已导出：${exportResult.filePath}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TXT 导出失败。';
      setError(message);
    }
  };

  const handleExportDocx = async () => {
    if (!result || !window.vicMail) return;
    try {
      const exportResult = await window.vicMail.exportDocx({
        subject: result.subject,
        body: result.body,
        customerCompany: form.customerCompany,
        customerName: form.customerName,
        scene: form.scene,
      });
      if (exportResult.ok) {
        setSaveStatus(`Word 已导出：${exportResult.filePath}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Word 导出失败。';
      setError(message);
    }
  };

  const handleCheckGrammar = async () => {
    if (!window.vicMail || !result) return;
    const payload = buildGrammarPayload();
    if (!payload) return;

    setIsCheckingGrammar(true);
    setError('');
    setSaveStatus('');
    try {
      const review = await window.vicMail.checkGrammar(payload);
      setGrammarReview(review);
      setSaveStatus(review.verdict === 'correct' ? `语法检查通过：${review.summary}` : `发现可优化语法：${review.summary}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '语法检查失败。';
      setError(normalizeErrorMessage(message));
    } finally {
      setIsCheckingGrammar(false);
    }
  };

  const handleFixGrammar = async () => {
    if (!window.vicMail || !result) return;
    const payload = buildGrammarPayload();
    if (!payload) return;

    setIsFixingGrammar(true);
    setError('');
    setSaveStatus('');
    try {
      const fixed: GrammarFixResult = await window.vicMail.fixGrammar(payload);
      setResult((current) => current ? {
        ...current,
        subject: fixed.subject,
        body: fixed.body,
      } : current);
      setCurrentOutputLanguage(payload.language);
      setGrammarReview({
        verdict: 'correct',
        summary: fixed.summary,
        issues: [],
      });
      setSaveStatus(`语法已修正：${fixed.summary}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '语法修正失败。';
      setError(normalizeErrorMessage(message));
    } finally {
      setIsFixingGrammar(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!result) return;
    const suggestedName = `${scenes.find((item) => item.value === form.scene)?.label || '模板'} - ${form.product.slice(0, 24)}`;
    const name = window.prompt('请输入模板名称', suggestedName)?.trim();
    if (!name) return;
    const notes = window.prompt('模板备注（可选）', `${form.industry} / ${form.language}`) ?? '';
    const now = new Date().toISOString();
    setTemplates((current) => [{
      id: uid('template'),
      category: 'custom',
      name,
      createdAt: now,
      updatedAt: now,
      provider: form.provider,
      scene: form.scene,
      tone: form.tone,
      language: form.language,
      industry: form.industry,
      industryPack: form.industryPack,
      source: form.customerSource,
      sceneStrategy: form.sceneStrategy,
      subject: result.subject,
      body: result.body,
      notes: notes.trim(),
    }, ...current]);
    setSaveStatus(`模板已保存：${name}`);
    setView('templates');
  };

  const loadHistoryRecord = (record: HistoryRecord) => {
    const providerPreset = providerPresets.find((item) => item.id === record.provider);
    setForm((current) => ({
      ...current,
      provider: record.provider,
      baseUrl: providerPreset?.baseUrl || current.baseUrl,
      model: record.model,
      scene: record.scene,
      tone: record.tone,
      country: record.country,
      language: record.language,
      product: record.product,
      customerCompany: record.customerCompany,
      customerName: record.customerName,
    }));
    setCurrentOutputLanguage(record.language.split(' + ')[0]);
    setGrammarReview(null);
    setResult({ subject: record.subject, body: record.body, followUpTip: record.followUpTip, toneNotes: record.toneNotes, model: record.model });
    setView('workspace');
    setSaveStatus('已从历史记录载入');
  };

  const loadTemplateRecord = (template: TemplateRecord) => {
    const providerPreset = providerPresets.find((item) => item.id === template.provider);
    setForm((current) => ({
      ...current,
      provider: template.provider,
      baseUrl: providerPreset?.baseUrl || current.baseUrl,
      model: providerPreset?.model || current.model,
      scene: template.scene,
      tone: template.tone,
      language: template.language,
      industry: template.industry,
    }));
    setCurrentOutputLanguage(template.language.split(' + ')[0]);
    setGrammarReview(null);
    setResult({
      subject: template.subject,
      body: template.body,
      followUpTip: 'You can regenerate this template with fresh customer details.',
      toneNotes: `Loaded from template: ${template.name}`,
      model: providerPreset?.model || form.model,
    });
    setView('workspace');
    setSaveStatus(`已载入模板：${template.name}`);
  };

  const handleSaveCustomer = () => {
    const company = form.customerCompany.trim();
    if (!company) {
      setError('请先填写客户公司，再保存到客户资料库。');
      return;
    }

    const now = new Date().toISOString();
    const record: CustomerRecord = {
      id: uid('customer'),
      createdAt: now,
      updatedAt: now,
      company,
      contactName: form.customerName.trim(),
      source: form.customerSource,
      country: form.country.trim(),
      language: form.language.trim(),
      role: form.customerRole.trim(),
      customerType: form.customerType.trim(),
      stage: form.customerStage,
      responseStatus: form.responseStatus,
      followUpCount: form.followUpCount,
      industry: form.industry.trim(),
      notes: form.customerBackground.trim(),
    };

    setCustomerRecords((current) => {
      const deduped = current.filter((item) => !(item.company === record.company && item.contactName === record.contactName));
      return [record, ...deduped].slice(0, 300);
    });
    setSaveStatus(`客户已保存：${record.company}`);
  };

  const handleSaveProviderSettings = async () => {
    if (!window.vicMail) {
      setError('当前环境没有加载 Electron 接口，请用桌面版运行 Vic Mail。');
      return;
    }

    try {
      await window.vicMail.saveProviderSettings({
        provider: form.provider,
        apiKey: form.apiKey,
        baseUrl: form.baseUrl,
        model: form.model,
        senderCompany: form.senderCompany,
      });
      setSaveStatus('API 配置已保存到本地，下次打开会自动载入');
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存 API 配置失败。';
      setError(message);
    }
  };

  const handleLoadCustomer = (customerId: string) => {
    const customer = customerRecords.find((item) => item.id === customerId);
    if (!customer) {
      return;
    }

    setCurrentOutputLanguage('');
    setGrammarReview(null);
    setForm((current) => ({
      ...current,
      customerCompany: customer.company,
      customerName: customer.contactName,
      customerSource: customer.source,
      country: customer.country || current.country,
      language: customer.language || current.language,
      customerRole: customer.role,
      customerType: customer.customerType,
      customerStage: customer.stage,
      responseStatus: customer.responseStatus,
      followUpCount: customer.followUpCount,
      industry: customer.industry || current.industry,
      customerBackground: customer.notes,
    }));
    setSaveStatus(`已载入客户：${customer.company}`);
    setView('workspace');
  };

  const deleteCustomerRecord = (customerId: string) => {
    setCustomerRecords((current) => current.filter((item) => item.id !== customerId));
  };

  const handleBulkImportCustomers = () => {
    const rows = parseBulkCustomerInput(bulkCustomerInput);
    if (!rows.length) {
      setError('请先粘贴客户名单，再执行批量导入。');
      return;
    }

    const now = new Date().toISOString();
    const imported: CustomerRecord[] = rows.map((item) => ({
      id: uid('customer'),
      createdAt: now,
      updatedAt: now,
      company: item.company,
      contactName: item.contactName,
      source: sourcePacks.some((pack) => pack.id === item.source) ? item.source : 'manual_search',
      country: item.country,
      language: item.language || recommendLanguage(item.country),
      role: '',
      customerType: '',
      stage: 'prospecting',
      responseStatus: 'new',
      followUpCount: 0,
      industry: item.industry,
      notes: item.notes,
    }));

    setCustomerRecords((current) => {
      const merged = [...imported, ...current];
      const deduped = merged.filter((item, index, array) => (
        array.findIndex((candidate) => candidate.company === item.company && candidate.contactName === item.contactName) === index
      ));
      return deduped.slice(0, 500);
    });
    setBulkCustomerInput('');
    setError('');
    setSaveStatus(`已批量导入 ${imported.length} 个客户，默认进入待开发阶段`);
  };

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomerIds((current) => (
      current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId]
    ));
  };

  const selectFilteredCustomers = () => {
    setSelectedCustomerIds(filteredCustomers.map((customer) => customer.id));
  };

  const clearSelectedCustomers = () => {
    setSelectedCustomerIds([]);
  };

  const openBatchDraft = (draft: BatchDraft) => {
    if (!draft.response) {
      setError(draft.error || '该批量任务生成失败，暂无可载入正文。');
      return;
    }
    setForm(draft.request);
    setCurrentOutputLanguage(draft.request.language.split(' + ')[0]);
    setGrammarReview(null);
    setResult(draft.response);
    setView('workspace');
    setSaveStatus(`已载入批量草稿：${draft.customerCompany}`);
  };

  const handleBatchGenerateDrafts = async () => {
    if (!window.vicMail) {
      setError('当前环境没有加载 Electron 接口，请用桌面版运行 Vic Mail。');
      return;
    }
    if (!selectedCustomers.length) {
      setError('请先在客户资料库中勾选至少一个客户，再执行批量生成。');
      return;
    }

    setIsBatchGenerating(true);
    setBatchStatus('');
    setError('');
    const drafts: BatchDraft[] = [];

    try {
      for (let index = 0; index < selectedCustomers.length; index += 1) {
        const customer = selectedCustomers[index];
        const request = withEffectiveLanguage(buildRequestFromCustomer(customer));
        setBatchStatus(`正在生成第 ${index + 1} / ${selectedCustomers.length} 封：${customer.company}`);
        try {
          const response = await window.vicMail.generateMail(request);
          saveHistoryRecord(request, response);
          drafts.push({
            id: uid('batch'),
            customerId: customer.id,
            customerCompany: customer.company,
            scene: request.scene,
            status: 'success',
            request,
            response,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : '批量生成失败。';
          drafts.push({
            id: uid('batch'),
            customerId: customer.id,
            customerCompany: customer.company,
            scene: request.scene,
            status: 'failed',
            error: normalizeErrorMessage(message),
            request,
          });
        }
      }

      setBatchDrafts(drafts);
      const successCount = drafts.filter((item) => item.status === 'success').length;
      const failedCount = drafts.length - successCount;
      setSaveStatus(`批量任务完成：成功 ${successCount} 封，失败 ${failedCount} 封。成功结果已自动写入历史记录`);
      setBatchStatus(`批量生成完成：成功 ${successCount} / 失败 ${failedCount}`);
      if (failedCount > 0) {
        setError('部分客户生成失败，但批量任务已继续完成。你可以稍后重试失败项，或切换备用 AI 提供商。');
      }
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const bumpCustomerFollowUp = (customerId: string) => {
    setCustomerRecords((current) => current.map((item) => (
      item.id === customerId
        ? {
            ...item,
            followUpCount: Math.min(item.followUpCount + 1, 99),
            responseStatus: item.responseStatus === 'new' ? 'no_reply' : item.responseStatus,
            stage: item.stage === 'prospecting' ? 'contacted' : item.stage,
            updatedAt: new Date().toISOString(),
          }
        : item
    )));
    setSaveStatus('已为该客户记录一次跟进');
  };

  const continueCustomerFlow = (customerId: string) => {
    const customer = customerRecords.find((item) => item.id === customerId);
    if (!customer) return;
    setCurrentOutputLanguage('');
    setGrammarReview(null);
    setForm(buildRequestFromCustomer(customer));
    setView('workspace');
    setSaveStatus(`已为 ${customer.company} 打开继续跟进工作台`);
  };

  const currentProvider = providerPresets.find((item) => item.id === form.provider) ?? defaultProvider;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark-row">
            <div className="brand-mark-shell">
              <img alt="Vic Mail" className="brand-mark" src={brandIcon} />
            </div>
            <div>
              <div className="brand-kicker">Global Trade Mail Studio</div>
              <h1>Vic Mail Pro</h1>
            </div>
          </div>
          <p>面向外贸业务开发、报价推进与客户跟进的邮件工作台。用更结构化的方式，把 AI 写信变成可复用的销售动作。</p>
          <div className="brand-meta-row">
            <span>Trade Workflow</span>
            <span>Multi-AI</span>
            <span>Windows Desktop</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Pro 模块</div>
          <div className="nav-pill-row">
            {[
              { id: 'workspace', label: '工作台' },
              { id: 'history', label: '历史记录' },
              { id: 'templates', label: '模板库' },
              { id: 'customers', label: '客户资料' },
              { id: 'settings', label: '设置' },
            ].map((item) => (
              <button
                key={item.id}
                className={`nav-pill ${view === item.id ? 'active' : ''}`}
                onClick={() => setView(item.id as WorkspaceView)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="nav-select-note">
            {view === 'workspace' ? `${currentProvider.label} 生成工作区` : null}
            {view === 'history' ? `${historyRecords.length} 条生成记录` : null}
            {view === 'templates' ? `${templates.length} 个可复用模板` : null}
            {view === 'customers' ? `${customerRecords.length} 个客户档案` : null}
            {view === 'settings' ? '本地 API 配置与默认项' : null}
          </div>
        </div>
      </aside>

      <main className="workspace">
        <section className="topbar">
          <div>
            <div className="eyebrow">Pro workspace</div>
            <h2>多 AI 提供商的全球开发信工作台</h2>
            <p className="topbar-copy">从客户开发、报价跟进到老客户唤醒，把邮件生成、资产沉淀和业务推进放进同一套桌面工作台。</p>
          </div>
          <div className="topbar-badges">
            <span>{currentProvider.label}</span>
            <span>History</span>
            <span>Templates</span>
            <span>Customers</span>
            <span>Secure Local Config</span>
            <span>Gmail Jump</span>
          </div>
        </section>

        {view === 'workspace' ? (
          <section className="layout">
            <div className="panel form-panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">输入层</div>
                  <p>先选提供商，再测连接，再生成邮件。生成结果会自动沉淀到历史记录，优质内容可手动保存为模板。</p>
                </div>
                <div className="action-row">
                  <button className="secondary-button" onClick={handleSaveProviderSettings} type="button">保存 API 配置</button>
                  <button className="secondary-button" disabled={isTesting} onClick={handleTestConnection} type="button">{isTesting ? '测试中...' : '测试连接'}</button>
                  <button className="generate-button" disabled={isLoading} onClick={handleGenerate} type="button">{isLoading ? '生成中...' : '生成邮件'}</button>
                </div>
              </div>

              <div className="field-grid four">
                <label>
                  <span>AI 提供商</span>
                  <select value={form.provider} onChange={(event) => applyProviderPreset(event.target.value as ProviderId)}>
                    {providerPresets.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>场景模块</span>
                  <select value={form.scene} onChange={(event) => updateField('scene', event.target.value as MailScene)}>
                    {scenes.map((scene) => (
                      <option key={scene.value} value={scene.value}>{scene.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>写作风格</span>
                  <select value={form.tone} onChange={(event) => updateField('tone', event.target.value as MailTone)}>
                    {tones.map((tone) => (
                      <option key={tone.value} value={tone.value}>{tone.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>输出长度</span>
                  <select value={form.length} onChange={(event) => updateField('length', event.target.value as MailRequest['length'])}>
                    <option value="short">短版</option>
                    <option value="medium">中版</option>
                    <option value="long">长版</option>
                  </select>
                </label>
              </div>
              <div className="toolbar-note">现在 AI、场景模块、写作风格都已经调整为顶部下拉选择，操作会更集中。</div>

              {connectionStatus ? <div className="status-box">{connectionStatus}</div> : null}
              {saveStatus ? <div className="status-box alt">{saveStatus}</div> : null}

              <div className="field-grid three">
                <label><span>API Base URL</span><input value={form.baseUrl} onChange={(event) => updateField('baseUrl', event.target.value)} placeholder={currentProvider.baseUrl} /></label>
                <label><span>模型</span><input value={form.model} onChange={(event) => updateField('model', event.target.value)} placeholder={currentProvider.model} /></label>
                <label><span>当前提供商说明</span><input value={currentProvider.helper} readOnly /></label>
              </div>

              <div className="field-grid one">
                <label><span>API Key</span><input type="password" value={form.apiKey} onChange={(event) => updateField('apiKey', event.target.value)} placeholder="输入当前提供商对应的 API Key" /></label>
              </div>

              <div className="section-banner">基础配置</div>
              <div className="field-grid three">
                <label>
                  <span>目标国家</span>
                  <select value={form.country} onChange={(event) => updateField('country', event.target.value)}>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>语言模式</span>
                  <select value={form.languageMode} onChange={(event) => updateField('languageMode', event.target.value as LanguageMode)}>
                    <option value="auto">自动匹配客户语言</option>
                    <option value="single">指定单语生成</option>
                    <option value="bilingual">双语对照输出</option>
                  </select>
                </label>
                <label><span>行业</span><input value={form.industry} onChange={(event) => updateField('industry', event.target.value)} /></label>
              </div>

              <div className="section-banner">语言与行业策略</div>
              <div className="field-grid three">
                <label>
                  <span>行业模板包</span>
                  <select value={form.industryPack} onChange={(event) => updateField('industryPack', event.target.value)}>
                    {industryPacks.map((pack) => (
                      <option key={pack.id} value={pack.id}>{pack.label} / {pack.helper}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>当前行业策略</span>
                  <input value={currentIndustryPack.helper} readOnly />
                </label>
                <label>
                  <span>场景策略</span>
                  <select value={form.sceneStrategy} onChange={(event) => updateField('sceneStrategy', event.target.value)}>
                    {currentStrategies.map((strategy) => (
                      <option key={strategy.value} value={strategy.value}>{strategy.label} / {strategy.helper}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="micro-note">行业模板包会帮助系统优先抓住不同买家的关注点；场景策略则决定邮件开头方式、推进节奏和 CTA 结构。</div>
              {industryHints.length ? (
                <div className="tag-row">
                  {industryHints.map((hint) => <span key={hint}>{hint}</span>)}
                </div>
              ) : null}

              <div className={`field-grid ${form.languageMode === 'bilingual' ? 'two' : 'one'}`}>
                <label>
                  <span>推荐语言</span>
                  <input value={recommendedLanguage} readOnly />
                </label>
                {form.languageMode === 'bilingual' ? (
                  <label>
                    <span>第二语言</span>
                    <select value={form.secondaryLanguage} onChange={(event) => updateField('secondaryLanguage', event.target.value)}>
                      {languageOptions.map((language) => (
                        <option key={language} value={language}>{language}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              {form.languageMode === 'auto' ? <div className="micro-note">当前会根据目标国家自动推荐客户更常用的商务语言；如需人工控制，可切到“指定单语生成”。</div> : null}
              {form.languageMode === 'bilingual' ? <div className="micro-note">双语模式更适合内部审核、团队对照或先看中文后再发外语版本；正式发客户时通常建议单语。</div> : null}

              <div className="field-grid one"><label><span>产品信息</span><textarea rows={3} value={form.product} onChange={(event) => updateField('product', event.target.value)} placeholder="例如：Frozen halal lamb cuts / pet snacks / paper cups" /></label></div>
              <div className="field-grid one"><label><span>USP / 核心卖点</span><textarea rows={3} value={form.usp} onChange={(event) => updateField('usp', event.target.value)} placeholder="写清楚产品优势、供应稳定性、包装、定制能力、认证等" /></label></div>

              <div className="section-banner">客户与来源</div>
              <div className="field-grid one">
                <label>
                  <span>从客户资料库快速载入</span>
                  <select value="" onChange={(event) => { if (event.target.value) handleLoadCustomer(event.target.value); }}>
                    <option value="">选择已保存客户</option>
                    {customerRecords.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.company}{customer.contactName ? ` / ${customer.contactName}` : ''}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field-grid two">
                <label>
                  <span>客户来源渠道</span>
                  <select value={form.customerSource} onChange={(event) => updateField('customerSource', event.target.value)}>
                    {sourcePacks.map((source) => (
                      <option key={source.id} value={source.id}>{source.label} / {source.helper}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>当前渠道打法</span>
                  <input value={currentSourcePack.helper} readOnly />
                </label>
              </div>
              <div className="micro-note">同样是开发信，海关数据、展会、官网、LinkedIn、老客户重连的开场逻辑都不同。这里会帮助系统选更贴近真实场景的切入方式。</div>
              {sourceHints.length ? (
                <div className="tag-row">
                  {sourceHints.map((hint) => <span key={hint}>{hint}</span>)}
                </div>
              ) : null}

              <div className="field-grid four">
                <label><span>客户公司</span><input value={form.customerCompany} onChange={(event) => updateField('customerCompany', event.target.value)} /></label>
                <label><span>客户姓名</span><input value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} /></label>
                <label><span>客户职位</span><input value={form.customerRole} onChange={(event) => updateField('customerRole', event.target.value)} /></label>
                <label><span>客户类型</span><input value={form.customerType} onChange={(event) => updateField('customerType', event.target.value)} /></label>
              </div>

              <div className="field-grid one"><label><span>客户背景</span><textarea rows={2} value={form.customerBackground} onChange={(event) => updateField('customerBackground', event.target.value)} placeholder="比如官网定位、目标市场、客户关注点、客户刚提到的问题" /></label></div>

              <div className="field-grid three">
                <label>
                  <span>客户阶段</span>
                  <select value={form.customerStage} onChange={(event) => updateField('customerStage', event.target.value as CustomerStage)}>
                    {customerStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>最近状态</span>
                  <select value={form.responseStatus} onChange={(event) => updateField('responseStatus', event.target.value as ResponseStatus)}>
                    {responseStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>已跟进次数</span>
                  <input type="number" min="0" max="20" value={form.followUpCount} onChange={(event) => updateField('followUpCount', Number(event.target.value || 0))} />
                </label>
              </div>
              <div className="micro-note">这三项会帮助系统判断你现在是在首次开发、继续跟进、报价承接还是谈判推进，也会影响跟进建议。</div>

              <div className="field-grid four">
                <label><span>MOQ</span><input value={form.moq} onChange={(event) => updateField('moq', event.target.value)} /></label>
                <label><span>报价条件</span><input value={form.priceTerms} onChange={(event) => updateField('priceTerms', event.target.value)} /></label>
                <label><span>付款方式</span><input value={form.paymentTerms} onChange={(event) => updateField('paymentTerms', event.target.value)} /></label>
                <label><span>交期</span><input value={form.leadTime} onChange={(event) => updateField('leadTime', event.target.value)} /></label>
              </div>

              <div className="field-grid two">
                <label><span>认证 / 资质</span><input value={form.certifications} onChange={(event) => updateField('certifications', event.target.value)} /></label>
                <label><span>发件公司</span><input value={form.senderCompany} onChange={(event) => updateField('senderCompany', event.target.value)} /></label>
              </div>

              <div className="field-grid one"><label><span>特别要求</span><textarea rows={3} value={form.extraRequirements} onChange={(event) => updateField('extraRequirements', event.target.value)} placeholder="例如：避免太推销；更像欧美采购常见表达；突出 halal；加入可寄样信息" /></label></div>
              <label className="switch-row"><input checked={form.culturalAdaptation} onChange={(event) => updateField('culturalAdaptation', event.target.checked)} type="checkbox" /><span>启用国家文化适配</span></label>

              {matchedSystemTemplates.length ? (
                <div className="asset-panel">
                  <div className="panel-title">系统模板推荐</div>
                  <div className="asset-list">
                    {matchedSystemTemplates.map((template) => (
                      <button key={template.id} className="asset-item" onClick={() => loadTemplateRecord(template)} type="button">
                        <strong>{template.name}</strong>
                        <span>{template.notes}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="result-column">
              <div className="panel result-panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">输出层</div>
                    <p>{currentProvider.label} 返回的主题、正文和跟进建议会在这里展示，也可以直接跳转到 Gmail，或导出为 TXT / Word。</p>
                  </div>
                  <div className="action-row">
                    <button className="secondary-button action-save-customer" onClick={handleSaveCustomer} type="button">保存客户</button>
                    <button className="secondary-button action-template" disabled={!result} onClick={handleSaveTemplate} type="button">保存为模板</button>
                    <button className="secondary-button action-export-txt" disabled={!result} onClick={handleExportTxt} type="button">导出 TXT</button>
                    <button className="secondary-button action-export-word" disabled={!result} onClick={handleExportDocx} type="button">导出 Word</button>
                    <button className="secondary-button action-gmail" disabled={!result} onClick={handleOpenGmail} type="button">跳转 Gmail</button>
                    <button className="secondary-button action-copy" disabled={!result} onClick={handleCopy} type="button">{copyState === 'done' ? '已复制' : '复制主题 + 正文'}</button>
                    <button className="secondary-button action-grammar-check" disabled={!result || isCheckingGrammar} onClick={handleCheckGrammar} type="button">{isCheckingGrammar ? '检查中...' : '检查语法'}</button>
                    <button className="secondary-button action-grammar-fix" disabled={!result || isFixingGrammar} onClick={handleFixGrammar} type="button">{isFixingGrammar ? '修正中...' : '修正语法'}</button>
                  </div>
                </div>
                {error ? <div className="error-box">{error}</div> : null}
                {grammarReview ? (
                  <div className={`status-box ${grammarReview.verdict === 'correct' ? 'grammar-ok' : 'grammar-watch'}`}>
                    <strong>{grammarReview.verdict === 'correct' ? `语法检查通过 · ${grammarTargetLanguage}` : `发现语法可优化项 · ${grammarTargetLanguage}`}</strong>
                    <span>{grammarReview.summary}</span>
                    {grammarReview.issues.length ? (
                      <ul className="grammar-issue-list">
                        {grammarReview.issues.map((issue, index) => (
                          <li key={`${issue}-${index}`}>{issue}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                {result ? (
                  <div className="mail-card">
                    <div className="mail-meta">
                      <span>提供商：{currentProvider.label}</span>
                      <span>模型：{result.model}</span>
                      <span>场景：{scenes.find((scene) => scene.value === form.scene)?.label}</span>
                      <span>风格：{tones.find((tone) => tone.value === form.tone)?.label}</span>
                    </div>
                    <div className="mail-section"><div className="mail-label">Subject</div><div className="mail-subject">{result.subject}</div></div>
                    <div className="mail-section"><div className="mail-label">Body</div><pre className="mail-body">{result.body}</pre></div>
                    <div className="hint-grid">
                      <div className="hint-card"><div className="mail-label">Tone Notes</div><p>{result.toneNotes}</p></div>
                      <div className="hint-card"><div className="mail-label">Next Step</div><p>{result.followUpTip}</p></div>
                    </div>

                    <details className="fold-panel" open>
                      <summary>主题行备选</summary>
                      <div className="fold-panel-body">
                        <div className="variant-list">
                          {subjectVariants.map((variant) => (
                            <button key={variant.id} className="variant-item" onClick={() => navigator.clipboard.writeText(variant.value)} type="button">
                              <strong>{variant.style}</strong>
                              <span>{variant.value}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </details>

                    <details className="fold-panel" open>
                      <summary>回复目标检测</summary>
                      <div className="fold-panel-body">
                        <div className="goal-list">
                          {goalSignals.map((signal) => (
                            <div key={signal.id} className={`goal-item ${signal.status}`}>
                              <strong>{signal.label}</strong>
                              <span>{signal.detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>

                    <details className="fold-panel" open>
                      <summary>质量检查与工作流建议</summary>
                      <div className="fold-panel-body">
                        <div className="review-panel">
                          <p className="review-summary">{workflowSuggestion}</p>
                          <div className="review-list">
                            {qualityReview.map((item) => (
                              <div key={item.id} className={`review-item ${item.level}`}>
                                <strong>{item.title}</strong>
                                <span>{item.detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>

                    <details className="fold-panel">
                      <summary>跟进链建议</summary>
                      <div className="fold-panel-body">
                        <div className="sequence-list">
                          {followUpSequence.map((step) => (
                            <div key={step.id} className="sequence-item">
                              <div className="sequence-day">{step.dayLabel}</div>
                              <div className="sequence-title">{step.title}</div>
                              <p>{step.angle}</p>
                              <div className="sequence-cta">CTA: {step.cta}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="empty-state">
                    <h3>先选 AI，再测试连接，再正式生成</h3>
                    <p>当前已接入 7 个 AI 提供商：MiniMax、DeepSeek、Kimi、Qwen、ChatGPT、Claude、Gemini。生成后会自动沉淀到历史记录，也可以手动保存成模板或导出文件。</p>
                    <ul>
                      <li>自动保存历史记录</li>
                      <li>当前结果一键保存为模板</li>
                      <li>历史记录和模板都可重新载入工作台</li>
                      <li>结合客户阶段和跟进状态给出质量检查</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="panel architecture-panel">
                <div className="panel-title">当前架构</div>
                <div className="stack-list">
                  <span>Electron Desktop Shell</span>
                  <span>React + TypeScript UI</span>
                  <span>Provider Presets</span>
                  <span>Local History Store</span>
                  <span>Template Library</span>
                  <span>Gmail Compose Jump</span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {view === 'history' ? (
          <section className="library-layout">
            <div className="panel library-panel">
              <div className="panel-header">
                <div><div className="panel-title">历史记录</div><p>每次生成后都会自动保存，方便回看、复制和重新载入。</p></div>
                <input className="search-input" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="搜索客户、国家、产品或标题" />
              </div>
              <div className="dashboard-strip">
                <div className="dashboard-stat"><span>总记录</span><strong>{historyRecords.length}</strong></div>
                <div className="dashboard-stat"><span>筛选结果</span><strong>{filteredHistory.length}</strong></div>
                <div className="dashboard-stat"><span>最近场景</span><strong>{historyRecords[0] ? (scenes.find((item) => item.value === historyRecords[0].scene)?.label || historyRecords[0].scene) : '暂无'}</strong></div>
              </div>
              {filteredHistory.length ? (
                <div className="record-list">
                  {filteredHistory.map((record) => (
                    <article key={record.id} className="record-card">
                      <div className="record-head">
                        <div><h3>{record.subject || 'Untitled email'}</h3><p>{record.customerCompany || '未填写客户公司'} · {record.country} · {scenes.find((item) => item.value === record.scene)?.label}</p></div>
                        <span>{new Date(record.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="record-body">{record.body.slice(0, 220)}{record.body.length > 220 ? '...' : ''}</div>
                      <div className="action-row">
                        <button className="secondary-button" onClick={() => loadHistoryRecord(record)} type="button">载入工作台</button>
                        <button className="secondary-button" onClick={() => setTemplates((current) => [{ id: uid('template'), category: 'custom', name: `${scenes.find((item) => item.value === record.scene)?.label || '模板'} - ${record.product.slice(0, 20)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provider: record.provider, scene: record.scene, tone: record.tone, language: record.language, industry: form.industry, industryPack: form.industryPack, source: form.customerSource, sceneStrategy: form.sceneStrategy, subject: record.subject, body: record.body, notes: `${record.country} / ${record.customerCompany || 'history import'}` }, ...current])} type="button">存成模板</button>
                        <button className="secondary-button" onClick={() => setHistoryRecords((current) => current.filter((item) => item.id !== record.id))} type="button">删除</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="empty-library">暂无历史记录，先去工作台生成一封邮件吧。</div>}
            </div>
          </section>
        ) : null}

        {view === 'templates' ? (
          <section className="library-layout">
            <div className="panel library-panel">
              <div className="panel-header">
                <div><div className="panel-title">模板库</div><p>把高质量结果沉淀成可复用模板，后面可一键载入继续改写。</p></div>
                <input className="search-input" value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="搜索模板名称、行业、语言或备注" />
              </div>
              <div className="field-grid three compact-filter-grid">
                <label>
                  <span>按场景筛选</span>
                  <select value={templateSceneFilter} onChange={(event) => setTemplateSceneFilter(event.target.value as 'all' | MailScene)}>
                    <option value="all">全部场景</option>
                    {scenes.map((scene) => (
                      <option key={scene.value} value={scene.value}>{scene.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>按行业筛选</span>
                  <select value={templateIndustryFilter} onChange={(event) => setTemplateIndustryFilter(event.target.value)}>
                    <option value="all">全部行业</option>
                    {industryPacks.map((pack) => (
                      <option key={pack.id} value={pack.id}>{pack.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>按来源筛选</span>
                  <select value={templateSourceFilter} onChange={(event) => setTemplateSourceFilter(event.target.value)}>
                    <option value="all">全部来源</option>
                    {sourcePacks.map((source) => (
                      <option key={source.id} value={source.id}>{source.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="dashboard-strip">
                <div className="dashboard-stat"><span>全部模板</span><strong>{filteredTemplates.length}</strong></div>
                <div className="dashboard-stat"><span>我的模板</span><strong>{customTemplateCount}</strong></div>
                <div className="dashboard-stat"><span>系统模板</span><strong>{systemTemplates.length}</strong></div>
              </div>
              {filteredTemplates.length ? (
                <div className="record-list template-grid">
                  {filteredTemplates.map((template) => (
                    <article key={template.id} className="record-card">
                      <div className="record-head">
                        <div><h3>{template.name}</h3><p>{template.category === 'system' ? '系统模板' : '我的模板'} · {providerPresets.find((item) => item.id === template.provider)?.label} · {template.language} · {scenes.find((item) => item.value === template.scene)?.label}</p></div>
                        <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="record-body">{template.subject}</div>
                      {template.notes ? <div className="template-notes">{template.notes}</div> : null}
                      <div className="template-notes">{industryPacks.find((item) => item.id === template.industryPack)?.label || template.industry} · {sourcePacks.find((item) => item.id === template.source)?.label || '未设来源'} · {(sceneStrategies[template.scene] || []).find((item) => item.value === template.sceneStrategy)?.label || template.sceneStrategy}</div>
                      <div className="action-row">
                        <button className="secondary-button" onClick={() => loadTemplateRecord(template)} type="button">使用模板</button>
                        {template.category === 'custom' ? <button className="secondary-button" onClick={() => setTemplates((current) => current.filter((item) => item.id !== template.id))} type="button">删除</button> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="empty-library">暂无模板。先在工作台生成邮件，再点击“保存为模板”。</div>}
            </div>
          </section>
        ) : null}

        {view === 'customers' ? (
          <section className="library-layout">
            <div className="panel library-panel">
              <div className="panel-header">
                <div><div className="panel-title">客户资料库</div><p>保存客户公司、联系人、国家和背景信息，后续一键回填到工作台。</p></div>
                <input className="search-input" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="搜索公司、联系人、国家或行业" />
              </div>
              <div className="dashboard-strip">
                <div className="dashboard-stat"><span>全部客户</span><strong>{customerRecords.length}</strong></div>
                <div className="dashboard-stat"><span>当前筛选</span><strong>{filteredCustomers.length}</strong></div>
                <div className="dashboard-stat"><span>已勾选批量</span><strong>{selectedCustomerIds.length}</strong></div>
              </div>
              <div className="asset-panel">
                <div className="panel-title">批量导入客户</div>
                <p>每行一个客户，推荐格式：`公司, 联系人, 国家, 语言, 行业, 来源渠道`。来源渠道可填 `customs_data`、`trade_show`、`website`、`linkedin`、`old_customer`、`referral`、`manual_search`。</p>
                <textarea
                  className="bulk-import-textarea"
                  value={bulkCustomerInput}
                  onChange={(event) => setBulkCustomerInput(event.target.value)}
                  placeholder={'Acme Foods, John, Spain, Spanish, Food export, customs_data\nBright Pack, Anna, Germany, English, Packaging products, website'}
                  rows={5}
                />
                <div className="action-row">
                  <button className="generate-button" onClick={handleBulkImportCustomers} type="button">批量导入客户</button>
                  <button className="secondary-button" onClick={() => setBulkCustomerInput('')} type="button">清空内容</button>
                </div>
              </div>
              <div className="asset-panel">
                <div className="panel-title">批量生成任务</div>
                <p>先勾选客户，再按当前工作台里的产品、卖点、AI 提供商和语言模式批量生成首轮草稿或跟进草稿。</p>
                <div className="action-row">
                  <button className="secondary-button" onClick={selectFilteredCustomers} type="button">全选当前筛选</button>
                  <button className="secondary-button" onClick={clearSelectedCustomers} type="button">清空勾选</button>
                  <button className="generate-button" disabled={isBatchGenerating} onClick={handleBatchGenerateDrafts} type="button">
                    {isBatchGenerating ? '批量生成中...' : `为所选客户批量生成 (${selectedCustomerIds.length})`}
                  </button>
                </div>
                {batchStatus ? <div className="status-box alt">{batchStatus}</div> : null}
                {!!batchDrafts.length ? (
                  <div className="asset-list">
                    {batchDrafts.map((draft) => (
                      <button key={draft.id} className="asset-item" onClick={() => openBatchDraft(draft)} type="button">
                        <strong>{draft.customerCompany}</strong>
                        <span>{scenes.find((scene) => scene.value === draft.scene)?.label || draft.scene}</span>
                        <small>{draft.status === 'success' ? (draft.response?.subject || '已生成草稿') : (draft.error || '生成失败')}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="customer-summary-grid">
                <article className={`summary-card ${customerStageFilter === 'all' ? 'active' : ''}`}>
                  <button className="summary-card-button" onClick={() => setCustomerStageFilter('all')} type="button">
                    <span>全部客户</span>
                    <strong>{customerRecords.length}</strong>
                    <small>查看全部阶段客户</small>
                  </button>
                </article>
                {customerStageSummary.map((stage) => (
                  <article key={stage.value} className={`summary-card ${customerStageFilter === stage.value ? 'active' : ''}`}>
                    <button className="summary-card-button" onClick={() => setCustomerStageFilter(stage.value)} type="button">
                      <span>{stage.label}</span>
                      <strong>{stage.count}</strong>
                      <small>{stage.helper}</small>
                    </button>
                  </article>
                ))}
              </div>
              <div className="filter-toolbar">
                <div className="filter-chip-row">
                  <button className={`filter-chip ${customerStageFilter === 'all' ? 'active' : ''}`} onClick={() => setCustomerStageFilter('all')} type="button">全部阶段</button>
                  {customerStages.map((stage) => (
                    <button
                      key={stage.value}
                      className={`filter-chip ${customerStageFilter === stage.value ? 'active' : ''}`}
                      onClick={() => setCustomerStageFilter(stage.value)}
                      type="button"
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
                <div className="filter-toolbar-note">
                  当前显示 {filteredCustomers.length} 个客户，支持按阶段快速筛选后继续推进。
                </div>
              </div>
              {filteredCustomers.length ? (
                <div className="record-list template-grid">
                  {filteredCustomers.map((customer) => (
                    <article key={customer.id} className="record-card">
                      <div className="record-head">
                        <div><h3>{customer.company}</h3><p>{customer.contactName || '未填写联系人'} · {customer.country || '未填写国家'} · {customer.industry || '未填写行业'}</p></div>
                        <span>{new Date(customer.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <label className="customer-checkbox">
                        <input
                          checked={selectedCustomerIds.includes(customer.id)}
                          onChange={() => toggleCustomerSelection(customer.id)}
                          type="checkbox"
                        />
                        <span>加入批量任务</span>
                      </label>
                      <div className="record-body">{customer.role || '未填写职位'} · {customer.customerType || '未填写客户类型'} · {customer.language || '未填写语言'} · {sourcePacks.find((item) => item.id === customer.source)?.label || '未设来源'} · {customerStages.find((item) => item.value === customer.stage)?.label || '未设阶段'} · 已跟进 {customer.followUpCount} 次</div>
                      <div className="tag-row">
                        <span className="status-chip">{customerStages.find((item) => item.value === customer.stage)?.label || '未设阶段'}</span>
                        <span className="status-chip">{responseStatuses.find((item) => item.value === customer.responseStatus)?.label || '未设状态'}</span>
                        <span className="status-chip">{sourcePacks.find((item) => item.id === customer.source)?.label || '未设来源'}</span>
                      </div>
                      {customer.notes ? <div className="template-notes">{customer.notes}</div> : null}
                      <div className="action-row">
                        <button className="generate-button" onClick={() => continueCustomerFlow(customer.id)} type="button">继续跟进</button>
                        <button className="secondary-button" onClick={() => bumpCustomerFollowUp(customer.id)} type="button">记录跟进 +1</button>
                        <button className="secondary-button" onClick={() => handleLoadCustomer(customer.id)} type="button">载入工作台</button>
                        <button className="secondary-button" onClick={() => deleteCustomerRecord(customer.id)} type="button">删除</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="empty-library">暂无客户资料。先在工作台填写客户信息，再点击“保存客户”。</div>}
            </div>
          </section>
        ) : null}

        {view === 'settings' ? (
          <section className="library-layout">
            <div className="panel library-panel">
              <div className="panel-header">
                <div><div className="panel-title">设置</div><p>把当前提供商、API Key、Base URL、模型和发件公司保存到本地，后续启动时自动带回工作台。</p></div>
                <div className="action-row">
                  <button className="secondary-button" onClick={handleSaveProviderSettings} type="button">保存当前 API 配置</button>
                  <button className="secondary-button" disabled={isTesting} onClick={handleTestConnection} type="button">{isTesting ? '测试中...' : '测试连接'}</button>
                </div>
              </div>
              <div className="status-box alt">当前版本会把 API 配置写到 Electron 本地目录；系统支持时会优先使用系统加密能力保存 key，同时不再把 API Key 写进浏览器 localStorage。</div>
              <div className="field-grid two">
                <label><span>当前提供商</span><input value={currentProvider.label} readOnly /></label>
                <label><span>发件公司</span><input value={form.senderCompany} onChange={(event) => updateField('senderCompany', event.target.value)} /></label>
              </div>
              <div className="field-grid two">
                <label><span>API Base URL</span><input value={form.baseUrl} onChange={(event) => updateField('baseUrl', event.target.value)} /></label>
                <label><span>模型</span><input value={form.model} onChange={(event) => updateField('model', event.target.value)} /></label>
              </div>
              <div className="field-grid one">
                <label><span>API Key</span><input type="password" value={form.apiKey} onChange={(event) => updateField('apiKey', event.target.value)} placeholder="保存后，下次打开自动载入" /></label>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;












