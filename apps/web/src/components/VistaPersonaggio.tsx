import { useEffect, useState, type ReactNode } from "react";
import { Eye, LoaderCircle, X } from "lucide-react";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import { ABILITA, CARATTERISTICHE, derivate, segno, testoDanni } from "@dnd/regole/regole.ts";
import { condizione, effetto, LIVELLI_INDEBOLIMENTO } from "@dnd/regole/dati/condizioni.ts";
import { schedaNelParty } from "../party";
import Avatar from "./Avatar";

interface Props {
  partyId: number;
  personaggioId: number;
  onSessioneScaduta: () => void;
  onChiudi: () => void;
}

const Sezione = ({ titolo, children }: { titolo: string; children: ReactNode }) => (
  <section className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-2">
    <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{titolo}</h3>
    {children}
  </section>
);

const Valore = ({ etichetta, valore, colore = "text-slate-100" }: { etichetta: string; valore: ReactNode; colore?: string }) => (
  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-center">
    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{etichetta}</div>
    <div className={`text-lg font-black ${colore}`}>{valore}</div>
  </div>
);

// Scheda di un personaggio del party in sola lettura, per il Master: tutto viene da derivate().
export default function VistaPersonaggio({ partyId, personaggioId, onSessioneScaduta, onChiudi }: Props) {
  const [scheda, setScheda] = useState<CharacterData | string | null>(null);

  useEffect(() => {
    let attivo = true;
    schedaNelParty(partyId, personaggioId).then(esito => {
      if (!attivo) return;
      if (esito === "sessione scaduta") return onSessioneScaduta();
      setScheda("errore" in esito ? esito.errore : esito.dati);
    });
    return () => { attivo = false; };
  }, [partyId, personaggioId, onSessioneScaduta]);

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [onChiudi]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4" onClick={onChiudi}>
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-400" /> Scheda in sola lettura
          </h2>
          <button onClick={onChiudi} title="Chiudi" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
        </div>
        {scheda === null && <div className="flex justify-center py-10"><LoaderCircle className="w-6 h-6 text-indigo-400 animate-spin" /></div>}
        {typeof scheda === "string" && (
          <p role="alert" className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{scheda}</p>
        )}
        {scheda !== null && typeof scheda === "object" && <Contenuto c={scheda} />}
      </div>
    </div>
  );
}

function Contenuto({ c }: { c: CharacterData }) {
  const d = derivate(c);
  const pf = c.combattimento;
  const slot = d.slotMax.flatMap((max, i) => (max > 0 ? [{ livello: i + 1, max, liberi: Math.max(0, max - c.slotSpesi[i]) }] : []));
  const incantesimi = c.incantesimi
    .filter(s => s.livello === 0 || s.preparato || d.semprePreparato(s.nome) || !d.prepara)
    .sort((a, b) => a.livello - b.livello || a.nome.localeCompare(b.nome));
  const stati = [
    ...c.condizioni.map(id => condizione(id)?.nome ?? id),
    ...(c.indebolimento > 0 ? [`Indebolimento ${c.indebolimento}`] : []),
    ...c.effetti.map(e => effetto(e.id)?.nome ?? e.id),
    ...(c.concentrazione ? [`Concentrazione: ${c.concentrazione}`] : []),
  ];

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar avatar={c.info.avatar} nome={c.info.nome} />
        <div className="min-w-0">
          <div className="text-2xl font-black text-white truncate">{c.info.nome || "Senza nome"}</div>
          <div className="text-sm text-slate-400">
            {[c.info.razza, `${c.info.classe} Liv. ${c.info.livello}`, c.info.sottoclasse, c.info.background].filter(Boolean).join(" • ")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Valore etichetta="PF" colore={pf.pfAttuali === 0 ? "text-rose-400" : "text-emerald-400"}
          valore={<>{pf.pfAttuali}/{d.pfMassimiEffettivi}{pf.pfTemporanei > 0 && <span className="text-sky-400 text-sm"> +{pf.pfTemporanei}</span>}</>} />
        <Valore etichetta="CA" valore={d.ca} colore="text-indigo-300" />
        <Valore etichetta="Iniziativa" valore={segno(d.iniziativa)} />
        <Valore etichetta="Velocità" valore={c.info.velocita || "—"} />
        <Valore etichetta="Perc. passiva" valore={d.percezionePassiva} />
        <Valore etichetta="Competenza" valore={segno(d.comp)} />
        {d.cdMagia !== null && <Valore etichetta="CD Magia" valore={d.cdMagia} colore="text-violet-400" />}
        {d.attaccoMagico !== null && <Valore etichetta="Att. magico" valore={segno(d.attaccoMagico)} colore="text-cyan-400" />}
        <Valore etichetta="Dadi Vita" valore={`${pf.dadiVitaRimanenti}/${c.info.livello}`} />
      </div>

      {stati.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stati.map(s => (
            <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">{s}</span>
          ))}
          {c.indebolimento > 0 && <span className="text-xs text-slate-500 self-center">{LIVELLI_INDEBOLIMENTO[c.indebolimento - 1]}</span>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Sezione titolo="Caratteristiche e tiri salvezza">
          <div className="grid grid-cols-3 gap-2">
            {CARATTERISTICHE.map(k => (
              <div key={k} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-500 font-bold">{k}</div>
                <div className="text-lg font-black text-slate-100">{c.caratteristiche[k].valore}</div>
                <div className="text-xs text-slate-400">{segno(d.mod(k))} • TS {segno(d.ts(k))}{c.caratteristiche[k].compTS && " ●"}</div>
              </div>
            ))}
          </div>
        </Sezione>
        <Sezione titolo="Abilità">
          <ul className="grid grid-cols-2 gap-x-3 text-xs">
            {ABILITA.map(a => (
              <li key={a.id} className={`flex justify-between ${c.competenzeAbilita.includes(a.id) ? "text-indigo-200 font-semibold" : "text-slate-400"}`}>
                <span className="truncate">{a.nome}</span><span>{segno(d.abilita(a.id))}</span>
              </li>
            ))}
          </ul>
        </Sezione>
      </div>

      {c.armi.length > 0 && (
        <Sezione titolo="Armi">
          <ul className="text-sm space-y-1">
            {c.armi.map(a => {
              const att = d.attaccoArma(a);
              return (
                <li key={a.id} className="flex flex-wrap justify-between gap-2">
                  <span className={a.rotta ? "text-slate-500 line-through" : "text-slate-200"}>{a.nome}{a.bonus ? ` ${segno(a.bonus)}` : ""}</span>
                  <span className="text-slate-400">{segno(att.bonus)} per colpire • {testoDanni(att.danni)} {att.danni.tipo}</span>
                </li>
              );
            })}
          </ul>
        </Sezione>
      )}

      {(slot.length > 0 || incantesimi.length > 0) && (
        <Sezione titolo={d.prepara ? "Incantesimi preparati" : "Incantesimi"}>
          {slot.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {slot.map(s => (
                <span key={s.livello} className="px-2 py-0.5 text-xs rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/30">
                  {s.livello}°: {s.liberi}/{s.max}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-300">
            {incantesimi.map(s => `${s.nome}${s.livello === 0 ? " (trucchetto)" : ` (${s.livello}°)`}`).join(", ") || "—"}
          </p>
        </Sezione>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Sezione titolo={`Zaino (${d.pesoTotale.toFixed(1)}/${d.capacitaCarico} kg)`}>
          <p className="text-xs text-amber-200/80">
            {(["mp", "mo", "me", "ma", "mr"] as const).filter(m => c.monete[m] > 0).map(m => `${c.monete[m]} ${m}`).join(" • ") || "Nessuna moneta"}
          </p>
          <ul className="text-sm text-slate-300 space-y-0.5">
            {c.armatura && <li>{c.armatura.nome} (indossata)</li>}
            {c.scudo && <li>Scudo</li>}
            {c.inventario.map(o => (
              <li key={o.id}>
                {o.nome}{o.qta !== 1 && ` ×${o.qta}`}
                {o.delParty && <span className="ml-1.5 text-[10px] text-indigo-300">del party</span>}
              </li>
            ))}
          </ul>
        </Sezione>
        <Sezione titolo="Privilegi">
          <p className="text-sm text-slate-300">{c.privilegi.map(p => p.nome).join(", ") || "—"}</p>
        </Sezione>
      </div>
    </>
  );
}
