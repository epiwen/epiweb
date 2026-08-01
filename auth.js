/* auth.js — GitHub-identity session gate.
 * Runs immediately on every protected page.
 * Identity is established at login.html via GET /user with the stored PAT.
 * localStorage holds the identity across browser restarts;
 * sessionStorage holds the live session (cleared when the tab/browser closes). */
(function () {
  // UNGATED pages are public read-only browsing — reachable without signing in.
  // The map + the pages it clicks into (Sites, Catalog) load the public corpus
  // over the raw CDN / anonymous API, so a logged-out guest can explore them;
  // every editor / write / admin page stays gated below. contribute.html + the
  // login page round out the always-public set.
  var UNGATED = ["login.html", "contribute.html", "map.html", "sites.html", "catalog.html"];
  var USERNAME_KEY = "epiwen_gh_username";
  var SESSION_KEY  = "epiwen_authed";
  var LOGIN        = "login.html";

  var page = window.location.pathname.split("/").pop() || "index.html";
  var gated = UNGATED.indexOf(page) === -1;

  function redirect() {
    window.location.replace(LOGIN + "?r=" + encodeURIComponent(window.location.href));
  }

  var username = localStorage.getItem(USERNAME_KEY);

  // A stale "guest" identity (from the retired Browse-as-guest button) is
  // never valid, regardless of what sessionStorage says — without this, a
  // browser that was already "signed in" as guest before the button was
  // removed would pass the sessionStorage check below on every reload and
  // never get routed back through login.html's own cleanup, staying stuck
  // on the empty epiwen-workshop backend indefinitely.
  if (username === "guest") {
    sessionStorage.removeItem(SESSION_KEY);
    ["epiwen_gh_username", "epiwen_gh_avatar", "epiwen_gh_name", "epiwen_gh_token"]
      .forEach(function (k) { localStorage.removeItem(k); });
    localStorage.setItem("epiwen_gh_owner",  "pleuston");
    localStorage.setItem("epiwen_gh_repo",   "epiwen-data");
    localStorage.setItem("epiwen_gh_branch", "main");
    if (gated) { redirect(); return; }
    username = null;
  }

  var signedIn = !!username && sessionStorage.getItem(SESSION_KEY) === username;

  // Protected pages require a live session; ungated pages fall through so guests
  // can browse.
  if (gated && !signedIn) { redirect(); return; }

  // Paint the topbar auth control on every page (gated + ungated): the signed-in
  // identity + sign-out, or a "Sign in" link for a logged-out guest on the
  // public pages.
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector('[onclick="EpiAuth.signOut()"]');
    if (!btn) return;
    if (signedIn) {
      var av = localStorage.getItem("epiwen_gh_avatar") || "";
      var name = localStorage.getItem("epiwen_gh_name") || username;
      var img = av
        ? '<img src="' + av + '" width="18" height="18" alt="" '
          + 'style="border-radius:50%;vertical-align:middle;margin-right:.3rem;display:inline-block"> '
        : "";
      btn.innerHTML = img + "@" + username;
      btn.title = name + " · click to sign out";
    } else {
      btn.textContent = "Sign in";
      btn.title = "Sign in with GitHub";
      btn.removeAttribute("onclick");
      btn.onclick = function () { window.location.href = LOGIN; };
    }
  });
})();

window.EpiAuth = {
  getUser: function () {
    return {
      username: localStorage.getItem("epiwen_gh_username") || "",
      avatar:   localStorage.getItem("epiwen_gh_avatar")   || "",
      name:     localStorage.getItem("epiwen_gh_name")     || "",
      token:    localStorage.getItem("epiwen_gh_token")    || ""
    };
  },
  /* full=true clears stored identity + token (switch account);
     full=false (default) keeps identity, just ends the session. */
  signOut: function (full) {
    sessionStorage.removeItem("epiwen_authed");
    if (full) {
      ["epiwen_gh_username", "epiwen_gh_avatar", "epiwen_gh_name",
       "epiwen_gh_token", "epiwen_gh_owner", "epiwen_gh_repo",
       "epiwen_gh_branch", "epiwen_gh_path"
      ].forEach(function (k) { localStorage.removeItem(k); });
    }
    window.location.href = "login.html";
  }
};
