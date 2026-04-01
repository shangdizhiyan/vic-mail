const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const OpenAI = require('openai');

const isDev = !app.isPackaged;
const defaultBaseUrl = 'https://api.minimaxi.com/v1';
const defaultModel = 'MiniMax-M2.1';

function getProviderSettingsPath() {
  return path.join(app.getPath('userData'), 'provider-settings.json');
}

function readProviderSettings() {
  try {
    const settingsPath = getProviderSettingsPath();
    if (!fs.existsSync(settingsPath)) {
      return {};
    }

    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const apiKey = parsed.apiKey && safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(parsed.apiKey, 'base64'))
      : parsed.apiKey || '';

    return {
      provider: parsed.provider || 'minimaxi',
      apiKey,
      baseUrl: parsed.baseUrl || defaultBaseUrl,
      model: parsed.model || defaultModel,
      senderCompany: parsed.senderCompany || '',
    };
  } catch {
    return {};
  }
}

function writeProviderSettings(payload) {
  const settingsPath = getProviderSettingsPath();
  const apiKey = payload.apiKey?.trim() || '';
  const storedApiKey = apiKey && safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(apiKey).toString('base64')
    : apiKey;

  const data = {
    provider: payload.provider || 'minimaxi',
    apiKey: storedApiKey,
    baseUrl: payload.baseUrl?.trim() || defaultBaseUrl,
    model: payload.model?.trim() || defaultModel,
    senderCompany: payload.senderCompany?.trim() || '',
  };

  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
}

function sanitizeFilePart(value) {
  return (value || 'email')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'email';
}

function buildExportFileName(payload, extension) {
  const customer = sanitizeFilePart(payload.customerCompany || payload.customerName || 'customer');
  const scene = sanitizeFilePart(payload.scene || 'mail');
  return 'Vic Mail - ' + scene + ' - ' + customer + '.' + extension;
}

function getExportBaseDirectory() {
  const candidates = [
    app.getPath('documents'),
    app.getPath('desktop'),
    app.getPath('downloads'),
    app.getPath('home'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {}
  }

  return process.cwd();
}

function ensureParentDirectory(filePath) {
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
}

async function saveTextMail(mainWindow, payload) {
  const fileName = buildExportFileName(payload, 'txt');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出 TXT',
    defaultPath: path.join(getExportBaseDirectory(), fileName),
    filters: [{ name: 'Text File', extensions: ['txt'] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false };
  }

  const content = 'Subject: ' + (payload.subject || '') + '\n\n' + (payload.body || '');
  ensureParentDirectory(result.filePath);
  fs.writeFileSync(result.filePath, content, 'utf8');
  return { ok: true, filePath: result.filePath };
}

async function saveDocxMail(mainWindow, payload) {
  const fileName = buildExportFileName(payload, 'docx');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出 Word',
    defaultPath: path.join(getExportBaseDirectory(), fileName),
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false };
  }

  const bodyLines = (payload.body || '').split(/\r?\n/);
  const children = [
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: 'Subject: ' + (payload.subject || ''), bold: true, size: 28 })],
    }),
    ...bodyLines.map((line) => new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: line || ' ' })],
    })),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  ensureParentDirectory(result.filePath);
  fs.writeFileSync(result.filePath, buffer);
  return { ok: true, filePath: result.filePath };
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#151924',
    title: 'Vic Mail',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function buildPrompt(payload) {
  const sceneInstructions = {
    first_contact: 'Write a first-touch cold outreach email that opens naturally, proves relevance fast, introduces product value, and ends with a clear but low-pressure CTA.',
    follow_up: 'Write a follow-up email for a prospect who has not replied yet. Reference the earlier outreach briefly, add one fresh reason to respond, and keep the tone polite.',
    reply_customer: 'Write a reply email responding to an interested buyer. Acknowledge their message, answer likely concerns, and move the conversation to the next business step.',
    inquiry_quote: 'Write a structured quotation email. Confirm the buyer request, present the offer clearly, state commercial terms cleanly, and invite the buyer to confirm details.',
    negotiation: 'Write a negotiation email that protects margin while sounding collaborative. Explain the business logic behind the offer and suggest acceptable trade-offs.',
    close_deal: 'Write a conversion-focused email that pushes the deal toward confirmation, deposit, PI approval, or sample-to-order transition.',
    after_sales: 'Write a post-order or after-sales email that builds trust, updates status, invites feedback, and gently opens the door for repeat business.',
    reactivation: 'Write a reactivation email for an old customer. Reconnect warmly, mention a relevant update, and suggest a simple next step.',
  };

  const toneGuidance = {
    professional: 'Use professional and rigorous business language. Be credible, concise, and confident.',
    friendly: 'Use warm and approachable business language. Sound helpful and easy to work with.',
    concise: 'Keep the writing efficient and direct. Short paragraphs, fast to scan, no unnecessary filler.',
    humorous: 'Use light, safe humor very sparingly while remaining business-appropriate and respectful.',
  };

  const strategyGuidance = {
    value_intro: 'Lead with buyer-relevant value and commercial relevance rather than introducing your company for too long.',
    sample_offer: 'Use sample, spec confirmation, or trial-order friendliness as the opening hook.',
    relationship_soft: 'Keep the approach softer and more relationship-oriented, with lower pressure language.',
    fresh_angle: 'Do not repeat the previous message. Add one fresh reason or angle to justify the follow-up.',
    short_push: 'Keep the message notably shorter and easier to scan, focusing on one action only.',
    soft_checkin: 'Use a polite, low-pressure check-in tone that makes it easy to reply.',
    answer_and_push: 'Answer the buyer clearly first, then smoothly move them toward the next concrete step.',
    trust_build: 'Strengthen trust using quality, documents, experience, reliability, or service capability.',
    fast_close: 'Reduce friction and move the buyer efficiently toward sample, quote, or confirmation.',
    structured_quote: 'Present quote terms in a very structured and commercially clear format.',
    option_quote: 'Offer two or more practical options so the buyer can choose quickly.',
    clarify_first: 'Ask the minimum important clarification questions before giving a full offer.',
    protect_margin: 'Defend price logic and avoid easy concessions while still sounding cooperative.',
    trade_off: 'Use conditional trade-offs, not unilateral concessions.',
    relationship_keep: 'Keep negotiation balanced and relationship-friendly, avoiding overly hard wording.',
    pi_push: 'Make the next step toward PI or order confirmation feel immediate and operationally easy.',
    urgency_light: 'Use gentle urgency based on production, timing, or price window without sounding pushy.',
    easy_confirmation: 'Reduce decision friction so the buyer can confirm with a simple reply.',
    feedback_first: 'Lead with feedback and service quality before mentioning the next order.',
    reorder_soft: 'Introduce reorder or related items naturally after service confirmation.',
    care_and_service: 'Emphasize care, coordination, and responsiveness more than selling.',
    new_update: 'Use a relevant new update as the reason to restart the conversation.',
    simple_question: 'Ask one very simple, low-friction question to improve reply probability.',
    relationship_reconnect: 'Reconnect naturally and politely before discussing business in detail.',
  };


  const industryGuidance = {
    general: 'Keep the message commercially balanced and broadly applicable to general export buyers.',
    food: 'Emphasize compliance, certifications, packaging, cold chain or quality consistency, and export document readiness.',
    machinery: 'Emphasize technical reliability, specifications, durability, spare-parts support, and after-sales responsiveness.',
    packaging: 'Emphasize customization, printing, MOQ flexibility, lead time, and packaging/export execution experience.',
    building: 'Emphasize specifications, durability, project support, loading efficiency, and shipment coordination.',
    pet: 'Emphasize safety, packaging appeal, private label flexibility, consistency, and product-market fit.',
  };


  const sourceGuidance = {
    customs_data: 'Open in a researched, buyer-relevant way that reflects awareness of the prospect\'s existing import activity or sourcing relevance.',
    trade_show: 'Open with trade-show continuity and use a warmer follow-up tone tied to the fair interaction.',
    website: 'Open by referencing something specific from the company website, product line, or market focus.',
    linkedin: 'Keep the opening lighter and more personal, avoiding an overly sales-heavy first paragraph.',
    old_customer: 'Reconnect based on historical contact or prior cooperation before moving into a new offer.',
    referral: 'Clearly mention the referral source to build trust quickly.',
    manual_search: 'Use a classic cold outreach structure with strong relevance and low-pressure CTA.',
  };

  const cultureLine = payload.culturalAdaptation
    ? `Adapt the tone to business expectations commonly seen in ${payload.country}.`
    : 'Keep the tone globally professional without over-localizing cultural assumptions.';

  const companyBlock = payload.senderCompany
    ? `Sender company: ${payload.senderCompany}`
    : 'Sender company: not provided';

  const languageInstruction = payload.languageMode === 'bilingual'
    ? `Generate a bilingual email. Use ${payload.language} first, then ${payload.secondaryLanguage || 'Chinese'} as the second version. Keep both versions faithful in meaning. In body, clearly separate the two language sections with plain text headings.`
    : `Generate the email in ${payload.language} only.`;

  return `
You are an expert international trade email strategist for a desktop product called Vic Mail.
Your task is to generate a practical foreign-trade email the user can send with minimal edits.

Hard rules:
- Output valid JSON only.
- JSON keys must be: subject, body, followUpTip, toneNotes.
- body must contain plain text email content with line breaks.
- Do not use markdown fences.
- Keep the email realistic and commercially useful.
- Avoid fake certifications, fake statistics, or invented factory claims.
- Follow the language instruction exactly.
- If bilingual mode is requested, keep the two versions aligned in meaning and business intent.

Scene goal:
${sceneInstructions[payload.scene] || sceneInstructions.first_contact}

Tone:
${toneGuidance[payload.tone] || toneGuidance.professional}

Scene strategy:
${strategyGuidance[payload.sceneStrategy] || 'Use the selected scene strategy to shape the opening, angle, and CTA.'}

Industry guidance:
${industryGuidance[payload.industryPack] || industryGuidance.general}

Source guidance:
${sourceGuidance[payload.customerSource] || sourceGuidance.manual_search}

Language instruction:
${languageInstruction}

Localization:
${cultureLine}

Business context:
- Target country: ${payload.country}
- Language mode: ${payload.languageMode}
- Primary output language: ${payload.language}
- Secondary language: ${payload.secondaryLanguage || 'not requested'}
- Industry: ${payload.industry || 'not specified'}
- Industry pack: ${payload.industryPack || 'general'}
- Product: ${payload.product}
- Product USP: ${payload.usp || 'not specified'}
- Scene strategy: ${payload.sceneStrategy || 'not specified'}
- Customer company: ${payload.customerCompany || 'not specified'}
- Customer contact: ${payload.customerName || 'not specified'}
- Customer source: ${payload.customerSource || 'manual_search'}
- Customer role: ${payload.customerRole || 'not specified'}
- Customer type: ${payload.customerType || 'not specified'}
- Customer background: ${payload.customerBackground || 'not specified'}
- Customer stage: ${payload.customerStage || 'not specified'}
- Response status: ${payload.responseStatus || 'not specified'}
- Follow-up count: ${payload.followUpCount ?? 0}
- MOQ: ${payload.moq || 'not specified'}
- Price terms: ${payload.priceTerms || 'not specified'}
- Payment terms: ${payload.paymentTerms || 'not specified'}
- Lead time: ${payload.leadTime || 'not specified'}
- Certifications: ${payload.certifications || 'not specified'}
- Extra requirements: ${payload.extraRequirements || 'not specified'}
- Desired length: ${payload.length}
- ${companyBlock}

Write the best possible email for this exact context. Also provide:
- subject: a single email subject line in the primary language
- followUpTip: one short suggestion on what to send next
- toneNotes: one short explanation of how the tone was adapted
  `.trim();
}

function looksBilingual(text) {
  if (!text) return false;
  return /(bilingual|中文版|中文版本|Chinese version|Arabic version|English version|Below is the Chinese version|primary communication|for internal reference|阿拉伯语版|英文版)/i.test(text);
}

function buildSingleLanguageRepairPrompt(payload, draft) {
  return `
You are fixing a foreign-trade email for Vic Mail.

Task:
- Rewrite the provided draft into ${payload.language} only.
- Remove any bilingual structure, translation notes, second-language sections, or internal-reference notes.
- Keep the business meaning, commercial terms, CTA, and tone aligned with the original draft.
- The final result must be a single-language email only.

Output rules:
- Return valid JSON only.
- JSON keys must be: subject, body, followUpTip, toneNotes.
- subject and body must be in ${payload.language} only.
- Do not mention bilingual output.
- Do not add Chinese, English, or any second-language section.

Draft subject:
${draft.subject || ''}

Draft body:
${draft.body || ''}

Draft follow-up tip:
${draft.followUpTip || ''}

Draft tone notes:
${draft.toneNotes || ''}
  `.trim();
}

function buildGrammarCheckPrompt(payload) {
  return `
You are a multilingual business email grammar reviewer for Vic Mail.

Task:
- Review the email subject and body in ${payload.language}.
- Focus on grammar, spelling, punctuation, agreement, article use, tense consistency, and unnatural wording.
- Evaluate whether the writing is already grammatically correct enough to send.
- Be strict but practical for real business email usage.

Output rules:
- Return valid JSON only.
- JSON keys must be: verdict, summary, issues.
- verdict must be either "correct" or "needs_fix".
- summary must be one concise sentence in Chinese.
- issues must be an array of short Chinese bullet-style strings.
- If the email is already acceptable, issues can be an empty array.

Email subject:
${payload.subject || ''}

Email body:
${payload.body || ''}
  `.trim();
}

function buildGrammarFixPrompt(payload) {
  return `
You are a multilingual business email proofreader for Vic Mail.

Task:
- Rewrite the email subject and body in ${payload.language}.
- Fix grammar, spelling, punctuation, and unnatural wording.
- Preserve the original business meaning, structure, and tone as much as possible.
- Do not change commercial facts unless required for grammar correction.
- Keep the corrected email ready to send.

Output rules:
- Return valid JSON only.
- JSON keys must be: subject, body, summary.
- summary must be one concise sentence in Chinese explaining what was corrected.
- body must be plain text with line breaks.

Original subject:
${payload.subject || ''}

Original body:
${payload.body || ''}
  `.trim();
}

function extractJson(content) {
  if (!content) {
    throw new Error('Model returned an empty response.');
  }

  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Model response was not valid JSON.');
    }
    return JSON.parse(match[0]);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryModelError(message) {
  return /(429|500|502|503|504|529)/.test(message);
}

async function withModelRetry(task, options = {}) {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 1400;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === retries || !shouldRetryModelError(message)) {
        throw error;
      }
      await delay(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

async function callOpenAICompatible(payload, messages, temperature) {
  const client = new OpenAI({
    apiKey: payload.apiKey.trim(),
    baseURL: payload.baseUrl?.trim() || defaultBaseUrl,
  });

  return client.chat.completions.create({
    model: payload.model?.trim() || defaultModel,
    temperature,
    messages,
  });
}

async function callClaude(payload, messages, temperature) {
  const systemMessage = messages.find((item) => item.role === 'system')?.content || '';
  const conversation = messages
    .filter((item) => item.role !== 'system')
    .map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content }));

  const response = await fetch(`${(payload.baseUrl?.trim() || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': payload.apiKey.trim(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: payload.model?.trim() || 'claude-sonnet-4-20250514',
      max_tokens: 2400,
      temperature,
      system: systemMessage,
      messages: conversation,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function runModel(payload, messages, temperature) {
  if (payload.provider === 'claude') {
    const response = await callClaude(payload, messages, temperature);
    const content = Array.isArray(response.content)
      ? response.content.map((item) => item.text || '').join('')
      : '';
    return {
      content,
      model: response.model || payload.model,
    };
  }

  const completion = await callOpenAICompatible(payload, messages, temperature);
  const content = completion.choices?.[0]?.message?.content;
  return {
    content: Array.isArray(content) ? content.map((item) => item.text || '').join('') : content,
    model: payload.model?.trim() || defaultModel,
  };
}

ipcMain.handle('vic-mail:generate', async (_event, payload) => {
  const apiKey = payload.apiKey?.trim();
  if (!apiKey) {
    throw new Error('Please enter an API key before generating.');
  }

  const response = await withModelRetry(() => runModel(
    payload,
    [
      { role: 'system', content: buildPrompt(payload) },
      { role: 'user', content: 'Generate the final email JSON now.' },
    ],
    0.7,
  ));

  const parsed = extractJson(response.content);

  return {
    subject: parsed.subject || '',
    body: parsed.body || '',
    followUpTip: parsed.followUpTip || '',
    toneNotes: parsed.toneNotes || '',
    model: response.model || payload.model?.trim() || defaultModel,
  };
});

ipcMain.handle('vic-mail:check-grammar', async (_event, payload) => {
  const apiKey = payload.apiKey?.trim();
  if (!apiKey) {
    throw new Error('Please enter an API key before checking grammar.');
  }

  const response = await withModelRetry(() => runModel(
    payload,
    [
      { role: 'system', content: buildGrammarCheckPrompt(payload) },
      { role: 'user', content: 'Review the email now and return the JSON result.' },
    ],
    0.2,
  ));

  const parsed = extractJson(response.content);

  return {
    verdict: parsed.verdict === 'correct' ? 'correct' : 'needs_fix',
    summary: parsed.summary || '已完成语法检查。',
    issues: Array.isArray(parsed.issues) ? parsed.issues.filter(Boolean) : [],
  };
});

ipcMain.handle('vic-mail:fix-grammar', async (_event, payload) => {
  const apiKey = payload.apiKey?.trim();
  if (!apiKey) {
    throw new Error('Please enter an API key before fixing grammar.');
  }

  const response = await withModelRetry(() => runModel(
    payload,
    [
      { role: 'system', content: buildGrammarFixPrompt(payload) },
      { role: 'user', content: 'Rewrite the email now and return the corrected JSON result.' },
    ],
    0.2,
  ));

  const parsed = extractJson(response.content);

  return {
    subject: parsed.subject || payload.subject || '',
    body: parsed.body || payload.body || '',
    summary: parsed.summary || '已完成语法修正。',
  };
});

ipcMain.handle('vic-mail:test-connection', async (_event, payload) => {
  const apiKey = payload.apiKey?.trim();
  if (!apiKey) {
    throw new Error('Please enter an API key before testing.');
  }

  const response = await withModelRetry(() => runModel(
    payload,
    [
      { role: 'system', content: 'Reply with plain text: OK' },
      { role: 'user', content: 'Connection test.' },
    ],
    0.1,
  ), { retries: 1, baseDelayMs: 1000 });

  return {
    ok: true,
    model: response.model || payload.model?.trim() || defaultModel,
    baseUrl: payload.baseUrl?.trim() || defaultBaseUrl,
  };
});

ipcMain.handle('vic-mail:get-defaults', async () => ({
  defaultBaseUrl,
  defaultModel,
}));

ipcMain.handle('vic-mail:get-saved-provider-settings', async () => readProviderSettings());

ipcMain.handle('vic-mail:save-provider-settings', async (_event, payload) => {
  writeProviderSettings(payload);
  return { ok: true };
});

ipcMain.handle('vic-mail:export-txt', async (_event, payload) => {
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!mainWindow) {
    throw new Error('No active window available for TXT export.');
  }
  return saveTextMail(mainWindow, payload);
});

ipcMain.handle('vic-mail:export-docx', async (_event, payload) => {
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!mainWindow) {
    throw new Error('No active window available for Word export.');
  }
  return saveDocxMail(mainWindow, payload);
});

ipcMain.handle('vic-mail:open-gmail-compose', async (_event, payload) => {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    su: payload.subject || '',
    body: payload.body || '',
  });

  const url = `https://mail.google.com/mail/?${params.toString()}`;
  await shell.openExternal(url);
  return { ok: true };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
















