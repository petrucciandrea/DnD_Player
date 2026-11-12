import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, ArrowUpCircle } from "lucide-react";
import type { CharacterData, IncantesimoCatalogo, Privilegio, XPRecord } from "@dnd/regole/tipi.ts";
import type { SetChar } from "../stato.ts";
import type { ChiediTiro } from "../tiroDadi.ts";
import type { Derivate } from "@dnd/regole/regole.ts";
import { applicaSalita, privilegiMancanti, sceltePendenti } from "@dnd/regole/regole.ts";
import { regoleClasse } from "@dnd/regole/dati/classi.ts";
import { opzioniScelta, type DefinizioneScelta } from "@dnd/regole/dati/scelte.ts";
import { catalogoCreazione, privilegiFinoAlLivello } from "../accesso";
import PannelloSalita, { SceltaPrivilegio } from "./PannelloSalita";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
  chiediTiro: ChiediTiro;
}

// I privilegi corrispondenti alle opzioni scelte.
const privilegiScelti = (scelte: Record<string, string[]>, pendenti: { scelta: DefinizioneScelta }[], catalogo: Privilegio[]) =>
  pendenti.flatMap(({ scelta }) => opzioniScelta(scelta, catalogo).filter(o => (scelte[scelta.id] ?? []).includes(o.nome)));

export default function TabProgresso({ char, d, setChar, chiediTiro }: Props) {
  const [newXpInput, setNewXpInput] = useState({ valore: "", motivo: "" });
  const [salita, setSalita] = useState(false); // pannello di salita aperto
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
  const regole = regoleClasse(char.info.classe);

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
            onClick={() => setSalita(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
          >
            <ArrowUpCircle className="w-4 h-4" /> Sali al livello {livello + 1}
          </button>
        )}
        {salita && (
          <div className="mt-4">
            <PannelloSalita
              key={livello}
              char={char}
              chiediTiro={chiediTiro}
              opzioni={opzioni}
              incantesimiCatalogo={incantesimiCatalogo}
              onAnnulla={() => setSalita(false)}
              onConferma={scelta => {
                setChar(prev => applicaSalita(prev, scelta, incantesimiCatalogo));
                setSalita(false);
              }}
            />
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
