# "Sign in with GitHub" — setup

Contributors currently have to create a personal access token, pick a scope, and
paste it. This replaces that with one click. It needs a single server-side
endpoint, because GitHub's token exchange requires the app's **client secret**,
which can never live in a static page. (The secret-free *device flow* is not an
option either: `github.com/login/*` sends no CORS headers, so a browser cannot
call it — verified.)

Nothing else moves. The app stays on GitHub Pages; this is ~90 lines that do one
thing and store nothing.

Until both values in `../oauth-config.js` are filled in, the button stays hidden
and sign-in works exactly as it does today. **You can deploy this in either
order** — nothing breaks midway.

---

## 1. Register the OAuth App  *(you — it creates a secret)*

**GitHub → your `epiwen` org → Settings → Developer settings → OAuth Apps → New OAuth App**

| Field | Value |
|---|---|
| Application name | `Epiwen` |
| Homepage URL | `https://epiwen.github.io/epiweb/` |
| Authorization callback URL | `https://epiwen.github.io/epiweb/login.html` |

Register it under the **organisation**, not your personal account, so it
survives any change of maintainer.

Then **Generate a new client secret** and keep it to hand for step 2. Copy the
**Client ID** too — that one is public and goes in `oauth-config.js`.

> To test locally as well, add a second OAuth App with the callback
> `http://localhost:3456/login.html`. GitHub allows only one callback URL per
> app.

## 2. Deploy the worker  *(free tier)*

```bash
npm install -g wrangler          # once
cd oauth-worker
wrangler login
wrangler deploy                  # prints https://epiwen-auth.<you>.workers.dev

# the secret is stored encrypted by Cloudflare — never in this repo
wrangler secret put GITHUB_CLIENT_ID       # paste the Client ID
wrangler secret put GITHUB_CLIENT_SECRET   # paste the client secret
```

## 3. Point the app at it

In `../oauth-config.js`:

```js
clientId:  "Iv1.xxxxxxxxxxxx",                      // from step 1 — public
workerUrl: "https://epiwen-auth.<you>.workers.dev", // from step 2
```

Commit and push. The button appears; the token box stays as a fallback.

---

## What a contributor sees

Click **Sign in with GitHub** → GitHub's approval screen → back, signed in.
No token, no scopes to choose.

The checkbox *"I also edit the private backend"* requests `repo` instead of
`public_repo`, so ordinary contributors are not over-granted by default.

## Scopes

| Who | Scope | Reaches |
|---|---|---|
| Contributors | `public_repo` | `epiwen-data-public` (places, rubbings, records) + `epiweb` |
| Curators | `repo` | the above **+ private `epiwen-data`** (authorities, bibliography) |

## Honest limits

- **This is a UX win, not a security win.** The token still lands in the
  browser's `localStorage`, exactly as a pasted PAT does. What changes is that
  nobody has to mint or handle one.
- An OAuth token carries a whole scope (`public_repo`), which is **broader**
  than a fine-grained PAT pinned to one repository. If you would rather have
  tight per-repo permissions than convenience, keep the PAT flow.
- It adds one piece of infrastructure someone must own, and a secret to rotate
  — a deliberate departure from the project's "no build step, no backend" rule.
- Revoking is per-user: **GitHub → Settings → Applications → Authorized OAuth
  Apps**. Removing someone's repo access still revokes their *write* ability
  regardless of the token.

## Other hosts

The handler is plain `fetch`. To run it on Netlify or Vercel, keep the body and
swap the wrapper:

- **Netlify** — `netlify/functions/auth.js`, `export const handler = async (event) => …`
- **Vercel** — `api/auth.js`, `export default async function (req, res) { … }`

Set the same two environment variables, then put that URL in `workerUrl`.
