/**
 * Approximate GPS coordinates for every campus in the Campus enum.
 * Used as a fallback when a hostel has no explicit lat/lng set.
 * Coordinates sourced from OpenStreetMap / Google Maps spot checks.
 */
export const CAMPUS_COORDS = {
  UG:        { lat:  5.6502,  lng: -0.1870,  label: "University of Ghana, Legon" },
  KNUST:     { lat:  6.6745,  lng: -1.5716,  label: "KNUST, Kumasi" },
  UCC:       { lat:  5.1077,  lng: -1.2828,  label: "University of Cape Coast" },
  UDS:       { lat:  9.4078,  lng: -0.8525,  label: "UDS, Tamale" },
  UEW:       { lat:  5.3524,  lng: -0.7304,  label: "UEW, Winneba" },
  UPSA:      { lat:  5.6395,  lng: -0.1783,  label: "UPSA, Accra" },
  UHAS:      { lat:  6.6085,  lng:  0.4668,  label: "UHAS, Ho" },
  UESD:      { lat:  6.0867,  lng: -0.3396,  label: "UESD, Somanya" },
  CKTCUTAS:  { lat: 10.7869,  lng: -1.0674,  label: "CKT-UTAS, Navrongo" },
  SDDBIDS:   { lat: 10.4952,  lng: -2.3357,  label: "SDD-UBIDS, Wa" },
  AAMUSTED:  { lat:  7.3419,  lng: -2.3301,  label: "AAMUSTED, Mampong" },
  UMAT:      { lat:  5.3553,  lng: -2.1367,  label: "UMaT, Tarkwa" },
  GIMPA:     { lat:  5.6479,  lng: -0.1759,  label: "GIMPA, Accra" },
  ATU:       { lat:  5.5530,  lng: -0.2069,  label: "Accra Technical University" },
  HTU:       { lat:  6.6009,  lng:  0.4694,  label: "Ho Technical University" },
  KTU:       { lat:  6.6896,  lng: -1.6150,  label: "Kumasi Technical University" },
  CCTU:      { lat:  5.1106,  lng: -1.2705,  label: "Cape Coast Technical University" },
  STU:       { lat:  7.3394,  lng: -2.3256,  label: "Sunyani Technical University" },
  TTTU:      { lat:  9.4055,  lng: -0.8394,  label: "Tamale Technical University" },
  TATU:      { lat:  4.8892,  lng: -1.7741,  label: "Takoradi Technical University" },
  WTU:       { lat: 10.0601,  lng: -2.5099,  label: "Wa Technical University" },
  KofTU:     { lat:  6.0965,  lng: -0.2623,  label: "Koforidua Technical University" },
  BTU:       { lat: 10.7869,  lng: -0.8511,  label: "Bolgatanga Technical University" },
  ASHESI:    { lat:  5.7601,  lng: -0.2203,  label: "Ashesi University, Berekuso" },
  CENTRAL:   { lat:  5.5484,  lng: -0.2126,  label: "Central University, Accra" },
  VVU:       { lat:  5.7585,  lng: -0.2196,  label: "Valley View University" },
  GCUC:      { lat:  5.5963,  lng: -0.2068,  label: "Ghana Christian University College" },
  MUG:       { lat:  5.5530,  lng: -0.2069,  label: "Methodist University Ghana" },
  TTS:       { lat:  5.5530,  lng: -0.2069,  label: "Trinity Theological Seminary" },
  REGENT:    { lat:  5.6395,  lng: -0.1903,  label: "Regent University" },
  PACU:      { lat:  5.5530,  lng: -0.2069,  label: "Pan-African Christian University" },
  ACC:       { lat:  5.6367,  lng: -0.1724,  label: "Academic City College" },
  WIUC:      { lat:  5.5692,  lng: -0.2253,  label: "Wisconsin International University" },
  GCTU:      { lat:  5.6395,  lng: -0.1903,  label: "GCTU, Accra" },
  CUCG:      { lat:  7.3394,  lng: -2.3256,  label: "Catholic University, Sunyani" },
  PUCG:      { lat:  6.6896,  lng: -1.6150,  label: "Presbyterian University, Kumasi" },
  PU:        { lat:  5.7601,  lng: -0.2203,  label: "Pentecost University" },
  HCC:       { lat:  5.5530,  lng: -0.2069,  label: "Heritage Christian College" },
  AIT:       { lat:  5.5693,  lng: -0.2126,  label: "Accra Institute of Technology" },
  BLUECREST: { lat:  5.6367,  lng: -0.1724,  label: "BlueCrest University" },
  ANOVA:     { lat:  5.6395,  lng: -0.1783,  label: "ANova Education" },
  MOUNT:     { lat:  5.5530,  lng: -0.2069,  label: "Mountcrest University" },
  DOMINION:  { lat:  5.5484,  lng: -0.2126,  label: "Dominion University" },
  ANU:       { lat:  6.7424,  lng: -0.0000,  label: "All Nations University, Koforidua" },
  GBUC:      { lat:  7.3394,  lng: -2.3256,  label: "Ghana Baptist University" },
  ZENITH:    { lat:  5.6395,  lng: -0.1903,  label: "Zenith University" },
  SPIRITAN:  { lat:  7.3394,  lng: -2.3256,  label: "Spiritan University" },
  IUCG:      { lat:  5.6367,  lng: -0.1724,  label: "Islamic University College Ghana" },
  LANCASTER: { lat:  5.6395,  lng: -0.1783,  label: "Lancaster University Ghana" },
  WEBSTER:   { lat:  5.6367,  lng: -0.1724,  label: "Webster University Ghana" },
  SMC:       { lat:  5.5530,  lng: -0.2069,  label: "Swiss Management Centre Ghana" },
  OTHER:     { lat:  7.9465,  lng: -1.0232,  label: "Ghana" },
};

/** Returns { lat, lng } for a hostel — explicit coords take priority, campus fallback second. */
export function resolveCoords(hostel) {
  if (hostel.latitude != null && hostel.longitude != null) {
    return { lat: hostel.latitude, lng: hostel.longitude };
  }
  return CAMPUS_COORDS[hostel.campus] ?? CAMPUS_COORDS.OTHER;
}
