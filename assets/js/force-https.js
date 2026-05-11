(function () {
  var isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]";

  if (!isLocalhost && window.location.protocol === "http:") {
    window.location.replace("https://" + window.location.host + window.location.pathname + window.location.search + window.location.hash);
  }
})();
