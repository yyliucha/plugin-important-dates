/**
 * 重要日期 · 全站悬浮提醒
 * 由 plugin-important-dates 维护（系统设置 → 代码注入 → 全局 head 标签），
 * 配置全部来自 GET /important-dates-reminders（公开接口）。
 */
(function () {
  var SESSION_KEY = "id-toast-closed-session";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyTemplate(tpl, r) {
    var text = tpl == null || String(tpl).trim() === "" ? "「{title}」还有 {daysUntil} 天" : String(tpl);
    return text
      .replace(/\{title\}/g, esc(r.title))
      .replace(/\{daysUntil\}/g, String(r.daysUntil))
      .replace(/\{dateText\}/g, esc(r.dateText || ""))
      .replace(/\{nextSolarDate\}/g, esc(r.nextSolarDate || ""));
  }

  function positionStyle(pos) {
    var map = {
      "top-right": "top:16px;right:16px;",
      "top-left": "top:16px;left:16px;",
      "bottom-left": "bottom:16px;left:16px;",
      "bottom-center": "bottom:16px;left:50%;transform:translateX(-50%);",
      "center": "top:50%;left:50%;transform:translate(-50%,-50%);",
      "bottom-right": "bottom:16px;right:16px;"
    };
    return map[pos] || map["bottom-right"];
  }

  function show(d) {
    if (!d || d.toastEnabled === false) return;
    try {
      if (window.sessionStorage && sessionStorage.getItem(SESSION_KEY)) return;
    } catch (e) {}
    var items = d.reminders || [];
    var body;
    if (items.length) {
      body = items.map(function (r) {
        return '<div>' + applyTemplate(d.toastTemplate, r) + "</div>";
      }).join("");
    } else {
      var emptyText = d.toastEmptyText == null ? "" : String(d.toastEmptyText);
      if (!emptyText) return;
      body = '<div>' + esc(emptyText) + "</div>";
    }
    var title = d.toastTitle == null || String(d.toastTitle) === "" ? "重要日期提醒" : String(d.toastTitle);
    var box = document.createElement("div");
    box.id = "id-toast-box";
    box.setAttribute("role", "alert");
    box.style.cssText =
      "position:fixed;z-index:999999;max-width:360px;min-width:220px;background:#fff7ed;" +
      "border:1px solid #fdba74;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.22);" +
      "padding:12px 40px 12px 16px;font-size:14px;color:#9a3412;font-family:inherit;" +
      "opacity:0;transition:opacity .3s;" +
      positionStyle(d.toastPosition);
    box.innerHTML =
      '<div style="font-weight:600;margin-bottom:4px;">' + esc(title) + "</div>" +
      '<div style="line-height:1.9;">' + body + "</div>" +
      '<span style="position:absolute;top:8px;right:10px;cursor:pointer;opacity:.6;' +
      'font-size:18px;line-height:1;" aria-label="关闭">×</span>';
    document.body.appendChild(box);
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch (e) {}
      box.style.opacity = "0";
      setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
      }, 320);
    }
    box.querySelector("span").addEventListener("click", close);
    requestAnimationFrame(function () {
      box.style.opacity = "1";
    });
    var secs = Number(d.toastCloseSeconds);
    if (secs > 0) setTimeout(close, secs * 1000);
  }

  function load() {
    var run = function () {
      fetch("/important-dates-reminders")
        .then(function (r) {
          return r.json();
        })
        .then(show)
        .catch(function () {});
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  load();
})();
