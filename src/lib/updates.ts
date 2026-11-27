// Keeps the installed app on the latest version. Android keeps the app's page alive in the background, so the
// service worker can install a new version while the old page keeps running. Here: look for an update whenever
// the app comes to the front, and reload once the new version has taken over, unless a dialog is open (an
// unsaved entry would be lost); then reload the next time the app comes to the front.
export function watchForUpdates() {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  const hadController = !!sw.controller; // on the very first install there is nothing old to replace
  let pending = false;
  const reloadWhenIdle = () => {
    if (document.querySelector("dialog[open]")) pending = true;
    else location.reload();
  };
  sw.addEventListener("controllerchange", () => {
    if (hadController) reloadWhenIdle();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (pending) return reloadWhenIdle();
    void sw
      .getRegistration()
      .then((r) => r?.update())
      .catch(() => {});
  });
}
