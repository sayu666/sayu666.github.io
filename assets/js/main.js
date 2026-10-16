/* CSI205TC Question 2 — page behaviour.
   1. theme toggle persisted in localStorage
   2. a client-side connection probe: DNS timing, resource timing, protocol
      version and round-trip estimate for this very page
   3. a footer note recording when the page was last loaded
*/

(function () {
  "use strict";

  /* ---------- theme ---------- */
  var KEY = "sayu-theme";
  var root = document.documentElement;

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode */ }
  }

  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  if (stored) {
    applyTheme(stored);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    applyTheme("light");
  }

  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      applyTheme(root.getAttribute("data-theme") === "light" ? "dark" : "light");
    });
  }

  /* ---------- connection probe ---------- */
  var out = document.getElementById("probe-out");
  var runBtn = document.getElementById("run-probe");

  function row(label, value, state) {
    var li = document.createElement("li");
    var name = document.createElement("span");
    name.textContent = label;
    var val = document.createElement("span");
    val.textContent = value;
    val.className = state || "";
    li.appendChild(name);
    li.appendChild(val);
    if (out) { out.appendChild(li); }
  }

  function median(values) {
    if (!values.length) { return null; }
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function runProbe() {
    if (!out) { return; }
    out.innerHTML = "";
    if (runBtn) { runBtn.disabled = true; }

    /* 1. protocol version actually negotiated for this document */
    var nav = performance.getEntriesByType("navigation")[0];
    var protocol = "unknown";
    if (nav && nav.nextHopProtocol) { protocol = nav.nextHopProtocol.toUpperCase(); }
    row("Negotiated protocol", protocol, "ok");

    /* 2. DNS lookup cost, from the navigation timing breakdown */
    if (nav) {
      var dnsMs = nav.domainLookupEnd - nav.domainLookupStart;
      var tlsMs = nav.connectEnd - nav.secureConnectionStart;
      var ttfbMs = nav.responseStart - nav.requestStart;
      row("DNS lookup", dnsMs.toFixed(1) + " ms", "ok");
      row("TLS handshake", tlsMs > 0 ? tlsMs.toFixed(1) + " ms" : "n/a", "ok");
      row("Time to first byte", ttfbMs.toFixed(1) + " ms", "ok");
      row("Document size", Math.round((nav.transferSize || 0) / 1024) + " KB", "ok");
      row("Server address", nav.serverTiming ? "see DevTools" : "hidden by CORS", "wait");
    } else {
      row("Navigation timing", "not exposed by this browser", "wait");
    }

    /* 3. resource breakdown: how many requests, over which hosts */
    var resources = performance.getEntriesByType("resource");
    row("Sub-resources", String(resources.length), "ok");
    var hosts = {};
    resources.forEach(function (entry) {
      try {
        var host = new URL(entry.name).hostname;
        hosts[host] = (hosts[host] || 0) + 1;
      } catch (e) { /* ignore */ }
    });
    Object.keys(hosts).forEach(function (host) {
      row("  from " + host, hosts[host] + " request(s)", "wait");
    });

    /* 4. round-trip estimate: fetch a tiny same-origin file and take the median
          of several samples, which averages out scheduling noise */
    var samples = [];
    var pending = 6;
    var done = 0;

    function sample() {
      var started = performance.now();
      fetch("assets/js/main.js?probe=" + Math.random(), { cache: "no-store" })
        .then(function (response) { return response.arrayBuffer(); })
        .then(function () {
          samples.push(performance.now() - started);
        })
        .catch(function () { /* keep going */ })
        .then(function () {
          done += 1;
          if (done === pending) {
            var mid = median(samples);
            row("Median round trip", mid === null ? "unavailable" : mid.toFixed(1) + " ms", "ok");
            row("Samples", samples.length + " of " + pending, "wait");
            if (runBtn) { runBtn.disabled = false; }
          } else {
            sample();
          }
        });
    }

    for (var i = 0; i < pending; i += 1) { sample(); }
    row("Location", window.location.hostname, "wait");
  }

  if (runBtn) { runBtn.addEventListener("click", runProbe); }

  var footer = document.querySelector(".site-footer p");
  if (footer) {
    var stamp = document.createElement("span");
    stamp.className = "fine";
    stamp.textContent = " · loaded " + new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    footer.appendChild(stamp);
  }
})();
