/* gamf-touch.js — drop-in touch support for keyboard/mouse-only games.
   Inject into a fork's page with a small inline config BEFORE this script:
     <script>window.GAMF_TOUCH = {
        dpad:true, repeat:true,
        keys:{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'},
        buttons:[{label:'Rotate',key:'ArrowUp'},{label:'Drop',key:' '}],
        mouse:false
     };</script>
     <script src="gamf-touch.js"></script>
   - dpad : show an on-screen D-pad that fires KeyboardEvents (key + keyCode).
   - buttons : extra round action buttons (each {label,key}).
   - mouse : translate touch -> mouse(down/move/up)+click for drag/click games.
*/
(function () {
  var CFG = window.GAMF_TOUCH || {};
  var KEYS = CFG.keys || { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  var CODE = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32, Enter: 13, Escape: 27 };
  var NAMEDCODE = { ' ': 'Space', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Enter: 'Enter' };

  function fireKey(type, key) {
    var kc = CODE[key] != null ? CODE[key] : (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
    var ev;
    try { ev = new KeyboardEvent(type, { key: key, code: NAMEDCODE[key] || ('Key' + key.toUpperCase()), bubbles: true, cancelable: true }); }
    catch (e) { ev = document.createEvent('Event'); ev.initEvent(type, true, true); ev.key = key; }
    // many old games read keyCode/which — force them (constructor leaves them 0)
    try { Object.defineProperty(ev, 'keyCode', { get: function () { return kc; } }); } catch (e) {}
    try { Object.defineProperty(ev, 'which', { get: function () { return kc; } }); } catch (e) {}
    document.dispatchEvent(ev);
  }

  var held = {};
  function press(key) {
    if (held[key]) return; held[key] = true;
    fireKey('keydown', key);
    if (CFG.repeat) held[key + '_t'] = setInterval(function () { fireKey('keydown', key); }, 130);
  }
  function release(key) {
    if (!held[key]) return; held[key] = false;
    if (held[key + '_t']) { clearInterval(held[key + '_t']); held[key + '_t'] = null; }
    fireKey('keyup', key);
  }

  var STYLE =
  '.gxt{position:fixed;z-index:99999;bottom:max(14px,env(safe-area-inset-bottom));pointer-events:none;font-family:system-ui,sans-serif}' +
  '.gxt-dpad{left:max(12px,env(safe-area-inset-left));display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(3,56px);gap:6px}' +
  '.gxt-act{right:max(12px,env(safe-area-inset-right));display:flex;flex-direction:column-reverse;gap:10px;align-items:flex-end}' +
  '.gxt button{pointer-events:auto;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;color:#eef1f7;' +
  'background:rgba(17,20,30,.62);border:1px solid rgba(120,140,200,.35);backdrop-filter:blur(8px);border-radius:14px;' +
  'font-size:22px;font-weight:700;display:grid;place-items:center;touch-action:none;transition:transform .06s,background .12s}' +
  '.gxt button:active{transform:scale(.92);background:rgba(124,92,255,.5)}' +
  '.gxt-act button{min-width:64px;height:56px;border-radius:28px;padding:0 16px;font-size:14px;letter-spacing:.02em}' +
  '.gxt-u{grid-area:1/2}.gxt-l{grid-area:2/1}.gxt-r{grid-area:2/3}.gxt-d{grid-area:3/2}';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function bindHold(btn, key) {
    btn.addEventListener('pointerdown', function (e) { e.preventDefault(); press(key); });
    var up = function (e) { e.preventDefault(); release(key); };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
  }

  function buildDpad() {
    var style = el('style'); style.textContent = STYLE; document.head.appendChild(style);
    if (CFG.dpad) {
      var pad = el('div', 'gxt gxt-dpad');
      [['gxt-u', KEYS.up, '▲'], ['gxt-l', KEYS.left, '◀'], ['gxt-r', KEYS.right, '▶'], ['gxt-d', KEYS.down, '▼']]
        .forEach(function (b) { if (!b[1]) return; var btn = el('button', b[0], b[2]); btn.setAttribute('aria-label', b[1]); bindHold(btn, b[1]); pad.appendChild(btn); });
      document.body.appendChild(pad);
    }
    if (CFG.buttons && CFG.buttons.length) {
      var act = el('div', 'gxt gxt-act');
      CFG.buttons.forEach(function (b) {
        var btn = el('button', null, b.label);
        btn.addEventListener('pointerdown', function (e) { e.preventDefault(); fireKey('keydown', b.key); });
        btn.addEventListener('pointerup', function (e) { e.preventDefault(); fireKey('keyup', b.key); });
        act.appendChild(btn);
      });
      document.body.appendChild(act);
    }
  }

  // ---- touch -> mouse passthrough (for drag/click-only games) ----
  function inUI(t) { return t && (t.closest && t.closest('.gxt')); }
  function relay(e) {
    if (!CFG.mouse) return;
    var t = e.changedTouches && e.changedTouches[0]; if (!t) return;
    var target = document.elementFromPoint(t.clientX, t.clientY) || document.body;
    if (inUI(target)) return;
    var map = { touchstart: 'mousedown', touchmove: 'mousemove', touchend: 'mouseup', touchcancel: 'mouseup' };
    var type = map[e.type]; if (!type) return;
    var me = new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY, button: 0, buttons: type === 'mouseup' ? 0 : 1 });
    target.dispatchEvent(me);
    if (type === 'mouseup') target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY }));
    if (e.cancelable) e.preventDefault();
  }

  function start() {
    if (CFG.dpad || (CFG.buttons && CFG.buttons.length)) buildDpad();
    if (CFG.mouse) {
      ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (t) {
        document.addEventListener(t, relay, { passive: false });
      });
    }
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
