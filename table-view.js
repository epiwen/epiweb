/* table-view.js — a small reusable sortable table (window.EpiTable).
 *
 * Used by the catalog (objects/inscriptions/rubbings), the sites browser, and the
 * person/place authority browsers to offer a sortable "Table" view alongside the
 * existing cards/tree. No dependencies; bundled in the app repo.
 *
 *   EpiTable.render(container, {
 *     rows,                       // array of row objects
 *     columns: [{ key, label, type?, get?(row), render?(row), sortable? }],
 *                                 //   type: "text" (default) | "num" | "date"
 *     sort:   { key, dir }?,      // initial sort (dir 1 asc / -1 desc)
 *     group:  { label, get(row) }?,   // optional group-by header rows
 *     rowKey: function(row),      // stable id for row-click dispatch
 *     onRowClick: function(row, ev)?
 *   }) -> { setRows(rows), getSort() }
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Comparator: numeric-aware for "num"/"date", else a natural (numeric) locale
  // compare. Blanks always sort last regardless of direction.
  function cmp(a, b, type) {
    var ae = a == null || a === "", be = b == null || b === "";
    if (ae && be) return 0;
    if (ae) return 1;
    if (be) return -1;
    if (type === "num" || type === "date") {
      var na = parseFloat(a), nb = parseFloat(b);
      var nan = isNaN(na), nbn = isNaN(nb);
      if (nan && nbn) return String(a).localeCompare(String(b));
      if (nan) return 1;
      if (nbn) return -1;
      return na - nb;
    }
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function render(container, opts) {
    var columns = opts.columns;
    var rows = (opts.rows || []).slice();
    var sort = opts.sort ? { key: opts.sort.key, dir: opts.sort.dir || 1 } : null;
    var group = opts.group || null;

    function val(row, col) { return col.get ? col.get(row) : row[col.key]; }

    function sortRows(list) {
      if (!sort) return list;
      var col = columns.filter(function (c) { return c.key === sort.key; })[0];
      if (!col) return list;
      return list.slice().sort(function (a, b) {
        return sort.dir * cmp(val(a, col), val(b, col), col.type);
      });
    }

    function cellHtml(r, c) {
      if (c.render) return c.render(r);
      var v = val(r, c);
      return esc(v == null ? "" : v);
    }
    function rowHtml(r) {
      var rk = opts.rowKey ? ' data-rk="' + esc(opts.rowKey(r)) + '"' : "";
      var cls = opts.onRowClick ? "etbl-click" : "";
      var h = '<tr' + rk + (cls ? ' class="' + cls + '"' : "") + ">";
      for (var i = 0; i < columns.length; i++) h += "<td>" + cellHtml(r, columns[i]) + "</td>";
      return h + "</tr>";
    }

    function draw() {
      var sorted = sortRows(rows);
      var h = '<table class="etbl"><thead><tr>';
      columns.forEach(function (c) {
        var on = c.sortable === false ? "" : " etbl-sortable";
        var arrow = sort && sort.key === c.key ? '<span class="etbl-arrow">' + (sort.dir > 0 ? "▲" : "▼") + "</span>" : "";
        h += '<th data-k="' + esc(c.key) + '" class="' + (c.cls || "") + on + '">' + esc(c.label) + arrow + "</th>";
      });
      h += "</tr></thead><tbody>";

      if (group) {
        var buckets = {}, order = [];
        sorted.forEach(function (r) {
          var g = group.get(r); if (g == null || g === "") g = "—";
          if (!buckets[g]) { buckets[g] = []; order.push(g); }
          buckets[g].push(r);
        });
        // group.sortKey lets a caller park a bucket (e.g. "unassigned") last
        // without renaming it.
        var gkey = group.sortKey || function (g) { return g; };
        order.sort(function (a, b) { return cmp(gkey(a), gkey(b)); });
        order.forEach(function (g) {
          h += '<tr class="etbl-group"><th colspan="' + columns.length + '">' +
               esc(g) + ' <span class="etbl-gn">' + buckets[g].length + "</span></th></tr>";
          buckets[g].forEach(function (r) { h += rowHtml(r); });
        });
      } else {
        sorted.forEach(function (r) { h += rowHtml(r); });
      }
      h += "</tbody></table>";
      container.innerHTML = h;

      Array.prototype.forEach.call(container.querySelectorAll("th.etbl-sortable"), function (th) {
        th.addEventListener("click", function () {
          var k = th.getAttribute("data-k");
          if (sort && sort.key === k) sort.dir = -sort.dir;
          else sort = { key: k, dir: 1 };
          draw();
        });
      });
      if (opts.onRowClick) {
        Array.prototype.forEach.call(container.querySelectorAll("tbody tr.etbl-click"), function (tr) {
          tr.addEventListener("click", function (ev) {
            var rk = tr.getAttribute("data-rk");
            var row = rows.filter(function (r) { return String(opts.rowKey(r)) === rk; })[0];
            if (row) opts.onRowClick(row, ev);
          });
        });
      }
    }

    draw();
    return {
      setRows: function (rs) { rows = (rs || []).slice(); draw(); },
      getSort: function () { return sort ? { key: sort.key, dir: sort.dir } : null; }
    };
  }

  window.EpiTable = { render: render, esc: esc };
})();
