import { describe, expect, it } from "vitest";
import { dayDiff, deadlineIso } from "./dates";
import { milestoneProgress } from "./game";
import { appsText, deadlineLabel, savedText, sentLabel, waitLabel } from "./labels";

const today = "2026-11-27";
const label = (end: string) => {
  const deadline = deadlineIso({ d: today, end });
  return deadlineLabel(end, deadline, deadline ? dayDiff(today, deadline) : null);
};

describe("deadline and waiting texts", () => {
  it("says how long a saved ad stays open", () => {
    expect(label("30.11.")).toEqual({ text: "Haku päättyy 3 pv päästä", date: "30.11.", tone: "urgent" });
    expect(label("9.12.")).toMatchObject({ text: "Haku päättyy 12 pv päästä", tone: "soon" });
    expect(label("28.11.")).toMatchObject({ text: "Haku päättyy huomenna", tone: "urgent" });
    expect(label("27.11.")).toMatchObject({ text: "Haku päättyy tänään", tone: "urgent" });
  });
  it("tells an ended search and one without a date apart", () => {
    expect(label("20.11.")).toEqual({ text: "Haku päättyi 20.11.", date: "", tone: "past" });
    expect(label("jatkuva haku")).toEqual({ text: "Määräaika: jatkuva haku", date: "", tone: "none" });
    expect(label("")).toEqual({ text: "Ei määräaikaa", date: "", tone: "none" });
  });
  it("counts the wait in days", () => {
    expect(waitLabel(47)).toBe("Odottanut 47 pv");
  });
});

describe("application milestone progress", () => {
  it("shows the next milestone, or the last one once all are reached", () => {
    expect(milestoneProgress(0)).toMatchObject({ milestone: { id: "first", required: 1 }, done: false });
    expect(milestoneProgress(23)).toMatchObject({ milestone: { id: "quarter", required: 25 }, total: 23, done: false });
    expect(milestoneProgress(25)).toMatchObject({ milestone: { id: "fifty", name: "Puolisataa" }, done: false });
    expect(milestoneProgress(61)).toMatchObject({ milestone: { id: "hundred", required: 100 }, done: false });
    expect(milestoneProgress(150)).toMatchObject({ milestone: { id: "twohundred", required: 200 }, done: false });
    expect(milestoneProgress(205)).toMatchObject({ milestone: { id: "twohundred" }, total: 205, done: true });
  });
});

describe("log and status texts", () => {
  it("formats the send date and counts", () => {
    expect(sentLabel("2026-11-03")).toBe("Haettu 3.11.");
    expect(appsText(1)).toBe("1 hakemus");
    expect(appsText(12)).toBe("12 hakemusta");
    expect(savedText(1)).toBe("1 tallennettu paikka");
    expect(savedText(3)).toBe("3 tallennettua paikkaa");
  });
});
