// Setzt Hell/Dunkel vor dem ersten Rendern, damit nichts aufblitzt.
// Logik synchron zu src/lib/farbschema.ts (wirksamesSchema, FARBSCHEMA_KEY).
(function () {
  var schema = null;
  try {
    var raw = localStorage.getItem("eierverkauf.farbschema");
    if (raw === "hell" || raw === "dunkel") schema = raw;
  } catch (e) {
    /* ohne localStorage: Systemeinstellung */
  }
  if (!schema) {
    schema = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dunkel" : "hell";
  }
  document.documentElement.dataset.theme = schema;
})();
