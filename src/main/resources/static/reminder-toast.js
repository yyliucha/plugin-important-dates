/**
 * 重要日期 · 全站悬浮提醒
 * 由 plugin-important-dates 维护（系统设置 → 代码注入 → 全局 head 标签），
 * 配置全部来自 GET /important-dates-reminders（公开接口）。
 *
 * 关闭行为（配置化）：
 *   - 点 × 弹出「关闭方式」菜单（本次 / 3 天 / 10 天 / 永久），5 秒不选按站主默认关闭行为
 *   - 默认关闭行为由 toastDefaultClose 下发（once/1d/3d/7d/10d/30d/forever）
 *   - 「本次关闭」只收起当前弹窗；按时长/永久记录在 localStorage，到期自动恢复
 */
(function () {
  var KEY_UNTIL = "id-toast-until";
  var KEY_FOREVER = "id-toast-forever";
  var MENU_ITEMS = [
    { label: "本次关闭", value: "once" },
    { label: "3 天内不显示", value: "3d" },
    { label: "10 天内不显示", value: "10d" },
    { label: "永久关闭", value: "forever" }
  ];
  var MENU_TIMEOUT_MS = 5000;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function lsGet(k) {
    try {
      return window.localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      window.localStorage.setItem(k, v);
    } catch (e) {}
  }
  function lsRemove(k) {
    try {
      window.localStorage.removeItem(k);
    } catch (e) {}
  }

  /** 是否仍处于"关闭期"（按时长/永久记忆判断；过期的自动清理）。 */
  function isDismissed() {
    if (lsGet(KEY_FOREVER) === "1") {
      return true;
    }
    var until = Number(lsGet(KEY_UNTIL) || 0);
    if (until > 0) {
      if (until > Date.now()) {
        return true;
      }
      lsRemove(KEY_UNTIL);
    }
    return false;
  }

  /** 按选择执行关闭：once 仅收起当前弹窗；时长/永久写入 localStorage。 */
  function applyDismiss(choice, hide) {
    if (choice === "forever") {
      lsSet(KEY_FOREVER, "1");
      lsRemove(KEY_UNTIL);
    } else if (choice && choice !== "once") {
      var days = { "1d": 1, "3d": 3, "7d": 7, "10d": 10, "30d": 30 }[choice];
      if (days) {
        lsSet(KEY_UNTIL, String(Date.now() + days * 86400000));
        lsRemove(KEY_FOREVER);
      }
    }
    if (hide) {
      hide();
    }
  }

  function applyTemplate(tpl, r) {
    var text = tpl == null || String(tpl).trim() === "" ? "「{title}」{whenText}（{dateText}）" : String(tpl);
    return text
      .replace(/\{title\}/g, esc(r.title))
      .replace(/\{whenText\}/g, whenText(r))
      .replace(/\{daysUntil\}/g, String(r.daysUntil))
      .replace(/\{dateText\}/g, esc(r.dateText || ""))
      .replace(/\{nextSolarDate\}/g, esc(r.nextSolarDate || ""));
  }

  /** 按剩余天数生成贴心措辞：今天 / 明天就到 / 还有 N 天就到。 */
  function whenText(r) {
    var d = Number(r.daysUntil);
    if (d <= 0) return "就是今天呀 🎉";
    if (d === 1) return "明天就到啦～";
    return "还有 " + d + " 天就到啦～";
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

  /** 弹出「关闭方式」菜单；5 秒未选择自动按默认行为执行。 */
  function showCloseMenu(box, defaultChoice, hide) {
    var menu = document.createElement("div");
    menu.style.cssText =
      "position:absolute;right:8px;top:0;transform:translateY(calc(-100% - 6px));" +
      "background:#fff7ed;border:1px solid #fdba74;border-radius:10px;" +
      "box-shadow:0 6px 18px rgba(0,0,0,.25);padding:4px;min-width:150px;" +
      "z-index:9;font-size:13px;color:#9a3412;";
    var list = document.createElement("div");
    MENU_ITEMS.forEach(function (item, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.innerText = item.label;
      btn.style.cssText =
        "display:block;width:100%;text-align:left;border:0;background:transparent;" +
        "color:inherit;padding:7px 10px;border-radius:7px;cursor:pointer;font:inherit;" +
        (idx === 0 ? "font-weight:600;" : "");
      btn.addEventListener("mouseenter", function () { btn.style.background = "rgba(245,158,11,.15)"; });
      btn.addEventListener("mouseleave", function () { btn.style.background = "transparent"; });
      btn.addEventListener("click", function () {
        applyDismiss(item.value, hide);
      });
      list.appendChild(btn);
    });
    menu.appendChild(list);
    box.appendChild(menu);
    // 5 秒未选择 → 默认行为
    setTimeout(function () {
      if (menu.parentNode) {
        applyDismiss(defaultChoice, hide);
      }
    }, MENU_TIMEOUT_MS);
  }

  function show(d) {
    if (!d || d.toastEnabled === false) return;
    if (isDismissed()) return;
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
      'font-size:18px;line-height:1;padding:2px 4px;" aria-label="关闭">×</span>';
    document.body.appendChild(box);
    var closed = false;
    function hide() {
      if (closed) return;
      closed = true;
      box.style.opacity = "0";
      setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
      }, 320);
    }
    var defaultChoice = d.toastDefaultClose || "once";
    var menuEnabled = d.toastCloseMenu !== false;
    box.querySelector("span").addEventListener("click", function () {
      if (menuEnabled) {
        showCloseMenu(box, defaultChoice, hide);
      } else {
        applyDismiss(defaultChoice, hide);
      }
    });
    requestAnimationFrame(function () {
      box.style.opacity = "1";
    });
    var secs = Number(d.toastCloseSeconds);
    if (secs > 0) {
      setTimeout(hide, secs * 1000);
    }
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
