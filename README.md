# Vic Mail

Vic Mail is a Windows desktop app for drafting foreign-trade emails with multiple AI providers.

It helps export sales teams generate emails for common trade scenarios such as first contact, follow-up, quotation, negotiation, order closing, reactivation, and after-sales communication.

## Features

- Windows desktop app built with Electron + React + TypeScript
- Multi-provider AI selection
- Trade-focused email generation workflow
- Multiple business scenes for export sales communication
- Tone selection for different customer styles
- One-click Gmail compose jump
- Connection testing before generation

## AI Providers

Vic Mail currently includes preset support for these OpenAI-compatible providers:

- MiniMaxi China: `https://api.minimaxi.com/v1` + `MiniMax-M2.1`
- DeepSeek: `https://api.deepseek.com` + `deepseek-chat`
- Kimi / Moonshot: `https://api.moonshot.cn/v1` + `kimi-k2`
- Qwen / DashScope: `https://dashscope.aliyuncs.com/compatible-mode/v1` + `qwen-plus`

You can still manually edit the base URL and model if needed.

## Email Scenes

- First contact
- Follow-up
- Reply to customer
- Inquiry / quotation
- Negotiation
- Close deal
- After-sales
- Reactivation

## Core Workflow

1. Choose an AI provider
2. Enter the provider-specific API key
3. Test the connection
4. Fill in country, product, customer, and trade context
5. Generate the email
6. Copy the result or open Gmail directly

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- OpenAI-compatible API layer
- electron-builder

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run build:desktop
```

Installer output:

- `release/Vic Mail Setup 0.1.0.exe`

## Repository Notes

- `node_modules`, `dist`, `release`, and `.env` files are ignored
- Do not commit real API keys to this repository
- This repository is intended to host the source code only

## License

[MIT](./LICENSE)
