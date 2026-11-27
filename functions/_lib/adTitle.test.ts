import { describe, expect, it } from "vitest";
import { allowedAdUrl, extractTitle, fetchAdTitle } from "./adTitle";

describe("ad title lookup", () => {
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

  it("follows redirects only to known sites", async () => {
    const page = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });
    const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
    const via = (...rs: Response[]) => (async () => rs.shift()!) as unknown as typeof fetch;
    const start = allowedAdUrl("https://www.linkedin.com/jobs/view/1")!;
    expect(
      await fetchAdTitle(start, via(redirect("https://fi.linkedin.com/jobs/view/1"), page("<title>T</title>"))),
    ).toEqual({ title: "T", reason: "" });
    expect(await fetchAdTitle(start, via(redirect("https://evil.example/"), page("<title>X</title>")))).toEqual({
      title: "",
      reason: "ohjaus osoitteeseen evil.example",
    });
    expect(await fetchAdTitle(start, via(new Response("", { status: 403 })))).toEqual({
      title: "",
      reason: "www.linkedin.com vastasi 403",
    });
  });

  it("does not take a login wall for the ad", async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: "https://www.linkedin.com/authwall?trk=x" },
    });
    const start = allowedAdUrl("https://www.linkedin.com/jobs/view/1")!;
    expect(await fetchAdTitle(start, (async () => redirect) as unknown as typeof fetch)).toEqual({
      title: "",
      reason: "www.linkedin.com vaatii kirjautumisen",
    });
  });
});
