/**
 * 重要日期 · 全站悬浮提醒
 * 由 plugin-important-dates 维护（系统设置 → 代码注入 → 全局 head 标签），
 * 配置全部来自 GET /important-dates-reminders（公开接口）。
 *
 * 关闭行为（配置化）：
 *   - 点 × 弹出「关闭方式」菜单（本次关闭 / 今天不再提示 / N 天内不显示），5 秒不选按站主默认关闭行为
 *   - 「本次关闭」只收起当前弹窗；其余选项记录在 localStorage，到期自动恢复
 *   - 没有「永久不再提示」：静音总是有期限，避免访客手一滑就再也收不到提醒
 *   - 可选的「N 天」由服务端下发（toastDurations，来自插件设置），改设置不用改脚本
 */
(function () {
  // 便于排查：浏览器控制台执行 window.__ID_TOAST_VERSION 即可确认当前跑的是哪一版脚本
  window.__ID_TOAST_VERSION = "140";
  var KEY_UNTIL = "id-toast-until";
  /** 1.3.1 及更早版本写下的「永久静音」标记：现在不再支持，读到就清掉 */
  var KEY_FOREVER_LEGACY = "id-toast-forever";
  /** 提示频率记录（按访客浏览器计）：上次弹出的时间戳、当天已弹次数与当天日期 */
  var KEY_LAST_SHOWN = "id-toast-last";
  var KEY_DAY = "id-toast-day";
  /** 设置里没给或给坏了时候的兜底时长（天） */
  var FALLBACK_DURATIONS = [3, 5, 7, 30];
  var MENU_TIMEOUT_MS = 5000;

  /** 规范化服务端下发的时长列表：只保留 1–365 的整数，去重、升序。 */
  function normalizeDurations(list) {
    var raw = Object.prototype.toString.call(list) === "[object Array]" ? list : FALLBACK_DURATIONS;
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var n = Number(raw[i]);
      if (!isFinite(n)) continue;
      n = Math.floor(n);
      if (n < 1 || n > 365) continue;
      if (out.indexOf(n) === -1) out.push(n);
    }
    if (!out.length) out = FALLBACK_DURATIONS.slice();
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  /** 菜单内容：本次关闭、今天不再提示，加上设置里挑的时长（没有任何「永久」项）。 */
  function buildMenuItems(durations) {
    var items = [
      { label: "本次关闭", value: "once" },
      { label: "今天不再提示", value: "today" }
    ];
    durations.forEach(function (d) {
      items.push({ label: d + " 天内不显示", value: "d" + d });
    });
    return items;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** 取配置里的文本，空白/缺失时用兜底值 */
  function value(v, fallback) {
    return v == null || String(v).trim() === "" ? fallback : String(v);
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

  /** 是否仍处于"关闭期"（按时长判断；过期的自动清理）。 */
  function isDismissed() {
    // 老版本可能留下过「永久静音」标记：直接清掉，否则这些人会以为自己被永久拉黑了
    if (lsGet(KEY_FOREVER_LEGACY) !== null) {
      lsRemove(KEY_FOREVER_LEGACY);
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

  /**
   * 按选择执行关闭：
   *   once      只收起当前弹窗，不记录
   *   today     撑到当地当天 24 点
   *   d<N>      N 天内不再提示
   * 认不出来的选择一律按「本次关闭」处理，绝不能变成永久静音。
   */
  function applyDismiss(choice, hide) {
    if (choice === "today") {
      var end = new Date();
      end.setHours(24, 0, 0, 0);
      lsSet(KEY_UNTIL, String(end.getTime()));
    } else {
      var m = /^d(\d+)$/.exec(String(choice || ""));
      var days = m ? Number(m[1]) : 0;
      if (days >= 1) {
        lsSet(KEY_UNTIL, String(Date.now() + days * 86400000));
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
  function showCloseMenu(box, defaultChoice, hide, durations) {
    var items = buildMenuItems(durations);
    var menu = document.createElement("div");
    menu.style.cssText =
      "position:absolute;right:8px;top:0;transform:translateY(calc(-100% - 6px));" +
      "background:#fff7ed;border:1px solid #fdba74;border-radius:10px;" +
      "box-shadow:0 6px 18px rgba(0,0,0,.25);padding:4px;min-width:150px;" +
      "z-index:9;font-size:13px;color:#9a3412;";
    var list = document.createElement("div");
    items.forEach(function (item, idx) {
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

  /**
   * 弹出悬浮提示。
   *
   * @returns {boolean} 是否**真的弹出来了**。调用方只应在返回 true 时回报"已提醒"，
   *   否则会在"被关闭期拦住 / 无内容"时白白消耗掉一个提醒节点（用户什么都没看到，
   *   却再也收不到这个节点的提醒了）。
   */
  function show(d) {
    if (!d || d.toastEnabled === false) return false;
    if (isDismissed()) return false;
    var items = d.reminders || [];
    var body;
    if (items.length) {
      // 服务端已给出人性化文案（节点式，逐日不同）时直接用；否则回退到模板。
      // 座驾项可能带 groupTotal：同一辆车的其余到期项被折叠了，补一句「共 N 项」，
      // 免得用户以为这辆车只有这一件事。
      body = items.map(function (r) {
        var line = r.text ? esc(r.text) : applyTemplate(d.toastTemplate, r);
        var total = Number(r.groupTotal) || 0;
        if (total > 1) {
          line += ' <span style="opacity:.7;font-size:12px;">（这辆车共 ' + total + " 项到期）</span>";
        }
        return "<div>" + line + "</div>";
      }).join("");
    } else {
      var emptyText = d.toastEmptyText == null ? "" : String(d.toastEmptyText);
      if (!emptyText) return false;
      body = '<div>' + esc(emptyText) + "</div>";
    }
    var title = d.toastTitle == null || String(d.toastTitle) === "" ? "重要日期提醒" : String(d.toastTitle);
    var box = document.createElement("div");
    box.id = "id-toast-box";
    // 用 status 而不是 alert：这是提醒不是报错，读屏软件不该打断用户正在听的内容
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    box.style.cssText =
      "position:fixed;z-index:999999;max-width:360px;min-width:220px;background:#fff7ed;" +
      "border:1px solid #fdba74;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.22);" +
      "padding:12px 40px 12px 16px;font-size:14px;color:#9a3412;font-family:inherit;" +
      "opacity:0;transition:opacity .3s;" +
      positionStyle(d.toastPosition);
    // 被"每类最多 N 条"裁掉的项数：不说出来的话，用户不知道自己看到的是残缺的
    var overflow = Number(d.overflowCount) || 0;
    // 详情页：点弹窗任意位置可以去「记得」页看全部。管理员进后台，访客进前台的「记得」页
    var moreText = value(d.toastMoreText, "点这里看全部");
    var moreHref = value(d.toastMoreUrl, "/important-dates");
    var more = overflow > 0
      ? '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #fdba74;opacity:.8;">还有 ' +
        overflow + " 项</div>"
      : "";
    box.innerHTML =
      '<div style="font-weight:600;margin-bottom:4px;">' + esc(title) + "</div>" +
      '<div style="line-height:1.9;">' + body + "</div>" +
      more +
      '<div style="margin-top:6px;font-size:12px;">' +
      '<a href="' + esc(moreHref) + '" style="color:#c2410c;text-decoration:underline;">' + esc(moreText) + "</a></div>" +
      // 用真正的 <button>：可 Tab 聚焦、可回车触发，读屏软件也能正确朗读
      '<button type="button" id="id-toast-close" class="id-toast-close" aria-label="关闭提醒" title="关闭提醒"' +
      ' style="position:absolute;top:8px;right:10px;cursor:pointer;opacity:.6;border:0;background:transparent;' +
      'color:inherit;font:inherit;font-size:18px;line-height:1;padding:2px 4px;">×</button>';
    document.body.appendChild(box);
    // 关闭按钮用固定的 id/class 定位，不要靠「第一个 span」这类结构选择器：
    // 正文里一旦新增 span（比如「这辆车共 N 项到期」），结构选择器就会点到别的东西上。
    var closeBtn = box.querySelector("#id-toast-close");
    var closed = false;
    function hide() {
      if (closed) return;
      closed = true;
      if (countdownTimer) clearInterval(countdownTimer);
      document.removeEventListener("keydown", onKeydown);
      box.style.opacity = "0";
      setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
      }, 320);
    }
    var defaultChoice = d.toastDefaultClose || "once";
    var menuEnabled = d.toastCloseMenu !== false;
    var durations = normalizeDurations(d.toastDurations);
    closeBtn.addEventListener("click", function () {
      if (menuEnabled) {
        // 有菜单：点 × 先给选择，5 秒未选则按默认行为执行
        showCloseMenu(box, defaultChoice, hide, durations);
      } else {
        // 没有菜单：点 × 只是收起当前这个弹窗（默认关闭行为里也没有「永久」可选了，
        // 但仍然不在这里套用默认行为 —— 访客点一下就没反应、也看不出发生了什么，
        // 只会表现为"刷新一次之后就再也不弹了"）。
        hide();
      }
    });
    // Esc 只收起当前弹窗，不写任何静音记录：按键盘的习惯动作不该产生"以后都不提醒我"的后果
    function onKeydown(e) {
      if (e.key === "Escape" || e.key === "Esc") {
        hide();
      }
    }
    document.addEventListener("keydown", onKeydown);
    requestAnimationFrame(function () {
      box.style.opacity = "1";
    });
    // 自动关闭倒计时：秒数文字 + 底部进度条
    var countdownTimer = null;
    var secs = Number(d.toastCloseSeconds);
    if (secs > 0) {
      box.style.paddingBottom = "22px";
      var cdText = document.createElement("div");
      cdText.style.cssText =
        "position:absolute;left:16px;right:40px;bottom:6px;font-size:11px;" +
        "opacity:.55;color:#9a3412;text-align:right;line-height:1;";
      var cdBar = document.createElement("div");
      cdBar.style.cssText =
        "position:absolute;left:0;bottom:0;height:3px;background:#f97316;" +
        "opacity:.55;border-radius:0 0 0 14px;width:100%;transition:width 1s linear;";
      var left = secs;
      cdText.textContent = left + " 秒后自动收起";
      box.appendChild(cdText);
      box.appendChild(cdBar);
      countdownTimer = setInterval(function () {
        left -= 1;
        if (left <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          return;
        }
        cdText.textContent = left + " 秒后自动收起";
        cdBar.style.width = Math.round((left / secs) * 100) + "%";
      }, 1000);
      setTimeout(hide, secs * 1000);
    }
    return true;
  }

  /**
   * 弹窗里「看全部」要跳去哪。
   * 正在看后台的话（网址以 /console 开头）就去后台「记得」，否则去前台「记得」页；
   * 服务端也允许用 toastMoreUrl 覆盖成别的地址（比如主题自定义页面）。
   */
  function moreUrl(d) {
    var custom = d.toastMoreUrl == null ? "" : String(d.toastMoreUrl).trim();
    if (custom) return custom;
    var inConsole = location.pathname.indexOf("/console") === 0;
    return inConsole ? "/console/important-dates" : "/important-dates";
  }

  /** 今天（当地日期）的标识，用于判断"当天已弹次数"是否过期 */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  /**
   * 提示频率是否允许现在弹（由页主设置，记录在本浏览器）：
   *   every    每次都弹（不限制）
   *   daily    当天最多 N 次（跨天自动清零）
   *   interval 距上次弹出至少 N 分钟
   */
  function frequencyAllows(d) {
    var mode = d.toastFrequency || "every";
    var n = Number(d.toastFrequencyN);
    if (!isFinite(n) || n < 1) n = 1;
    if (mode === "daily") {
      if (lsGet(KEY_DAY) !== todayKey()) return true;   // 新的一天，计数作废
      return Number(lsGet(KEY_LAST_SHOWN + "-count") || 0) < n;
    }
    if (mode === "interval") {
      var last = Number(lsGet(KEY_LAST_SHOWN) || 0);
      return !last || (Date.now() - last) >= n * 60000;
    }
    return true;
  }

  /** 记录"刚刚弹过一次"（只在弹窗确实显示之后调用） */
  function markShown() {
    var today = todayKey();
    var count = lsGet(KEY_DAY) === today ? Number(lsGet(KEY_LAST_SHOWN + "-count") || 0) : 0;
    lsSet(KEY_DAY, today);
    lsSet(KEY_LAST_SHOWN + "-count", String(count + 1));
    lsSet(KEY_LAST_SHOWN, String(Date.now()));
  }

  function load() {
    var run = function () {
      // 数据实时取自 /important-dates-reminders（公开 GET，匿名可访问），
      // 服务端总是给出"进入提醒期且尚未写库标记"的完整清单。
      // 弹窗是否真的显示，由下面的频率限制 + 关闭期共同决定，全部记在访客浏览器；
      // 服务端不做任何"交付即记账"，否则用户没看到也会被判为已弹过。
      fetch("/important-dates-reminders?ts=" + Date.now(), { credentials: "same-origin" })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          if (!d || d.toastEnabled === false) return;
          var items = d.toastItems || [];
          if (!items.length) return;
          // 提示频率（页主设置）：every 每次都弹 / daily 每天最多 N 次 / interval 每 N 分钟最多一次
          if (!frequencyAllows(d)) return;
          if (show({
            toastPosition: d.toastPosition,
            toastTitle: d.toastTitle,
            toastTemplate: d.toastTemplate,
            toastEmptyText: d.toastEmptyText,
            toastCloseSeconds: d.toastCloseSeconds,
            toastDefaultClose: d.toastDefaultClose,
            toastCloseMenu: d.toastCloseMenu,
            toastDurations: d.toastDurations,
            // 被裁掉的条数 + 详情入口（默认：管理员进后台「记得」，访客进前台「记得」页）
            overflowCount: d.overflowCount,
            toastMoreText: d.toastMoreText,
            toastMoreUrl: moreUrl(d),
            reminders: items
          })) {
            markShown();
          }
        })
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
