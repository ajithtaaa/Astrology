# ജീവിതപങ്കാളി ജ്യോതിഷം

A Malayalam chatbot website for marriage and relationship astrology: who your future spouse will be, their
character, job, place, appearance, love vs arranged marriage, marriage timing, ചൊവ്വാദോഷം and
നക്ഷത്രപ്പൊരുത്തം. Some questions are free. The rest are unlocked through a UPI payment to `BHARATPE2R0F0X6K4D61686@unitype` (BharatPe).

## How it works

| Part | File |
| --- | --- |
| Chat UI (Malayalam) | `public/index.html`, `public/app.js`, `public/style.css` |
| Admin panel: approve payments, users, prices, QR | `public/admin.html` |
| Sidereal (Lahiri) chart, Vimshottari dasha | `lib/astro.js` |
| Malayalam readings and the 10 Kerala poruthams | `lib/reading.js`, `lib/texts.js` |
| Ask Soma (AstroSoma) client | `lib/soma.js` |
| Sessions, payment requests, settings | `lib/pay.js`, `lib/accounts.js`, `lib/settings.js` |
| Serverless API (Vercel) | `api/*.js` |

**Ask Soma.** When `ASKSOMA_MCP_URL` is set, every reading also asks Ask Soma (the `ask_soma` and
`check_compatibility` tools, with `language: "Malayalam"`) and shows its answer first. If Ask Soma isn't
configured or fails, the built-in engine answers on its own, so the site keeps working.

**Topics.**
- Free: spouse's nature, general marriage outlook.
- Paid: love or arranged marriage, spouse's job, spouse's place, marriage timing, appearance, ചൊവ്വാദോഷം,
  porutham, and the user's own question.

**Sign-in.** Users sign in with their name and phone number. There's no OTP. The session is HMAC-signed with
`PAYMENT_SECRET`.

**Payments (manual).**
1. The user picks a paid question and sees its price (set per question in the admin panel) and the payment QR code.
   They can download the QR or open it in a UPI app.
2. They pay, then enter the name shown in their Google Pay / UPI app. Someone who has already paid enters only the
   name. For "own question", the question text is sent with the request.
3. In `/admin.html` (log in with `ADMIN_KEY`), the owner checks BharatPe for that payer name and amount, then clicks
   **Approve**. The customer's page polls and shows the answer automatically. **Reject** asks them to re-check the
   name.
4. The admin panel also lists all users with their unlocked questions and custom questions, lets the owner upload or
   replace the payment QR image, change per-question prices, UPI ID, payee name and WhatsApp number, and shows an
   optional feed of payments forwarded to `/api/webhook?key=WEBHOOK_SECRET` (for example by the "Notification to
   Webhook" app for BharatPe). That feed only helps the owner check payments; it never unlocks anything by itself.

Users, requests, settings and the QR image are stored in a private **Vercel Blob** store (`BLOB_READ_WRITE_TOKEN`).
Locally, an in-memory store is used instead.

## Environment variables

| Name | Purpose |
| --- | --- |
| `PAYMENT_SECRET` | **Required.** Long random string used to sign orders and tokens. |
| `ADMIN_KEY` | Password for `/admin.html`. |
| `UPI_ID` | Default UPI ID (the admin panel setting overrides it). |
| `WEBHOOK_SECRET` | Key for the optional payment-notification feed (`?key=` or `x-webhook-secret` header). |
| `BLOB_READ_WRITE_TOKEN` | Set automatically by the connected Vercel Blob store. |
| `UPI_PAYEE_NAME` | Name shown in UPI apps. |
| `PRICE_SINGLE` | Default price per question (₹49); change prices in the admin panel. |
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
