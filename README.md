# Vic Mail

Vic Mail is a Windows desktop app for drafting foreign-trade emails with multiple AI providers.

## Current scope

- Electron desktop shell
- React + TypeScript UI
- Multi-provider AI connection through Electron IPC
- Multi-scene email drafting workflow
- Tone switching for trade emails
- Gmail compose jump
- Windows installer packaging with `electron-builder`

## AI providers included

- MiniMaxi China: `https://api.minimaxi.com/v1` + `MiniMax-M2.1`
- DeepSeek: `https://api.deepseek.com` + `deepseek-chat`
- Kimi / Moonshot: `https://api.moonshot.cn/v1` + `kimi-k2`
- Qwen / DashScope: `https://dashscope.aliyuncs.com/compatible-mode/v1` + `qwen-plus`

## Scenes included

- First contact
- Follow-up
- Reply to customer
- Inquiry / quotation
- Negotiation
- Close deal
- After-sales
- Reactivation

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run build:desktop
```

Installer output:

- `release/Vic Mail Setup 0.1.0.exe`

## Usage

1. Choose an AI provider.
2. Confirm or adjust the preset base URL and model.
3. Enter the provider-specific API key.
4. Test connection.
5. Generate the email.
6. Copy it or open Gmail directly.
