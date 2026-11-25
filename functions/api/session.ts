// Opened as a page after the Access session has expired: Access shows its login first,
// then this sends the browser back to the app. Never served from the service worker cache.
export const onRequestGet: PagesFunction = ({ request }) =>
  Response.redirect(new URL("/", request.url).toString(), 302);
