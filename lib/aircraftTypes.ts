// Aircraft identity / "learn the planes" layer.
//
// A curated, offline dictionary keyed by ICAO type code (the `typeCode` we get
// from airplanes.live / adsbdb) -> friendly name, manufacturer, a spotter class,
// and a one-line recognition hint. The goal is educational: turn a raw "B738"
// into "Boeing 737-800 · narrowbody airliner · CFM engines under the wing, blade
// antenna forest on the spine" plus links out to photos and a full write-up.
//
// Coverage is the common US / Northeast fleet (~120 types). Anything not in the
// table still gets a sensible class via the ADS-B emitter category fallback, so
// the card never shows nothing.

export type AircraftClass =
  | "airliner"
  | "regional"
  | "bizjet"
  | "turboprop"
  | "piston"
  | "military"
  | "helicopter"
  | "glider"
  | "other";

export interface ClassMeta {
  label: string;
  color: string; // chip color, tuned for Sectional Night
  blurb: string; // one-liner framing the whole class, for learning
}

// Class palette borrows the hypsometric ramp's logic: GA warm-green at the
// "ground" end, airliners cool turquoise like high cruise, military topo-brown.
export const CLASS_META: Record<AircraftClass, ClassMeta> = {
  airliner: {
    label: "Airliner",
    color: "#5fb8c4",
    blurb: "Jet built to move lots of people. Two big engines slung under swept wings (or, rarely now, four).",
  },
  regional: {
    label: "Regional",
    color: "#7fb8a8",
    blurb: "Smaller airliner for short hops — regional jets and big turboprops feeding the hubs.",
  },
  bizjet: {
    label: "Business jet",
    color: "#9bb87e",
    blurb: "Private/charter jet. Engines mounted on the rear fuselage, sleek and small, often a T-tail.",
  },
  turboprop: {
    label: "Turboprop",
    color: "#b8a05e",
    blurb: "Propeller driven by a jet (turbine) engine — efficient workhorses for short and rough-field flying.",
  },
  piston: {
    label: "Light / GA",
    color: "#a8c890",
    blurb: "General-aviation piston aircraft — the small props you learn to fly in and see at every local field.",
  },
  military: {
    label: "Military",
    color: "#c98a68",
    blurb: "Armed-forces aircraft — transports, tankers, fighters, trainers, and helicopters.",
  },
  helicopter: {
    label: "Helicopter",
    color: "#c2a0c0",
    blurb: "Rotary wing — hovers and flies slow/low. Watch for hospital, police, and news traffic.",
  },
  glider: {
    label: "Glider",
    color: "#8aae6e",
    blurb: "Engineless sailplane (or a lightweight/ultralight) — long thin wings, riding lift.",
  },
  other: {
    label: "Aircraft",
    color: "#c7b89a",
    blurb: "Identity not in the reference set yet — the links below still pull photos and details.",
  },
};

export interface TypeInfo {
  name: string; // friendly, e.g. "Boeing 737-800"
  mfr: string;
  cls: AircraftClass;
  recog?: string; // how to pick it out of the sky / ramp
  wiki?: string; // explicit Wikipedia slug; otherwise we search by name
}

// Keyed by ICAO type designator (uppercase). Kept terse on purpose.
export const TYPES: Record<string, TypeInfo> = {
  // ── Boeing / Airbus narrowbody airliners ───────────────────────────────
  B737: { name: "Boeing 737-700", mfr: "Boeing", cls: "airliner", wiki: "Boeing_737_Next_Generation", recog: "Classic narrowbody; pointed nose, engines flattened at the bottom ('hamster pouch')." },
  B738: { name: "Boeing 737-800", mfr: "Boeing", cls: "airliner", wiki: "Boeing_737_Next_Generation", recog: "The everyday workhorse jet. Stretched 737, often with upturned 'split scimitar' winglets." },
  B739: { name: "Boeing 737-900", mfr: "Boeing", cls: "airliner", wiki: "Boeing_737_Next_Generation", recog: "Longest of the older 737s — same nose, even longer tube." },
  B38M: { name: "Boeing 737 MAX 8", mfr: "Boeing", cls: "airliner", wiki: "Boeing_737_MAX", recog: "Tell it from older 737s by the split 'AT' winglet and serrated engine nacelle (chevrons)." },
  B39M: { name: "Boeing 737 MAX 9", mfr: "Boeing", cls: "airliner", wiki: "Boeing_737_MAX" },
  B3XM: { name: "Boeing 737 MAX 10", mfr: "Boeing", cls: "airliner", wiki: "Boeing_737_MAX" },
  B752: { name: "Boeing 757-200", mfr: "Boeing", cls: "airliner", wiki: "Boeing_757", recog: "Tall, long, skinny on big landing gear — 'the pencil.' Powerful climber." },
  B753: { name: "Boeing 757-300", mfr: "Boeing", cls: "airliner", wiki: "Boeing_757" },
  B762: { name: "Boeing 767-200", mfr: "Boeing", cls: "airliner", wiki: "Boeing_767" },
  B763: { name: "Boeing 767-300", mfr: "Boeing", cls: "airliner", wiki: "Boeing_767", recog: "Widebody but oval, not round — two aisles inside. Common on freighters (FedEx/UPS)." },
  B764: { name: "Boeing 767-400", mfr: "Boeing", cls: "airliner", wiki: "Boeing_767" },
  B772: { name: "Boeing 777-200", mfr: "Boeing", cls: "airliner", wiki: "Boeing_777" },
  B77L: { name: "Boeing 777-200LR / F", mfr: "Boeing", cls: "airliner", wiki: "Boeing_777" },
  B77W: { name: "Boeing 777-300ER", mfr: "Boeing", cls: "airliner", wiki: "Boeing_777", recog: "Huge twin — the biggest two-engine jet. Six-wheel main gear, raked wingtips." },
  B788: { name: "Boeing 787-8 Dreamliner", mfr: "Boeing", cls: "airliner", wiki: "Boeing_787_Dreamliner", recog: "Smooth nose, no eyebrow windows; scalloped (toothed) engine cowls and gull-bent wingtips." },
  B789: { name: "Boeing 787-9 Dreamliner", mfr: "Boeing", cls: "airliner", wiki: "Boeing_787_Dreamliner" },
  B78X: { name: "Boeing 787-10 Dreamliner", mfr: "Boeing", cls: "airliner", wiki: "Boeing_787_Dreamliner" },
  B741: { name: "Boeing 747-100", mfr: "Boeing", cls: "airliner", wiki: "Boeing_747" },
  B744: { name: "Boeing 747-400", mfr: "Boeing", cls: "airliner", wiki: "Boeing_747", recog: "The original jumbo — four engines and the unmistakable upper-deck hump." },
  B748: { name: "Boeing 747-8", mfr: "Boeing", cls: "airliner", wiki: "Boeing_747-8", recog: "Newest jumbo: longer hump, raked wingtips. Mostly freighters now." },
  A318: { name: "Airbus A318", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A318" },
  A319: { name: "Airbus A319", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A320_family", recog: "Shortest A320-family jet; round nose, round engine inlets, tidy fin-tip winglets." },
  A320: { name: "Airbus A320", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A320_family", recog: "Boeing 737's rival. Rounder nose and engine inlets; sits taller, straighter stance." },
  A321: { name: "Airbus A321", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A320_family", recog: "Stretched A320 — long tube, four overwing exits per side." },
  A19N: { name: "Airbus A319neo", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A320neo_family" },
  A20N: { name: "Airbus A320neo", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A320neo_family", recog: "New-engine A320 — bigger fans and tall curved 'sharklet' wingtips." },
  A21N: { name: "Airbus A321neo", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A320neo_family" },
  A332: { name: "Airbus A330-200", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A330" },
  A333: { name: "Airbus A330-300", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A330", recog: "Widebody twin; long straight wing with a small upturned tip, round nose." },
  A339: { name: "Airbus A330-900neo", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A330neo" },
  A359: { name: "Airbus A350-900", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A350", recog: "Curved-up wingtips and a black 'mask' around the cockpit windows." },
  A35K: { name: "Airbus A350-1000", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A350" },
  A388: { name: "Airbus A380", mfr: "Airbus", cls: "airliner", wiki: "Airbus_A380", recog: "The double-decker — full-length two-storey fuselage, four engines. Unmistakable." },

  // ── Regional jets & turboprops ─────────────────────────────────────────
  E170: { name: "Embraer E170", mfr: "Embraer", cls: "regional", wiki: "Embraer_E-Jet_family" },
  E75L: { name: "Embraer E175", mfr: "Embraer", cls: "regional", wiki: "Embraer_E-Jet_family", recog: "Ubiquitous regional jet; underwing engines, sharp pointed nose, swept fin." },
  E75S: { name: "Embraer E175 (short wing)", mfr: "Embraer", cls: "regional", wiki: "Embraer_E-Jet_family" },
  E190: { name: "Embraer E190", mfr: "Embraer", cls: "regional", wiki: "Embraer_E-Jet_family" },
  E195: { name: "Embraer E195", mfr: "Embraer", cls: "regional", wiki: "Embraer_E-Jet_family" },
  E290: { name: "Embraer E190-E2", mfr: "Embraer", cls: "regional", wiki: "Embraer_E-Jet_E2_family" },
  E295: { name: "Embraer E195-E2", mfr: "Embraer", cls: "regional", wiki: "Embraer_E-Jet_E2_family" },
  E135: { name: "Embraer ERJ 135", mfr: "Embraer", cls: "regional", wiki: "Embraer_ERJ_family" },
  E145: { name: "Embraer ERJ 145", mfr: "Embraer", cls: "regional", wiki: "Embraer_ERJ_family", recog: "Skinny early regional jet; rear-mounted engines, low T-ish tail, only 50 seats." },
  CRJ2: { name: "Bombardier CRJ200", mfr: "Bombardier", cls: "regional", wiki: "Bombardier_CRJ100/200", recog: "Tube-like 50-seater; rear engines, pointed nose, T-tail. The classic 'commuter jet.'" },
  CRJ7: { name: "Bombardier CRJ700", mfr: "Bombardier", cls: "regional", wiki: "Bombardier_CRJ700_series" },
  CRJ9: { name: "Bombardier CRJ900", mfr: "Bombardier", cls: "regional", wiki: "Bombardier_CRJ700_series", recog: "Stretched CRJ; rear engines + T-tail, extra exits over the wing." },
  CRJX: { name: "Bombardier CRJ1000", mfr: "Bombardier", cls: "regional", wiki: "Bombardier_CRJ700_series" },
  BCS1: { name: "Airbus A220-100", mfr: "Airbus", cls: "regional", wiki: "Airbus_A220", recog: "Quiet, modern; big geared-fan engines under a high-tech wing, droop-snoot nose." },
  BCS3: { name: "Airbus A220-300", mfr: "Airbus", cls: "regional", wiki: "Airbus_A220" },
  DH8D: { name: "De Havilland Dash 8 Q400", mfr: "De Havilland Canada", cls: "regional", wiki: "De_Havilland_Canada_Dash_8", recog: "High-wing twin turboprop; tall stalky gear, big six-blade props, T-tail. Fast for a prop." },
  DH8A: { name: "De Havilland Dash 8-100", mfr: "De Havilland Canada", cls: "regional", wiki: "De_Havilland_Canada_Dash_8" },
  AT72: { name: "ATR 72", mfr: "ATR", cls: "regional", wiki: "ATR_72", recog: "High-wing turboprop; engines hung high on the wing, slim fuselage, square fin." },
  AT76: { name: "ATR 72-600", mfr: "ATR", cls: "regional", wiki: "ATR_72" },
  AT45: { name: "ATR 42", mfr: "ATR", cls: "regional", wiki: "ATR_42" },
  SF34: { name: "Saab 340", mfr: "Saab", cls: "regional", wiki: "Saab_340" },
  E45X: { name: "Embraer ERJ 145XR", mfr: "Embraer", cls: "regional", wiki: "Embraer_ERJ_family" },

  // ── Business jets ──────────────────────────────────────────────────────
  C25A: { name: "Cessna CitationJet CJ2", mfr: "Cessna", cls: "bizjet", wiki: "Cessna_CitationJet/CJ_series" },
  C25B: { name: "Cessna CitationJet CJ3", mfr: "Cessna", cls: "bizjet", wiki: "Cessna_CitationJet/CJ_series" },
  C25C: { name: "Cessna CitationJet CJ4", mfr: "Cessna", cls: "bizjet", wiki: "Cessna_CitationJet/CJ_series", recog: "Small light jet; rear engines, straight-ish wing, oval windows. Entry-level business jet." },
  C56X: { name: "Cessna Citation Excel / XLS", mfr: "Cessna", cls: "bizjet", wiki: "Cessna_Citation_Excel", recog: "Best-selling midsize Citation; rear engines, T-tail, stand-up cabin." },
  C68A: { name: "Cessna Citation Latitude", mfr: "Cessna", cls: "bizjet", wiki: "Cessna_Citation_Latitude" },
  C700: { name: "Cessna Citation Longitude", mfr: "Cessna", cls: "bizjet", wiki: "Cessna_Citation_Longitude" },
  C750: { name: "Cessna Citation X", mfr: "Cessna", cls: "bizjet", wiki: "Cessna_Citation_X", recog: "Sleek and very fast; sharply swept wing, the speed king of business jets." },
  GLF4: { name: "Gulfstream IV", mfr: "Gulfstream", cls: "bizjet", wiki: "Gulfstream_IV" },
  GLF5: { name: "Gulfstream V", mfr: "Gulfstream", cls: "bizjet", wiki: "Gulfstream_V" },
  GLF6: { name: "Gulfstream G650", mfr: "Gulfstream", cls: "bizjet", wiki: "Gulfstream_G650", recog: "Big long-range jet; tall T-tail, round oval windows in a row. The exec heavyweight." },
  GLF7: { name: "Gulfstream G700", mfr: "Gulfstream", cls: "bizjet", wiki: "Gulfstream_G700" },
  GALX: { name: "Gulfstream G200 / Galaxy", mfr: "Gulfstream", cls: "bizjet", wiki: "IAI_Galaxy" },
  G280: { name: "Gulfstream G280", mfr: "Gulfstream", cls: "bizjet", wiki: "Gulfstream_G280" },
  LJ35: { name: "Learjet 35", mfr: "Learjet", cls: "bizjet", wiki: "Learjet_35" },
  LJ45: { name: "Learjet 45", mfr: "Learjet", cls: "bizjet", wiki: "Learjet_45", recog: "Small and quick; tip-tanks or sharp winglets, low-set rear engines. The original 'bizjet.'" },
  LJ60: { name: "Learjet 60", mfr: "Learjet", cls: "bizjet", wiki: "Learjet_60" },
  LJ75: { name: "Learjet 75", mfr: "Learjet", cls: "bizjet", wiki: "Learjet_75" },
  CL30: { name: "Bombardier Challenger 300/350", mfr: "Bombardier", cls: "bizjet", wiki: "Bombardier_Challenger_300", recog: "Wide-body 'super-midsize'; flat oval fuselage, winglets, rear engines." },
  CL35: { name: "Bombardier Challenger 350", mfr: "Bombardier", cls: "bizjet", wiki: "Bombardier_Challenger_300" },
  CL60: { name: "Bombardier Challenger 600/605", mfr: "Bombardier", cls: "bizjet", wiki: "Bombardier_Challenger_600_series", recog: "Fat-fuselage widebody bizjet; the airframe behind the CRJ regional jets." },
  GL5T: { name: "Bombardier Global 5000", mfr: "Bombardier", cls: "bizjet", wiki: "Bombardier_Global_Express" },
  GL7T: { name: "Bombardier Global 7500", mfr: "Bombardier", cls: "bizjet", wiki: "Bombardier_Global_7500", recog: "Ultra-long-range flagship; very long fuselage, four cabin zones, swept wing." },
  GLEX: { name: "Bombardier Global Express", mfr: "Bombardier", cls: "bizjet", wiki: "Bombardier_Global_Express" },
  F2TH: { name: "Dassault Falcon 2000", mfr: "Dassault", cls: "bizjet", wiki: "Dassault_Falcon_2000" },
  FA7X: { name: "Dassault Falcon 7X", mfr: "Dassault", cls: "bizjet", wiki: "Dassault_Falcon_7X", recog: "French tri-jet — THREE rear engines (one in the tail). A Falcon giveaway." },
  FA8X: { name: "Dassault Falcon 8X", mfr: "Dassault", cls: "bizjet", wiki: "Dassault_Falcon_8X" },
  FA50: { name: "Dassault Falcon 50", mfr: "Dassault", cls: "bizjet", wiki: "Dassault_Falcon_50", recog: "Tri-jet bizjet — three tail engines, the earlier Falcon shape." },
  F900: { name: "Dassault Falcon 900", mfr: "Dassault", cls: "bizjet", wiki: "Dassault_Falcon_900" },
  E50P: { name: "Embraer Phenom 100", mfr: "Embraer", cls: "bizjet", wiki: "Embraer_Phenom_100" },
  E55P: { name: "Embraer Phenom 300", mfr: "Embraer", cls: "bizjet", wiki: "Embraer_Phenom_300", recog: "Top-selling light jet; clean lines, winglets, oval windows. Very common on charter apps." },
  E545: { name: "Embraer Praetor 500", mfr: "Embraer", cls: "bizjet", wiki: "Embraer_Praetor" },
  E55L: { name: "Embraer Legacy 450 / Praetor", mfr: "Embraer", cls: "bizjet", wiki: "Embraer_Legacy_450" },
  BE40: { name: "Beechjet 400 / Hawker 400", mfr: "Beechcraft", cls: "bizjet", wiki: "Beechcraft_Beechjet" },
  H25B: { name: "Hawker 800 / 850", mfr: "Hawker", cls: "bizjet", wiki: "Hawker_800" },
  HDJT: { name: "HondaJet HA-420", mfr: "Honda", cls: "bizjet", wiki: "Honda_HA-420_HondaJet", recog: "Unique: engines mounted ON TOP of the wings, not the fuselage. Nothing else looks like it." },
  PC24: { name: "Pilatus PC-24", mfr: "Pilatus", cls: "bizjet", wiki: "Pilatus_PC-24", recog: "'Super versatile jet' — rugged light jet that lands on short/gravel strips, big cargo door." },

  // ── GA turboprops & utility ────────────────────────────────────────────
  PC12: { name: "Pilatus PC-12", mfr: "Pilatus", cls: "turboprop", wiki: "Pilatus_PC-12", recog: "Single big turboprop; pointed spinner, sweptback fin, winglets. Popular owner-flown & air ambulance." },
  TBM7: { name: "Daher TBM 700", mfr: "Daher / Socata", cls: "turboprop", wiki: "Socata_TBM" },
  TBM8: { name: "Daher TBM 850", mfr: "Daher / Socata", cls: "turboprop", wiki: "Socata_TBM" },
  TBM9: { name: "Daher TBM 900/960", mfr: "Daher", cls: "turboprop", wiki: "Socata_TBM", recog: "Fast single-engine turboprop; sleek, winglets, looks like a scaled-down jet up front." },
  BE20: { name: "Beechcraft King Air 200", mfr: "Beechcraft", cls: "turboprop", wiki: "Beechcraft_King_Air", recog: "Twin turboprop, T-tail; the most common business turboprop you'll see." },
  BE9L: { name: "Beechcraft King Air 90", mfr: "Beechcraft", cls: "turboprop", wiki: "Beechcraft_King_Air" },
  B350: { name: "Beechcraft King Air 350", mfr: "Beechcraft", cls: "turboprop", wiki: "Beechcraft_Super_King_Air", recog: "Stretched King Air with winglets — twin props, T-tail, the bigger sibling." },
  C208: { name: "Cessna 208 Caravan", mfr: "Cessna", cls: "turboprop", wiki: "Cessna_208_Caravan", recog: "High-wing single turboprop on fixed gear; often a belly cargo pod. Skydive & freight favorite." },
  C20T: { name: "Cessna 208B Grand Caravan", mfr: "Cessna", cls: "turboprop", wiki: "Cessna_208_Caravan" },
  KODI: { name: "Daher Kodiak 100", mfr: "Daher / Quest", cls: "turboprop", wiki: "Quest_Kodiak" },
  DHC6: { name: "De Havilland Twin Otter", mfr: "De Havilland Canada", cls: "turboprop", wiki: "De_Havilland_Canada_DHC-6_Twin_Otter", recog: "High strut-braced wing, twin props, fixed gear — rugged bush/island hopper." },
  PC6T: { name: "Pilatus PC-6 Porter", mfr: "Pilatus", cls: "turboprop", wiki: "Pilatus_PC-6_Porter" },
  EPIC: { name: "Epic E1000", mfr: "Epic", cls: "turboprop", wiki: "Epic_E1000" },

  // ── GA pistons ─────────────────────────────────────────────────────────
  C152: { name: "Cessna 152", mfr: "Cessna", cls: "piston", wiki: "Cessna_152", recog: "Tiny two-seat trainer; high wing, fixed gear. Smaller sibling of the 172." },
  C172: { name: "Cessna 172 Skyhawk", mfr: "Cessna", cls: "piston", wiki: "Cessna_172", recog: "THE trainer — high wing, strut-braced, fixed tricycle gear. The most-built aircraft ever." },
  C72R: { name: "Cessna 172RG Cutlass", mfr: "Cessna", cls: "piston", wiki: "Cessna_172" },
  C82R: { name: "Cessna 182RG", mfr: "Cessna", cls: "piston", wiki: "Cessna_182_Skylane" },
  C182: { name: "Cessna 182 Skylane", mfr: "Cessna", cls: "piston", wiki: "Cessna_182_Skylane", recog: "Beefier high-wing single than the 172 — bigger engine, often a step up for owners." },
  C210: { name: "Cessna 210 Centurion", mfr: "Cessna", cls: "piston", wiki: "Cessna_210", recog: "High-wing single with RETRACTABLE gear and no wing strut — fast cross-country Cessna." },
  C206: { name: "Cessna 206 Stationair", mfr: "Cessna", cls: "piston", wiki: "Cessna_206" },
  P28A: { name: "Piper PA-28 Cherokee / Archer", mfr: "Piper", cls: "piston", wiki: "Piper_PA-28_Cherokee", recog: "LOW wing single, fixed gear — the low-wing answer to the Cessna 172. Stubby 'Hershey-bar' wing." },
  PA28: { name: "Piper PA-28 Cherokee", mfr: "Piper", cls: "piston", wiki: "Piper_PA-28_Cherokee" },
  P32R: { name: "Piper PA-32R Saratoga", mfr: "Piper", cls: "piston", wiki: "Piper_PA-32R" },
  PA32: { name: "Piper PA-32 Cherokee Six", mfr: "Piper", cls: "piston", wiki: "Piper_PA-32_Cherokee_Six" },
  PA34: { name: "Piper PA-34 Seneca", mfr: "Piper", cls: "piston", wiki: "Piper_PA-34_Seneca", recog: "Low-wing TWIN piston; counter-rotating props. Common multi-engine trainer." },
  PA44: { name: "Piper PA-44 Seminole", mfr: "Piper", cls: "piston", wiki: "Piper_PA-44_Seminole", recog: "Low-wing twin trainer with a T-tail — flight schools use it for multi-engine ratings." },
  SR20: { name: "Cirrus SR20", mfr: "Cirrus", cls: "piston", wiki: "Cirrus_SR20" },
  SR22: { name: "Cirrus SR22", mfr: "Cirrus", cls: "piston", wiki: "Cirrus_SR22", recog: "Modern composite single; low wing, sleek, fixed gear — and a whole-plane parachute. Best-selling GA plane." },
  S22T: { name: "Cirrus SR22T (turbo)", mfr: "Cirrus", cls: "piston", wiki: "Cirrus_SR22" },
  DA40: { name: "Diamond DA40 Star", mfr: "Diamond", cls: "piston", wiki: "Diamond_DA40", recog: "Sleek composite single; long thin glider-like wings, T-tail, bubble canopy." },
  DA42: { name: "Diamond DA42 Twin Star", mfr: "Diamond", cls: "piston", wiki: "Diamond_DA42", recog: "Slim diesel TWIN; very long thin wings, T-tail — looks like a powered glider." },
  DA62: { name: "Diamond DA62", mfr: "Diamond", cls: "piston", wiki: "Diamond_DA62" },
  BE36: { name: "Beechcraft A36 Bonanza", mfr: "Beechcraft", cls: "piston", wiki: "Beechcraft_Bonanza", recog: "Fast low-wing single, retractable gear. (V-tail models are the iconic forked-tail 'Bonanza.')" },
  BE33: { name: "Beechcraft Debonair / Bonanza 33", mfr: "Beechcraft", cls: "piston", wiki: "Beechcraft_Bonanza" },
  BE35: { name: "Beechcraft V35 Bonanza", mfr: "Beechcraft", cls: "piston", wiki: "Beechcraft_Bonanza", recog: "The classic V-TAIL — two tail surfaces in a V instead of the usual three. Instantly recognizable." },
  BE58: { name: "Beechcraft Baron 58", mfr: "Beechcraft", cls: "piston", wiki: "Beechcraft_Baron", recog: "Low-wing piston twin, retractable gear — the twin-engine Bonanza." },
  BE55: { name: "Beechcraft Baron 55", mfr: "Beechcraft", cls: "piston", wiki: "Beechcraft_Baron" },
  M20P: { name: "Mooney M20", mfr: "Mooney", cls: "piston", wiki: "Mooney_M20", recog: "Low-wing speedster; the dead giveaway is the vertical-leading-edge tail (looks 'backwards')." },
  BE76: { name: "Beechcraft Duchess", mfr: "Beechcraft", cls: "piston", wiki: "Beechcraft_Duchess" },
  RV7: { name: "Van's RV-7", mfr: "Van's Aircraft", cls: "piston", wiki: "Van's_Aircraft_RV-7", recog: "Homebuilt; small, sporty, low wing, bubble canopy. The kit-plane you'll see most." },
  RV10: { name: "Van's RV-10", mfr: "Van's Aircraft", cls: "piston", wiki: "Van's_Aircraft_RV-10" },

  // ── Helicopters ────────────────────────────────────────────────────────
  R22: { name: "Robinson R22", mfr: "Robinson", cls: "helicopter", wiki: "Robinson_R22", recog: "Tiny two-seat trainer helo; skinny tail, teetering two-blade rotor." },
  R44: { name: "Robinson R44", mfr: "Robinson", cls: "helicopter", wiki: "Robinson_R44", recog: "Four-seat piston helo — the most common civil helicopter. Slim, two-blade rotor." },
  R66: { name: "Robinson R66", mfr: "Robinson", cls: "helicopter", wiki: "Robinson_R66" },
  B06: { name: "Bell 206 JetRanger", mfr: "Bell", cls: "helicopter", wiki: "Bell_206", recog: "Classic news/charter helo; rounded nose, slim tailboom, two-blade rotor." },
  B407: { name: "Bell 407", mfr: "Bell", cls: "helicopter", wiki: "Bell_407", recog: "Four-blade development of the JetRanger — common EMS and police helo." },
  B429: { name: "Bell 429", mfr: "Bell", cls: "helicopter", wiki: "Bell_429" },
  EC30: { name: "Airbus H125 / AS350", mfr: "Airbus Helicopters", cls: "helicopter", wiki: "Eurocopter_AS350_%C3%89cureuil", recog: "'Squirrel' utility helo; sleek, single engine, three-blade rotor. Tour & utility favorite." },
  AS50: { name: "Airbus AS350 Écureuil", mfr: "Airbus Helicopters", cls: "helicopter", wiki: "Eurocopter_AS350_%C3%89cureuil" },
  EC35: { name: "Airbus H135", mfr: "Airbus Helicopters", cls: "helicopter", wiki: "Eurocopter_EC135", recog: "Twin-engine EMS helo; ducted 'fenestron' tail rotor (a fan in the fin, no exposed tail blade)." },
  EC45: { name: "Airbus H145", mfr: "Airbus Helicopters", cls: "helicopter", wiki: "Eurocopter_EC145", recog: "Bigger twin EMS/utility helo; rear clamshell doors, often a hospital or police machine." },
  A139: { name: "Leonardo AW139", mfr: "Leonardo", cls: "helicopter", wiki: "AgustaWestland_AW139", recog: "Sleek medium twin; retractable gear — offshore, VIP, and police work." },
  S76: { name: "Sikorsky S-76", mfr: "Sikorsky", cls: "helicopter", wiki: "Sikorsky_S-76", recog: "Fast executive/EMS twin; retractable gear, swept tail fin." },
  S92: { name: "Sikorsky S-92", mfr: "Sikorsky", cls: "helicopter", wiki: "Sikorsky_S-92" },

  // ── Common military ────────────────────────────────────────────────────
  H60: { name: "Sikorsky UH-60 Black Hawk", mfr: "Sikorsky", cls: "military", wiki: "Sikorsky_UH-60_Black_Hawk", recog: "Army utility helo; low flat body, canted tail rotor, often in pairs at low level." },
  C130: { name: "Lockheed C-130 Hercules", mfr: "Lockheed", cls: "military", wiki: "Lockheed_C-130_Hercules", recog: "Four-turboprop tactical transport; high wing, rear ramp, fat fuselage. The workhorse." },
  C30J: { name: "Lockheed C-130J Super Hercules", mfr: "Lockheed", cls: "military", wiki: "Lockheed_Martin_C-130J_Super_Hercules" },
  C17: { name: "Boeing C-17 Globemaster III", mfr: "Boeing", cls: "military", wiki: "Boeing_C-17_Globemaster_III", recog: "Huge four-jet airlifter; high wing with winglets, T-tail, rear ramp." },
  K35R: { name: "Boeing KC-135 Stratotanker", mfr: "Boeing", cls: "military", wiki: "Boeing_KC-135_Stratotanker", recog: "Air-refueling tanker on the old 707 airframe; four engines, flying boom under the tail." },
  KC35: { name: "Boeing KC-135 Stratotanker", mfr: "Boeing", cls: "military", wiki: "Boeing_KC-135_Stratotanker" },
  F16: { name: "General Dynamics F-16 Fighting Falcon", mfr: "General Dynamics", cls: "military", wiki: "General_Dynamics_F-16_Fighting_Falcon", recog: "Single-engine fighter; bubble canopy, belly air intake, single tail. Fast, tight turns." },
  F15: { name: "McDonnell Douglas F-15 Eagle", mfr: "Boeing", cls: "military", wiki: "McDonnell_Douglas_F-15_Eagle", recog: "Twin-tail, twin-engine air-superiority fighter; big rectangular intakes, broad wing." },
  F18: { name: "Boeing F/A-18 Hornet", mfr: "Boeing", cls: "military", wiki: "McDonnell_Douglas_F/A-18_Hornet", recog: "Twin canted tails, twin engines — carrier fighter, often Navy/Marines." },
  F35: { name: "Lockheed F-35 Lightning II", mfr: "Lockheed Martin", cls: "military", wiki: "Lockheed_Martin_F-35_Lightning_II", recog: "Single-engine stealth fighter; faceted angular shape, twin canted tails, chiseled nose." },
  A10: { name: "Fairchild A-10 Thunderbolt II", mfr: "Fairchild Republic", cls: "military", wiki: "Fairchild_Republic_A-10_Thunderbolt_II", recog: "'Warthog' — twin engines mounted high at the rear, twin tails, straight wing. Flies low and slow." },
  P8: { name: "Boeing P-8 Poseidon", mfr: "Boeing", cls: "military", wiki: "Boeing_P-8_Poseidon", recog: "737-based sub hunter; looks like a 737 but with a sensor-laden belly and no cabin windows." },
  E3CF: { name: "Boeing E-3 Sentry (AWACS)", mfr: "Boeing", cls: "military", wiki: "Boeing_E-3_Sentry", recog: "707 airframe with a giant rotating radar disc (rotodome) on its back." },
  C5M: { name: "Lockheed C-5 Galaxy", mfr: "Lockheed", cls: "military", wiki: "Lockheed_C-5_Galaxy", recog: "One of the largest aircraft — high wing, T-tail, upward-hinging nose. Four jets." },
  V22: { name: "Bell-Boeing V-22 Osprey", mfr: "Bell / Boeing", cls: "military", wiki: "Bell_Boeing_V-22_Osprey", recog: "Tiltrotor — giant props on wingtips that swivel up to hover. Half plane, half helicopter." },
  AH64: { name: "Boeing AH-64 Apache", mfr: "Boeing", cls: "military", wiki: "Boeing_AH-64_Apache", recog: "Attack helo; tandem stepped cockpits, stub wings with weapons, nose sensor turret." },
  CH47: { name: "Boeing CH-47 Chinook", mfr: "Boeing", cls: "military", wiki: "Boeing_CH-47_Chinook", recog: "Tandem-rotor heavy-lift helo — two big rotors front and back, no tail rotor." },
  T6: { name: "Beechcraft T-6 Texan II", mfr: "Beechcraft", cls: "military", wiki: "Beechcraft_T-6_Texan_II", recog: "Single turboprop military trainer; tandem cockpit under a long canopy." },
  T38: { name: "Northrop T-38 Talon", mfr: "Northrop", cls: "military", wiki: "Northrop_T-38_Talon", recog: "Slim supersonic jet trainer; tiny wings, twin engines, tandem seats." },

  // ── Gliders / light ────────────────────────────────────────────────────
  GLID: { name: "Glider / Sailplane", mfr: "Various", cls: "glider", recog: "Very long, thin wings; no engine noise. Soars on thermals and ridge lift." },
  ULAC: { name: "Ultralight", mfr: "Various", cls: "glider", recog: "Very light, slow, minimal aircraft — often open-frame. Flies low and gentle." },
  BALL: { name: "Balloon", mfr: "Various", cls: "other", recog: "Lighter-than-air; drifts with the wind, no forward control." },
};

// Map ICAO emitter category (ADS-B `category`, e.g. "A3") -> a fallback class,
// used when the exact type isn't in the table so the chip is never empty.
function classFromEmitter(cat: string | null): AircraftClass | null {
  if (!cat) return null;
  const c = cat.toUpperCase();
  switch (c) {
    case "A1": return "piston"; // light (<15,500 lb)
    case "A2": return "turboprop"; // small — turboprops/light jets
    case "A3": return "airliner"; // large
    case "A4": return "airliner"; // high-vortex large (757)
    case "A5": return "airliner"; // heavy
    case "A6": return "military"; // high performance (>5g, >400 kt)
    case "A7": return "helicopter"; // rotorcraft
    case "B1": return "glider";
    case "B2": return "other"; // lighter-than-air
    case "B4": return "glider"; // ultralight
    default: return null;
  }
}

export interface Identity {
  cls: AircraftClass;
  meta: ClassMeta;
  info: TypeInfo | null; // null when only the class is known (fallback)
  name: string; // best human name we can offer
  recog: string | null; // recognition hint if we have one
}

interface IdentityInput {
  typeCode: string | null;
  description: string | null; // free text from airplanes.live, e.g. "CESSNA 172"
  category: string | null; // ADS-B emitter category
  isMilitary: boolean;
}

// Resolve the best identity we can: exact type from the table, else a class from
// the military flag / emitter category, with the raw description as the name.
export function identify(ac: IdentityInput): Identity {
  const code = ac.typeCode?.trim().toUpperCase();
  const info = code ? TYPES[code] ?? null : null;

  let cls: AircraftClass;
  if (info) cls = info.cls;
  else if (ac.isMilitary) cls = "military";
  else cls = classFromEmitter(ac.category) ?? "other";

  const name =
    info?.name ||
    titleCase(ac.description) ||
    code ||
    "Unknown aircraft";

  return {
    cls,
    meta: CLASS_META[cls],
    info,
    name,
    recog: info?.recog ?? null,
  };
}

// "CESSNA 172 Skyhawk" comes through SHOUTING from the feed — gentle it down.
function titleCase(s: string | null): string | null {
  if (!s) return null;
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, ch: string) => ch.toUpperCase())
    .replace(/\b([A-Z])(\d)/g, (m) => m.toUpperCase()); // keep model letters with digits upper-ish
}

// ── Outbound learn-more links ────────────────────────────────────────────

// Photos of THIS exact airframe (great for learning to recognize a tail number).
export function planespottersUrl(registration: string | null, hex: string): string {
  if (registration) {
    return `https://www.planespotters.net/search?q=${encodeURIComponent(registration)}`;
  }
  return `https://www.planespotters.net/hex/${encodeURIComponent(hex.toUpperCase())}`;
}

// A full write-up on the TYPE — explicit slug when we have one, else a search.
export function wikipediaUrl(info: TypeInfo | null, name: string): string {
  if (info?.wiki) return `https://en.wikipedia.org/wiki/${info.wiki}`;
  return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name + " aircraft")}`;
}
