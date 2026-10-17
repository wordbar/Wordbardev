/* Structured en-GB pronunciation adapter for the v16 experiment.
 *
 * The existing PHONICS object is child-friendly respelling data.  This layer
 * makes its structure explicit and keeps reviewed British corrections separate
 * from unvalidated legacy rows.  It performs no filesystem or browser access.
 */

export const REVIEWED_EN_GB = Object.freeze({
  docile: "DOH-syle",
  fragile: "FRAJ-yle",
  servile: "SER-vyle",
  hostile: "HOS-tyle",
  futile: "FYOO-tyle",
  volatile: "VOL-uh-tyle",
  temporary: "TEM-puh-ruh-ree",
  area: "AIR-ree-uh",
  idea: "eye-DEE-uh",
  radio: "RAY-dee-oh",
  video: "VID-ee-oh",
  trial: "TRY-uhl",
  genius: "JEE-nee-uhs",
  poem: "POH-uhm",
  propriety: "pruh-PRY-uh-tee",
  /* Correct the legacy uh-nee boundary: the n closes the un- syllable. */
  unemotional: "UN-ih-MOH-shuh-nuhl",
  /* Batch S8b: bounded Everyday residual. These are pronunciation evidence,
     not segmentation answers; the same pattern/scoring engine places cuts. */
  against: "uh-GENST",
  alphabet: "AL-fuh-bet",
  ambulance: "AM-byuh-luhns",
  animal: "AN-ih-muhl",
  around: "uh-ROUND",
  audience: "AW-dee-uhns",
  autumn: "AW-tuhm",
  balcony: "BAL-kuh-nee",
  banana: "buh-NAH-nuh",
  battery: "BAT-uh-ree",
  bracelet: "BRAYS-lit",
  broken: "BROH-kuhn",
  camera: "KAM-uh-ruh",
  caravan: "KARR-uh-van",
  centimetre: "SEN-tih-mee-tuh",
  chocolate: "CHOK-lit",
  chuckle: "CHUK-uhl",
  cinema: "SIN-uh-muh",
  colour: "KUL-uh",
  cousin: "KUZ-uhn",
  diamond: "DY-muhnd",
  dragon: "DRAG-uhn",
  elephant: "EL-ih-fuhnt",
  eleven: "ih-LEV-uhn",
  famous: "FAY-muhs",
  finish: "FIN-ish",
  forest: "FOR-ist",
  frozen: "FROH-zuhn",
  garage: "GARR-ahzh",
  guitar: "gih-TAR",
  helicopter: "HEL-ih-kop-tuh",
  holiday: "HOL-ih-day",
  hoover: "HOO-vuh",
  hospital: "HOS-pih-tuhl",
  however: "how-EV-uh",
  legend: "LEJ-uhnd",
  lizard: "LIZ-uhd",
  mechanic: "muh-KAN-ik",
  melody: "MEL-uh-dee",
  mobile: "MOH-byle",
  modern: "MOD-uhn",
  mushroom: "MUSH-room",
  mystery: "MIS-tuh-ree",
  ninety: "NYN-tee",
  orange: "OR-inj",
  palace: "PAL-is",
  palette: "PAL-it",
  parent: "PAIR-uhnt",
  penguin: "PEN-gwin",
  pigeon: "PIJ-uhn",
  pirate: "PY-ruht",
  planet: "PLAN-it",
  police: "puh-LEES",
  potato: "puh-TAY-toh",
  princess: "PRIN-ses",
  radiator: "RAY-dee-ay-tuh",
  relative: "REL-uh-tiv",
  sailor: "SAY-luh",
  sausage: "SOS-ij",
  scientist: "SY-uhn-tist",
  season: "SEE-zuhn",
  second: "SEK-uhnd",
  seventy: "SEV-uhn-tee",
  several: "SEV-uh-ruhl",
  shadow: "SHAD-oh",
  shorts: "SHORTS",
  shovel: "SHUV-uhl",
  similar: "SIM-ih-luh",
  slippery: "SLIP-uh-ree",
  sometimes: "SUM-tymz",
  souvenir: "soo-vuh-NEER",
  spider: "SPY-duh",
  thousand: "THOW-zuhnd",
  toilet: "TOY-luht",
  tomato: "tuh-MAH-toh",
  tourist: "TOO-rist",
  towards: "tuh-WORDZ",
  trainers: "TRAY-nuhz",
  travel: "TRAV-uhl",
  trousers: "TROW-zuhz",
  violin: "vy-uh-LIN",
  visitor: "VIZ-ih-tuh",
  wizard: "WIZ-uhd"
});

function normaliseWord(value) {
  const word = String(value ?? "").trim().toLowerCase();
  return /^[a-z]+$/.test(word) ? word : "";
}

function parseSyllables(respelling) {
  return String(respelling || "").split("-").filter(Boolean).map((text, index) =>
    Object.freeze({
      index,
      text,
      normalised: text.toLowerCase(),
      stressed: /[A-Z]/.test(text)
    })
  );
}

export function createPronunciationProvider(legacyPronunciations, reviewed = REVIEWED_EN_GB) {
  if (!legacyPronunciations || typeof legacyPronunciations !== "object") {
    throw new TypeError("createPronunciationProvider requires the WordBar pronunciation map");
  }

  function get(value) {
    const word = normaliseWord(value);
    if (!word) return null;
    const isReviewed = Object.prototype.hasOwnProperty.call(reviewed, word);
    const respelling = isReviewed ? reviewed[word] : legacyPronunciations[word];
    if (!respelling) return null;
    const syllables = parseSyllables(respelling);
    if (!syllables.length) return null;
    return Object.freeze({
      schemaVersion: 1,
      word,
      dialect: "en-GB",
      respelling,
      syllables,
      syllableCount: syllables.length,
      source: isReviewed ? "reviewed-en-GB" : "legacy-respelling",
      validated: isReviewed
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    dialect: "en-GB",
    get,
    reviewedWords: Object.freeze(Object.keys(reviewed).sort())
  });
}
