import { useEffect, useState } from 'react';
import './app.css';
import type { MailRequest, MailResponse, MailScene, MailTone, ProviderId } from './global';

const providerPresets: Array<{
  id: ProviderId;
  label: string;
  helper: string;
  baseUrl: string;
  model: string;
}> = [
  {
    id: 'minimaxi',
    label: 'MiniMaxi',
    helper: '国内版默认预设',
    baseUrl: 'https://api.minimaxi.com/v1',
    model: 'MiniMax-M2.1',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    helper: 'DeepSeek 官方兼容接口',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    helper: 'Moonshot 官方接口',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    helper: '阿里云百炼兼容接口',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
];

const scenes: Array<{ value: MailScene; label: string; helper: string }> = [
  { value: 'first_contact', label: '首次开发信', helper: '陌生客户初次触达' },
  { value: 'follow_up', label: '跟进信', helper: '未回复客户二次推进' },
  { value: 'reply_customer', label: '回复客户', helper: '接住客户意向继续沟通' },
  { value: 'inquiry_quote', label: '询价 / 报价信', helper: '规格、条款、报价回复' },
  { value: 'negotiation', label: '谈判信', helper: '价格、MOQ、付款方式博弈' },
  { value: 'close_deal', label: '催单成交信', helper: '推动确认、PI、下单' },
  { value: 'after_sales', label: '售后维护信', helper: '发货、回访、复购引导' },
  { value: 'reactivation', label: '老客户唤醒', helper: '沉睡客户重新激活' },
];

const tones: Array<{ value: MailTone; label: string; helper: string }> = [
  { value: 'professional', label: '专业严谨', helper: '正式商务表达，适合作为默认风格' },
  { value: 'friendly', label: '亲切友好', helper: '更容易建立信任感和沟通温度' },
  { value: 'concise', label: '简洁高效', helper: '适合忙碌采购，快速抓住重点' },
  { value: 'humorous', label: '幽默风趣', helper: '轻度幽默，仍保持商务安全' },
];

const defaultProvider = providerPresets[0];

const initialForm: MailRequest = {
  provider: defaultProvider.id,
  apiKey: '',
  baseUrl: defaultProvider.baseUrl,
  model: defaultProvider.model,
  country: 'United States',
  language: 'English',
  industry: 'Food export',
  product: 'Frozen halal lamb cuts',
  usp: 'Halal certified, stable supply, flexible packaging, export-ready documents',
  customerCompany: '',
  customerName: '',
  customerRole: 'Purchasing Manager',
  customerType: 'Importer / Distributor',
  customerBackground: '',
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

function normalizeErrorMessage(message: string) {
  if (message.includes('401')) {
    return '连接失败：API Key 无效，或当前 key 不具备该接口权限。请检查提供商、Key 类型和账户状态。';
  }
  if (message.includes('403')) {
    return '连接失败：账号或模型权限不足，请检查套餐、模型权限或账户状态。';
  }
  if (message.includes('404')) {
    return '连接失败：模型名或接口地址不正确，请确认 Base URL 和模型名。';
  }
  return message;
}

function App() {
  const [form, setForm] = useState<MailRequest>(initialForm);
  const [result, setResult] = useState<MailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');

  useEffect(() => {
    const restore = localStorage.getItem('vic-mail-form');
    if (restore) {
      try {
        const parsed = JSON.parse(restore) as Partial<MailRequest>;
        setForm((current) => ({ ...current, ...parsed }));
      } catch {
        // Ignore malformed local state and continue with defaults.
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('vic-mail-form', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (!window.vicMail) {
      return;
    }

    window.vicMail
      .getDefaults()
      .then((defaults) => {
        setForm((current) => {
          if (current.provider !== 'minimaxi') {
            return current;
          }
          return {
            ...current,
            baseUrl: current.baseUrl || defaults.defaultBaseUrl,
            model: current.model || defaults.defaultModel,
          };
        });
      })
      .catch(() => undefined);
  }, []);

  const updateField = <K extends keyof MailRequest>(key: K, value: MailRequest[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyProviderPreset = (providerId: ProviderId) => {
    const preset = providerPresets.find((item) => item.id === providerId);
    if (!preset) {
      return;
    }

    setForm((current) => ({
      ...current,
      provider: providerId,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
    setConnectionStatus('');
    setError('');
  };

  const handleGenerate = async () => {
    if (!window.vicMail) {
      setError('当前环境没有加载 Electron 接口，请用桌面版运行 Vic Mail。');
      return;
    }

    setIsLoading(true);
    setError('');
    setConnectionStatus('');

    try {
      const response = await window.vicMail.generateMail(form);
      setResult(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed.';
      setError(normalizeErrorMessage(message));
    } finally {
      setIsLoading(false);
    }
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
      const response = await window.vicMail.testConnection({
        apiKey: form.apiKey,
        baseUrl: form.baseUrl,
        model: form.model,
      });
      setConnectionStatus(`连接成功：${response.model} @ ${response.baseUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed.';
      setConnectionStatus(normalizeErrorMessage(message));
    } finally {
      setIsTesting(false);
    }
  };

  const handleOpenGmail = async () => {
    if (!result || !window.vicMail) {
      return;
    }

    try {
      await window.vicMail.openGmailCompose({
        subject: result.subject,
        body: result.body,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open Gmail.';
      setError(message);
    }
  };

  const handleCopy = async () => {
    if (!result) {
      return;
    }

    await navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`);
    setCopyState('done');
    window.setTimeout(() => setCopyState('idle'), 1800);
  };

  const currentProvider = providerPresets.find((item) => item.id === form.provider) ?? defaultProvider;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">Global Trade Mail Studio</div>
          <h1>Vic Mail</h1>
          <p>输入国家、产品、客户与业务阶段，选择不同 AI 提供商，生成可直接发送的外贸邮件。</p>
        </div>

        <div className="panel">
          <div className="panel-title">AI 提供商</div>
          <div className="choice-grid compact">
            {providerPresets.map((provider) => (
              <button
                key={provider.id}
                className={`choice-card ${form.provider === provider.id ? 'active' : ''}`}
                onClick={() => applyProviderPreset(provider.id)}
                type="button"
              >
                <span>{provider.label}</span>
                <small>{provider.helper}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">场景模块</div>
          <div className="choice-grid">
            {scenes.map((scene) => (
              <button
                key={scene.value}
                className={`choice-card ${form.scene === scene.value ? 'active' : ''}`}
                onClick={() => updateField('scene', scene.value)}
                type="button"
              >
                <span>{scene.label}</span>
                <small>{scene.helper}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">写作风格</div>
          <div className="choice-grid compact">
            {tones.map((tone) => (
              <button
                key={tone.value}
                className={`choice-card ${form.tone === tone.value ? 'active' : ''}`}
                onClick={() => updateField('tone', tone.value)}
                type="button"
              >
                <span>{tone.label}</span>
                <small>{tone.helper}</small>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="workspace">
        <section className="topbar">
          <div>
            <div className="eyebrow">Desktop drafting engine</div>
            <h2>多 AI 提供商的全球开发信工作台</h2>
          </div>
          <div className="topbar-badges">
            <span>{currentProvider.label}</span>
            <span>Multi-AI</span>
            <span>Gmail Jump</span>
          </div>
        </section>

        <section className="layout">
          <div className="panel form-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">输入层</div>
                <p>先选提供商，再测连接，再生成邮件。当前推荐预设：{currentProvider.label} / {currentProvider.model}。</p>
              </div>
              <div className="action-row">
                <button className="secondary-button" disabled={isTesting} onClick={handleTestConnection} type="button">
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                <button className="generate-button" disabled={isLoading} onClick={handleGenerate} type="button">
                  {isLoading ? '生成中...' : '生成邮件'}
                </button>
              </div>
            </div>

            {connectionStatus ? <div className="status-box">{connectionStatus}</div> : null}

            <div className="field-grid three">
              <label>
                <span>AI 提供商</span>
                <input value={currentProvider.label} readOnly />
              </label>
              <label>
                <span>API Base URL</span>
                <input
                  value={form.baseUrl}
                  onChange={(event) => updateField('baseUrl', event.target.value)}
                  placeholder={currentProvider.baseUrl}
                />
              </label>
              <label>
                <span>模型</span>
                <input
                  value={form.model}
                  onChange={(event) => updateField('model', event.target.value)}
                  placeholder={currentProvider.model}
                />
              </label>
            </div>

            <div className="provider-hints">
              {providerPresets.map((provider) => (
                <div key={provider.id} className={`provider-pill ${form.provider === provider.id ? 'active' : ''}`}>
                  <strong>{provider.label}</strong>
                  <span>{provider.baseUrl}</span>
                  <span>{provider.model}</span>
                </div>
              ))}
            </div>

            <div className="field-grid two">
              <label>
                <span>API Key</span>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(event) => updateField('apiKey', event.target.value)}
                  placeholder="输入当前提供商对应的 API Key"
                />
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

            <div className="field-grid three">
              <label>
                <span>目标国家</span>
                <input value={form.country} onChange={(event) => updateField('country', event.target.value)} />
              </label>
              <label>
                <span>输出语言</span>
                <input value={form.language} onChange={(event) => updateField('language', event.target.value)} />
              </label>
              <label>
                <span>行业</span>
                <input value={form.industry} onChange={(event) => updateField('industry', event.target.value)} />
              </label>
            </div>

            <div className="field-grid one">
              <label>
                <span>产品信息</span>
                <textarea
                  rows={3}
                  value={form.product}
                  onChange={(event) => updateField('product', event.target.value)}
                  placeholder="例如：Frozen halal lamb cuts / pet snacks / paper cups"
                />
              </label>
            </div>

            <div className="field-grid one">
              <label>
                <span>USP / 核心卖点</span>
                <textarea
                  rows={3}
                  value={form.usp}
                  onChange={(event) => updateField('usp', event.target.value)}
                  placeholder="写清楚产品优势、供应稳定性、包装、定制能力、认证等"
                />
              </label>
            </div>

            <div className="field-grid four">
              <label>
                <span>客户公司</span>
                <input value={form.customerCompany} onChange={(event) => updateField('customerCompany', event.target.value)} />
              </label>
              <label>
                <span>客户姓名</span>
                <input value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} />
              </label>
              <label>
                <span>客户职位</span>
                <input value={form.customerRole} onChange={(event) => updateField('customerRole', event.target.value)} />
              </label>
              <label>
                <span>客户类型</span>
                <input value={form.customerType} onChange={(event) => updateField('customerType', event.target.value)} />
              </label>
            </div>

            <div className="field-grid one">
              <label>
                <span>客户背景</span>
                <textarea
                  rows={2}
                  value={form.customerBackground}
                  onChange={(event) => updateField('customerBackground', event.target.value)}
                  placeholder="比如官网定位、目标市场、客户关注点、客户刚提到的问题"
                />
              </label>
            </div>

            <div className="field-grid four">
              <label>
                <span>MOQ</span>
                <input value={form.moq} onChange={(event) => updateField('moq', event.target.value)} />
              </label>
              <label>
                <span>报价条件</span>
                <input value={form.priceTerms} onChange={(event) => updateField('priceTerms', event.target.value)} />
              </label>
              <label>
                <span>付款方式</span>
                <input value={form.paymentTerms} onChange={(event) => updateField('paymentTerms', event.target.value)} />
              </label>
              <label>
                <span>交期</span>
                <input value={form.leadTime} onChange={(event) => updateField('leadTime', event.target.value)} />
              </label>
            </div>

            <div className="field-grid two">
              <label>
                <span>认证 / 资质</span>
                <input value={form.certifications} onChange={(event) => updateField('certifications', event.target.value)} />
              </label>
              <label>
                <span>发件公司</span>
                <input value={form.senderCompany} onChange={(event) => updateField('senderCompany', event.target.value)} />
              </label>
            </div>

            <div className="field-grid one">
              <label>
                <span>特别要求</span>
                <textarea
                  rows={3}
                  value={form.extraRequirements}
                  onChange={(event) => updateField('extraRequirements', event.target.value)}
                  placeholder="例如：避免太推销；更像欧美采购常见表达；突出 halal；加入可寄样信息"
                />
              </label>
            </div>

            <label className="switch-row">
              <input
                checked={form.culturalAdaptation}
                onChange={(event) => updateField('culturalAdaptation', event.target.checked)}
                type="checkbox"
              />
              <span>启用国家文化适配</span>
            </label>
          </div>

          <div className="result-column">
            <div className="panel result-panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">输出层</div>
                  <p>{currentProvider.label} 返回的主题、正文和跟进建议会在这里展示，也可以直接跳转到 Gmail。</p>
                </div>
                <div className="action-row">
                  <button className="secondary-button" disabled={!result} onClick={handleOpenGmail} type="button">
                    跳转 Gmail
                  </button>
                  <button className="secondary-button" disabled={!result} onClick={handleCopy} type="button">
                    {copyState === 'done' ? '已复制' : '复制主题 + 正文'}
                  </button>
                </div>
              </div>

              {error ? <div className="error-box">{error}</div> : null}

              {result ? (
                <div className="mail-card">
                  <div className="mail-meta">
                    <span>提供商：{currentProvider.label}</span>
                    <span>模型：{result.model}</span>
                    <span>场景：{scenes.find((scene) => scene.value === form.scene)?.label}</span>
                    <span>风格：{tones.find((tone) => tone.value === form.tone)?.label}</span>
                  </div>

                  <div className="mail-section">
                    <div className="mail-label">Subject</div>
                    <div className="mail-subject">{result.subject}</div>
                  </div>

                  <div className="mail-section">
                    <div className="mail-label">Body</div>
                    <pre className="mail-body">{result.body}</pre>
                  </div>

                  <div className="hint-grid">
                    <div className="hint-card">
                      <div className="mail-label">Tone Notes</div>
                      <p>{result.toneNotes}</p>
                    </div>
                    <div className="hint-card">
                      <div className="mail-label">Next Step</div>
                      <p>{result.followUpTip}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <h3>先选 AI，再测试连接，再正式生成</h3>
                  <p>当前已接入 4 个官方兼容入口：MiniMaxi、DeepSeek、Kimi、Qwen。切换后会自动带出推荐地址和模型。</p>
                  <ul>
                    <li>MiniMaxi：`https://api.minimaxi.com/v1` / `MiniMax-M2.1`</li>
                    <li>DeepSeek：`https://api.deepseek.com` / `deepseek-chat`</li>
                    <li>Kimi：`https://api.moonshot.cn/v1` / `kimi-k2`</li>
                    <li>Qwen：`https://dashscope.aliyuncs.com/compatible-mode/v1` / `qwen-plus`</li>
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
                <span>OpenAI-Compatible API Layer</span>
                <span>Gmail Compose Jump</span>
                <span>electron-builder 打包</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
