# ജീവിതപങ്കാളി ജ്യോതിഷം – Malayalam relationship astrology chatbot

A Malayalam chatbot website for marriage and relationship astrology: who your future spouse will be, their
character, job, place, appearance, love vs arranged marriage, marriage timing, ചൊവ്വാദോഷം and
നക്ഷത്രപ്പൊരുത്തം. Some questions are free. The rest are unlocked through a UPI payment to `ajithta855@oksbi`.

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

**Payment flow.**
1. The user picks a plan: ₹49 for one question (24 h) or ₹199 for everything (30 days).
2. The server creates a signed order and shows a UPI QR code plus a `upi://pay` deep link (on mobile) for
   `ajithta855@oksbi`, with the order number in the payment note.
3. The user pays and enters the 12-digit UTR.
4. What happens next depends on the mode:
   - `AUTO_UNLOCK` (default `true`): the question unlocks right away. The UTR and order are written to
     the Vercel function logs so you can match them against your bank or UPI app.
     ⚠️ Without a payment gateway nothing can confirm the money actually arrived, so a dishonest user could
     type a fake UTR.
   - `AUTO_UNLOCK=false` (manual verification): the user sees "pending" and can WhatsApp you the order and UTR.
     You check your UPI app, open `/admin.html`, enter `ADMIN_KEY` and the order number, and send the user the
     8-character unlock code.

Orders and tokens are HMAC-signed with `PAYMENT_SECRET`, so no database is needed and they can't be forged.

## Environment variables

| Name | Purpose |
| --- | --- |
| `PAYMENT_SECRET` | **Required.** Long random string used to sign orders and tokens. |
| `ADMIN_KEY` | Password for `/admin.html`. |
| `UPI_ID` | Defaults to `ajithta855@oksbi`. |
| `UPI_PAYEE_NAME` | Name shown in UPI apps. |
| `PRICE_SINGLE` / `PRICE_FULL` | Defaults `49` / `199` (₹). |
| `AUTO_UNLOCK` | `false` to require manual approval. |
| `OWNER_WHATSAPP` | e.g. `919876543210`; shows a "WhatsApp വഴി അറിയിക്കുക" button in manual mode. |
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
