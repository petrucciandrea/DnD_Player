import type {
  Arma, Armatura, BackgroundCatalogo, Caratteristica, CatalogoCreazione, CharacterData, IncantesimoCatalogo, InventoryItem,
  Privilegio, RazzaCatalogo, Spell,
} from "./tipi.ts";
import { ABILITA, CARATTERISTICHE, pfPrimoLivello } from "./regole.ts";
import { personaggioVuoto } from "./scheda.ts";
import {
  CLASSI, GIOCHI, incantesimiIniziali, STRUMENTI_ARTIGIANO, STRUMENTI_MUSICALI, type NomeClasse, type RegoleClasse,
  type VoceEquipaggiamento,
} from "./dati/classi.ts";

// Creazione di un personaggio di 1° livello (regole 2014). Funzioni pure: la procedura guidata
// (components/SchermataCreazione.tsx) raccoglie le scelte, qui si valida e si costruisce la scheda.

export interface SceltaEquipaggiamento {
  opzione: number; // indice dell'opzione scelta nel gruppo
  armi: string[]; // un'arma per ogni voce "armaAScelta" dell'opzione, nell'ordine
}

export interface SceltePersonaggio {
  razza: string;
  sottorazza: string; // "" se la razza non ne ha
  bonusAScelta: Caratteristica[]; // Mezzelfo: +1 a due caratteristiche diverse da CAR
  abilitaRazza: string[]; // Mezzelfo: due abilità a scelta
  lingueRazza: string[]; // lingue a scelta della razza
  strumentoRazza: string; // Nano: uno tra fabbro, birraio, muratore
  trucchettoRazza: string; // Alto Elfo: un trucchetto da mago

  classe: NomeClasse | "";
  sottoclasse: string; // solo per chi la sceglie al 1° livello
  abilitaClasse: string[];
  strumentiClasse: string[]; // Bardo (3 strumenti musicali), Monaco (1)

  tiri: number[][]; // sei tiri di 4d6
  assegnazione: Partial<Record<Caratteristica, number>>; // caratteristica → indice del tiro

  background: string;
  abilitaSostitutive: string[]; // se un'abilità del background è già presa
  lingueBackground: string[];
  strumentoBackground: string;

  equipaggiamento: SceltaEquipaggiamento[]; // un elemento per gruppo della classe

  trucchetti: string[];
  incantesimi: string[];

  dettagli: {
    nome: string;
    allineamento: string;
    giocatore: string;
    eta: number;
    altezza: string;
    peso: string;
    occhi: string;
    capelli: string;
    carnagione: string;
  } & CharacterData["lore"];
}

export const scelteVuote = (): SceltePersonaggio => ({
  razza: "", sottorazza: "", bonusAScelta: [], abilitaRazza: [], lingueRazza: [], strumentoRazza: "", trucchettoRazza: "",
  classe: "", sottoclasse: "", abilitaClasse: [], strumentiClasse: [],
  tiri: [], assegnazione: {},
  background: "", abilitaSostitutive: [], lingueBackground: [], strumentoBackground: "",
  equipaggiamento: [],
  trucchetti: [], incantesimi: [],
  dettagli: {
    nome: "", allineamento: "", giocatore: "", eta: 0, altezza: "", peso: "", occhi: "", capelli: "", carnagione: "",
    tratti: "", ideali: "", legami: "", difetti: "", backgroundBio: "",
  },
});

export const ALLINEAMENTI = [
  "Legale Buono", "Neutrale Buono", "Caotico Buono", "Legale Neutrale", "Neutrale", "Caotico Neutrale",
  "Legale Malvagio", "Neutrale Malvagio", "Caotico Malvagio",
];

// 4d6: si scarta il dado più basso.
export const sommaMigliori3 = (tiri: number[]) =>
  [...tiri].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);

// --- Razza ---

export const sottorazzeDi = (catalogo: CatalogoCreazione, razza: string) => catalogo.razze.filter(r => r.madre === razza);

// Razza madre e sottorazza sommate in un'unica voce.
export function razzaCompleta(catalogo: CatalogoCreazione, razza: string, sottorazza: string): RazzaCatalogo | null {
  const madre = catalogo.razze.find(r => r.nome === razza && r.madre === null);
  if (!madre) return null;
  const sotto = catalogo.razze.find(r => r.nome === sottorazza && r.madre === razza);
  if (!sotto) return madre;
  const bonus = { ...madre.bonus };
  for (const [k, v] of Object.entries(sotto.bonus) as [Caratteristica, number][]) bonus[k] = (bonus[k] ?? 0) + v;
  return {
    nome: sotto.nome, madre: madre.nome,
    taglia: sotto.taglia ?? madre.taglia, velocita: sotto.velocita ?? madre.velocita,
    bonus, bonusAScelta: madre.bonusAScelta + sotto.bonusAScelta,
    abilita: [...madre.abilita, ...sotto.abilita], abilitaAScelta: madre.abilitaAScelta + sotto.abilitaAScelta,
    lingue: [...madre.lingue, ...sotto.lingue], lingueAScelta: madre.lingueAScelta + sotto.lingueAScelta,
    armi: [...madre.armi, ...sotto.armi], armature: [...madre.armature, ...sotto.armature],
    strumentiAScelta: [...madre.strumentiAScelta, ...sotto.strumentiAScelta],
    trucchetto: sotto.trucchetto ?? madre.trucchetto,
    privilegi: [...madre.privilegi, ...sotto.privilegi],
  };
}

// Bonus alle caratteristiche della razza, compresi i +1 a scelta (Mezzelfo).
export function bonusRazziali(razza: RazzaCatalogo | null, aScelta: Caratteristica[]): Record<Caratteristica, number> {
  const bonus = Object.fromEntries(CARATTERISTICHE.map(k => [k, razza?.bonus[k] ?? 0])) as Record<Caratteristica, number>;
  for (const k of aScelta.slice(0, razza?.bonusAScelta ?? 0)) bonus[k] += 1;
  return bonus;
}

// Punteggi finali: tiro assegnato + bonus razziale (null se manca un'assegnazione).
export function punteggiFinali(s: SceltePersonaggio, razza: RazzaCatalogo | null): Record<Caratteristica, number> | null {
  const bonus = bonusRazziali(razza, s.bonusAScelta);
  const punteggi = {} as Record<Caratteristica, number>;
  for (const k of CARATTERISTICHE) {
    const i = s.assegnazione[k];
    if (i === undefined || !s.tiri[i]) return null;
    punteggi[k] = sommaMigliori3(s.tiri[i]) + bonus[k];
  }
  return punteggi;
}

// --- Competenze ---

export const strumentiTra = (tipo: "musicali" | "artigianoOMusicali" | "artigiano" | "musicale" | "gioco"): string[] =>
  tipo === "musicali" || tipo === "musicale" ? STRUMENTI_MUSICALI
    : tipo === "artigiano" ? STRUMENTI_ARTIGIANO
    : tipo === "gioco" ? GIOCHI
    : [...STRUMENTI_ARTIGIANO, ...STRUMENTI_MUSICALI];

export const listaAbilitaClasse = (r: RegoleClasse) => (r.abilita.lista === "tutte" ? ABILITA.map(a => a.id) : r.abilita.lista);

// Abilità già ottenute da razza e classe: se il background ne ripete una, se ne sceglie un'altra.
export function abilitaPrimaDelBackground(s: SceltePersonaggio, razza: RazzaCatalogo | null): string[] {
  return [...new Set([...(razza?.abilita ?? []), ...s.abilitaRazza, ...s.abilitaClasse])];
}

export const abilitaDoppie = (s: SceltePersonaggio, razza: RazzaCatalogo | null, bg: BackgroundCatalogo | null) =>
  (bg?.abilita ?? []).filter(a => abilitaPrimaDelBackground(s, razza).includes(a));

export function abilitaFinali(s: SceltePersonaggio, razza: RazzaCatalogo | null, bg: BackgroundCatalogo | null): string[] {
  const prima = abilitaPrimaDelBackground(s, razza);
  const doppie = abilitaDoppie(s, razza, bg);
  const dalBackground = (bg?.abilita ?? []).filter(a => !doppie.includes(a));
  return [...new Set([...prima, ...dalBackground, ...s.abilitaSostitutive.slice(0, doppie.length)])];
}

// --- Equipaggiamento ---

export interface EquipaggiamentoIniziale {
  armi: Arma[];
  armatura: Armatura | null;
  scudo: boolean;
  oggetti: Omit<InventoryItem, "id">[];
}

export function equipaggiamentoIniziale(
  classe: RegoleClasse, scelte: SceltaEquipaggiamento[], bg: BackgroundCatalogo | null, catalogo: CatalogoCreazione,
): EquipaggiamentoIniziale {
  const esito: EquipaggiamentoIniziale = { armi: [], armatura: null, scudo: false, oggetti: [] };
  const aggiungiArma = (nome: string, qta = 1) => {
    const arma = catalogo.armi.find(a => a.nome === nome);
    if (!arma) return;
    if (!esito.armi.some(a => a.nome === nome)) esito.armi.push(arma);
    if (qta > 1) esito.oggetti.push({ nome: `${nome} (scorta)`, qta: qta - 1, peso: 0 });
  };
  classe.equipaggiamento.forEach((gruppo, g) => {
    const scelta = scelte[g] ?? { opzione: 0, armi: [] };
    const opzione = gruppo[gruppo.length === 1 ? 0 : scelta.opzione];
    if (!opzione) return;
    let aScelta = 0;
    for (const v of opzione.voci as VoceEquipaggiamento[]) {
      if (v.tipo === "arma") aggiungiArma(v.nome, v.qta);
      else if (v.tipo === "armaAScelta") aggiungiArma(scelta.armi[aScelta++] ?? "", v.qta);
      else if (v.tipo === "armatura") {
        if (v.nome === "Scudo") esito.scudo = true;
        else esito.armatura = catalogo.armature.find(a => a.nome === v.nome) ?? esito.armatura;
      } else esito.oggetti.push({ nome: v.nome, qta: v.qta ?? 1, peso: v.peso });
    }
  });
  esito.oggetti.push(...(bg?.equipaggiamento ?? []));
  return esito;
}

// Armi tra cui scegliere per una voce "armaAScelta".
export const armiDisponibili = (catalogo: CatalogoCreazione, v: Extract<VoceEquipaggiamento, { tipo: "armaAScelta" }>) =>
  catalogo.armi.filter(a => a.categoria === v.categoria && (!v.soloMischia || !a.distanza));

// --- Incantesimi ---

export const incantesimiDellaClasse = (catalogo: CatalogoCreazione, classe: string, livello: number) =>
  catalogo.incantesimi.filter(i => i.livello === livello && i.classi.includes(classe));

export const numeroTrucchettiIniziali = (classe: string) => CLASSI[classe as NomeClasse]?.incantatore?.trucchetti[0] ?? 0;

const spellDa = (i: IncantesimoCatalogo, preparato: boolean): Spell => ({
  id: i.id, nome: i.nome, livello: i.livello, scuola: i.scuola, tempo: i.tempo, preparato,
  ...(i.scheda ? { scheda: i.scheda } : {}),
});

// --- Validazione dei passi ---

export type Passo = "razza" | "classe" | "caratteristiche" | "background" | "equipaggiamento" | "incantesimi" | "dettagli";

export const PASSI: { id: Passo; titolo: string }[] = [
  { id: "razza", titolo: "Razza" },
  { id: "classe", titolo: "Classe" },
  { id: "caratteristiche", titolo: "Caratteristiche" },
  { id: "background", titolo: "Background" },
  { id: "equipaggiamento", titolo: "Equipaggiamento" },
  { id: "incantesimi", titolo: "Incantesimi" },
  { id: "dettagli", titolo: "Dettagli" },
];

// Messaggio che spiega cosa manca per completare il passo, oppure null.
export function mancaNelPasso(passo: Passo, s: SceltePersonaggio, catalogo: CatalogoCreazione): string | null {
  const razza = razzaCompleta(catalogo, s.razza, s.sottorazza);
  const regole = s.classe ? CLASSI[s.classe] : null;
  const bg = catalogo.background.find(b => b.nome === s.background) ?? null;
  switch (passo) {
    case "razza":
      if (!razza) return "Scegli una razza.";
      if (sottorazzeDi(catalogo, s.razza).length > 0 && !s.sottorazza) return "Scegli una sottorazza.";
      if (new Set(s.bonusAScelta).size < razza.bonusAScelta) return `Scegli ${razza.bonusAScelta} caratteristiche diverse per il +1.`;
      if (new Set(s.abilitaRazza).size < razza.abilitaAScelta) return `Scegli ${razza.abilitaAScelta} abilità.`;
      if (new Set(s.lingueRazza.filter(Boolean)).size < razza.lingueAScelta) return "Scegli le lingue.";
      if (razza.strumentiAScelta.length > 0 && !s.strumentoRazza) return "Scegli lo strumento.";
      if (razza.trucchetto === "*" && !s.trucchettoRazza) return "Scegli il trucchetto.";
      return null;
    case "classe":
      if (!regole) return "Scegli una classe.";
      if (regole.livelloSottoclasse === 1 && !s.sottoclasse) return "Scegli la sottoclasse.";
      if (new Set(s.abilitaClasse).size < regole.abilita.numero) return `Scegli ${regole.abilita.numero} abilità.`;
      if (regole.strumentiAScelta && new Set(s.strumentiClasse.filter(Boolean)).size < regole.strumentiAScelta.numero) {
        return "Scegli gli strumenti.";
      }
      return null;
    case "caratteristiche":
      if (s.tiri.length < 6) return "Tira sei volte 4d6.";
      if (!punteggiFinali(s, razza)) return "Assegna un tiro a ogni caratteristica.";
      return null;
    case "background":
      if (!bg) return "Scegli un background.";
      if (new Set(s.abilitaSostitutive.filter(Boolean)).size < abilitaDoppie(s, razza, bg).length) return "Scegli le abilità sostitutive.";
      if (new Set(s.lingueBackground.filter(Boolean)).size < bg.lingueAScelta) return "Scegli le lingue.";
      if (bg.strumentiAScelta && !s.strumentoBackground) return "Scegli lo strumento.";
      return null;
    case "equipaggiamento": {
      if (!regole) return "Scegli prima la classe.";
      for (const [g, gruppo] of regole.equipaggiamento.entries()) {
        const scelta = s.equipaggiamento[g];
        const opzione = gruppo[gruppo.length === 1 ? 0 : scelta?.opzione ?? -1];
        if (!opzione) return "Scegli un'opzione per ogni gruppo.";
        const daScegliere = opzione.voci.filter(v => v.tipo === "armaAScelta").length;
        if ((scelta?.armi ?? []).filter(Boolean).length < daScegliere) return "Scegli le armi.";
      }
      return null;
    }
    case "incantesimi": {
      if (!regole?.incantatore) return null;
      const trucchetti = Math.min(numeroTrucchettiIniziali(s.classe), incantesimiDellaClasse(catalogo, s.classe, 0).length);
      if (s.trucchetti.length < trucchetti) return `Scegli ${trucchetti} trucchetti.`;
      const incantesimi = Math.min(incantesimiIniziali(s.classe), incantesimiDellaClasse(catalogo, s.classe, 1).length);
      if (s.incantesimi.length < incantesimi) return `Scegli ${incantesimi} incantesimi.`;
      return null;
    }
    case "dettagli":
      return s.dettagli.nome.trim() ? null : "Dai un nome al personaggio.";
  }
}

// --- La scheda ---

export function personaggioIniziale(s: SceltePersonaggio, catalogo: CatalogoCreazione): CharacterData {
  const razza = razzaCompleta(catalogo, s.razza, s.sottorazza);
  const regole = s.classe ? CLASSI[s.classe] : null;
  const bg = catalogo.background.find(b => b.nome === s.background) ?? null;
  const punteggi = punteggiFinali(s, razza);
  if (!razza || !regole || !s.classe || !bg || !punteggi) throw new Error("Scelte incomplete.");

  const c = personaggioVuoto();
  const d = s.dettagli;
  c.info = {
    ...c.info,
    nome: d.nome.trim(), classe: s.classe, sottoclasse: regole.livelloSottoclasse === 1 ? s.sottoclasse : "", livello: 1,
    razza: razza.nome, background: bg.nome, allineamento: d.allineamento, giocatore: d.giocatore, eta: d.eta,
    altezza: d.altezza, peso: d.peso, occhi: d.occhi, capelli: d.capelli, carnagione: d.carnagione,
    velocita: razza.velocita ?? "9 m", taglia: razza.taglia ?? "Media",
  };
  for (const k of CARATTERISTICHE) c.caratteristiche[k] = { valore: punteggi[k], compTS: regole.tiriSalvezza.includes(k) };
  c.competenzeAbilita = abilitaFinali(s, razza, bg);
  const unici = (voci: string[]) => [...new Set(voci.filter(Boolean))];
  c.competenzeAltre = {
    lingue: unici([...razza.lingue, ...s.lingueRazza, ...s.lingueBackground]),
    strumenti: unici([...regole.strumenti, ...s.strumentiClasse, s.strumentoRazza, ...bg.strumenti, s.strumentoBackground]),
    armi: unici([...regole.armi, ...razza.armi]),
    armature: unici([...regole.armature, ...razza.armature]),
  };

  // Privilegi: razza, background, classe e sottoclasse di 1° livello.
  const privilegiClasse = catalogo.privilegiClasse
    .filter(p => p.classe === s.classe && p.livello === 1 && (p.sottoclasse === null || p.sottoclasse === c.info.sottoclasse))
    .map(p => p.privilegio);
  const privilegi: Privilegio[] = [];
  for (const p of [...razza.privilegi, bg.privilegio, ...privilegiClasse]) {
    if (!privilegi.some(x => x.nome === p.nome && x.fonte === p.fonte)) privilegi.push(p);
  }
  c.privilegi = privilegi;

  // Equipaggiamento e monete.
  const eq = equipaggiamentoIniziale(regole, s.equipaggiamento, bg, catalogo);
  c.armi = eq.armi;
  c.armatura = eq.armatura;
  c.scudo = eq.scudo;
  c.inventario = eq.oggetti.map((o, i) => ({ ...o, id: i + 1 }));
  c.monete = { ...c.monete, mo: bg.mo };

  // Incantesimi: trucchetti e incantesimi scelti, il trucchetto della razza e, per chi prepara
  // dall'intera lista, tutti gli incantesimi di 1° livello della classe presenti nel catalogo.
  const perNome = (nome: string) => catalogo.incantesimi.find(i => i.nome === nome);
  const inc = regole.incantatore;
  const scelti: Spell[] = [];
  const aggiungi = (i: IncantesimoCatalogo | undefined, preparato: boolean) => {
    if (i && !scelti.some(x => x.nome === i.nome)) scelti.push(spellDa(i, preparato));
  };
  if (inc) {
    for (const n of s.trucchetti) aggiungi(perNome(n), true);
    for (const n of s.incantesimi) aggiungi(perNome(n), inc.modo === "conosciuti");
    if (inc.modo === "preparati") for (const i of incantesimiDellaClasse(catalogo, s.classe, 1)) aggiungi(i, false);
  }
  const trucchettoRazza = razza.trucchetto === "*" ? s.trucchettoRazza : razza.trucchetto;
  if (trucchettoRazza) aggiungi(perNome(trucchettoRazza), true);
  c.incantesimi = scelti;

  c.lore = { tratti: d.tratti, ideali: d.ideali, legami: d.legami, difetti: d.difetti, backgroundBio: d.backgroundBio };

  const pf = pfPrimoLivello(c, regole.dadoVita);
  c.combattimento = { ...c.combattimento, pfAttuali: pf, pfMassimi: pf, dadiVitaRimanenti: 1 };
  return c;
}
