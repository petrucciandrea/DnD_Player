import { useEffect, useState } from "react";
import { ArrowUpCircle, LoaderCircle, Search, X, Dices } from "lucide-react";
import type { Caratteristica, CharacterData, IncantesimoCatalogo, Privilegio } from "@dnd/regole/tipi.ts";
import type { ChiediTiro } from "../tiroDadi.ts";
import {
  CARATTERISTICHE, aumentiDa, applicaAumento, derivate, haAumentoCaratteristiche, incantesimiDaImparare, pfPerLivello,
  sceltePendenti, slotMassimi, spellDaCatalogo, type SceltaSalita,
} from "@dnd/regole/regole.ts";
import { incantatoreDi, regoleClasse } from "@dnd/regole/dati/classi.ts";
import { opzioniScelta, type DefinizioneScelta } from "@dnd/regole/dati/scelte.ts";
import { incantesimiDiSottoclasse } from "@dnd/regole/dati/incantesimiSottoclasse.ts";
import { privilegiDiLivello } from "../accesso";
import RicercaIncantesimi from "./RicercaIncantesimi";
import ScegliMolti from "./ScegliMolti";

interface Props {
  char: CharacterData; // la scheda al livello attuale: il pannello prepara la salita al successivo
  chiediTiro: ChiediTiro;
  opzioni: Privilegio[] | null; // opzioni delle scelte di privilegio (null = catalogo non raggiungibile)
  incantesimiCatalogo: IncantesimoCatalogo[];
  onConferma: (salita: SceltaSalita) => void;
  onAnnulla?: () => void;
}

// Stato del pannello di salita di livello.
interface Salita {
  sottoclasse: string;
  scelte: Record<string, string[]>; // opzioni scelte per id di scelta (Metamagia, stile...)
  // Aumento dei punteggi: due +1 (sulla stessa caratteristica = +2), oppure un talento.
  aumento: { tipo: "aumento" | "talento"; car: (Caratteristica | "")[]; talento: { nome: string; descrizione: string } };
  trucchetti: string[];
  incantesimi: string[];
  // PF del nuovo livello: tiro del Dado Vita (dadi fisici o dell'app) oppure la media.
  pf: { modo: "tiro" | "media"; tiro: number | null };
}

const campo = "bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500";
const etichetta = "text-xs text-slate-400 font-semibold uppercase tracking-wider";

// Incantesimi da scegliere: gli scelti si vedono come chip e si cambiano dalla modale di ricerca.
export function SceltaIncantesimi({ titolo, opzioni, scelte, massimo, onCambia }: {
  titolo: string; opzioni: IncantesimoCatalogo[]; scelte: string[]; massimo: number; onCambia: (v: string[]) => void;
}) {
  const [aperta, setAperta] = useState(false);
  const scelti = opzioni.filter(i => scelte.includes(i.nome));
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
        {titolo} <span className="normal-case text-slate-500">({scelte.length}/{massimo})</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {scelti.map(i => (
          <span key={i.id} className="px-2.5 py-1 rounded-lg border text-xs bg-indigo-600 border-indigo-500 text-white">
            {i.nome}{i.livello > 0 ? ` (${i.livello}°)` : ""}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setAperta(true)}
          className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 hover:border-slate-500 text-xs text-slate-300 flex items-center gap-1"
        >
          <Search className="w-3.5 h-3.5" /> {scelti.length > 0 ? "Cambia" : "Scegli"}
        </button>
      </div>
      {aperta && (
        <RicercaIncantesimi
          titolo={titolo}
          catalogo={opzioni}
          massimo={massimo}
          iniziali={scelti.map(i => i.id)}
          etichettaConferma="Conferma"
          onConferma={v => { onCambia(v.map(i => i.nome)); setAperta(false); }}
          onChiudi={() => setAperta(false)}
        />
      )}
    </div>
  );
}

// Opzioni di una scelta di privilegio, senza quelle che la scheda ha già.
export function SceltaPrivilegio({ scelta, mancano, catalogo, posseduti, valori, onCambia }: {
  scelta: DefinizioneScelta; mancano: number; catalogo: Privilegio[]; posseduti: Privilegio[];
  valori: string[]; onCambia: (v: string[]) => void;
}) {
  const opzioni = opzioniScelta(scelta, catalogo).filter(o => !posseduti.some(p => p.fonte === o.fonte && p.nome === o.nome));
  return (
    <ScegliMolti
      titolo={scelta.nome}
      opzioni={opzioni.map(o => o.nome)}
      scelte={valori}
      massimo={mancano}
      onCambia={onCambia}
      suggerimento={v => opzioni.find(o => o.nome === v)?.descrizione}
    />
  );
}

// Salita al livello successivo: PF, sottoclasse, privilegi dal catalogo, aumento o talento, incantesimi e scelte
// di privilegio. Non modifica la scheda: consegna le scelte a onConferma (che le applica con applicaSalita).
// Si usa nella tab Progresso e nella creazione di un personaggio oltre il 1° livello.
export default function PannelloSalita({ char, chiediTiro, opzioni, incantesimiCatalogo, onConferma, onAnnulla }: Props) {
  const d = derivate(char);
  const livello = char.info.livello;
  const nuovo = livello + 1;
  const regole = regoleClasse(char.info.classe);
  // La sottoclasse si sceglie al suo livello, se non c'è già.
  const serveSottoclasse = !!regole && nuovo >= regole.livelloSottoclasse && !regole.sottoclassi.includes(char.info.sottoclasse);

  const [salita, setSalita] = useState<Salita>(() => ({
    sottoclasse: serveSottoclasse ? "" : char.info.sottoclasse, scelte: {}, trucchetti: [], incantesimi: [],
    aumento: { tipo: "aumento", car: ["", ""], talento: { nome: "", descrizione: "" } },
    pf: { modo: "tiro", tiro: null },
  }));

  // Privilegi del nuovo livello dal catalogo (con quelli della sottoclasse, se c'è), per la chiave che li ha chiesti.
  const chiave = `${char.info.classe}|${nuovo}|${salita.sottoclasse}`;
  const [caricati, setCaricati] = useState<{ chiave: string; voci: Privilegio[] | "offline" } | null>(null);
  useEffect(() => {
    let attivo = true;
    privilegiDiLivello(char.info.classe, nuovo, salita.sottoclasse).then(r => {
      if (attivo) setCaricati({ chiave, voci: r ? r.map(x => x.privilegio) : "offline" });
    });
    return () => { attivo = false; };
  }, [char.info.classe, nuovo, salita.sottoclasse, chiave]);
  // null = in caricamento, "offline" = non disponibili.
  const privilegi = caricati?.chiave === chiave ? caricati.voci : null;

  // Cambiando sottoclasse cambiano privilegi, scelte e incantesimi del livello.
  const cambiaSottoclasse = (sottoclasse: string) =>
    setSalita(prev => ({ ...prev, sottoclasse, scelte: {}, trucchetti: [], incantesimi: [] }));

  // Scelte di privilegio dovute al nuovo livello (con la sottoclasse scelta salendo).
  const sottoclasseDopo = serveSottoclasse ? salita.sottoclasse : char.info.sottoclasse;
  const pendentiSalita = sceltePendenti(char, { livello: nuovo, sottoclasse: sottoclasseDopo });
  // Senza catalogo le scelte non bloccano la salita: si potranno completare dopo.
  const scelteComplete = !opzioni || pendentiSalita.every(x => (salita.scelte[x.scelta.id] ?? []).length >= Math.min(
    x.mancano, opzioniScelta(x.scelta, opzioni).filter(o => !char.privilegi.some(p => p.fonte === o.fonte && p.nome === o.nome)).length,
  ));
  const privilegiSceltiSalita = opzioni
    ? pendentiSalita.flatMap(({ scelta }) => opzioniScelta(scelta, opzioni).filter(o => (salita.scelte[scelta.id] ?? []).includes(o.nome)))
    : [];

  // Aumento dei punteggi (o talento) ai livelli che lo concedono.
  const serveAumento = haAumentoCaratteristiche(char.info.classe, nuovo);
  const aumentoValido = !serveAumento || (salita.aumento.tipo === "talento"
    ? salita.aumento.talento.nome.trim() !== ""
    : applicaAumento(char, aumentiDa(salita.aumento.car)) !== char);
  const cambiaAumento = (parziale: Partial<Salita["aumento"]>) =>
    setSalita(prev => ({ ...prev, aumento: { ...prev.aumento, ...parziale } }));

  // Incantesimi da imparare al nuovo livello: trucchetti, conosciuti o i 2 da copiare nel libro.
  const incDopo = incantatoreDi(char.info.classe, sottoclasseDopo);
  const imparabili = incantesimiDaImparare(char, incantesimiCatalogo, nuovo, sottoclasseDopo);

  // Il tiro del Dado Vita passa dal dialogo dei tiri: dadi fisici o tiro dell'app.
  const tiraPf = async () => {
    const tiri = await chiediTiro({
      titolo: `Dado Vita (livello ${nuovo})`,
      descrizione: `PF del nuovo livello: 1d${d.dadoVita} ${d.mod("COS") >= 0 ? "+" : "−"} ${Math.abs(d.mod("COS"))} (COS), almeno 1.`,
      dadi: [{ etichetta: "Dado Vita", facce: d.dadoVita }],
      bonus: d.mod("COS"),
    });
    if (tiri) setSalita(prev => ({ ...prev, pf: { modo: "tiro", tiro: tiri[0] } }));
  };
  const tiroPf = salita.pf.modo === "tiro" ? salita.pf.tiro : undefined;

  // Cosa cambia al nuovo livello, per il riepilogo.
  const incPrima = incantatoreDi(char.info.classe, char.info.sottoclasse);
  const slotPrima = slotMassimi(incPrima, livello);
  const slotDopo = slotMassimi(incDopo, nuovo);
  const nuoviSlot = slotDopo.flatMap((n, i) => (n > (slotPrima[i] ?? 0) ? [`${n - (slotPrima[i] ?? 0)}× ${i + 1}°`] : []));
  const trucchettiInPiu = (incDopo?.trucchetti[nuovo - 1] ?? 0) - (incPrima?.trucchetti[livello - 1] ?? 0);
  const conosciutiInPiu = (incDopo?.conosciuti?.[nuovo - 1] ?? 0) - (incPrima?.conosciuti?.[livello - 1] ?? 0);
  // Incantesimi di sottoclasse nuovi al livello successivo (il terreno del circolo può essere scelto salendo).
  const sottoclasseInfo = (livelloInfo: number, sottoclasse: string, privilegiExtra: Privilegio[] = []) =>
    incantesimiDiSottoclasse({ info: { ...char.info, livello: livelloInfo, sottoclasse }, privilegi: [...char.privilegi, ...privilegiExtra] });
  const sottoPrima = sottoclasseInfo(livello, char.info.sottoclasse);
  const sottoDopo = sottoclasseInfo(nuovo, sottoclasseDopo, privilegiSceltiSalita);
  const nuoviSempre = sottoDopo.sempre.filter(n => !sottoPrima.sempre.includes(n));
  const nuoviAmpliati = sottoDopo.ampliata.filter(n => !sottoPrima.ampliata.includes(n));
  const note = [
    `+1 Dado Vita (d${d.dadoVita}) e recupero di tutti i Dadi Vita spesi.`,
    nuoviSlot.length > 0 && `Nuovi slot incantesimo: ${nuoviSlot.join(", ")}.`,
    conosciutiInPiu > 0 && `Puoi imparare ${conosciutiInPiu} ${conosciutiInPiu === 1 ? "nuovo incantesimo" : "nuovi incantesimi"}.`,
    trucchettiInPiu > 0 && `Puoi imparare ${trucchettiInPiu === 1 ? "un nuovo trucchetto" : `${trucchettiInPiu} nuovi trucchetti`}.`,
    nuoviSempre.length > 0 && `Incantesimi sempre preparati (${sottoDopo.fonte?.toLowerCase()}): ${nuoviSempre.join(", ")}.`,
    nuoviAmpliati.length > 0 && `Nuovi incantesimi nella lista del patrono: ${nuoviAmpliati.join(", ")}.`,
  ].filter(Boolean);

  const nTrucchetti = Math.min(Math.max(0, trucchettiInPiu), imparabili.trucchetti.length);
  const nIncantesimi = Math.min(incDopo?.modo === "libro" ? 2 : Math.max(0, conosciutiInPiu), imparabili.incantesimi.length);

  const pronta = privilegi !== null && (!serveSottoclasse || !!salita.sottoclasse) && scelteComplete && aumentoValido && tiroPf !== null;
  const conferma = () => {
    if (!pronta) return;
    // I trucchetti e gli incantesimi conosciuti sono pronti, quelli copiati nel libro vanno preparati.
    const incantesimi = [
      ...imparabili.trucchetti.filter(i => salita.trucchetti.includes(i.nome)).map(i => spellDaCatalogo(i, true)),
      ...imparabili.incantesimi.filter(i => salita.incantesimi.includes(i.nome)).map(i => spellDaCatalogo(i, incDopo?.modo !== "libro")),
    ];
    const talento = serveAumento && salita.aumento.tipo === "talento"
      ? { nome: salita.aumento.talento.nome.trim(), fonte: "Talento", descrizione: salita.aumento.talento.descrizione.trim() }
      : undefined;
    const aumenti = serveAumento && salita.aumento.tipo === "aumento" ? aumentiDa(salita.aumento.car) : undefined;
    onConferma({
      privilegi: [...(Array.isArray(privilegi) ? privilegi : []), ...privilegiSceltiSalita],
      sottoclasse: serveSottoclasse ? salita.sottoclasse : undefined,
      incantesimi,
      ...(aumenti ? { aumenti } : {}),
      ...(talento ? { talento } : {}),
      ...(tiroPf != null ? { tiroPf } : {}),
    });
  };

  return (
    <div className="bg-slate-950/60 border border-emerald-900/50 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-emerald-300">Livello {nuovo}</h4>
        {onAnnulla && (
          <button onClick={onAnnulla} title="Annulla" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
        )}
      </div>
      {serveSottoclasse && regole && (
        <label className="block space-y-1 text-sm">
          <span className={etichetta}>Sottoclasse</span>
          <select value={salita.sottoclasse} onChange={e => cambiaSottoclasse(e.target.value)} className={`${campo} w-full`}>
            <option value="">Scegli...</option>
            {regole.sottoclassi.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      <ul className="text-sm text-slate-300 list-disc pl-5 space-y-0.5">
        {note.map(n => <li key={String(n)}>{n}</li>)}
      </ul>
      <div className="text-sm">
        <span className={etichetta}>Nuovi privilegi</span>
        {privilegi === null ? (
          <LoaderCircle className="w-4 h-4 text-indigo-400 animate-spin mt-1" />
        ) : privilegi === "offline" ? (
          <p className="text-xs text-amber-300 mt-1">Catalogo non raggiungibile: i privilegi del nuovo livello non verranno aggiunti.</p>
        ) : privilegi.length === 0 ? (
          <p className="text-xs text-slate-500 mt-1">Nessun privilegio nel catalogo per questo livello (il catalogo è ancora parziale).</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {privilegi.map(p => (
              <li key={`${p.nome}|${p.fonte}`} className="text-xs text-slate-400">
                <strong className="text-slate-200">{p.nome}</strong> ({p.fonte}): {p.descrizione}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className={etichetta}>Punti ferita</span>
          {(["tiro", "media"] as const).map(m => (
            <label key={m} className="flex items-center gap-1.5 text-xs text-slate-300">
              <input
                type="radio"
                checked={salita.pf.modo === m}
                onChange={() => setSalita(prev => ({ ...prev, pf: { ...prev.pf, modo: m } }))}
                className="accent-indigo-500"
              />
              {m === "tiro" ? `Tira 1d${d.dadoVita}` : `Media (${d.dadoVita / 2 + 1})`}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {salita.pf.modo === "tiro" && (
            <button
              type="button"
              onClick={tiraPf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Dices className="w-3.5 h-3.5" /> {salita.pf.tiro === null ? "Tira il Dado Vita" : "Tira di nuovo"}
            </button>
          )}
          {tiroPf === null ? (
            <span className="text-xs text-slate-500">Tira il dado per conoscere i PF del nuovo livello.</span>
          ) : (
            <span className="text-slate-300">
              {salita.pf.modo === "tiro" && <>Risultato <strong className="text-slate-100">{tiroPf}</strong> → </>}
              <strong className="text-emerald-300">+{pfPerLivello(char, d.dadoVita, tiroPf)} PF massimi</strong>
            </span>
          )}
        </div>
      </div>
      {serveAumento && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className={etichetta}>Aumento dei punteggi</span>
            {(["aumento", "talento"] as const).map(t => (
              <label key={t} className="flex items-center gap-1.5 text-xs text-slate-300">
                <input type="radio" checked={salita.aumento.tipo === t} onChange={() => cambiaAumento({ tipo: t })} className="accent-indigo-500" />
                {t === "aumento" ? "+2 a una o +1 a due" : "Talento"}
              </label>
            ))}
          </div>
          {salita.aumento.tipo === "aumento" ? (
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map(i => (
                <select
                  key={i}
                  value={salita.aumento.car[i]}
                  onChange={e => cambiaAumento({ car: salita.aumento.car.map((x, j) => (j === i ? e.target.value as Caratteristica | "" : x)) })}
                  className={campo}
                >
                  <option value="">+1 a...</option>
                  {CARATTERISTICHE.map(k => <option key={k} value={k}>{k} ({char.caratteristiche[k].valore})</option>)}
                </select>
              ))}
              {salita.aumento.car.every(Boolean) && !aumentoValido && (
                <p className="col-span-2 text-xs text-rose-300">Nessun punteggio può superare 20.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={salita.aumento.talento.nome}
                onChange={e => cambiaAumento({ talento: { ...salita.aumento.talento, nome: e.target.value } })}
                placeholder="Nome del talento"
                className={`${campo} w-full`}
              />
              <textarea
                value={salita.aumento.talento.descrizione}
                onChange={e => cambiaAumento({ talento: { ...salita.aumento.talento, descrizione: e.target.value } })}
                placeholder="Cosa fa (facoltativo)"
                rows={2}
                className={`${campo} w-full`}
              />
              <p className="text-[11px] text-slate-500">Gli effetti dei talenti sui calcoli non sono automatici: modificali a mano se servono.</p>
            </div>
          )}
        </div>
      )}
      {nTrucchetti > 0 && (
        <SceltaIncantesimi
          titolo="Nuovi trucchetti"
          opzioni={imparabili.trucchetti}
          scelte={salita.trucchetti}
          massimo={nTrucchetti}
          onCambia={v => setSalita(prev => ({ ...prev, trucchetti: v }))}
        />
      )}
      {nIncantesimi > 0 && (
        <SceltaIncantesimi
          titolo={incDopo?.modo === "libro" ? "Incantesimi da copiare nel libro" : "Nuovi incantesimi conosciuti"}
          opzioni={imparabili.incantesimi}
          scelte={salita.incantesimi}
          massimo={nIncantesimi}
          onCambia={v => setSalita(prev => ({ ...prev, incantesimi: v }))}
        />
      )}
      {opzioni && pendentiSalita.map(({ scelta, mancano }) => (
        <SceltaPrivilegio
          key={scelta.id}
          scelta={scelta}
          mancano={mancano}
          catalogo={opzioni}
          posseduti={char.privilegi}
          valori={salita.scelte[scelta.id] ?? []}
          onCambia={v => setSalita(prev => ({ ...prev, scelte: { ...prev.scelte, [scelta.id]: v } }))}
        />
      ))}
      <button
        onClick={conferma}
        disabled={!pronta}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold"
      >
        <ArrowUpCircle className="w-4 h-4" /> Conferma livello {nuovo}
      </button>
    </div>
  );
}
