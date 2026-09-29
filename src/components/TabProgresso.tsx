import { useState, type FormEvent } from "react";
import { Plus, Trash2, ArrowUpCircle, LoaderCircle, X } from "lucide-react";
import type { CharacterData, Privilegio, SetChar, XPRecord } from "../tipi";
import type { Derivate } from "../regole";
import { haAumentoCaratteristiche, pfPerLivello, privilegiMancanti, saliDiLivello, slotMassimi } from "../regole";
import { incantatoreDi, regoleClasse } from "../dati/classi";
import { privilegiDiLivello, privilegiFinoAlLivello } from "../accesso";

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
}

// Stato del pannello di salita di livello: privilegi null = in caricamento, "offline" = non disponibili.
interface Salita {
  sottoclasse: string;
  privilegi: Privilegio[] | null | "offline";
}

export default function TabProgresso({ char, d, setChar }: Props) {
  const [newXpInput, setNewXpInput] = useState({ valore: "", motivo: "" });
  const [salita, setSalita] = useState<Salita | null>(null);
  const [verifica, setVerifica] = useState<"attesa" | "offline" | Privilegio[] | null>(null);
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
    setSalita({ sottoclasse, privilegi: null });
    const r = await privilegiDiLivello(char.info.classe, nuovo, sottoclasse);
    setSalita(prev => (prev?.sottoclasse === sottoclasse ? { sottoclasse, privilegi: r ? r.map(x => x.privilegio) : "offline" } : prev));
  };

  const confermaSalita = () => {
    if (!salita || (serveSottoclasse && !salita.sottoclasse)) return;
    const privilegi = Array.isArray(salita.privilegi) ? salita.privilegi : [];
    setChar(prev => saliDiLivello(prev, { privilegi, sottoclasse: serveSottoclasse ? salita.sottoclasse : undefined }));
    setSalita(null);
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
  const sottoclasseDopo = serveSottoclasse ? (salita?.sottoclasse ?? "") : char.info.sottoclasse;
  const incPrima = incantatoreDi(char.info.classe, char.info.sottoclasse);
  const incDopo = incantatoreDi(char.info.classe, sottoclasseDopo);
  const slotPrima = slotMassimi(incPrima, livello);
  const slotDopo = slotMassimi(incDopo, nuovo);
  const nuoviSlot = slotDopo.flatMap((n, i) => (n > (slotPrima[i] ?? 0) ? [`${n - (slotPrima[i] ?? 0)}× ${i + 1}°`] : []));
  const trucchettiInPiu = (incDopo?.trucchetti[nuovo - 1] ?? 0) - (incPrima?.trucchetti[livello - 1] ?? 0);
  const conosciutiInPiu = (incDopo?.conosciuti?.[nuovo - 1] ?? 0) - (incPrima?.conosciuti?.[livello - 1] ?? 0);
  const note = [
    `+${pfPerLivello(char, d.dadoVita)} PF massimi e +1 Dado Vita (d${d.dadoVita}).`,
    nuoviSlot.length > 0 && `Nuovi slot incantesimo: ${nuoviSlot.join(", ")}.`,
    incDopo?.modo === "libro" && "Copia 2 nuovi incantesimi nel libro (tab Grimorio).",
    conosciutiInPiu > 0 && `Puoi imparare ${conosciutiInPiu} ${conosciutiInPiu === 1 ? "nuovo incantesimo" : "nuovi incantesimi"}.`,
    trucchettiInPiu > 0 && `Puoi imparare ${trucchettiInPiu === 1 ? "un nuovo trucchetto" : `${trucchettiInPiu} nuovi trucchetti`}.`,
    haAumentoCaratteristiche(nuovo) && "Aumento dei punteggi di caratteristica: usa \"Modifica\" nella tab Statistiche.",
  ].filter(Boolean);

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
            <button
              onClick={confermaSalita}
              disabled={salita.privilegi === null || (serveSottoclasse && !salita.sottoclasse)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold"
            >
              <ArrowUpCircle className="w-4 h-4" /> Conferma livello {nuovo}
            </button>
          </div>
        )}
      </div>

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
