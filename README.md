# Tycho

Tycho maps how a question could play out. A scenario starts from one event, splits at each turning point, and ends in outcomes, with the share of simulated runs that took each path.

This repository is the whole product: the web app, the scenario map format, and everything needed to run it yourself. It is open source under the AGPL-3.0 license.

## What is here so far

- **Sign in and sign up.** One flow for both. You type your email, get a 6-digit code by email, and type it in. A new email address becomes an account. The first time, Tycho asks your name.
- **The scenario map format** in `packages/map`: the data type for a map, a sample map, and a page that draws it.

## Run it on your computer

You need [Docker](https://docs.docker.com/get-docker/). To run everything, the database and the app:

```sh
docker compose up
```

Then open http://localhost:4310.

To work on the code, you also need Node.js 22 or newer and [pnpm](https://pnpm.io). Run the database in Docker and the app on your machine:

```sh
pnpm install
docker compose up -d db
cp .env.example apps/web/.env.local
pnpm dev
```

The app creates its database tables when it starts.

### Sign-in codes without an email account

If `RESEND_API_KEY` is not set, Tycho runs in dev mode: it sends no email and prints each sign-in code in the terminal where the app runs. Look for a block that starts with `[tycho] Dev mode`.

## Settings

Tycho reads these environment variables. `.env.example` lists them with sample values.

| Variable | What it does |
|---|---|
| `DATABASE_URL` | The Postgres database. With `docker compose`, it is `postgres://tycho:tycho@127.0.0.1:55432/tycho`. |
| `APP_URL` | The address people use to reach the app, like `https://tycho.example.com`. Tycho refuses form submissions that come from any other site. Set it when the app runs behind a proxy. |
| `RESEND_API_KEY` | A key from [Resend](https://resend.com), the service that sends the sign-in emails. Leave it empty for dev mode. |
| `MAIL_FROM` | The sender of sign-in emails, like `Tycho <noreply@example.com>`. Its domain must be verified in Resend. |
| `MIGRATE_ON_START` | Set to `0` to stop the app from updating the database tables when it starts. Then run `pnpm db:migrate` yourself. |

## Tests

The tests need the database running (`docker compose up -d db`). Each run makes a scratch database and deletes it at the end.

```sh
pnpm test        # unit tests
pnpm typecheck   # TypeScript checks
```

## How sign-in stays safe

- **Codes.** Each code is 6 random digits. Tycho stores only a salted hash of it, never the code itself. A code works once, for 10 minutes, and stops working after 5 wrong tries. Sending a new code ends the old one. The code appears only in the email's body, never its subject line, so it does not show on a lock screen.
- **Limits.** One address can get 1 code a minute, 5 in 15 minutes, and 10 a day. One network (IP address) can request 20 codes in 15 minutes and 100 a day, and can enter 30 wrong codes in 15 minutes.
- **Sessions.** Signing in puts a random token in a cookie that scripts on the page cannot read. Tycho stores only a hash of the token. A session lasts 30 days from your last visit. Signing out deletes it.
- **Forms from other sites.** Every change is a POST request, and Tycho checks that it came from its own pages.
- **Behind a proxy.** Tycho reads the visitor's IP address from the `X-Forwarded-For` header. It uses the last entry, the one your proxy adds, so put exactly one proxy in front of the app (Caddy, nginx, or your host's). Without a proxy, visitors can fake the header and dodge the per-IP limits. With a second layer like a CDN in front, the last entry is the CDN, so `clientIp` in `apps/web/src/lib/auth/http.ts` needs to look one entry further back.

## Sending email another way

Email goes through a small interface in `apps/web/src/lib/mail/index.ts`. To use SMTP or another service, write a new `Mailer` there and choose it in `getMailer()`.

## Layout

```
apps/web        The web app (Next.js, Tailwind CSS, Drizzle ORM)
  drizzle/      Database migrations, as SQL
  src/app/      Pages and API routes
  src/lib/auth/ Codes, limits and sessions
  src/lib/mail/ Sending email
packages/map    The scenario map format and its view
```

To change the database, edit `apps/web/src/db/schema.ts`, then run `pnpm db:generate` to write a new migration, and commit it.
