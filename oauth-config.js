/* oauth-config.js — "Sign in with GitHub" settings.
 *
 * Both values below are PUBLIC (a client id is not a secret). The client
 * SECRET lives only in the worker's environment — never here, never in any
 * file served to a browser.
 *
 * Until clientId AND workerUrl are both filled in, the OAuth button stays
 * hidden and login.html behaves exactly as before (paste a token). So this
 * file is safe to commit empty.
 *
 * Setup: oauth-worker/README.md
 */
window.EpiOAuth = {
  // GitHub → your org → Settings → Developer settings → OAuth Apps → New
  clientId: "",

  // The deployed exchange endpoint, e.g. "https://epiwen-auth.<you>.workers.dev"
  workerUrl: "",

  // Scope requested for ordinary contributors: enough to write the PUBLIC
  // corpus (places, rubbings, records) and the app repo — nothing more.
  scope: "public_repo",

  // Curators who also edit the PRIVATE backend (authorities, bibliography,
  // core records) need full repo. Offered as an opt-in checkbox at sign-in so
  // nobody is over-granted by default.
  scopeFull: "repo"
};
