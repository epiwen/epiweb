/* authority-browser.js — loads data/authority-index.json and renders the Authorities browser */
(function () {
  "use strict";

  var allRecords   = [];
  var _publicRecords  = [];
  var _privateRecords = [];
  var currentFilter = window.__EPI_AUTH_FILTER || (new URLSearchParams(window.location.search)).get("filter") || "all";
  var _deepId = (new URLSearchParams(window.location.search)).get("id");   // deep-link to one authority
  var currentQuery  = "";
  var selectedRec   = null;
  var authView = localStorage.getItem("epiwen_auth_view") || "cards";  // "cards" | "table"
  var yearFrom = null, yearTo = null;   // active time filter (lifespan / attestation)
  var groupByProvince = localStorage.getItem("epiwen_auth_group") !== "0";  // places table

  // Pull year(s) out of a free-text lifespan ("705–774", "1871 - 1942", "1954-").
  function yearsOf(dateStr) {
    if (!dateStr) return null;
    var m = String(dateStr).match(/\d{3,4}/g);
    if (!m) return null;
    var ys = m.map(Number);
    return { from: Math.min.apply(null, ys), to: Math.max.apply(null, ys) };
  }
  function birthYear(dateStr) { var y = yearsOf(dateStr); return y ? y.from : null; }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function toast(msg, isErr) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "show" + (isErr ? " toast-error" : "");
    setTimeout(function () { el.className = ""; }, isErr ? 6000 : 3000);
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  function loadIndex() {
    var list = document.getElementById("auth-list");
    list.innerHTML = '<div class="catalog-loading">Loading authority index…</div>';

    // Baseline: the public default-corpus authority index from the app repo
    // (no token — works for guests). Additive: the private epiwen-data backend
    // index, which only resolves for signed-in users who can read it.
    var defJob = (window.EpiCollections && EpiCollections.loadDefaultAuthorityIndex)
      ? EpiCollections.loadDefaultAuthorityIndex()
      : Promise.resolve([]);
    var backendJob = EpiData.fetch("data/authority-index.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });

    Promise.all([defJob, backendJob]).then(function (res) {
      var def = res[0] || [], backend = res[1] || [];
      // Dedup by id; the backend entry (canonical XML via EpiData) wins over the
      // public default copy, so signed-in users open the full private record.
      var byId = {};
      def.forEach(function (r)     { byId[r.id] = r; });
      backend.forEach(function (r) { byId[r.id] = r; });
      _publicRecords = Object.keys(byId).map(function (k) { return byId[k]; });
      mergePrivate();
    });
  }

  // Merge private authority entries from enabled collections (re-run on toggle).
  function mergePrivate() {
    if (!window.EpiCollections) { allRecords = _publicRecords.slice(); renderList(); return; }
    EpiCollections.loadIndex("authority")
      .then(function (priv) {
        _privateRecords = priv || [];
        allRecords = _publicRecords.concat(_privateRecords);
        renderList();
      })
      .catch(function () { allRecords = _publicRecords.slice(); renderList(); });
  }

  // ── Filter + render ───────────────────────────────────────────────────────

  function fold(s) { return window.EpiVariants ? EpiVariants.fold(s) : String(s == null ? "" : s).toLowerCase(); }
  function filteredRecords() {
    var q = fold(currentQuery);
    return allRecords.filter(function (r) {
      if (currentFilter === "vocabulary"  && r.name_type !== "vocabulary")  return false;
      if (currentFilter === "personal"   && r.name_type !== "personal")   return false;
      if (currentFilter === "corporate"  && r.name_type !== "corporate")  return false;
      if (currentFilter === "temporal"   && r.name_type !== "temporal")   return false;
      if (currentFilter === "geographic" && r.name_type !== "geographic") return false;
      if (q) {
        var hay = fold((r.display_name || "") + " " + (r.name_zh || "") + " " + (r.name_pinyin || ""));
        if (hay.indexOf(q) === -1) return false;
      }
      if (yearFrom != null || yearTo != null) {
        var y = yearsOf(r.date);
        if (!y) return false;                                   // undated → out when filtering by time
        var lo = yearFrom != null ? yearFrom : -Infinity;
        var hi = yearTo   != null ? yearTo   :  Infinity;
        if (y.to < lo || y.from > hi) return false;             // lifespan doesn't overlap the range
      }
      return true;
    });
  }

  function renderList() {
    var recs = filteredRecords();
    var list = document.getElementById("auth-list");
    var countEl = document.getElementById("auth-count");
    if (countEl) countEl.textContent = recs.length + " of " + allRecords.length;

    if (!recs.length) {
      list.innerHTML = '<div class="catalog-loading">No records match.</div>';
      return;
    }

    if (authView === "table" && document.getElementById("auth-view-mode")) {
      renderAuthTable(recs, list);
    } else {
      var frag = document.createDocumentFragment();
      recs.forEach(function (rec) { frag.appendChild(buildListItem(rec)); });
      list.innerHTML = "";
      list.appendChild(frag);
    }

    // Deep-link: ?id=<authority> opens that record (e.g. from a rubbing collection).
    // Only consume _deepId once the record is actually present — it may arrive in a
    // later render (the shared/private corpus loads after the default index).
    if (_deepId) {
      var want = _deepId;
      var rec = recs.filter(function (r) { return r.id === want; })[0] ||
                allRecords.filter(function (r) { return r.id === want; })[0];
      if (rec) {
        _deepId = null;
        var div = list.querySelector('[data-auth-id="' + (window.CSS && CSS.escape ? CSS.escape(want) : want) + '"]');
        selectRecord(rec, div || null);
        if (div) div.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function authBadges(rec) {
    var b = [];
    ["wikidata", "viaf", "gnd", "dila_authority", "cbdb"].forEach(function (k) {
      if (rec[k]) b.push('<a href="' + esc(EXT_LINKS[k](rec[k])) + '" target="_blank" rel="noopener" ' +
        'onclick="event.stopPropagation()">' + esc(ID_LABELS[k]) + "</a>");
    });
    return b.join(" · ");
  }

  function nameCell(r) {
    var disp = r.display_name || r.name_zh || r.id;
    // Only add forms the display name doesn't already carry (display_name is
    // often "English 中文", so a bare zh/pinyin repeat looks like noise).
    var sub = [];
    if (r.name_pinyin && disp.indexOf(r.name_pinyin) === -1) sub.push(r.name_pinyin);
    if (r.name_zh && disp.indexOf(r.name_zh) === -1) sub.push(r.name_zh);
    // 🌐 = shared public corpus (visible to everyone); 🔒 = a private collection.
    var mark = r.shared ? "🌐 " : (r.source === "private" ? "🔒 " : "");
    return mark + esc(disp) +
      (sub.length ? ' <span class="tree-label-zh">' + esc(sub.join(" · ")) + "</span>" : "");
  }
  var UNASSIGNED = "（未指定 unassigned）";
  function provinceLabel(r) {
    if (!r.province) return "";
    return [r.province, r.province_en].filter(Boolean).join(" · ");
  }

  // Sortable table view. Persons/corporate: Name · Dates · Authorities.
  // Places (geographic): Name · Type · Province · Coordinates · Attested,
  // grouped by province. Row click opens the same detail pane as a card.
  function renderAuthTable(recs, list) {
    var isGeo = currentFilter === "geographic";
    var columns = isGeo ? [
      { key: "name", label: "Name", cls: "col-zh", render: nameCell },
      { key: "place_type", label: "Type", get: function (r) { return r.place_type || ""; } },
      { key: "province", label: "Province", cls: "col-zh",
        get: function (r) { return r.province || ""; }, render: function (r) { return esc(provinceLabel(r)); } },
      { key: "coordinates", label: "Coordinates", cls: "col-num",
        get: function (r) { return r.coordinates || ""; } },
      { key: "attested", label: "Attested", type: "num",
        get: function (r) { return birthYear(r.date); },
        render: function (r) { return esc(r.date || ""); } }
    ] : [
      { key: "name", label: "Name", cls: "col-zh", render: nameCell },
      { key: "born", label: "Dates", type: "num",
        get: function (r) { return birthYear(r.date); },
        render: function (r) { return esc(r.date || ""); } },
      { key: "auth", label: "Authorities", sortable: false, render: authBadges }
    ];
    list.innerHTML = '<div class="tbl-wrap"><div id="auth-tbl"></div></div>';
    EpiTable.render(document.getElementById("auth-tbl"), {
      columns: columns, rows: recs, sort: { key: "name", dir: 1 },
      group: isGeo && groupByProvince
        ? { label: "Province",
            get: function (r) { return provinceLabel(r) || UNASSIGNED; },
            sortKey: function (g) { return g === UNASSIGNED ? "￿" : g; } }
        : null,
      rowKey: function (r) { return r.id; },
      onRowClick: function (r) { selectRecord(r, null); }
    });
  }

  function buildListItem(rec) {
    var div = document.createElement("div");
    div.className = "catalog-item";
    div.dataset.authId = rec.id;

    var info = document.createElement("div");
    info.className = "catalog-item-info";

    var nameEl = document.createElement("div");
    nameEl.className = "catalog-title";
    if (rec.source === "private") {
      nameEl.innerHTML = '<span class="catalog-badge-private" title="Private collection">🔒 ' +
        esc(rec.collectionTitle || rec.collection || "private") + '</span> ' + esc(rec.display_name || rec.id);
    } else {
      nameEl.textContent = rec.display_name || rec.id;
    }
    info.appendChild(nameEl);

    // Sub-line: forms + type
    var subParts = [];
    if (rec.name_pinyin && rec.name_pinyin !== rec.display_name) subParts.push(rec.name_pinyin);
    if (rec.name_zh && rec.name_zh !== rec.display_name)         subParts.push(rec.name_zh);
    if (rec.name_type === "corporate") subParts.push("corporate");
    if (subParts.length) {
      var sub = document.createElement("div");
      sub.className = "catalog-date";
      sub.textContent = subParts.join(" · ");
      info.appendChild(sub);
    }

    // Identifier badges
    var idBadges = [];
    if (rec.wikidata)       idBadges.push("WD");
    if (rec.viaf)           idBadges.push("VIAF");
    if (rec.gnd)            idBadges.push("GND");
    if (rec.dila_authority) idBadges.push("DILA");
    if (rec.cbdb)           idBadges.push("CBDB");
    if (idBadges.length) {
      var badges = document.createElement("div");
      badges.className = "catalog-date";
      badges.textContent = idBadges.join(" · ");
      info.appendChild(badges);
    }

    div.appendChild(info);
    div.addEventListener("click", function () { selectRecord(rec, div); });
    return div;
  }

  function selectRecord(rec, itemEl) {
    var prev = document.querySelector(".catalog-item.selected");
    if (prev) prev.classList.remove("selected");
    if (itemEl) itemEl.classList.add("selected");
    selectedRec = rec;
    showDetail(rec);
  }

  // ── Detail pane ───────────────────────────────────────────────────────────

  var EXT_LINKS = {
    wikidata:       function (v) { return "https://www.wikidata.org/wiki/" + encodeURIComponent(v); },
    viaf:           function (v) { return "https://viaf.org/viaf/" + encodeURIComponent(v); },
    gnd:            function (v) { return "https://d-nb.info/gnd/" + encodeURIComponent(v); },
    dila_authority: function (v) { return "https://authority.dila.edu.tw/" + v; },
    cbdb:           function (v) { return "https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=" + encodeURIComponent(v); }
  };

  var ID_LABELS = { wikidata: "Wikidata", viaf: "VIAF", gnd: "GND", dila_authority: "DILA", cbdb: "CBDB" };

  function idRow(label, value, makeUrl) {
    var val = value || "—";
    var row = "<tr><th>" + esc(label) + "</th><td>";
    if (value && makeUrl) {
      row += '<a href="' + esc(makeUrl(value)) + '" target="_blank" rel="noopener">' + esc(value) + " ↗</a>";
    } else {
      row += esc(val);
    }
    return row + "</td></tr>";
  }

  function showDetail(rec) {
    var titleEl = document.getElementById("preview-title");
    if (titleEl) titleEl.textContent = rec.display_name || rec.id;

    var contentEl = document.getElementById("auth-detail-content");
    if (!contentEl) return;

    var html = '<div style="padding:1rem 1.2rem">';
    html += "<h3 style=\"margin:0 0 .3rem\">" + esc(rec.display_name || rec.id) + "</h3>";

    var sub = [];
    if (rec.name_pinyin && rec.name_pinyin !== rec.display_name) sub.push(rec.name_pinyin);
    if (rec.name_zh && rec.name_zh !== rec.display_name)         sub.push(rec.name_zh);
    if (sub.length) {
      html += "<p class=\"catalog-date\" style=\"margin:0 0 .8rem\">" + esc(sub.join(" · ")) + "</p>";
    }

    html += "<table class=\"docs-table\" style=\"margin-bottom:.8rem\">";
    html += "<tbody>";
    html += "<tr><th>Type</th><td>" + esc(rec.name_type || "personal") +
      (rec.place_type ? " · " + esc(rec.place_type) : "") + "</td></tr>";
    if (rec.province)
      html += "<tr><th>Province</th><td>" + esc(provinceLabel(rec)) + "</td></tr>";
    if (rec.coordinates)
      html += "<tr><th>Coordinates</th><td>" + esc(rec.coordinates) + "</td></tr>";
    if (rec.date)
      html += "<tr><th>" + (rec.name_type === "geographic" ? "Attested" : "Dates") + "</th><td>" +
        esc(rec.date) + "</td></tr>";
    if (rec.site_id)
      html += '<tr><th>Site record</th><td><a href="sites.html?site=' +
        encodeURIComponent(rec.site_id) + '">Open in Sites →</a></td></tr>';
    html += idRow("Wikidata", rec.wikidata, EXT_LINKS.wikidata);
    html += idRow("VIAF",     rec.viaf,     EXT_LINKS.viaf);
    html += idRow("GND",      rec.gnd,      EXT_LINKS.gnd);
    html += idRow("DILA",     rec.dila_authority, EXT_LINKS.dila_authority);
    html += idRow("CBDB",     rec.cbdb,     EXT_LINKS.cbdb);
    html += "</tbody></table>";

    html += "<div style=\"display:flex;gap:.5rem;flex-wrap:wrap\">";
    html += "<button class=\"btn small primary\" id=\"auth-edit-btn\">Edit</button>";
    html += "<button class=\"btn small\" id=\"auth-copy-btn\">Copy XML</button>";
    html += "</div>";
    html += "</div>";

    contentEl.innerHTML = html;

    document.getElementById("auth-edit-btn").addEventListener("click", function () {
      openInEditor(rec);
    });
    document.getElementById("auth-copy-btn").addEventListener("click", function () {
      fetchXml(rec, function (xml) {
        navigator.clipboard.writeText(xml)
          .then(function () { toast("XML copied to clipboard"); })
          .catch(function (e) { toast("Copy failed: " + e.message, true); });
      });
    });
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function fetchXml(rec, cb) {
    var relPath = "authority/" + encodeURIComponent(rec.id) + ".xml";
    var p;
    if (rec._default && window.EpiCollections && EpiCollections.fetchDefaultAuthorityXml) {
      // Public default-corpus record — no token needed.
      p = EpiCollections.fetchDefaultAuthorityXml(rec.id);
    } else if (rec.source === "private" && window.EpiCollections) {
      p = EpiCollections.fetchRecordXml(rec.collection, relPath);
    } else {
      p = EpiData.fetch(relPath).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status); return r.text();
      });
    }
    p.then(cb).catch(function (err) { toast("Could not load XML: " + err.message, true); });
  }

  // Where a record's file lives, by origin. A collection record (shared public
  // corpus or an enabled private package) lives under collections/<pkg>/authority/
  // in THAT package's repo — not in the default backend.
  function authPkgOf(rec) {
    if (rec._default || !rec.collection || !window.EpiCollections) return null;
    return rec.collection;
  }
  function authPrefixFor(rec) {
    if (rec._default) return EpiCollections.DEFAULT_CORPUS.id + "/authority/";
    var pkg = authPkgOf(rec);
    if (pkg) return "collections/" + pkg + "/authority/";
    return "authority/";
  }
  function authTargetFor(rec) {
    if (rec._default) {
      var d = EpiCollections.DEFAULT_CORPUS;
      return { owner: d.owner, repo: d.repo, branch: d.branch };
    }
    var pkg = authPkgOf(rec);
    if (!pkg) return null;                       // backend: use the stored default
    var sh = EpiCollections.sharedPkg && EpiCollections.sharedPkg(pkg);
    if (sh) return { owner: sh.owner, repo: sh.repo, branch: sh.branch };
    var c = EpiCollections.getConfig();          // private collections repo
    return { owner: c.owner, repo: c.repo, branch: c.branch };
  }

  function openInEditor(rec) {
    fetchXml(rec, function (xml) {
      sessionStorage.setItem("epiwen_preload_authority", JSON.stringify({
        id:             rec.id,
        display_name:   rec.display_name,
        name_zh:        rec.name_zh,
        name_pinyin:    rec.name_pinyin,
        name_type:      rec.name_type || "personal",
        wikidata:       rec.wikidata,
        viaf:           rec.viaf,
        gnd:            rec.gnd,
        dila_authority: rec.dila_authority,
        cbdb:           rec.cbdb,
        // Save/delete the record IN PLACE — three homes:
        //   default (public corpus) → app repo,      corpus/authority/
        //   collection (shared/private pkg) → its repo, collections/<pkg>/authority/
        //   backend                 → epiwen-data,   authority/
        // Without the collection branch a place or a rubbing institution edited
        // here was written to the BACKEND at authority/<id>.xml — wrong repo and
        // wrong path, leaving the real record untouched.
        _authPrefix:    authPrefixFor(rec),
        _writeTarget:   authTargetFor(rec),
        xml:            xml
      }));
      window.location.href = "authority-editor.html";
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", function () {
    // Sync tab button to URL ?filter param
    if (currentFilter !== "all") {
      document.querySelectorAll(".auth-tab-btn").forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.filter === currentFilter);
      });
    }
    loadIndex();

    if (window.EpiCollections) {
      EpiCollections.onChange(mergePrivate);
    }

    document.getElementById("auth-search").addEventListener("input", function () {
      currentQuery = this.value.trim();
      renderList();
    });

    // Cards ⇄ Table toggle (persons/places), persisted.
    var vm = document.getElementById("auth-view-mode");
    if (vm) {
      function paintVm() {
        Array.prototype.forEach.call(vm.querySelectorAll("button"), function (b) {
          b.classList.toggle("active", b.dataset.mode === authView);
        });
      }
      paintVm();
      vm.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-mode]");
        if (!b || b.dataset.mode === authView) return;
        authView = b.dataset.mode;
        localStorage.setItem("epiwen_auth_view", authView);
        paintVm();
        renderList();
      });
    }

    // Time filter — year range + dynasty presets (applies to both views).
    var yf = document.getElementById("year-from"), yt = document.getElementById("year-to");
    function readYears() {
      yearFrom = yf && yf.value !== "" ? parseInt(yf.value, 10) : null;
      yearTo   = yt && yt.value !== "" ? parseInt(yt.value, 10) : null;
      renderList();
    }
    if (yf) yf.addEventListener("input", readYears);
    if (yt) yt.addEventListener("input", readYears);
    Array.prototype.forEach.call(document.querySelectorAll(".auth-presets button"), function (b) {
      b.addEventListener("click", function () {
        if (yf) yf.value = b.dataset.from || "";
        if (yt) yt.value = b.dataset.to || "";
        readYears();
      });
    });
    var yc = document.getElementById("year-clear");
    if (yc) yc.addEventListener("click", function () {
      if (yf) yf.value = ""; if (yt) yt.value = "";
      yearFrom = yearTo = null; renderList();
    });

    // Places: group the table by province (on by default).
    var gp = document.getElementById("group-province");
    if (gp) {
      gp.checked = groupByProvince;
      gp.addEventListener("change", function () {
        groupByProvince = gp.checked;
        localStorage.setItem("epiwen_auth_group", groupByProvince ? "1" : "0");
        renderList();
      });
    }

    document.querySelectorAll(".auth-tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".auth-tab-btn").forEach(function (b) {
          b.classList.remove("active");
        });
        this.classList.add("active");
        currentFilter = this.dataset.filter;
        renderList();
      });
    });

    var newBtn = document.getElementById("auth-new-btn");
    if (newBtn) {
      newBtn.addEventListener("click", function () {
        sessionStorage.removeItem("epiwen_preload_authority");
        window.location.href = "authority-editor.html";
      });
    }
  });
})();
