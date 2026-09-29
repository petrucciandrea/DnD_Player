import { useState } from "react";
import { Shield, Eye, Dices, Pencil, Check, Minus, Plus } from "lucide-react";
import type { Caratteristica, CharacterData, SetChar } from "../tipi";
import type { Derivate, Modalita } from "../regole";
import { ABILITA, CARATTERISTICHE, formulaDanno, modificaCaratteristica, segno } from "../regole";
import type { ChiediD20, ChiediTiro } from "../tiroDadi";

interface Tiro {
  etichetta: string;
  facce: number;
  risultato: number;
  bonus: number;
  tiri?: number[];
  modalita?: Modalita;
}

interface Props {
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
  chiediTiro: ChiediTiro;
  chiediD20: ChiediD20;
}

export default function TabStatistiche({ char, d, setChar, chiediTiro, chiediD20 }: Props) {
  const [ultimoTiro, setUltimoTiro] = useState<Tiro | null>(null);
  const [modifica, setModifica] = useState(false);

  const astuziaGnomesca = char.privilegi.some(p => p.nome === "Astuzia Gnomesca");

  const tira = async (etichetta: string, facce: number, bonus = 0, descrizione?: string) => {
    if (facce === 20) {
      const r = await chiediD20({ titolo: etichetta, bonus, descrizione });
      if (r) setUltimoTiro({ etichetta, facce, risultato: r.risultato, bonus, tiri: r.tiri, modalita: r.modalita });
      return;
    }
    const tiri = await chiediTiro({ titolo: etichetta, dadi: [{ etichetta: "Risultato", facce }], bonus });
    if (tiri) setUltimoTiro({ etichetta, facce, risultato: tiri[0], bonus });
  };

  const cambiaValore = (k: Caratteristica, delta: number) =>
    setChar(prev => modificaCaratteristica(prev, k, delta));

  const toggleCompetenza = (id: string) =>
    setChar(prev => ({
      ...prev,
      competenzeAbilita: prev.competenzeAbilita.includes(id)
        ? prev.competenzeAbilita.filter(x => x !== id)
        : [...prev.competenzeAbilita, id],
    }));

  const togglePresagio = (index: number) =>
    setChar(prev => ({
      ...prev,
      divinazione: { ...prev.divinazione, usati: prev.divinazione.usati.map((u, i) => (i === index ? !u : u)) },
    }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" /> Caratteristiche e Tiri Salvezza
          </h2>
          <button
            onClick={() => setModifica(m => !m)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              modifica
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {modifica ? <><Check className="w-3.5 h-3.5" /> Fatto</> : <><Pencil className="w-3.5 h-3.5" /> Modifica</>}
          </button>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          {modifica
            ? "Modifica i punteggi e clicca un'abilità per cambiarne la competenza."
            : "Clicca un tiro salvezza, un'abilità o un'arma per tirare il d20."}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CARATTERISTICHE.map(sigla => {
            const car = char.caratteristiche[sigla];
            const ts = d.ts(sigla);
            return (
              <div key={sigla} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{sigla}</span>
                <span className="text-3xl font-black text-white my-1">{segno(d.mod(sigla))}</span>
                <div className="flex items-center gap-1.5">
                  {modifica && (
                    <button onClick={() => cambiaValore(sigla, -1)} className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full">Punteggio: {car.valore}</span>
                  {modifica && (
                    <button onClick={() => cambiaValore(sigla, 1)} className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => tira(
                    `TS ${sigla}`, 20, ts,
                    astuziaGnomesca && ["INT", "SAG", "CAR"].includes(sigla)
                      ? "Astuzia Gnomesca: vantaggio se il tiro salvezza è contro la magia."
                      : undefined,
                  )}
                  className="mt-3 pt-2 border-t border-slate-800/80 w-full text-xs text-slate-400 flex justify-between items-center px-1 hover:text-slate-200"
                >
                  <span>Tiro Salvezza:</span>
                  <span className={`font-bold ${car.compTS ? "text-indigo-400" : "text-slate-300"}`}>
                    {segno(ts)} {car.compTS && "★"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Abilità</h3>
            <span className="text-xs text-slate-500">Percezione passiva: <strong className="text-slate-300">{d.percezionePassiva}</strong></span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {ABILITA.map(a => {
              const competente = char.competenzeAbilita.includes(a.id);
              const bonus = d.abilita(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => (modifica ? toggleCompetenza(a.id) : tira(a.nome, 20, bonus))}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm hover:bg-slate-800/60 transition text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${competente ? "bg-indigo-400" : "border border-slate-600"}`} />
                    <span className={competente ? "text-slate-100 font-semibold" : "text-slate-400"}>{a.nome}</span>
                    <span className="text-[10px] text-slate-500">{a.car}</span>
                  </span>
                  <span className={`font-mono font-bold ${competente ? "text-indigo-300" : "text-slate-300"}`}>{segno(bonus)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Armi da Mischia / Distanza</h3>
          <div className="space-y-2">
            {char.armi.map((arma, idx) => {
              const { bonus, mod } = d.attaccoArma(arma);
              const danno = formulaDanno(arma.dado, mod) + (arma.dadoVersatile ? ` / ${formulaDanno(arma.dadoVersatile, mod)}` : "");
              return (
                <button
                  key={idx}
                  onClick={() => tira(`Attacco: ${arma.nome}`, 20, bonus)}
                  className="w-full flex flex-wrap justify-between items-center gap-2 p-3 bg-slate-950/60 hover:bg-slate-800/40 rounded-lg border border-slate-800 text-sm text-left transition"
                >
                  <span>
                    <span className="font-semibold text-slate-200">{arma.nome}</span>
                    <span className="block text-[11px] text-slate-500">{arma.proprieta}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono">
                    <span className="text-indigo-300 font-bold">Attacco: {segno(bonus)}</span>
                    <span className="text-amber-300">Danno: {danno}</span>
                    <span className="text-slate-400">{arma.tipoDanno}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-900/50 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-indigo-300 flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" /> Presagio (Divinazione)
            </h3>
            <span className="text-xs bg-indigo-900/60 px-2 py-0.5 rounded text-indigo-200">{d.dadiPresagio}d20 al Riposo Lungo</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Sostituisci qualsiasi tiro per colpire, TS o prova con uno di questi risultati.
          </p>
          <div className={`grid gap-3 ${char.divinazione.presagio.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
            {char.divinazione.presagio.map((tiro, idx) => {
              const usato = char.divinazione.usati[idx];
              return (
                <button
                  key={idx}
                  onClick={() => togglePresagio(idx)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center transition ${
                    usato
                      ? "bg-slate-950/40 border-slate-800 text-slate-600 line-through"
                      : "bg-indigo-950/80 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/10 hover:border-indigo-400"
                  }`}
                >
                  <span className="text-2xl font-black font-mono">{tiro}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider mt-0.5">
                    {usato ? "Usato" : "Disponibile"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Dices className="w-4 h-4 text-amber-400" /> Tira Dadi Rapido
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[4, 6, 8, 10, 12, 20].map(f => (
              <button
                key={f}
                onClick={() => tira(`d${f}`, f)}
                className="px-3 py-2 bg-slate-950 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/50 rounded-lg text-xs font-bold text-slate-300 transition"
              >
                d{f}
              </button>
            ))}
          </div>
          {ultimoTiro && (
            <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center text-sm gap-2">
              <span className="text-slate-400">
                {ultimoTiro.etichetta}
                <span className="block text-xs text-slate-500 font-mono">
                  {ultimoTiro.modalita && ultimoTiro.modalita !== "normale" && ultimoTiro.tiri
                    ? `${ultimoTiro.modalita} (${ultimoTiro.tiri.join(", ")}) → ${ultimoTiro.risultato}`
                    : `d${ultimoTiro.facce} = ${ultimoTiro.risultato}`}
                  {ultimoTiro.bonus !== 0 && ` ${segno(ultimoTiro.bonus)}`}
                  {ultimoTiro.facce === 20 && ultimoTiro.risultato === 20 && " · Critico!"}
                  {ultimoTiro.facce === 20 && ultimoTiro.risultato === 1 && " · 1 naturale"}
                </span>
              </span>
              <span className="text-xl font-black text-amber-400 font-mono">{ultimoTiro.risultato + ultimoTiro.bonus}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
