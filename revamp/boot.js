(function () {
  var href = window.location.href;
  var clean = new URL(href);
  if (clean.hash) {
    clean.hash = "";
    window.history.replaceState(null, "", clean);
  }
  Object.defineProperty(window, "__lynkBootTake", {
    configurable: true,
    value: function () {
      delete window.__lynkBootTake;
      return href;
    },
  });
})();
