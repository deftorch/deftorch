# Deftorch

Deftorch is a secure, standalone multi-model AI orchestrator designed to provide a unified chat interface for interacting with various LLM providers (Gemini, OpenRouter, Ollama) and advanced agentic workflows.

---

## 🚀 Key Features

*   **Multi-Model Orchestration**: Switch seamlessly between models from different providers in a unified chat experience.
*   **Bring Your Own Key (BYOK)**: Secure, stateless API key injection. Keys are configured client-side and passed safely in request payloads without server-side persistence.
*   **Agentic Workflows**: Support for sequential agent pipelines (e.g., Drafter to Reviewer) and condition-based routing.
*   **Native Tools & Grounding**: Integrated support for Google Search Grounding and server-side Code Execution (rendering outputs safely as Markdown).
*   **API Key Rotation**: Automatically falls back and rotates between a cluster of configured Gemini API keys to guarantee maximum uptime for default endpoints.
*   **Safe Uploads**: Validates file types by matching their binary headers (magic bytes) to prevent malicious code injection.

---

## 🛠️ Tech Stack

*   **Framework**: Next.js (App Router, Standalone Output)
*   **Frontend**: React, Tailwind CSS, Lucide React, Zustand State Management
*   **Model Providers**: Google Gemini (native), OpenRouter (Claude, Llama, etc.), Ollama (local)
*   **HTTP Client**: Undici (customized for TOCTOU prevention)
*   **Development & Testing Tooling**: Bun Runtime, PM2, TypeScript, ESLint

---

## ⚙️ Environment Variables

Create a `.env.local` (for development) or `.env` (for production) file in the root directory:

```env
# Gemini API Configuration
# Multiple keys can be separated by commas for automated key rotation (used if BYOK is not provided)
GEMINI_API_KEYS=your_first_key,your_second_key

# Model Settings
NEXT_PUBLIC_DEFAULT_MODEL=gemini-2.5-flash

# Cleanup Endpoint Security Token
CRON_TOKEN=a-long-securely-generated-secret-token
```

---

## 📦 Getting Started

### Installation
Ensure you have the [Bun runtime](https://bun.sh/) installed:

```bash
bun install
```

### Run in Development
Launch the Next.js development server:

```bash
bun dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production
Generate the optimized standalone build:

```bash
bun run build
```

---

## 🖥️ PM2 Process Management
Deftorch is pre-configured for PM2 deployments. Run the application in production mode using:

```bash
# Start with PM2
pm2 start ecosystem.config.js

# View active logs
pm2 logs deftorch
```

The production logs will be written to `./logs/out.log` and `./logs/err.log`. Ensure the `logs` folder exists before running PM2 in production.

### Reverse Proxy (required for rate limiting to be effective)

Deftorch's per-IP rate limiter (see Security Measures below) trusts the `x-forwarded-for` header from whatever sits in front of it. Never expose the Node process directly — put a reverse proxy in front and make sure it discards any client-supplied forwarding headers before adding its own:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    # Overwrite, don't append — a client-sent X-Forwarded-For must not survive here.
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## 🔒 Security Measures

1.  **Stateless BYOK**: API keys provided by the user are never stored on the server. They are transmitted securely and consumed per-request.
2.  **SSRF / DNS Rebinding Shield**: Image analysis and URL fetching utilize a hardened `safeFetch` implementation (powered by `undici`). It resolves DNS only once and forces the HTTP connection to that specific, validated, non-private IP to prevent TOCTOU vulnerabilities.
3.  **XSS Protection**: Markdown rendering utilizes `rehype-sanitize` to purge unsafe HTML tags and scripts.
4.  **MIME Verification**: Image uploads inspect hex magic numbers (`FFD8FF`, `89504E47`, `47494638`, `52494646`) to avoid extension spoofing.
5.  **Timing Attack Prevention**: Cron endpoints use `crypto.timingSafeEqual` for authorization header verification.
6.  **Per-IP Rate Limiting**: `/api/chat` and other write endpoints are throttled via an in-memory LRU cache keyed by client IP (`lib/rate-limiter.ts`). **This protection is only meaningful behind a trusted reverse proxy.** The limiter trusts the `x-forwarded-for` / `x-real-ip` request headers as-is — if Deftorch is exposed directly to the internet without a proxy in front of it, any client can spoof these headers and bypass the limit entirely. When deploying with PM2 (see below), always put Nginx, Caddy, or Cloudflare in front of the Node process, and make sure it **strips any client-supplied `x-forwarded-for`/`x-real-ip` before setting its own** — do not simply pass the incoming header through untouched. Because the limiter is in-memory, it also only works correctly for a **single Node process/instance**; it does not synchronize across PM2 cluster workers or multiple server replicas.