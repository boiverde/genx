// GENX supported allele selections (mirror of CLINPGX_GENE_REGISTRY in prototype-clinpgx.html).
// Maintained for server-side safety gating, NOT a substitute for clinical allele databases.
// Tests must verify this catalogue remains in sync with the frontend.
'use strict';
module.exports = Object.freeze({
  "CYP2D6": [
    "*1",
    "*1x2",
    "*1x≥3",
    "*2",
    "*2x2",
    "*3",
    "*4",
    "*4x2",
    "*5",
    "*6",
    "*9",
    "*10",
    "*17",
    "*29",
    "*41"
  ],
  "CYP2C19": [
    "*1",
    "*2",
    "*3",
    "*4",
    "*17"
  ],
  "CYP2C9": [
    "*1",
    "*2",
    "*3",
    "*5",
    "*6",
    "*8",
    "*11"
  ],
  "CYP2B6": [
    "*1",
    "*4",
    "*6",
    "*9",
    "*18"
  ],
  "CYP3A4": [
    "*1",
    "*1B",
    "*20",
    "*22"
  ],
  "CYP3A5": [
    "*1",
    "*3",
    "*6",
    "*7"
  ],
  "SLCO1B1": [
    "*1",
    "*5",
    "*15",
    "*17",
    "*37"
  ],
  "DPYD": [
    "*1",
    "*2A",
    "*13",
    "rs67376798",
    "*7",
    "*8"
  ],
  "TPMT": [
    "*1",
    "*2",
    "*3A",
    "*3B",
    "*3C"
  ],
  "NUDT15": [
    "*1",
    "*2",
    "*3",
    "*4",
    "*5"
  ],
  "UGT1A1": [
    "*1",
    "*6",
    "*28",
    "*36",
    "*37",
    "*80"
  ],
  "ABCG2": [
    "*1",
    "*2",
    "rs2231142"
  ],
  "HLA-A": [
    "*31:01",
    "Negative"
  ],
  "HLA-B": [
    "*57:01",
    "*58:01",
    "*15:02",
    "Negative"
  ],
  "VKORC1": [
    "-1639G>A (AA)",
    "-1639G>A (GA)",
    "-1639G>A (GG)"
  ],
  "CYP4F2": [
    "*1",
    "*3"
  ],
  "G6PD": [
    "Normal",
    "Deficient (A-)",
    "Deficient (Mediterranean)"
  ],
  "NAT2": [
    "Rapid",
    "Intermediate",
    "Slow"
  ],
  "RYR1": [
    "Normal",
    "Malignant Hyperthermia Susceptible"
  ],
  "CACNA1S": [
    "Normal",
    "Malignant Hyperthermia Susceptible"
  ],
  "rs12777823": [
    "A/A",
    "A/G",
    "G/G"
  ],
  "F2": [
    "Normal (G/G)",
    "Prothrombin G20210A"
  ],
  "F5": [
    "Normal",
    "Factor V Leiden"
  ],
  "MT-RNR1": [
    "Normal",
    "m.1555A>G (Aminoglycoside Ototoxicity)"
  ],
  "CFTR": [
    "Normal",
    "F508del",
    "G551D"
  ]
});
