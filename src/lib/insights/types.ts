export type PsdPoint = { d_nm: number; psd: number; log10: number };

export type PsdSeries = {
  id: string;
  gravity: "1g" | "0g";
  flow_cm_s: number;
  file: string;
  points: PsdPoint[];
  mode_d_nm: number;
  large_share: number;
};

export type Insights = {
  generated_at: string;
  sources: { psi_id: string; url: string; doi: string | null }[];
  smoke: {
    headline: {
      flow_cm_s: number;
      mode_d_nm_1g: number;
      mode_d_nm_0g: number;
      large_share_1g: number;
      large_share_0g: number;
      large_share_ratio: number;
      tail_cutoff_nm: number;
    };
    series: PsdSeries[];
  };
  same_materials: {
    material: string;
    air_cm_s: number | null;
    mass_loss_mg_min: number | null;
    aging_min: number | null;
  }[];
  spice_fuels: {
    fuel: string;
    n: number;
    air_min: number | null;
    air_max: number | null;
    nozzles: string[];
  }[];
  kpis: {
    curated_psi: number;
    combustion_in_index: number;
    same_materials: number;
    spice_runs: number;
    lunar_o2_increase_pct: number;
  };
};
