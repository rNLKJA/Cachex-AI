import { describe, expect, it } from "vitest";

import { localDateStamp } from "./download";

describe("localDateStamp", () => {
  it("uses the local calendar date, zero-padded", () => {
    expect(localDateStamp(new Date(2026, 0, 5, 9, 0))).toBe("2026-01-05");
    expect(localDateStamp(new Date(2026, 9, 6, 5, 25))).toBe("2026-10-06");
  });

  it("keeps the local date just after local midnight", () => {
    // Any UTC offset ahead of UTC would give the previous day via toISOString().
    expect(localDateStamp(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
    expect(localDateStamp(new Date(2027, 0, 1, 0, 0, 1))).toBe("2027-01-01");
  });

  it("differs from the UTC date when the offset crosses midnight", () => {
    const prev = process.env.TZ;
    process.env.TZ = "Australia/Adelaide";
    try {
      // 05:25 on 6 October in Adelaide (UTC+10:30) is still 5 October in UTC.
      const d = new Date("2026-10-05T18:55:00Z");
      expect(d.toISOString().slice(0, 10)).toBe("2026-10-05");
      expect(localDateStamp(d)).toBe("2026-10-06");
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  });
});
