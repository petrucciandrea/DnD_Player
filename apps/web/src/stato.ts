import type { Dispatch, SetStateAction } from "react";
import type { CharacterData } from "@dnd/regole/tipi.ts";

// Aggiornamento della scheda: l'unico stato di CharacterData sta in App.
export type SetChar = Dispatch<SetStateAction<CharacterData>>;
