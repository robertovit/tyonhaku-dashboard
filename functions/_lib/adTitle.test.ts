import { describe, expect, it, vi } from "vitest";
import { allowedAdUrl, extractTitle, fetchAd, linkedinJobId, parseLinkedinPosting } from "./adTitle";

const page = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });
const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
/** A fake fetch that answers with the given responses in order and records the URLs asked. */
function via(...rs: Response[]) {
  const urls: string[] = [];
  const f = (async (u: string) => (urls.push(u), rs.shift() ?? new Response("", { status: 500 }))) as unknown;
  return { f: f as typeof fetch, urls };
}
const GUEST = `<section><h2 class="top-card-layout__title font-sans">Data-analyytikko &amp; kehittäjä</h2>
  <a class="topcard__org-name-link topcard__flavor--black-link" href="x">
     Esimerkki Oy
  </a></section>`;

describe("ad lookup", () => {
  it("accepts only https links to known job sites", () => {
    expect(allowedAdUrl("https://www.linkedin.com/jobs/view/123")?.hostname).toBe("www.linkedin.com");
    expect(allowedAdUrl("https://duunitori.fi/tyopaikat/tyo/x-1")).not.toBeNull();
    for (const bad of [
      "http://www.linkedin.com/jobs/view/123",
      "https://linkedin.com.evil.example/x",
      "https://evil-linkedin.com/x",
      "https://localhost/x",
      "https://www.linkedin.com:8443/x",
      "https://user@www.linkedin.com/x",
      "javascript:alert(1)",
      "",
      null,
    ])
      expect(allowedAdUrl(bad)).toBeNull();
  });

  it("reads og:title or <title> and decodes entities", () => {
    expect(extractTitle('<meta property="og:title" content="Analyytikko - Esimerkki &amp; Co - Duunitori">')).toBe(
      "Analyytikko - Esimerkki & Co - Duunitori",
    );
    expect(extractTitle('<meta content="Rooli at Yritys" property="og:title">')).toBe("Rooli at Yritys");
    expect(extractTitle("<title>\n  Data &#8211; Tiimi&#x21;\n</title>")).toBe("Data – Tiimi!");
    expect(extractTitle("<p>ei otsikkoa</p>")).toBe("");
  });

  it("finds the LinkedIn job id and reads the guest posting", () => {
    const id = (s: string) => linkedinJobId(new URL(s));
    expect(id("https://www.linkedin.com/jobs/view/4493123456/")).toBe("4493123456");
    expect(id("https://fi.linkedin.com/jobs/view/data-analyst-at-esimerkki-4493123456?trk=x")).toBe("4493123456");
    expect(id("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4493123456")).toBe("4493123456");
    expect(id("https://www.linkedin.com/in/someone")).toBeNull();
    expect(id("https://duunitori.fi/jobs/view/4493123456")).toBeNull();
    expect(parseLinkedinPosting(GUEST)).toEqual({ role: "Data-analyytikko & kehittäjä", org: "Esimerkki Oy" });
    expect(parseLinkedinPosting("<p>tyhjä</p>")).toEqual({ role: "", org: "" });
  });

  it("asks LinkedIn's guest posting first, then the page", async () => {
    const start = allowedAdUrl("https://www.linkedin.com/jobs/view/4493123456/")!;
    const ok = via(page(GUEST));
    expect(await fetchAd(start, ok.f)).toEqual({
      title: "",
      role: "Data-analyytikko & kehittäjä",
      org: "Esimerkki Oy",
      reason: "",
    });
    expect(ok.urls).toEqual(["https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4493123456"]);

    const fallback = via(new Response("", { status: 403 }), page("<title>Rooli at Yritys | LinkedIn</title>"));
    expect(await fetchAd(start, fallback.f)).toEqual({
      title: "Rooli at Yritys | LinkedIn",
      role: "",
      org: "",
      reason: "",
    });

    const blocked = via(new Response("", { status: 403 }), new Response("", { status: 403 }));
    expect((await fetchAd(start, blocked.f)).reason).toBe("www.linkedin.com vastasi 403");
  });

  it("retries a 429 once, then gives up without asking the page", async () => {
    vi.useFakeTimers();
    try {
      const start = allowedAdUrl("https://www.linkedin.com/jobs/view/4493123456/")!;
      const limited = () => new Response("", { status: 429 });
      const lucky = via(limited(), page(GUEST));
      const got = fetchAd(start, lucky.f);
      await vi.runAllTimersAsync();
      expect((await got).role).toBe("Data-analyytikko & kehittäjä");
      expect(lucky.urls).toHaveLength(2);

      const unlucky = via(limited(), limited(), page("<title>ei haeta</title>"));
      const none = fetchAd(start, unlucky.f);
      await vi.runAllTimersAsync();
      expect((await none).reason).toBe("www.linkedin.com vastasi 429");
      expect(unlucky.urls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("follows redirects only to known sites, and not to a login wall", async () => {
    const start = allowedAdUrl("https://duunitori.fi/tyopaikat/tyo/x-1")!;
    const title = async (...rs: Response[]) => {
      const r = await fetchAd(start, via(...rs).f);
      return [r.title, r.reason];
    };
    expect(await title(redirect("https://www.duunitori.fi/x"), page("<title>T</title>"))).toEqual(["T", ""]);
    expect(await title(redirect("https://evil.example/"), page("<title>X</title>"))).toEqual([
      "",
      "ohjaus osoitteeseen evil.example",
    ]);
    expect(await title(redirect("https://www.linkedin.com/authwall?trk=x"))).toEqual([
      "",
      "www.linkedin.com vaatii kirjautumisen",
    ]);
  });
});
