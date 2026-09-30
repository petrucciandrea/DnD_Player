import { useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { CharacterData, CompetenzeAltre, Privilegio, SetChar } from "../tipi";
import { GIOCHI, LINGUE, STRUMENTI_ARTIGIANO, STRUMENTI_MUSICALI } from "../dati/classi";
import { COMPETENZE_ARMI } from "../dati/competenze";

const TRATTI: { k: keyof CharacterData["lore"]; titolo: string }[] = [
  { k: "tratti", titolo: "Tratti Caratteriali" },
  { k: "ideali", titolo: "Ideali" },
  { k: "legami", titolo: "Legami" },
  { k: "difetti", titolo: "Difetti" },
];

const COMPETENZE: { k: keyof CompetenzeAltre; titolo: string; suggerimenti: string[] }[] = [
  { k: "lingue", titolo: "Lingue", suggerimenti: LINGUE },
  { k: "strumenti", titolo: "Strumenti", suggerimenti: [...STRUMENTI_ARTIGIANO, ...STRUMENTI_MUSICALI, ...GIOCHI, "Arnesi da scasso", "Trucchi per il camuffamento", "Strumenti da falsario", "Borsa da erborista", "Strumenti da navigatore", "Veicoli (terrestri)", "Veicoli (acquatici)"] },
  { k: "armi", titolo: "Armi", suggerimenti: COMPETENZE_ARMI },
  { k: "armature", titolo: "Armature", suggerimenti: ["Armature leggere", "Armature medie", "Armature pesanti", "Tutte le armature", "Scudi"] },
];

const FONTI_PRIVILEGIO = ["Talento", "Oggetto magico", "Dono", "Altro"];
const PRIVILEGIO_VUOTO = { nome: "", fonte: "Talento", descrizione: "" };
const campo = "bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500";

// Aggiunta di un privilegio fuori dal catalogo di classe (talenti, doni, oggetti magici).
function NuovoPrivilegio({ esistenti, onAggiungi }: { esistenti: Privilegio[]; onAggiungi: (p: Privilegio) => void }) {
  const [p, setP] = useState(PRIVILEGIO_VUOTO);
  const [errore, setErrore] = useState<string | null>(null);
  const aggiungi = (e: FormEvent) => {
    e.preventDefault();
    const nuovo = { nome: p.nome.trim(), fonte: p.fonte.trim() || "Altro", descrizione: p.descrizione.trim() };
    if (!nuovo.nome) return setErrore("Inserisci il nome del privilegio.");
    const chiave = (x: Privilegio) => `${x.nome}|${x.fonte}`.toLowerCase();
    if (esistenti.some(x => chiave(x) === chiave(nuovo))) return setErrore("La scheda ha già questo privilegio.");
    onAggiungi(nuovo);
    setP(PRIVILEGIO_VUOTO);
    setErrore(null);
  };
  return (
    <form onSubmit={aggiungi} className="bg-slate-900 border border-dashed border-slate-700 p-4 rounded-xl space-y-2">
      <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Nuovo privilegio</h3>
      <div className="grid grid-cols-2 gap-2">
        <input value={p.nome} onChange={e => setP({ ...p, nome: e.target.value })} placeholder="Nome" className={campo} />
        <input value={p.fonte} onChange={e => setP({ ...p, fonte: e.target.value })} list="fonti-privilegio" placeholder="Fonte" className={campo} />
        <datalist id="fonti-privilegio">
          {FONTI_PRIVILEGIO.map(f => <option key={f} value={f} />)}
        </datalist>
      </div>
      <textarea
        value={p.descrizione}
        onChange={e => setP({ ...p, descrizione: e.target.value })}
        placeholder="Descrizione"
        rows={2}
        className={`${campo} w-full`}
      />
      {errore && <p className="text-xs text-rose-400">{errore}</p>}
      <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
        <Plus className="w-3.5 h-3.5" /> Aggiungi privilegio
      </button>
    </form>
  );
}

function ListaCompetenze({ titolo, voci, suggerimenti, onAggiungi, onRimuovi }: {
  titolo: string; voci: string[]; suggerimenti: string[]; onAggiungi: (v: string) => void; onRimuovi: (v: string) => void;
}) {
  const [nuova, setNuova] = useState("");
  const idLista = `suggerimenti-${titolo}`;
  const aggiungi = (e: FormEvent) => {
    e.preventDefault();
    const v = nuova.trim();
    if (v && !voci.some(x => x.toLowerCase() === v.toLowerCase())) onAggiungi(v);
    setNuova("");
  };
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{titolo}</h4>
      <div className="flex flex-wrap gap-1.5">
        {voci.length === 0 && <span className="text-xs text-slate-500">Nessuna</span>}
        {voci.map(v => (
          <span key={v} className="group flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-200">
            {v}
            <button onClick={() => onRimuovi(v)} title={`Rimuovi ${v}`} className="text-slate-500 hover:text-rose-300">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={aggiungi} className="flex gap-1.5">
        <input
          value={nuova}
          onChange={e => setNuova(e.target.value)}
          list={idLista}
          placeholder="Aggiungi..."
          className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500"
        />
        <datalist id={idLista}>
          {suggerimenti.filter(s => !voci.includes(s)).map(s => <option key={s} value={s} />)}
        </datalist>
        <button type="submit" title="Aggiungi" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

export default function TabLore({ char, setChar }: { char: CharacterData; setChar: SetChar }) {
  const { info } = char;
  const dettagli = [
    ["Età", info.eta ? `${info.eta} anni` : ""],
    ["Altezza", info.altezza],
    ["Peso", info.peso],
    ["Occhi", info.occhi],
    ["Capelli", info.capelli],
    ["Carnagione", info.carnagione],
    ["Taglia", info.taglia],
    ["Giocatore", info.giocatore],
  ].filter(([, valore]) => valore);

  const cambiaCompetenze = (k: keyof CompetenzeAltre, voci: (prima: string[]) => string[]) =>
    setChar(prev => ({ ...prev, competenzeAltre: { ...prev.competenzeAltre, [k]: voci(prev.competenzeAltre[k]) } }));

  const rimuoviPrivilegio = (p: Privilegio) => {
    if (!confirm(`Togliere il privilegio ${p.nome} (${p.fonte}) dalla scheda?`)) return;
    setChar(prev => ({ ...prev, privilegi: prev.privilegi.filter(x => !(x.nome === p.nome && x.fonte === p.fonte)) }));
  };

  return (
    <div className="space-y-6 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {TRATTI.map(t => (
            <div key={t.k} className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">{t.titolo}</h3>
              <p className="text-slate-300 leading-relaxed">{char.lore[t.k] || <span className="text-slate-500">Non ancora scritto.</span>}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Biografia</h3>
            <p className="text-slate-300 leading-relaxed text-xs sm:text-sm whitespace-pre-line">
              {char.lore.backgroundBio || <span className="text-slate-500">Nessuna biografia.</span>}
            </p>
            {dettagli.length > 0 && (
              <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-400">
                {dettagli.map(([etichetta, valore]) => (
                  <div key={etichetta}>{etichetta}: <strong className="text-slate-200">{valore}</strong></div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Competenze e Lingue</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COMPETENZE.map(c => (
                <ListaCompetenze
                  key={c.k}
                  titolo={c.titolo}
                  voci={char.competenzeAltre[c.k]}
                  suggerimenti={c.suggerimenti}
                  onAggiungi={v => cambiaCompetenze(c.k, prima => [...prima, v])}
                  onRimuovi={v => cambiaCompetenze(c.k, prima => prima.filter(x => x !== v))}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-200 mb-3">Privilegi di Razza, Classe e Background</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {char.privilegi.map(p => (
            <div key={`${p.nome}|${p.fonte}`} className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-bold text-slate-200">{p.nome}</h3>
                <span className="flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                    {p.fonte}
                  </span>
                  <button onClick={() => rimuoviPrivilegio(p)} title={`Togli ${p.nome}`} className="p-1 text-slate-600 hover:text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{p.descrizione}</p>
            </div>
          ))}
          <NuovoPrivilegio esistenti={char.privilegi} onAggiungi={p => setChar(prev => ({ ...prev, privilegi: [...prev.privilegi, p] }))} />
        </div>
      </div>
    </div>
  );
}
