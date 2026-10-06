import { useState } from "react";
import { Coffee, Clock, Heart, Music, RotateCcw, Minus, Plus, X, Dices, Zap } from "lucide-react";
import type { CharacterData, EsitoRiposoBreve } from "@dnd/regole/tipi.ts";
import type { Derivate } from "@dnd/regole/regole.ts";
import { segno } from "@dnd/regole/regole.ts";
import type { ChiediTiro } from "../tiroDadi";

interface Props {
  char: CharacterData;
  d: Derivate;
  chiediTiro: ChiediTiro;
  onConferma: (esito: EsitoRiposoBreve, riepilogo: string) => void;
  onAnnulla: () => void;
}

// Dado del Canto di Riposo in base al livello del bardo (0 = nessun bardo).
const DADI_CANTO = [
  { facce: 0, label: "Nessun bardo" },
  { facce: 6, label: "d6 (bardo 2°–8°)" },
  { facce: 8, label: "d8 (bardo 9°–12°)" },
  { facce: 10, label: "d10 (bardo 13°–16°)" },
  { facce: 12, label: "d12 (bardo 17°+)" },
];

const sezione = "bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3";
const titoloSezione = "text-sm font-bold text-slate-200 flex items-center gap-2";
const piccolo = "p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30";
const pulsanteTiro = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed";

export default function PannelloRiposoBreve({ char, d, chiediTiro, onConferma, onAnnulla }: Props) {
  const [ore, setOre] = useState(1);
  const [tiriDadiVita, setTiriDadiVita] = useState<number[]>([]);
  const [quantiDadi, setQuantiDadi] = useState(1);
  const [facceCanto, setFacceCanto] = useState(0);
  const [tiroCanto, setTiroCanto] = useState<number | null>(null);
  const [tiroStabile, setTiroStabile] = useState<number | null>(null);
  const [recupero, setRecupero] = useState<number[]>([]);

  const modCOS = d.mod("COS");
  // Le risorse a ricarica breve che hanno usi spesi tornano piene alla fine del riposo.
  const ricaricabili = d.risorse.filter(r => r.ricarica === "breve" && r.usati > 0);
  const { pfAttuali, pfMassimi, dadiVitaRimanenti } = char.combattimento;
  const dadiDisponibili = dadiVitaRimanenti - tiriDadiVita.length;

  const pfDaDadi = tiriDadiVita.reduce((acc, t) => acc + Math.max(0, t + modCOS), 0);
  // Il Canto di Riposo si applica solo se si spende almeno un Dado Vita.
  const pfCanto = tiriDadiVita.length > 0 && facceCanto > 0 && tiroCanto !== null ? tiroCanto : 0;
  const { stabile } = char.combattimento;
  const pfStabile = pfAttuali === 0 && stabile && tiroStabile !== null && tiroStabile <= ore ? 1 : 0;
  const pfTotali = pfDaDadi + pfCanto + pfStabile;
  const pfFinali = Math.min(pfMassimi, pfAttuali + pfTotali);

  const spesi = (i: number) => Math.min(char.slotSpesi[i] ?? 0, d.slotMax[i] ?? 0);
  // Recupero Arcano non recupera slot di 6° livello o superiore.
  const livelliRecuperabili = d.slotMax.slice(0, 5).map((_, i) => i).filter(i => spesi(i) > 0);
  const livelliScelti = recupero.reduce((acc, n, i) => acc + n * (i + 1), 0);

  const tiraDadiVita = async () => {
    const n = Math.min(quantiDadi, dadiDisponibili);
    if (n <= 0) return;
    const tiri = await chiediTiro({
      titolo: n === 1 ? "Dado Vita" : `${n} Dadi Vita`,
      descrizione: `Ogni dado recupera 1d${d.dadoVita} ${segno(modCOS)} PF.`,
      dadi: Array.from({ length: n }, (_, i) => ({ etichetta: `Dado Vita ${tiriDadiVita.length + i + 1}`, facce: d.dadoVita })),
      bonus: modCOS,
    });
    if (!tiri) return;
    setTiriDadiVita(prev => [...prev, ...tiri]);
    setQuantiDadi(1);
  };

  const tiraCanto = async () => {
    const tiri = await chiediTiro({
      titolo: "Canto di Riposo",
      descrizione: "PF extra concessi dal bardo del gruppo.",
      dadi: [{ etichetta: "Canto di Riposo", facce: facceCanto }],
    });
    if (tiri) setTiroCanto(tiri[0]);
  };

  const tiraStabile = async () => {
    const tiri = await chiediTiro({
      titolo: "Recupero da stabilizzato",
      descrizione: "Una creatura stabile a 0 PF recupera 1 PF dopo 1d4 ore.",
      dadi: [{ etichetta: "Ore necessarie", facce: 4 }],
    });
    if (tiri) setTiroStabile(tiri[0]);
  };

  const cambiaRecupero = (i: number, delta: number) => {
    const prossimo = (recupero[i] ?? 0) + delta;
    if (prossimo < 0 || prossimo > spesi(i)) return;
    if (delta > 0 && livelliScelti + (i + 1) > d.budgetRecuperoArcano) return;
    const copia = [...recupero];
    copia[i] = prossimo;
    setRecupero(copia);
  };

  const conferma = () => {
    const slotRecuperati = Array.from({ length: recupero.length }, (_, i) => recupero[i] ?? 0);
    const parti = [`Riposo breve di ${ore} ${ore === 1 ? "ora" : "ore"}`];
    if (tiriDadiVita.length > 0) parti.push(`${tiriDadiVita.length} Dadi Vita (${tiriDadiVita.join(", ")})`);
    if (pfCanto > 0) parti.push(`Canto di Riposo +${pfCanto}`);
    if (pfStabile > 0) parti.push("stabilizzato +1");
    if (pfTotali > 0) parti.push(`+${pfFinali - pfAttuali} PF`);
    if (ricaricabili.length > 0) parti.push(`Risorse ricaricate: ${ricaricabili.map(r => r.nome).join(", ")}`);
    if (livelliScelti > 0) {
      const slot = slotRecuperati.flatMap((n, i) => (n > 0 ? [`${n}× ${i + 1}°`] : [])).join(", ");
      parti.push(`Recupero Arcano: ${slot}`);
    }
    onConferma({ dadiVitaSpesi: tiriDadiVita.length, pfRecuperati: pfTotali, slotRecuperati }, parti.join(" · ") + ".");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Coffee className="w-5 h-5 text-amber-400" /> Riposo Breve
            </h2>
            <p className="text-xs text-slate-400 mt-1">Almeno 1 ora senza attività faticose: niente combattimenti, marce o lanci di incantesimi impegnativi.</p>
          </div>
          <button onClick={onAnnulla} title="Annulla" className="text-slate-500 hover:text-slate-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* DURATA */}
        <div className={sezione}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={titoloSezione}><Clock className="w-4 h-4 text-sky-400" /> Durata</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setOre(o => Math.max(1, o - 1))} disabled={ore <= 1} className={piccolo}><Minus className="w-3 h-3" /></button>
              <span className="w-14 text-center font-mono font-bold text-slate-100">{ore} {ore === 1 ? "ora" : "ore"}</span>
              <button onClick={() => setOre(o => Math.min(23, o + 1))} className={piccolo}><Plus className="w-3 h-3" /></button>
            </div>
          </div>
          {ore >= 8 && (
            <p className="text-xs text-amber-300">Con 8 ore di riposo puoi fare un riposo lungo, che ripristina anche PF e slot.</p>
          )}
        </div>

        {/* DADI VITA */}
        <div className={sezione}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={titoloSezione}><Heart className="w-4 h-4 text-rose-400" /> Dadi Vita</h3>
            <span className="text-xs text-slate-400">Disponibili: <strong className="text-slate-200">{dadiDisponibili}/{char.info.livello}</strong> d{d.dadoVita} {segno(modCOS)}</span>
          </div>
          {dadiDisponibili > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setQuantiDadi(n => Math.max(1, n - 1))} disabled={quantiDadi <= 1} className={piccolo}><Minus className="w-3 h-3" /></button>
              <span className="w-6 text-center font-mono font-bold text-slate-100">{Math.min(quantiDadi, dadiDisponibili)}</span>
              <button onClick={() => setQuantiDadi(n => Math.min(dadiDisponibili, n + 1))} disabled={quantiDadi >= dadiDisponibili} className={piccolo}><Plus className="w-3 h-3" /></button>
              <button onClick={tiraDadiVita} className={pulsanteTiro}>
                <Dices className="w-3.5 h-3.5" /> Tira {Math.min(quantiDadi, dadiDisponibili) === 1 ? "Dado Vita" : "Dadi Vita"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Nessun Dado Vita rimasto: tornano con il riposo lungo.</p>
          )}
          {tiriDadiVita.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {tiriDadiVita.map((t, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono">
                  {t} {segno(modCOS)} = <strong className="text-emerald-400">{Math.max(0, t + modCOS)}</strong>
                </span>
              ))}
              <button onClick={() => setTiriDadiVita([])} className="text-slate-500 hover:text-rose-300 underline">annulla tiri</button>
            </div>
          )}
          <p className="text-[11px] text-slate-500">Puoi tirarli uno alla volta e decidere dopo ogni tiro se spenderne altri.</p>
        </div>

        {/* CANTO DI RIPOSO */}
        <div className={sezione}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={titoloSezione}><Music className="w-4 h-4 text-pink-400" /> Canto di Riposo</h3>
            <select
              value={facceCanto}
              onChange={e => { setFacceCanto(Number(e.target.value)); setTiroCanto(null); }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500"
            >
              {DADI_CANTO.map(c => <option key={c.facce} value={c.facce}>{c.label}</option>)}
            </select>
          </div>
          {facceCanto > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button onClick={tiraCanto} disabled={tiriDadiVita.length === 0} className={pulsanteTiro}>
                <Dices className="w-3.5 h-3.5" /> Tira d{facceCanto}
              </button>
              {tiroCanto !== null && <span className="text-slate-300">+<strong className="text-emerald-400">{tiroCanto}</strong> PF</span>}
              {tiriDadiVita.length === 0 && <span className="text-slate-500">Serve almeno un Dado Vita speso.</span>}
            </div>
          )}
        </div>

        {/* STABILIZZATO A 0 PF */}
        {pfAttuali === 0 && !stabile && (
          <div className={`${sezione} border-rose-900/60`}>
            <h3 className={titoloSezione}><Heart className="w-4 h-4 text-rose-500" /> Sei a 0 PF e non sei stabile</h3>
            <p className="text-xs text-slate-400">Tira i tiri salvezza contro morte (nella card dei Punti Ferita) finché non sei stabile, o fatti curare.</p>
          </div>
        )}
        {pfAttuali === 0 && stabile && (
          <div className={`${sezione} border-rose-900/60`}>
            <h3 className={titoloSezione}><Heart className="w-4 h-4 text-rose-500" /> A terra ma stabilizzato</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button onClick={tiraStabile} className={pulsanteTiro}><Dices className="w-3.5 h-3.5" /> Tira 1d4 ore</button>
              {tiroStabile !== null && (
                <span className="text-slate-300">
                  {tiroStabile} {tiroStabile === 1 ? "ora" : "ore"}: {pfStabile ? <strong className="text-emerald-400">+1 PF</strong> : `servono ${tiroStabile - ore} ore in più`}
                </span>
              )}
            </div>
          </div>
        )}

        {d.pattoMagico && (
          <div className={sezione}>
            <p className="text-xs text-slate-300">Gli slot del patto tornano tutti disponibili alla fine del riposo.</p>
          </div>
        )}

        {/* RECUPERO ARCANO (solo Mago) */}
        {d.haRecuperoArcano && (
          <div className={sezione}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={titoloSezione}><RotateCcw className="w-4 h-4 text-emerald-400" /> Recupero Arcano</h3>
              <span className="text-xs text-slate-400">Livelli: <strong className="text-slate-200">{livelliScelti}/{d.budgetRecuperoArcano}</strong></span>
            </div>
            {char.recuperoArcanoUsato ? (
              <p className="text-xs text-slate-500">Già usato oggi: torna disponibile dopo un riposo lungo.</p>
            ) : livelliRecuperabili.length === 0 ? (
              <p className="text-xs text-slate-500">Nessuno slot speso da recuperare.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {livelliRecuperabili.map(i => (
                  <div key={i} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300">
                    <span>{i + 1}° liv. <span className="text-slate-500">({spesi(i)} spesi)</span></span>
                    <button onClick={() => cambiaRecupero(i, -1)} className={piccolo}><Minus className="w-3 h-3" /></button>
                    <span className="font-mono font-bold w-3 text-center">{recupero[i] ?? 0}</span>
                    <button onClick={() => cambiaRecupero(i, 1)} className={piccolo}><Plus className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-500">Una volta al giorno, fino al 5° livello di slot.</p>
          </div>
        )}

        {/* RISORSE CHE TORNANO */}
        {ricaricabili.length > 0 && (
          <div className={sezione}>
            <h3 className={titoloSezione}><Zap className="w-4 h-4 text-amber-400" /> Risorse che tornano disponibili</h3>
            <p className="text-xs text-slate-300">
              {ricaricabili.map(r => `${r.nome} (${r.usati} ${r.unita ?? (r.usati === 1 ? "uso" : "usi")})`).join(", ")}.
            </p>
          </div>
        )}

        {/* RIEPILOGO */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-sm text-slate-300">
            PF: <strong className="text-slate-100">{pfAttuali}</strong> → <strong className="text-emerald-400">{pfFinali}</strong> / {pfMassimi}
          </div>
          <div className="flex gap-2">
            <button onClick={onAnnulla} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold">
              Annulla
            </button>
            <button onClick={conferma} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
              Completa riposo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
