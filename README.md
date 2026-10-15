# ജീവിതപങ്കാളി ജ്യോതിഷം – Malayalam relationship astrology chatbot

A Malayalam chatbot website for marriage and relationship astrology: who your future spouse will be, their
character, job, place, appearance, love vs arranged marriage, marriage timing, ചൊവ്വാദോഷം and
നക്ഷത്രപ്പൊരുത്തം. Some questions are free. The rest are unlocked through a UPI payment to `BHARATPE2R0F0X6K4D61686@unitype` (BharatPe).

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

**Payment flow (BharatPe UPI `BHARATPE2R0F0X6K4D61686@unitype`).**
1. The user picks a plan (default ₹49 for one question, ₹199 for everything; editable in the admin panel).
2. The server creates an order with a **unique amount** such as ₹49.37, valid for 30 minutes. The payment dialog shows
   a UPI QR code, a `upi://pay` button on mobile, and a live "waiting for payment" status.
3. A payment report reaches `/api/webhook`, and the order with that exact amount unlocks automatically. Reports can
   come from any of these sources:
   - **App notification**: BharatPe / PhonePe Business / Paytm alerts, forwarded by MacroDroid, Tasker or Notification Forwarder (`source=notification`).
   - **SMS**: bank or BharatPe SMS from an Android SMS forwarder or an iPhone Shortcuts automation (`source=sms`).
   - **E-mail**: payment alert e-mails, through the Gmail Apps Script shown in the admin panel, or Mailgun / CloudMailin / Zapier / Make (`source=email`).
   - **Structured API**: `{"amount": 49.37, "utr": "…"}` from any system (`source=api`).
   - **Razorpay**: `payment.captured` webhooks, signature-verified with `RAZORPAY_WEBHOOK_SECRET` (`source=razorpay`).

   Reports without a UTR, such as most BharatPe push notifications, are matched by amount alone and de-duplicated by
   their text.
4. If the user changed the amount, they can type their UTR instead. It's matched against recorded payments, and each
   UTR can be used once.
5. In the **admin panel** (`/admin.html`, log in with `ADMIN_KEY`) you can:
   - see revenue, orders and received payments;
   - mark an order paid, which unlocks the customer's screen right away;
   - add a payment by hand, or generate an unlock code;
   - test-parse a real SMS or notification;
   - copy the webhook URLs and follow the setup guides;
   - change the UPI ID, payee name, prices, validity periods and support WhatsApp number without redeploying.

Orders, payments and settings are stored in a private **Vercel Blob** store (`BLOB_READ_WRITE_TOKEN`). Locally, an
in-memory store is used instead.

## Environment variables

| Name | Purpose |
| --- | --- |
| `PAYMENT_SECRET` | **Required.** Long random string used to sign orders and tokens. |
| `ADMIN_KEY` | Password for `/admin.html`. |
| `UPI_ID` | Default UPI ID (the admin panel setting overrides it). |
| `WEBHOOK_SECRET` | Key every webhook source except Razorpay must send (`?key=` or `x-webhook-secret` header). |
| `RAZORPAY_WEBHOOK_SECRET` | Optional. Enables the signed Razorpay webhook. |
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
