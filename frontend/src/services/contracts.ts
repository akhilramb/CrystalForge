// Response shapes shared by the material and prediction screens.
export type Vector = [number, number, number];

export interface MaterialSummary {
  preferred_structure_mp_id: string | null;
  id: string;
  formula: string;
  working_ion: string;
  crystal_system: string | null;
  space_group_number: number | null;
  predicted_voltage: number | null;
  cost: number | null;
  sustainability: number | null;
  e_above_hull: number | null;
}

export interface EconomicsResult {
  cost: number | null;
  sustainability: number | null;
  cost_method: string;
  sustainability_method: string;
  critical_elements: string[];
  scarcity_risk: string | null;
  missing_prices: string[];
  missing_abundance: string[];
  breakdown: {
    element: string;
    mass_fraction: number;
    price: number | null;
    contribution: number | null;
    source: string | null;
    price_status: string;
  }[];
}

export interface Material extends MaterialSummary {
  bravais_lattice: string | null;
  materials_project_structure_url: string | null;
  interval?: [number, number];
  model_version?: string;
  capacity_grav: number | null;
  capacity_vol: number | null;
  band_gap: number | null;
  target_voltage: number | null;
  formation_energy_per_atom: number | null;
  max_delta_volume: number | null;
  source_provenance: string | null;
  battery_id: string;
  formula_charge: string | null;
  formula_discharge: string;
  data_split: string;
  economics: EconomicsResult;
}

export interface MaterialPage {
  items: MaterialSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface SimilarMaterial extends MaterialSummary {
  similarity: number;
  feature_distance: number;
}

export interface PredictionInput {
  formula: string;
  working_ion: string;
  crystal_system: string | null;
  space_group_number: number | null;
  frac_discharge?: number | null;
}

export interface PredictionResponse {
  id?: string;
  formula: string;
  working_ion: string;
  crystal_system: string | null;
  space_group_number: number | null;
  predicted_voltage: number;
  interval: [number, number];
  model_version?: string;
  history_id?: number | null;
  economics: EconomicsResult;
  similar: SimilarMaterial[];
  warnings?: string[];
}

export type CrystalGeometry = {
  lattice: [Vector, Vector, Vector];
  sites: { element: string; position: Vector }[];
};

export type StructureResponse =
  | { available: false; message: string; source_url?: string }
  | (CrystalGeometry & {
      available: true;
      material_id: string;
      formula: string;
      lengths: number[];
      angles: number[];
      volume: number;
      symmetry: {
        crystal_system: string;
        space_group: string;
        space_group_number: number;
      } | null;
      source_url: string;
      provenance: { source: string; method: "local_cif" | "cache" | "api"; retrieved_at: string | null };
    });
