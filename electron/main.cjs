const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const OpenAI = require('openai');

const isDev = !app.isPackaged;
const defaultBaseUrl = 'https://api.minimaxi.com/v1';
const defaultModel = 'MiniMax-M2.1';

function createWindow() {
  const win = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#151924',
    title: 'Vic Mail',
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

  const cultureLine = payload.culturalAdaptation
    ? `Adapt the tone to business expectations commonly seen in ${payload.country}.`
    : 'Keep the tone globally professional without over-localizing cultural assumptions.';

  const companyBlock = payload.senderCompany
    ? `Sender company: ${payload.senderCompany}`
    : 'Sender company: not provided';

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
- Match the requested language exactly.

Scene goal:
${sceneInstructions[payload.scene] || sceneInstructions.first_contact}

Tone:
${toneGuidance[payload.tone] || toneGuidance.professional}

Localization:
${cultureLine}

Business context:
- Target country: ${payload.country}
- Output language: ${payload.language}
- Industry: ${payload.industry || 'not specified'}
- Product: ${payload.product}
- Product USP: ${payload.usp || 'not specified'}
- Customer company: ${payload.customerCompany || 'not specified'}
- Customer contact: ${payload.customerName || 'not specified'}
- Customer role: ${payload.customerRole || 'not specified'}
- Customer type: ${payload.customerType || 'not specified'}
- Customer background: ${payload.customerBackground || 'not specified'}
- MOQ: ${payload.moq || 'not specified'}
- Price terms: ${payload.priceTerms || 'not specified'}
- Payment terms: ${payload.paymentTerms || 'not specified'}
- Lead time: ${payload.leadTime || 'not specified'}
- Certifications: ${payload.certifications || 'not specified'}
- Extra requirements: ${payload.extraRequirements || 'not specified'}
- Desired length: ${payload.length}
- ${companyBlock}

Write the best possible email for this exact context. Also provide:
- subject: a single email subject line
- followUpTip: one short suggestion on what to send next
- toneNotes: one short explanation of how the tone was adapted
  `.trim();
}

function extractJson(content) {
  if (!content) {
    throw new Error('MiniMax returned an empty response.');
  }

  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('MiniMax response was not valid JSON.');
    }
    return JSON.parse(match[0]);
  }
}

async function callMiniMax(payload, messages, temperature) {
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

ipcMain.handle('vic-mail:generate', async (_event, payload) => {
  const apiKey = payload.apiKey?.trim();
  if (!apiKey) {
    throw new Error('Please enter a MiniMax API key before generating.');
  }

  const completion = await callMiniMax(
    payload,
    [
      { role: 'system', content: buildPrompt(payload) },
      { role: 'user', content: 'Generate the final email JSON now.' },
    ],
    0.7,
  );

  const content = completion.choices?.[0]?.message?.content;
  const parsed = extractJson(Array.isArray(content) ? content.map((item) => item.text || '').join('') : content);

  return {
    subject: parsed.subject || '',
    body: parsed.body || '',
    followUpTip: parsed.followUpTip || '',
    toneNotes: parsed.toneNotes || '',
    model: payload.model?.trim() || defaultModel,
  };
});

ipcMain.handle('vic-mail:test-connection', async (_event, payload) => {
  const apiKey = payload.apiKey?.trim();
  if (!apiKey) {
    throw new Error('Please enter a MiniMax API key before testing.');
  }

  await callMiniMax(
    payload,
    [
      { role: 'system', content: 'Reply with plain text: OK' },
      { role: 'user', content: 'Connection test.' },
    ],
    0.1,
  );

  return {
    ok: true,
    model: payload.model?.trim() || defaultModel,
    baseUrl: payload.baseUrl?.trim() || defaultBaseUrl,
  };
});

ipcMain.handle('vic-mail:get-defaults', async () => ({
  defaultBaseUrl,
  defaultModel,
}));

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
