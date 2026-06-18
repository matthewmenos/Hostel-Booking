export const PUBLIC_UNIVERSITIES = [
  { value: "UG",        label: "University of Ghana, Legon" },
  { value: "KNUST",     label: "Kwame Nkrumah University of Science and Technology (KNUST)" },
  { value: "UCC",       label: "University of Cape Coast (UCC)" },
  { value: "UDS",       label: "University for Development Studies (UDS)" },
  { value: "UEW",       label: "University of Education, Winneba (UEW)" },
  { value: "UPSA",      label: "University of Professional Studies, Accra (UPSA)" },
  { value: "UHAS",      label: "University of Health and Allied Sciences (UHAS)" },
  { value: "UESD",      label: "University of Environment and Sustainable Development (UESD)" },
  { value: "CKTCUTAS",  label: "C.K. Tedam University of Technology and Applied Sciences (CKT-UTAS)" },
  { value: "SDDBIDS",   label: "SD Dombo University of Business and Integrated Development Studies (SDD-UBIDS)" },
  { value: "AAMUSTED",  label: "Akenten Appiah-Menka University of Skills Training and Entrepreneurial Development (AAMUSTED)" },
  { value: "UMAT",      label: "University of Mines and Technology (UMaT)" },
  { value: "GIMPA",     label: "Ghana Institute of Management and Public Administration (GIMPA)" },
  { value: "ATU",       label: "Accra Technical University" },
  { value: "HTU",       label: "Ho Technical University" },
  { value: "KTU",       label: "Kumasi Technical University" },
  { value: "CCTU",      label: "Cape Coast Technical University" },
  { value: "STU",       label: "Sunyani Technical University" },
  { value: "TTTU",      label: "Tamale Technical University" },
  { value: "TATU",      label: "Takoradi Technical University" },
  { value: "WTU",       label: "Wa Technical University" },
  { value: "KofTU",     label: "Koforidua Technical University" },
  { value: "BTU",       label: "Bolgatanga Technical University" },
];

export const PRIVATE_UNIVERSITIES = [
  { value: "ASHESI",    label: "Ashesi University" },
  { value: "CENTRAL",   label: "Central University" },
  { value: "VVU",       label: "Valley View University" },
  { value: "GCUC",      label: "Ghana Christian University College" },
  { value: "MUG",       label: "Methodist University Ghana" },
  { value: "TTS",       label: "Trinity Theological Seminary" },
  { value: "REGENT",    label: "Regent University College of Science and Technology" },
  { value: "PACU",      label: "Pan-African Christian University College" },
  { value: "ACC",       label: "Academic City College" },
  { value: "WIUC",      label: "Wisconsin International University College" },
  { value: "GCTU",      label: "Ghana Communication Technology University (GCTU)" },
  { value: "CUCG",      label: "Catholic University College of Ghana" },
  { value: "PUCG",      label: "Presbyterian University College Ghana" },
  { value: "PU",        label: "Pentecost University" },
  { value: "HCC",       label: "Heritage Christian College" },
  { value: "AIT",       label: "Accra Institute of Technology (AIT)" },
  { value: "BLUECREST", label: "BlueCrest University College" },
  { value: "ANOVA",     label: "ANova Education" },
  { value: "MOUNT",     label: "Mountcrest University College" },
  { value: "DOMINION",  label: "Dominion University College" },
  { value: "ANU",       label: "All Nations University" },
  { value: "GBUC",      label: "Ghana Baptist University College" },
  { value: "ZENITH",    label: "Zenith University College" },
  { value: "SPIRITAN",  label: "Spiritan University College" },
  { value: "IUCG",      label: "Islamic University College Ghana" },
  { value: "LANCASTER", label: "Lancaster University Ghana" },
  { value: "WEBSTER",   label: "Webster University Ghana" },
  { value: "SMC",       label: "Swiss Management Centre (SMC) University Ghana" },
];

export const ALL_UNIVERSITIES = [
  ...PUBLIC_UNIVERSITIES,
  ...PRIVATE_UNIVERSITIES,
];

// Flat value→label map for quick lookup
export const UNIVERSITY_LABEL = Object.fromEntries(
  ALL_UNIVERSITIES.map(({ value, label }) => [value, label])
);
