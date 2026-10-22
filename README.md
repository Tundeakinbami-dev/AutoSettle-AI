# AutoSettle AI ⚡

> **Autonomous PayPal Dispute Resolution & Evidence Orchestration for Online Merchants**  
> *Built for the PayPal AI Hackathon 2026*

AutoSettle AI transforms time-sensitive, stressful PayPal disputes into an evidence-backed, factual response workflow that takes **minutes rather than hours**. 

When a dispute arrives (via webhook or polling), AutoSettle AI retrieves linked order and fulfillment data, organizes supporting evidence, detects critical documentation gaps, drafts a factual rebuttal narrative adhering to strict anti-hallucination guardrails, and enables merchant authorization for direct submission through supported **PayPal Disputes REST API** endpoints.

---

## 🏆 Key Features & Core Differentiators

### 1. 🛡️ Strict Anti-Hallucination Guardrails
- **Zero Evidence Invention**: The AI agent never fabricates tracking numbers, delivery dates, or buyer correspondence. Every factual claim cited in the rebuttal maps to a verifiable provenance record (Carrier API, order invoice, or customer message timestamp).
- **No Guaranteed Win Claims**: Rebuttals strictly avoid forbidden guarantee language, maintaining neutral, professional, policy-compliant statements formatted for PayPal review teams.
- **Delivery Status Fidelity**: Rebuttals never claim delivery has occurred unless official carrier records confirm a `DELIVERED` status.

### 2. ⚡ Real-Time Urgency & Deadline Management
- Visual countdown timers highlighting disputes expiring in `< 24h` and `< 48h` to prevent default loss and forfeiture.
- Prioritized queues in the **AG Grid** merchant operations console.

### 3. 📦 Evidence Locker & Gap Detection
- Identifies missing documentation (e.g. absent pick-pack photos, missing delivery signatures, carrier scan exceptions) before response submission.
- Recommends the optimal dispute strategy:
  - `PROVIDE_EVIDENCE` (strong merchant defense meeting PayPal Seller Protection criteria)
  - `OFFER_PARTIAL_REFUND` (settlement negotiation for SNAD claims with missing pre-pack photos)
  - `ACCEPT_CLAIM` (for cases where cost of dispute outweighs evidence or proof is lacking)

### 4. 🔗 Native PayPal Disputes API Integration
- **OAuth2 Token Authentication**: `POST /v1/oauth2/token`
- **Dispute List & Retrieval**: `GET /v1/customer/disputes`, `GET /v1/customer/disputes/{id}`
- **Provide Evidence**: `POST /v1/customer/disputes/{id}/provide-evidence`
- **Accept Claim**: `POST /v1/customer/disputes/{id}/accept-claim`
- **Make Settlement Offer**: `POST /v1/customer/disputes/{id}/make-offer`
- **Webhook Ingestion**: `POST /api/webhooks/paypal` (`PAYMENT.DISPUTE.CREATED`, `PAYMENT.DISPUTE.UPDATED`, `PAYMENT.DISPUTE.RESOLVED`)
- **Seamless Live Sandbox & Simulation Toggle**: Connect live PayPal Developer Sandbox credentials in Settings or evaluate in high-fidelity simulation mode with zero setup.

### 5. ✍️ Human-in-the-Loop Merchant Authorization Gate
- Requires explicit merchant review and compliance confirmation before dispatching payloads to the PayPal Disputes API.
- Logs all actions to an immutable, timestamped audit trail.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling & Design System** | Tailwind CSS with custom fintech dark palette & glassmorphism |
| **Data Grid** | AG Grid (Quartz Dark theme) for the Merchant Dispute Operations Console |
| **Icons** | Lucide React |
| **Backend & Routing** | Next.js Server-Side API Routes (`src/app/api/...`) |
| **Persistence & Database** | Prisma ORM with SQLite (zero-config local dev & PostgreSQL production-ready) |
| **AI Reasoning Engine** | Structured outputs with Zod schema validation; hybrid engine supporting OpenAI API or deterministic anti-hallucination factual engine |
| **Payments & Disputes** | PayPal REST Disputes API v1 client & webhook pipeline |
| **Testing** | Node.js native test runner via `npm test` (unit & integration tests) |
| **Deployment Target** | Render / Vercel with environment variable configuration |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js `v18+` or `v20+`
- npm `v9+`

### 2. Installation
```bash
git clone https://github.com/Tundeakinbami-dev/AutoSettle-AI.git
cd AutoSettle-AI
npm install
```

### 3. Database Setup & Seeding
AutoSettle AI uses Prisma with SQLite for instant zero-dependency local execution:
```bash
npx prisma db push
npm run seed
```

This populates 5 realistic merchant dispute scenarios:
1. `PP-D-91042`: Item Not Received (INR) with verified UPS signature confirmation (High win potential).
2. `PP-D-83910`: Item Not As Described (SNAD) with missing pick-pack photo gap (AI recommends settlement offer).
3. `PP-D-61023`: Urgent INR expiring in 3 hours (Needs immediate 1-click submission).
4. `PP-D-72149`: Unauthorised Transaction with PayPal Seller Protection criteria met.
5. `PP-D-50218`: Historical Resolved dispute with complete compliance audit trail.

### 4. Running the Application
```bash
npm run dev
# or for production:
npm run build
npm run start
```
Open **http://localhost:3000** in your browser.

### 5. Running the Test Suite
```bash
npm test
```
Executes unit and integration tests verifying anti-hallucination guardrails, AI evidence scoring, Zod schema validity, and PayPal API client response handling.

---

## 📋 Environment Variables (`.env`)

```env
DATABASE_URL="file:./dev.db"

# Optional PayPal Developer Sandbox Credentials (leave blank for simulation mode)
PAYPAL_CLIENT_ID=""
PAYPAL_CLIENT_SECRET=""
PAYPAL_ENVIRONMENT="sandbox"

# Optional OpenAI API Key (AutoSettle includes intelligent offline agent if omitted)
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o"
```

> **Note:** When `APP_MODE` is set to `DEMO`, the UI displays a **"Demo Data"** badge in the navigation header (next to the PayPal API mode indicator) to clearly label that all displayed disputes and evidence are synthetic and no real PayPal API calls are made.


---

## 🚢 Production Deployment (Render)

1. Connect this repository to **Render** as a **Web Service**.
2. **Build Command**: `npm install && npx prisma db push && npm run seed && npm run build`
3. **Start Command**: `npm run start`
4. **Environment Variables**: Add `DATABASE_URL` (can use Render PostgreSQL or default SQLite disk) along with optional `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.

---

## ⚖️ Hackathon Compliance Disclaimer
*AutoSettle AI assists merchants in organizing factual records and submitting verified evidence to PayPal. AutoSettle AI does not guarantee dispute outcomes, does not manufacture evidence, and requires merchant authorization for dispute API submissions in accordance with PayPal Acceptable Use and Disputes policies.*
