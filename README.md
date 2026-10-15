# ജീവിതപങ്കാളി ജ്യോതിഷം – Malayalam relationship astrology chatbot

A Malayalam chatbot website for marriage and relationship astrology: who your future spouse will be, their
character, job, place, appearance, love vs arranged marriage, marriage timing, ചൊവ്വാദോഷം and
നക്ഷത്രപ്പൊരുത്തം. Some questions are free. The rest are unlocked through a UPI payment to `ajithta855@okhdfcbank`.

## How it works

| Part | File |
| --- | --- |
| Chat UI (Malayalam) | `public/index.html`, `public/app.js`, `public/style.css` |
| Owner page that generates unlock codes | `public/admin.html` |
| Sidereal (Lahiri) chart, Vimshottari dasha | `lib/astro.js` |
| Malayalam readings and the 10 Kerala poruthams | `lib/reading.js`, `lib/texts.js` |
| Ask Soma (AstroSoma) client | `lib/soma.js` |
| Signed UPI orders and access tokens | `lib/pay.js` |
| Serverless API (Vercel) | `api/*.js` |

**Ask Soma.** When `ASKSOMA_MCP_URL` is set, every reading also asks Ask Soma (the `ask_soma` and
`check_compatibility` tools, with `language: "Malayalam"`) and shows its answer first. If Ask Soma isn't
configured or fails, the built-in engine answers on its own, so the site keeps working.

**Topics.**
- Free: spouse's nature, general marriage outlook.
- Paid: love or arranged marriage, spouse's job, spouse's place, marriage timing, appearance, ചൊവ്വാദോഷം,
  porutham, and the user's own question.

**Payment flow (UPI `ajithta855@okhdfcbank` + webhook).**
1. The user picks a plan: ₹49 for one question (24 h) or ₹199 for everything (30 days).
2. The server creates an order with a **unique amount**, e.g. ₹49.37. Open orders never share an amount, and the
   order expires after 30 minutes. The payment dialog shows a UPI QR code, a `upi://pay` button on mobile, and a live
   "waiting for payment" status that polls `/api/verify`.
3. When the money lands, HDFC Bank sends you a credit SMS such as `INR 49.37 credited … UPI Ref No 412345678901`.
   An SMS-forwarding app on your phone POSTs that SMS to the webhook:
   `POST https://<site>/api/webhook?key=WEBHOOK_SECRET`
4. The webhook reads the amount and the 12-digit UPI reference, finds the open order with that exact amount, and
   marks it paid. The user's screen unlocks within a few seconds.
5. If the user changed the amount, they can type their UTR instead. It's matched against credits the webhook has
   already recorded (each UTR can be used once, and the amount must cover the plan).
6. As a last resort, `/admin.html` with `ADMIN_KEY` generates a one-off unlock code for an order.

Orders, credits and used UTRs are stored in a private **Vercel Blob** store (`BLOB_READ_WRITE_TOKEN`). Locally, an
in-memory store is used instead.

### Setting up the SMS webhook (one time, on the phone that receives HDFC SMS)
1. Install an SMS-to-URL forwarder on Android, for example **"SMS Forwarder"** (open source; F-Droid/GitHub
   `bogkonstantin/android_income_sms_gateway_webhook`) or **MacroDroid** or **Tasker**.
2. Add a rule: sender contains `HDFC` → forward to URL
   `https://jeevithapankali-jyothisham.vercel.app/api/webhook?key=<WEBHOOK_SECRET>`, method POST.
   The body can be JSON (`{"from":"%from%","text":"%text%"}`), form data, or plain text. Any of these work.
3. Test it by paying ₹1 to yourself, or with
   `curl -X POST '<url>?key=<secret>' -d '{"text":"INR 1.00 credited ... UPI Ref No 123456789012"}'`.
   The response tells you whether it matched an order.
4. Keep the phone on mobile data or Wi-Fi, and stop battery optimisation from killing the forwarder app.

## Environment variables

| Name | Purpose |
| --- | --- |
| `PAYMENT_SECRET` | **Required.** Long random string used to sign orders and tokens. |
| `ADMIN_KEY` | Password for `/admin.html`. |
| `UPI_ID` | Defaults to `ajithta855@okhdfcbank`. |
| `WEBHOOK_SECRET` | Key the SMS forwarder must send (`?key=` or `x-webhook-secret` header). |
| `BLOB_READ_WRITE_TOKEN` | Set automatically by the connected Vercel Blob store. |
| `SMS_SENDER_FILTER` | Optional regex for the SMS sender, e.g. `HDFC`. |
| `UPI_PAYEE_NAME` | Name shown in UPI apps. |
| `PRICE_SINGLE` / `PRICE_FULL` | Defaults `49` / `199` (₹). |
| `AUTO_UNLOCK` | `true` to unlock on any UTR without a matching credit (not recommended). |
| `ASKSOMA_MCP_URL` | Ask Soma MCP endpoint (streamable HTTP). |
| `ASKSOMA_API_KEY` | Bearer token for Ask Soma, if the endpoint requires one. |

## Local development

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # API smoke test: free/paid topics, UPI order, UTR, tokens, admin codes
```

## Deploy

Import the repository in Vercel; no build step is needed (`vercel.json` serves `public/` and `api/`). Set the
environment variables above and redeploy.
