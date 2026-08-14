/* ============================================================
   main.js — the entry point. Boot, callback wiring, and keyboard
   shortcuts are each their own module now (boot.js,
   callback-wiring.js, keyboard-shortcuts.js) — this file just
   calls them in order.
   ============================================================ */
(function () {
  U9.Boot.run();
  U9.CallbackWiring.run();
  U9.KeyboardShortcuts.run();
})();
