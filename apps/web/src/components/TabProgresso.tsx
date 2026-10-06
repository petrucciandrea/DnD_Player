import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, ArrowUpCircle, LoaderCircle, Search, X } from "lucide-react";
import type { Caratteristica, CharacterData, IncantesimoCatalogo, Privilegio, Spell, XPRecord } from "@dnd/regole/tipi.ts";
import type { SetChar } from "../stato.ts";
import type { Derivate } from "@dnd/regole/regole.ts";
import {
  CARATTERISTICHE, aggiungiIncantesimi, applicaAumento, haAumentoCaratteristiche, incantesimiDaImparare, incantesimiSottoclasseMancanti,
  pfPerLivello, privilegiMancanti, saliDiLivello, sceltePendenti, slotMassimi,
} from "@dnd/regole/regole.ts";
import { incantatoreDi, regoleClasse } from "@dnd/regole/dati/classi.ts";
import { opzioniScelta, type DefinizioneScelta } from "@dnd/regole/dati/scelte.ts";
import { incantesimiDiSottoclasse } from "@dnd/regole/dati/incantesimiSottoclasse.ts";
import { catalogoCreazione, privilegiDiLivello, privilegiFinoAlLivello } from "../accesso";
import RicercaIncantesimi from "./RicercaIncantesimi";
import ScegliMolti from "./ScegliMolti";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
}

// Stato del pannello di salita di livello: privilegi null = in caricamento, "offline" = non disponibili.
interface Salita {
  sottoclasse: string;
  privilegi: Privilegio[] | null | "offline";
  scelte: Record<string, string[]>; // opzioni scelte per id di scelta (Metamagia, stile...)
  // Aumento dei punteggi: due +1 (sulla stessa caratteristica = +2), oppure un talento.
  aumento: { tipo: "aumento" | "talento"; car: (Caratteristica | "")[]; talento: { nome: string; descrizione: string } };
  trucchetti: string[];
  incantesimi: string[];
}

const campo = "bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500";
const etichetta = "text-xs text-slate-400 font-semibold uppercase tracking-wider";

// +1 per ogni caratteristica scelta: la stessa due volte fa +2.
const aumentiDa = (car: (Caratteristica | "")[]) =>
  car.reduce<Partial<Record<Caratteristica, number>>>((acc, k) => (k ? { ...acc, [k]: (acc[k] ?? 0) + 1 } : acc), {});

const spellDa = (i: IncantesimoCatalogo, preparato: boolean): Spell => ({
  id: i.id, nome: i.nome, livello: i.livello, scuola: i.scuola, tempo: i.tempo, preparato, ...(i.scheda ? { scheda: i.scheda } : {}),
});

// Incantesimi da imparare: gli scelti si vedono come chip e si cambiano dalla modale di ricerca.
function SceltaIncantesimi({ titolo, opzioni, scelte, massimo, onCambia }: {
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
function SceltaPrivilegio({ scelta, mancano, catalogo, posseduti, valori, onCambia }: {
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

// I privilegi corrispondenti alle opzioni scelte.
const privilegiScelti = (scelte: Record<string, string[]>, pendenti: { scelta: DefinizioneScelta }[], catalogo: Privilegio[]) =>
  pendenti.flatMap(({ scelta }) => opzioniScelta(scelta, catalogo).filter(o => (scelte[scelta.id] ?? []).includes(o.nome)));

export default function TabProgresso({ char, d, setChar }: Props) {
  const [newXpInput, setNewXpInput] = useState({ valore: "", motivo: "" });
  const [salita, setSalita] = useState<Salita | null>(null);
  const [verifica, setVerifica] = useState<"attesa" | "offline" | Privilegio[] | null>(null);
  // Opzioni delle scelte di privilegio dal catalogo (null = in caricamento o non raggiungibile).
  const [opzioni, setOpzioni] = useState<Privilegio[] | null>(null);
  const [incantesimiCatalogo, setIncantesimiCatalogo] = useState<IncantesimoCatalogo[]>([]);
  const [scelteAttuali, setScelteAttuali] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let attivo = true;
    catalogoCreazione().then(c => {
      if (attivo && c) {
        setOpzioni(c.opzioniPrivilegio);
        setIncantesimiCatalogo(c.incantesimi);
      }
    });
    return () => { attivo = false; };
  }, []);
  const livello = char.info.livello;
  const nuovo = livello + 1;
  const regole = regoleClasse(char.info.classe);
  // La sottoclasse si sceglie al suo livello, se non c'è già.
  const serveSottoclasse = !!regole && nuovo >= regole.livelloSottoclasse && !regole.sottoclassi.includes(char.info.sottoclasse);

  const aggiungiXp = (e: FormEvent) => {
    e.preventDefault();
    const val = parseInt(newXpInput.valore);
    if (!val || val <= 0) return;
    const record: XPRecord = {
      id: Date.now(),
      data: new Date().toLocaleDateString("it-IT"),
      valore: val,
      motivo: newXpInput.motivo.trim() || "Guadagno generico",
    };
    setChar(prev => ({
      ...prev,
      xp: { totale: prev.xp.totale + val, storico: [record, ...prev.xp.storico] },
    }));
    setNewXpInput({ valore: "", motivo: "" });
  };

  const rimuoviXp = (r: XPRecord) => {
    if (!confirm(`Rimuovere +${r.valore} XP (${r.motivo})?`)) return;
    setChar(prev => ({
      ...prev,
      xp: { totale: Math.max(0, prev.xp.totale - r.valore), storico: prev.xp.storico.filter(x => x.id !== r.id) },
    }));
  };

  // Privilegi del nuovo livello dal catalogo (con quelli della sottoclasse, se c'è).
  const caricaPrivilegi = async (sottoclasse: string) => {
    setSalita(prev => ({
      sottoclasse, privilegi: null, scelte: {}, trucchetti: [], incantesimi: [],
      aumento: prev?.aumento ?? { tipo: "aumento", car: ["", ""], talento: { nome: "", descrizione: "" } },
    }));
    const r = await privilegiDiLivello(char.info.classe, nuovo, sottoclasse);
    setSalita(prev => (prev?.sottoclasse === sottoclasse ? { ...prev, privilegi: r ? r.map(x => x.privilegio) : "offline" } : prev));
  };

  // Scelte di privilegio dovute al nuovo livello (con la sottoclasse scelta salendo).
  const pendentiSalita = salita ? sceltePendenti(char, { livello: nuovo, sottoclasse: serveSottoclasse ? salita.sottoclasse : char.info.sottoclasse }) : [];
  // Senza catalogo le scelte non bloccano la salita: si potranno completare dopo.
  const scelteComplete = !opzioni || pendentiSalita.every(x => (salita?.scelte[x.scelta.id] ?? []).length >= Math.min(
    x.mancano, opzioniScelta(x.scelta, opzioni).filter(o => !char.privilegi.some(p => p.fonte === o.fonte && p.nome === o.nome)).length,
  ));

  // Aumento dei punteggi (o talento) ai livelli che lo concedono.
  const serveAumento = haAumentoCaratteristiche(char.info.classe, nuovo);
  const aumentoValido = !serveAumento || !salita || (salita.aumento.tipo === "talento"
    ? salita.aumento.talento.nome.trim() !== ""
    : applicaAumento(char, aumentiDa(salita.aumento.car)) !== char);
  const cambiaAumento = (parziale: Partial<Salita["aumento"]>) =>
    setSalita(prev => prev && { ...prev, aumento: { ...prev.aumento, ...parziale } });

  // Incantesimi da imparare al nuovo livello: trucchetti, conosciuti o i 2 da copiare nel libro.
  const sottoclasseDopo = serveSottoclasse ? (salita?.sottoclasse ?? "") : char.info.sottoclasse;
  const incDopo = incantatoreDi(char.info.classe, sottoclasseDopo);
  const imparabili = incantesimiDaImparare(char, incantesimiCatalogo, nuovo, sottoclasseDopo);

  const confermaSalita = () => {
    if (!salita || (serveSottoclasse && !salita.sottoclasse) || !scelteComplete || !aumentoValido) return;
    const privilegi = [
      ...(Array.isArray(salita.privilegi) ? salita.privilegi : []),
      ...(opzioni ? privilegiScelti(salita.scelte, pendentiSalita, opzioni) : []),
    ];
    // Gli incantesimi di sottoclasse che il nuovo livello concede (e quelli che mancavano) arrivano dal catalogo.
    // Gli incantesimi scelti: i conosciuti e i trucchetti sono pronti, quelli copiati nel libro vanno preparati.
    const scelti = [
      ...imparabili.trucchetti.filter(i => salita.trucchetti.includes(i.nome)).map(i => spellDa(i, true)),
      ...imparabili.incantesimi.filter(i => salita.incantesimi.includes(i.nome)).map(i => spellDa(i, incDopo?.modo !== "libro")),
    ];
    const talento = serveAumento && salita.aumento.tipo === "talento"
      ? { nome: salita.aumento.talento.nome.trim(), fonte: "Talento", descrizione: salita.aumento.talento.descrizione.trim() }
      : undefined;
    const aumenti = serveAumento && salita.aumento.tipo === "aumento" ? aumentiDa(salita.aumento.car) : undefined;
    setChar(prev => {
      const salito = saliDiLivello(prev, {
        privilegi, sottoclasse: serveSottoclasse ? salita.sottoclasse : undefined, incantesimi: scelti, aumenti, talento,
      });
      const mancanti = incantesimiSottoclasseMancanti(salito);
      return aggiungiIncantesimi(salito, incantesimiCatalogo
        .filter(v => mancanti.some(n => n.toLowerCase() === v.nome.toLowerCase()))
        .map(v => spellDa(v, true)));
    });
    setSalita(null);
  };

  // Scelte che mancano già al livello attuale (personaggi creati prima delle scelte di privilegio).
  const pendentiAttuali = sceltePendenti(char);
  const aggiungiScelte = () => {
    if (!opzioni) return;
    const nuovi = privilegiScelti(scelteAttuali, pendentiAttuali, opzioni);
    setChar(prev => ({
      ...prev,
      privilegi: [...prev.privilegi, ...nuovi.filter(p => !prev.privilegi.some(x => x.nome === p.nome && x.fonte === p.fonte))],
    }));
    setScelteAttuali({});
  };

  // Un personaggio salito di livello quando il catalogo era parziale può recuperare i privilegi che gli mancano.
  const cercaMancanti = async () => {
    setVerifica("attesa");
    const catalogo = await privilegiFinoAlLivello(char.info.classe, livello, char.info.sottoclasse);
    setVerifica(catalogo ? privilegiMancanti(char, catalogo) : "offline");
  };

  const aggiungiMancanti = (privilegi: Privilegio[]) => {
    setChar(prev => ({
      ...prev,
      privilegi: [...prev.privilegi, ...privilegi.filter(p => !prev.privilegi.some(x => x.nome === p.nome && x.fonte === p.fonte))],
    }));
    setVerifica(null);
  };

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
  const privilegiSceltiSalita = salita && opzioni ? privilegiScelti(salita.scelte, pendentiSalita, opzioni) : [];
  const sottoPrima = sottoclasseInfo(livello, char.info.sottoclasse);
  const sottoDopo = sottoclasseInfo(nuovo, sottoclasseDopo, privilegiSceltiSalita);
  const nuoviSempre = sottoDopo.sempre.filter(n => !sottoPrima.sempre.includes(n));
  const nuoviAmpliati = sottoDopo.ampliata.filter(n => !sottoPrima.ampliata.includes(n));
  const note = [
    `+${pfPerLivello(char, d.dadoVita)} PF massimi e +1 Dado Vita (d${d.dadoVita}).`,
    nuoviSlot.length > 0 && `Nuovi slot incantesimo: ${nuoviSlot.join(", ")}.`,
    conosciutiInPiu > 0 && `Puoi imparare ${conosciutiInPiu} ${conosciutiInPiu === 1 ? "nuovo incantesimo" : "nuovi incantesimi"}.`,
    trucchettiInPiu > 0 && `Puoi imparare ${trucchettiInPiu === 1 ? "un nuovo trucchetto" : `${trucchettiInPiu} nuovi trucchetti`}.`,
    nuoviSempre.length > 0 && `Incantesimi sempre preparati (${sottoDopo.fonte?.toLowerCase()}): ${nuoviSempre.join(", ")}.`,
    nuoviAmpliati.length > 0 && `Nuovi incantesimi nella lista del patrono: ${nuoviAmpliati.join(", ")}.`,
  ].filter(Boolean);

  const nTrucchetti = Math.min(Math.max(0, trucchettiInPiu), imparabili.trucchetti.length);
  const nIncantesimi = Math.min(incDopo?.modo === "libro" ? 2 : Math.max(0, conosciutiInPiu), imparabili.incantesimi.length);
  const soglia = d.prossimaSoglia;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <div>
            <h3 className="text-base font-bold text-slate-200">
              {soglia === null ? "Livello massimo raggiunto" : `Avanzamento a Livello ${livello + 1}`}
            </h3>
            {soglia !== null && (
              <p className="text-xs text-slate-400">Soglia successiva: {soglia.toLocaleString("it-IT")} XP ufficiali D&D 5e</p>
            )}
          </div>
          <div className="text-2xl font-black text-indigo-400">
            {char.xp.totale.toLocaleString("it-IT")}{soglia !== null && ` / ${soglia.toLocaleString("it-IT")}`} XP
          </div>
        </div>
        {soglia !== null && (
          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden mt-3">
            <div
              className={`h-full transition-all ${d.puoSalire ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${Math.min(100, (char.xp.totale / soglia) * 100)}%` }}
            />
          </div>
        )}
        {d.puoSalire && !salita && (
          <button
            onClick={() => caricaPrivilegi(serveSottoclasse ? "" : char.info.sottoclasse)}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
          >
            <ArrowUpCircle className="w-4 h-4" /> Sali al livello {livello + 1}
          </button>
        )}
        {salita && (
          <div className="mt-4 bg-slate-950/60 border border-emerald-900/50 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-bold text-emerald-300">Livello {nuovo}</h4>
              <button onClick={() => setSalita(null)} title="Annulla" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
            </div>
            {serveSottoclasse && regole && (
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Sottoclasse</span>
                <select
                  value={salita.sottoclasse}
                  onChange={e => caricaPrivilegi(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="">Scegli...</option>
                  {regole.sottoclassi.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <ul className="text-sm text-slate-300 list-disc pl-5 space-y-0.5">
              {note.map(n => <li key={String(n)}>{n}</li>)}
            </ul>
            <div className="text-sm">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Nuovi privilegi</span>
              {salita.privilegi === null ? (
                <LoaderCircle className="w-4 h-4 text-indigo-400 animate-spin mt-1" />
              ) : salita.privilegi === "offline" ? (
                <p className="text-xs text-amber-300 mt-1">Catalogo non raggiungibile: i privilegi del nuovo livello non verranno aggiunti.</p>
              ) : salita.privilegi.length === 0 ? (
                <p className="text-xs text-slate-500 mt-1">Nessun privilegio nel catalogo per questo livello (il catalogo è ancora parziale).</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {salita.privilegi.map(p => (
                    <li key={`${p.nome}|${p.fonte}`} className="text-xs text-slate-400">
                      <strong className="text-slate-200">{p.nome}</strong> ({p.fonte}): {p.descrizione}
                    </li>
                  ))}
                </ul>
              )}
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
                onCambia={v => setSalita(prev => prev && { ...prev, trucchetti: v })}
              />
            )}
            {nIncantesimi > 0 && (
              <SceltaIncantesimi
                titolo={incDopo?.modo === "libro" ? "Incantesimi da copiare nel libro" : "Nuovi incantesimi conosciuti"}
                opzioni={imparabili.incantesimi}
                scelte={salita.incantesimi}
                massimo={nIncantesimi}
                onCambia={v => setSalita(prev => prev && { ...prev, incantesimi: v })}
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
                onCambia={v => setSalita(prev => prev && { ...prev, scelte: { ...prev.scelte, [scelta.id]: v } })}
              />
            ))}
            <button
              onClick={confermaSalita}
              disabled={salita.privilegi === null || (serveSottoclasse && !salita.sottoclasse) || !scelteComplete || !aumentoValido}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold"
            >
              <ArrowUpCircle className="w-4 h-4" /> Conferma livello {nuovo}
            </button>
          </div>
        )}
      </div>

      {opzioni && pendentiAttuali.length > 0 && (
        <div className="bg-slate-900 border border-amber-900/50 p-4 rounded-xl space-y-3 text-sm">
          <div>
            <h3 className="font-bold text-slate-200">Scelte da completare</h3>
            <p className="text-xs text-slate-500">Al livello {livello} la classe ti fa scegliere queste opzioni.</p>
          </div>
          {pendentiAttuali.map(({ scelta, mancano }) => (
            <SceltaPrivilegio
              key={scelta.id}
              scelta={scelta}
              mancano={mancano}
              catalogo={opzioni}
              posseduti={char.privilegi}
              valori={scelteAttuali[scelta.id] ?? []}
              onCambia={v => setScelteAttuali(prev => ({ ...prev, [scelta.id]: v }))}
            />
          ))}
          <button
            onClick={aggiungiScelte}
            disabled={Object.values(scelteAttuali).every(v => v.length === 0)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Aggiungi alla scheda
          </button>
        </div>
      )}

      {livello > 1 && regole && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-200">Privilegi di classe</h3>
              <p className="text-xs text-slate-500">Controlla se alla scheda mancano privilegi di classe o sottoclasse fino al livello {livello}.</p>
            </div>
            <button
              onClick={cercaMancanti}
              disabled={verifica === "attesa"}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50"
            >
              {verifica === "attesa" ? "Controllo..." : "Cerca privilegi mancanti"}
            </button>
          </div>
          {verifica === "offline" && <p className="text-xs text-amber-300">Catalogo non raggiungibile: riprova più tardi.</p>}
          {Array.isArray(verifica) && (verifica.length === 0 ? (
            <p className="text-xs text-emerald-400">Nessun privilegio mancante.</p>
          ) : (
            <div className="space-y-2">
              <ul className="space-y-1">
                {verifica.map(p => (
                  <li key={`${p.nome}|${p.fonte}`} className="text-xs text-slate-400">
                    <strong className="text-slate-200">{p.nome}</strong> ({p.fonte}): {p.descrizione}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => aggiungiMancanti(verifica)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Aggiungi {verifica.length} {verifica.length === 1 ? "privilegio" : "privilegi"}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={aggiungiXp} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-2">
        <input
          type="number"
          min={1}
          placeholder="XP Guadagnati..."
          value={newXpInput.valore}
          onChange={e => setNewXpInput(prev => ({ ...prev, valore: e.target.value }))}
          className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
        />
        <input
          type="text"
          placeholder="Motivo / Sessione..."
          value={newXpInput.motivo}
          onChange={e => setNewXpInput(prev => ({ ...prev, motivo: e.target.value }))}
          className="flex-1 min-w-40 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
        />
        <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1">
          <Plus className="w-4 h-4" /> Registra XP
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800/60">
        {char.xp.storico.map(entry => (
          <div key={entry.id} className="group p-3 flex justify-between items-center gap-2 text-sm">
            <div>
              <span className="font-semibold text-slate-200">+{entry.valore} XP</span>
              <span className="text-xs text-slate-500 ml-2">({entry.motivo})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{entry.data}</span>
              <button
                onClick={() => rimuoviXp(entry)}
                title="Rimuovi voce"
                className="text-slate-600 hover:text-rose-400 p-1 sm:opacity-0 sm:group-hover:opacity-100 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
