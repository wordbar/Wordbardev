/* Bridges the existing global lexical PHONICS table into the explicit v16
   runtime dependency. Kept separate so phonics.js remains byte-identical. */
(function exposeWordBarPhonics(global){
  "use strict";
  global.WordBarPhonics=typeof PHONICS!=="undefined"?PHONICS:Object.freeze({});
})(window);
