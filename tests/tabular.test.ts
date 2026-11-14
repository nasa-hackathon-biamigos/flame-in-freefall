import { describe, expect, it } from "vitest";
import {
  isDetectorSheet,
  mapDetectorHeaders,
  parseFileMeta,
  preferredSheets,
  skipWorkbook,
} from "../src/lib/tabular/parse";

describe("parseFileMeta", () => {
  it("reads GMT, material and run from SAME filenames", () => {
    expect(parseFileMeta("GMT276dbp37.xls")).toMatchObject({
      gmt: "276",
      material: "dibutyl_phthalate",
    });
    expect(parseFileMeta("GMT263 Run 15 DBP.xls")).toEqual({
      gmt: "263",
      run_label: "15",
      material: "dibutyl_phthalate",
    });
    expect(parseFileMeta("GMT278Lampwick46.xls").material).toBe("lampwick");
    expect(parseFileMeta("Silicone GMT255hkp run 5s.xls").material).toBe("silicone_rubber");
  });
});

describe("sheet picking", () => {
  it("skips logs, the VPRED matrix and Test.xls", () => {
    expect(skipWorkbook("Run 2 GMT254 testlog.xlsx")).toBe(true);
    expect(skipWorkbook("SAME VPRED Matrix PLN-005 Baseline.xls")).toBe(true);
    expect(skipWorkbook("Test.xls")).toBe(true);
    expect(skipWorkbook("GMT276dbp37.xls")).toBe(false);
  });

  it("prefers the averaged science sheet over housekeeping", () => {
    expect(preferredSheets(["Sheet1", "GMT276dbp37hkp", "for average"])).toEqual(["for average"]);
    expect(preferredSheets(["for averagie", "Sheet1"])).toEqual(["for averagie"]);
    expect(preferredSheets(["Graph Data", "2007_277_14.eng"])).toEqual(["Graph Data"]);
  });
});

describe("detector headers", () => {
  const headers = [
    "TimeString",
    "Time",
    "ISSDetectorObscurationMeasurement(Volts)",
    "ISSDetectorScatterMeasurement(Volts)",
    "STSDetectorMeasurement(Volts)",
    "IonDetectorAMeasurement(Volts)",
    "PTrakMeasurement(PtPerCC)/100right",
    "DustTrakAMeasurement(MgPerM3)",
  ];

  it("maps NASA detector column names", () => {
    const m = mapDetectorHeaders(headers);
    expect(m.iss_scatter_v).toBe(3);
    expect(m.ptrak_pt_per_cc).toBe(6);
    expect(m.dusttrak_a_mg_m3).toBe(7);
    expect(isDetectorSheet(headers, 10)).toBe(true);
    expect(isDetectorSheet(headers, 98)).toBe(false);
  });
});
