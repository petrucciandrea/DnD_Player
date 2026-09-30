import { useEffect, useState, type FormEvent } from "react";
import { Check, Hammer, Minus, Plus, RotateCcw, ShieldAlert, Swords, Trash2, Wrench, X } from "lucide-react";
import type { Arma, ArmaPersonaggio, CharacterData, SetChar } from "../tipi";
import type { Derivate } from "../regole";
import {
  COLPO_SENZA_ARMI, MUNIZIONI_INIZIALI, danneggiaArma, nuovaArma, parseDado, recuperaMunizioni, ricaricaArma, riparaArma, rompiArma, segno,
  statoArma, testoDanni, usaArma, usaMunizioni,
} from "../regole";
import { catalogoCreazione } from "../accesso";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
  onAttacco: (arma: ArmaPersonaggio) => Promise<boolean>; // true se il tiro per colpire è stato fatto
}

const TIPI_DANNO = ["Contundente", "Perforante", "Tagliente"];
const piccolo = "p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30";
const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500";

const ARMA_VUOTA = {
  nome: "", dado: "1d6", dadoVersatile: "", tipoDanno: "Tagliente", proprieta: "", accurata: false, distanza: false,
  categoria: "semplice" as "semplice" | "guerra",
};

// Numero intero positivo da un campo di testo, oppure null se vuoto o non valido.
const positivo = (v: string) => {
  const n = Math.trunc(Number(v));
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

// Armi del personaggio: attacco, munizioni, durabilità, rotta/riparata; aggiunta dal catalogo o personalizzata.
export default function PannelloArmi({ char, d, setChar, onAttacco }: Props) {
  const [catalogo, setCatalogo] = useState<Arma[]>([]);
  const [aggiunta, setAggiunta] = useState<"catalogo" | "personalizzata" | null>(null);
  const [scelta, setScelta] = useState("");
  const [nuova, setNuova] = useState(ARMA_VUOTA);
  const [istanza, setIstanza] = useState({ bonus: "0", munizioni: "", durabilita: "" });
  const [errore, setErrore] = useState<string | null>(null);
  const [inDanno, setInDanno] = useState<{ id: number; colpi: string } | null>(null); // arma che si sta danneggiando

  useEffect(() => {
    let attivo = true;
    catalogoCreazione().then(c => {
      if (attivo && c) setCatalogo(c.armi);
    });
    return () => { attivo = false; };
  }, []);

  const attacca = async (arma: ArmaPersonaggio) => {
    if (await onAttacco(arma)) setChar(prev => usaArma(prev, arma.id));
  };

  const scegliDalCatalogo = (nome: string) => {
    setScelta(nome);
    const arma = catalogo.find(a => a.nome === nome);
    setIstanza(prev => ({ ...prev, munizioni: arma && usaMunizioni(arma) ? String(MUNIZIONI_INIZIALI) : "" }));
  };

  const chiudi = () => {
    setAggiunta(null);
    setScelta("");
    setNuova(ARMA_VUOTA);
    setIstanza({ bonus: "0", munizioni: "", durabilita: "" });
    setErrore(null);
  };

  // I dati dell'arma: dal catalogo, oppure dal form (validando i dadi).
  const armaDaForm = (): Arma | string => {
    if (aggiunta === "catalogo") return catalogo.find(a => a.nome === scelta) ?? "Scegli un'arma.";
    if (!nuova.nome.trim()) return "Inserisci il nome dell'arma.";
    try {
      parseDado(nuova.dado);
      if (nuova.dadoVersatile.trim()) parseDado(nuova.dadoVersatile);
    } catch {
      return "Dado non valido: scrivi per esempio 1d8 o 2d6.";
    }
    return {
      nome: nuova.nome.trim(), dado: nuova.dado.trim(), tipoDanno: nuova.tipoDanno, proprieta: nuova.proprieta.trim(),
      accurata: nuova.accurata, categoria: nuova.categoria,
      ...(nuova.dadoVersatile.trim() ? { dadoVersatile: nuova.dadoVersatile.trim() } : {}),
      ...(nuova.distanza ? { distanza: true } : {}),
    };
  };

  const aggiungi = (e: FormEvent) => {
    e.preventDefault();
    const arma = armaDaForm();
    if (typeof arma === "string") return setErrore(arma);
    const munizioni = positivo(istanza.munizioni);
    const durabilita = positivo(istanza.durabilita);
    const copia: ArmaPersonaggio = {
      ...nuovaArma(arma, Date.now()),
      bonus: Math.trunc(Number(istanza.bonus)) || 0,
      munizioni: munizioni ? { rimasti: munizioni, massimo: munizioni } : null,
      durabilita: durabilita ? { rimasti: durabilita, massimo: durabilita } : null,
    };
    setChar(prev => ({ ...prev, armi: [...prev.armi, copia] }));
    chiudi();
  };

  // Proposta: un colpo in meno di quelli che restano, oppure 3 per un'arma intatta.
  const apriDanno = (a: ArmaPersonaggio) =>
    setInDanno({ id: a.id, colpi: String(Math.max(1, (a.durabilita?.rimasti ?? a.danneggiata ?? 4) - 1)) });

  const confermaDanno = (e: FormEvent) => {
    e.preventDefault();
    if (!inDanno) return;
    const colpi = Math.trunc(Number(inDanno.colpi));
    if (!Number.isFinite(colpi) || colpi < 0) return;
    setChar(prev => danneggiaArma(prev, inDanno.id, colpi));
    setInDanno(null);
  };

  const rimuovi = (a: ArmaPersonaggio) => {
    if (confirm(`Togliere ${a.nome} dalle armi?`)) setChar(prev => ({ ...prev, armi: prev.armi.filter(x => x.id !== a.id) }));
  };

  const giaNelCatalogo = aggiunta === "personalizzata"
    && catalogo.some(a => a.nome.toLowerCase() === nuova.nome.trim().toLowerCase());

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Armi da Mischia / Distanza</h3>
        {!aggiunta && (
          <button onClick={() => setAggiunta("catalogo")} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white">
            <Plus className="w-3.5 h-3.5" /> Aggiungi arma
          </button>
        )}
      </div>

      {d.attacchiPerAzione > 1 && (
        <p className="text-xs text-indigo-300 mb-2">Attacco Extra: {d.attacchiPerAzione} attacchi con l'azione di Attacco.</p>
      )}
      {char.armi.length === 0 && !aggiunta && <p className="text-xs text-slate-500 mb-2">Nessuna arma.</p>}

      <div className="space-y-2">
        {(() => {
          const { bonus, danni } = d.attaccoArma(COLPO_SENZA_ARMI);
          return (
            <button
              onClick={() => onAttacco(COLPO_SENZA_ARMI)}
              title="Tira per colpire"
              className="w-full flex flex-wrap justify-between items-center gap-2 px-3 py-2 rounded-lg border border-slate-800/60 hover:bg-slate-800/40 text-sm text-left transition"
            >
              <span className="text-slate-400">
                Colpo senz'armi{d.artiMarziali && <span className="ml-2 text-[10px] uppercase font-bold text-indigo-300">Arti Marziali</span>}
              </span>
              <span className="flex gap-4 text-xs font-mono">
                <span className="text-indigo-300 font-bold">Attacco: {segno(bonus)}</span>
                <span className="text-amber-300">Danno: {testoDanni(danni)}</span>
              </span>
            </button>
          );
        })()}
        {char.armi.map(arma => {
          const { bonus, competente, danni, danniDueMani } = d.attaccoArma(arma);
          const { utilizzabile, motivo } = statoArma(arma);
          const danno = testoDanni(danni) + (danniDueMani ? ` / ${testoDanni(danniDueMani)}` : "");
          return (
            <div key={arma.id} className={`rounded-lg border ${arma.rotta ? "border-rose-900/60 bg-rose-950/10" : "border-slate-800 bg-slate-950/60"}`}>
              <button
                onClick={() => attacca(arma)}
                disabled={!utilizzabile}
                title={motivo ?? "Tira per colpire"}
                className="w-full flex flex-wrap justify-between items-center gap-2 p-3 hover:bg-slate-800/40 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-t-lg text-sm text-left transition"
              >
                <span>
                  <span className={`font-semibold ${arma.rotta ? "text-slate-500 line-through" : "text-slate-200"}`}>
                    {arma.nome}{arma.bonus !== 0 && ` ${segno(arma.bonus)}`}
                  </span>
                  {arma.rotta && <span className="ml-2 text-[10px] uppercase font-bold text-rose-400">Rotta</span>}
                  {!competente && (
                    <span title="Nessuna competenza in quest'arma: il bonus di competenza non si aggiunge all'attacco" className="ml-2 text-[10px] uppercase font-bold text-amber-400">
                      Non competente
                    </span>
                  )}
                  <span className="block text-[11px] text-slate-500">{arma.proprieta}</span>
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono">
                  <span className="text-indigo-300 font-bold">Attacco: {segno(bonus)}</span>
                  <span className="text-amber-300">Danno: {danno}</span>
                  <span className="text-slate-400">{arma.tipoDanno}</span>
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 pb-2 text-xs text-slate-400">
                {arma.munizioni && (
                  <span className="flex items-center gap-1.5">
                    Munizioni
                    <button onClick={() => setChar(prev => ricaricaArma(prev, arma.id, -1))} disabled={arma.munizioni.rimasti <= 0} className={piccolo}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className={`font-mono font-bold ${arma.munizioni.rimasti === 0 ? "text-rose-400" : "text-slate-200"}`}>
                      {arma.munizioni.rimasti}/{arma.munizioni.massimo}
                    </span>
                    <button onClick={() => setChar(prev => ricaricaArma(prev, arma.id, 1))} disabled={arma.munizioni.rimasti >= arma.munizioni.massimo} className={piccolo}>
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setChar(prev => recuperaMunizioni(prev, arma.id))}
                      disabled={arma.munizioni.massimo - arma.munizioni.rimasti < 2}
                      title="Dopo lo scontro: recupera metà delle munizioni spese"
                      className={`${piccolo} flex items-center gap-1 px-1.5`}
                    >
                      <RotateCcw className="w-3 h-3" /> Recupera
                    </button>
                  </span>
                )}
                {arma.durabilita && (
                  <span>
                    Durabilità{" "}
                    <span className={`font-mono font-bold ${arma.durabilita.rimasti === 0 ? "text-rose-400" : "text-slate-200"}`}>
                      {arma.durabilita.rimasti}/{arma.durabilita.massimo}
                    </span>
                  </span>
                )}
                {arma.danneggiata !== null && !arma.rotta && (
                  <span className="text-amber-300">
                    Danneggiata: <span className="font-mono font-bold">{arma.danneggiata}</span> {arma.danneggiata === 1 ? "colpo" : "colpi"} prima di rompersi
                  </span>
                )}
                <span className="flex items-center gap-1 ml-auto">
                  {!arma.rotta && inDanno?.id !== arma.id && (
                    <button onClick={() => apriDanno(arma)} title="L'arma è danneggiata: regge ancora pochi colpi" className={`${piccolo} flex items-center gap-1 px-1.5`}>
                      <ShieldAlert className="w-3 h-3" /> Danneggia
                    </button>
                  )}
                  {arma.rotta ? (
                    <button onClick={() => setChar(prev => riparaArma(prev, arma.id))} title="Ripara l'arma" className={`${piccolo} flex items-center gap-1 px-1.5 text-emerald-300`}>
                      <Wrench className="w-3 h-3" /> Ripara
                    </button>
                  ) : (
                    <button
                      onClick={() => confirm(`Segnare ${arma.nome} come rotta?`) && setChar(prev => rompiArma(prev, arma.id))}
                      title="L'arma si è rotta"
                      className={`${piccolo} flex items-center gap-1 px-1.5`}
                    >
                      <Hammer className="w-3 h-3" /> Rompi
                    </button>
                  )}
                  <button onClick={() => rimuovi(arma)} title="Togli l'arma" className="p-1 text-slate-500 hover:text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
              {inDanno?.id === arma.id && (
                <form onSubmit={confermaDanno} className="flex flex-wrap items-center gap-2 px-3 pb-2 text-xs text-slate-300">
                  Colpi che regge ancora
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    value={inDanno.colpi}
                    onChange={e => setInDanno({ ...inDanno, colpi: e.target.value })}
                    className={`${campo} w-16`}
                  />
                  <button type="submit" title="Conferma" className={`${piccolo} text-amber-300`}><Check className="w-3 h-3" /></button>
                  <button type="button" onClick={() => setInDanno(null)} title="Annulla" className={piccolo}><X className="w-3 h-3" /></button>
                  <span className="text-slate-500">(0 = si rompe subito)</span>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {aggiunta && (
        <form onSubmit={aggiungi} className="mt-3 p-3 rounded-lg border border-indigo-900/50 bg-indigo-950/20 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 text-xs font-semibold">
              {(["catalogo", "personalizzata"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setAggiunta(m); setErrore(null); }}
                  className={`px-2.5 py-1 rounded-lg border ${aggiunta === m ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400"}`}
                >
                  {m === "catalogo" ? "Dal catalogo" : "Personalizzata"}
                </button>
              ))}
            </div>
            <button type="button" onClick={chiudi} title="Annulla" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
          </div>

          {aggiunta === "catalogo" ? (
            <select value={scelta} onChange={e => scegliDalCatalogo(e.target.value)} className={`${campo} w-full`}>
              <option value="">{catalogo.length ? "Scegli un'arma..." : "Catalogo non raggiungibile"}</option>
              {(["semplice", "guerra"] as const).map(cat => (
                <optgroup key={cat} label={cat === "semplice" ? "Armi semplici" : "Armi da guerra"}>
                  {catalogo.filter(a => a.categoria === cat).map(a => (
                    <option key={a.nome} value={a.nome}>{a.nome} ({a.dado} {a.tipoDanno.toLowerCase()})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input value={nuova.nome} onChange={e => setNuova({ ...nuova, nome: e.target.value })} placeholder="Nome" className={`${campo} col-span-2`} />
              <input value={nuova.dado} onChange={e => setNuova({ ...nuova, dado: e.target.value })} placeholder="Dado (1d8)" className={campo} />
              <input value={nuova.dadoVersatile} onChange={e => setNuova({ ...nuova, dadoVersatile: e.target.value })} placeholder="A due mani (facoltativo)" className={campo} />
              <select value={nuova.tipoDanno} onChange={e => setNuova({ ...nuova, tipoDanno: e.target.value })} className={campo}>
                {TIPI_DANNO.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={nuova.categoria} onChange={e => setNuova({ ...nuova, categoria: e.target.value as "semplice" | "guerra" })} className={campo}>
                <option value="semplice">Semplice</option>
                <option value="guerra">Da guerra</option>
              </select>
              <input value={nuova.proprieta} onChange={e => setNuova({ ...nuova, proprieta: e.target.value })} placeholder="Proprietà" className={`${campo} col-span-2`} />
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                <input type="checkbox" checked={nuova.accurata} onChange={e => setNuova({ ...nuova, accurata: e.target.checked })} className="accent-indigo-500" /> Accurata
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                <input type="checkbox" checked={nuova.distanza} onChange={e => setNuova({ ...nuova, distanza: e.target.checked })} className="accent-indigo-500" /> A distanza
              </label>
              {giaNelCatalogo && (
                <p className="col-span-full text-[11px] text-amber-300">Un'arma con questo nome è già nel catalogo: verranno usati i suoi dati.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
            <label className="space-y-1">
              <span className="block">Bonus magico</span>
              <input type="number" value={istanza.bonus} onChange={e => setIstanza({ ...istanza, bonus: e.target.value })} className={`${campo} w-full`} />
            </label>
            <label className="space-y-1">
              <span className="block">Munizioni / cariche</span>
              <input type="number" min={1} value={istanza.munizioni} onChange={e => setIstanza({ ...istanza, munizioni: e.target.value })} placeholder="nessuna" className={`${campo} w-full`} />
            </label>
            <label className="space-y-1">
              <span className="block">Durabilità (usi)</span>
              <input type="number" min={1} value={istanza.durabilita} onChange={e => setIstanza({ ...istanza, durabilita: e.target.value })} placeholder="illimitata" className={`${campo} w-full`} />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">Munizioni e durabilità scendono di 1 a ogni tiro per colpire; a durabilità 0 l'arma si rompe.</p>
          {errore && <p className="text-xs text-rose-400">{errore}</p>}
          <button type="submit" className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
            <Swords className="w-3.5 h-3.5" /> Aggiungi
          </button>
        </form>
      )}
    </div>
  );
}
