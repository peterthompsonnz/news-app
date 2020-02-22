// Make sure sws are supported
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw-cached-pages.js")
      .then(reg => console.log("Service Worker: Registered (Pages)"))
      .catch(err => console.log(`Service Worker: Error: ${err}`));
  });
}
