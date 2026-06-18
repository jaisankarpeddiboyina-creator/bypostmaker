# Start Here

This is the simple guide. Use this when the bigger deployment file feels like too much.

## What You Have Right Now

You have a real local app.

It can:

- Open in your browser.
- Let you enter using a local demo login.
- Show the real PostMaker dashboard.
- Let you select platforms and write prompts.
- Build successfully.
- Type-check successfully.
- Use local Cloudflare D1 database state.

It cannot do the full real-world product flow until you add real keys for AI, Google, Razorpay, Resend, and Cloudflare.

That is normal. The app is not fake; it is just not connected to all outside services yet.

## The One Command To Run Locally

From the project root:

```bash
npm run dev
```

Then open:

```text
http://localhost:5173/api/auth/dev
```

That takes you into the app using the local dev login.

If the screen looks old or stuck, hard-refresh:

```text
Ctrl + Shift + R
```

## How To Test AI Locally

Create a local secrets file:

```bash
cp .dev.vars.example .dev.vars
```

Open `.dev.vars` and fill only these first:

```bash
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
JWT_SECRET=any-long-random-string
```

Restart:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/api/auth/dev
```

Then type a prompt and click Generate.

## What To Ignore For Now

Do not worry about these until AI generation works locally:

- Razorpay
- Resend
- Google OAuth
- GitHub Actions
- Staging deploy
- Production deploy
- Admin setup
- Cron jobs
- PostHog
- Sentry

Those are real, but they are later steps.

## The Best Order

Do this in order:

1. Run local app with dev login.
2. Add Groq and Gemini keys.
3. Confirm AI generation works locally.
4. Create Cloudflare D1 databases.
5. Deploy staging.
6. Add Google OAuth for staging.
7. Add Razorpay test mode for staging.
8. Add Resend for staging.
9. Test the full staging flow.
10. Only then deploy production.

## How To Know You Are Winning

You are winning when:

- `npm run dev` starts without errors.
- `http://localhost:5173/api/auth/dev` opens the app.
- You can type a prompt and generate posts.
- `npm run type-check` passes.
- `npm run build --prefix frontend` passes.

You do not need production keys to prove the core app works locally.

## Is This Safe To Launch Today?

Not yet.

It is safe to keep building and test locally.

It is ready to connect to staging once you have keys.

It is not ready to charge real users until staging proves:

- Real Google login works.
- Real AI generation works.
- Razorpay test checkout works.
- Razorpay webhook upgrades user plans.
- Resend emails arrive.
- Admin page works.
- Account deletion works.

## The Next Thing You Should Do

Get these two keys:

```text
GROQ_API_KEY
GEMINI_API_KEY
```

Put them in:

```text
.dev.vars
```

Then run:

```bash
npm run dev
```

And test generation locally.

That is the next real milestone.
