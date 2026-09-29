import { useState } from "react";
import { Sparkles, X, Target, Flame, Hourglass, BookOpen } from "lucide-react";
import type { CharacterData, SetChar, Spell } from "../tipi";
import type { Danni, Derivate } from "../regole";
import {
  critico, dannoIncantesimo, lanciaIncantesimo, numeroAttacchi, segno, slotUtilizzabili, testoDanni,
} from "../regole";
import { schedaDi } from "../dati/incantesimi";
import type { ChiediD20, ChiediTiro } from "../tiroDadi";
import { tiraDanni } from "../tiroDadi";

interface Props {
  spell: Spell;
  char: CharacterData;
  d: Derivate;
  setChar: SetChar;
  chiediTiro: ChiediTiro;
  chiediD20: ChiediD20;
  onChiudi: () => void;
}

interface Lancio {
  livelloSlot: number | null; // null = trucchetto o rituale
  rituale: boolean;
}

interface Attacco {
  risultato: number;
  totale: number;
  danni?: number; // tirati dopo
}

const nomeLivello = (l: number) => (l === 0 ? "Trucchetto" : `${l}° livello`);

export default function FinestraIncantesimo({ spell, char, d, setChar, chiediTiro, chiediD20, onChiudi }: Props) {
  const scheda = schedaDi(spell.nome);
  const disponibili = spell.livello > 0 ? slotUtilizzabili(char, spell.livello) : [];
  const [livelloScelto, setLivelloScelto] = useState<number>(disponibili[0] ?? spell.livello);
  const [lancio, setLancio] = useState<Lancio | null>(null);
  const [attacchi, setAttacchi] = useState<Attacco[]>([]);
  const [danniTirati, setDanniTirati] = useState<{ tiri: number[]; totale: number } | null>(null);

  const livelloEffettivo = lancio?.livelloSlot ?? (spell.livello === 0 ? 0 : livelloScelto);
  const danni: Danni | null = scheda ? dannoIncantesimo(scheda, livelloEffettivo, char.info.livello) : null;
  const totAttacchi = scheda ? numeroAttacchi(scheda, livelloEffettivo) : 0;
  const puoLanciare = spell.livello === 0 || (spell.preparato && disponibili.length > 0);
  const puoRituale = !!scheda?.rituale;

  const lancia = (livelloSlot: number | null, rituale = false) => {
    setChar(prev => lanciaIncantesimo(prev, livelloSlot));
    setLancio({ livelloSlot, rituale });
  };

  const tiraAttacco = async () => {
    const r = await chiediD20({
      titolo: totAttacchi > 1 ? `${spell.nome}: attacco ${attacchi.length + 1}/${totAttacchi}` : `${spell.nome}: tiro per colpire`,
      bonus: d.attaccoMagico,
    });
    if (r) setAttacchi(prev => [...prev, { risultato: r.risultato, totale: r.risultato + d.attaccoMagico }]);
  };

  const tiraDanniAttacco = async (i: number) => {
    if (!danni) return;
    const a = attacchi[i];
    const dadi = a.risultato === 20 ? critico(danni) : danni;
    const r = await tiraDanni(chiediTiro, `${spell.nome}: danni${a.risultato === 20 ? " critici" : ""}`, dadi);
    if (r) setAttacchi(prev => prev.map((x, j) => (j === i ? { ...x, danni: r.totale } : x)));
  };

  const tiraDanniSemplici = async () => {
    if (!danni) return;
    const r = await tiraDanni(chiediTiro, `${spell.nome}: danni`, danni);
    if (r) setDanniTirati(r);
  };

  const dettagli = scheda && [
    ["Tempo", scheda.tempo],
    ["Gittata", scheda.gittata],
    ["Componenti", scheda.componenti],
    ["Durata", scheda.durata],
  ];

  const pulsante = "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" /> {spell.nome}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {nomeLivello(spell.livello)} · {scheda?.scuola ?? spell.scuola}
              {scheda?.concentrazione && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Concentrazione</span>}
              {scheda?.rituale && <span className="ml-2 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">Rituale</span>}
            </p>
          </div>
          <button onClick={onChiudi} title="Chiudi" className="text-slate-500 hover:text-slate-200 p-1"><X className="w-4 h-4" /></button>
        </div>

        {scheda ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {dettagli?.map(([k, v]) => (
                <div key={k} className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">{k}</div>
                  <div className="text-slate-200">{v}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{scheda.descrizione}</p>
            {scheda.livelloSuperiore && (
              <p className="text-xs text-slate-400"><strong className="text-slate-300">A livelli superiori.</strong> {scheda.livelloSuperiore}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {scheda.attacco && (
                <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200">
                  <Target className="inline w-3.5 h-3.5 mr-1 text-indigo-300" />
                  Attacco {segno(d.attaccoMagico)}{totAttacchi > 1 && ` × ${totAttacchi}`}
                </span>
              )}
              {scheda.tiroSalvezza && (
                <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200">
                  TS {scheda.tiroSalvezza.car} CD {d.cdMagia} · se riesce: {scheda.tiroSalvezza.effetto}
                </span>
              )}
              {danni && (
                <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200">
                  <Flame className="inline w-3.5 h-3.5 mr-1 text-rose-400" />
                  {testoDanni(danni)} danni {danni.tipo}{scheda.danni?.perAttacco && totAttacchi > 1 && " per colpo"}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            {spell.scuola} · {spell.tempo}. Nessuna scheda per questo incantesimo: puoi comunque lanciarlo per spendere lo slot.
          </p>
        )}

        {/* LANCIO */}
        {!lancio ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            {spell.livello > 0 && spell.preparato && (
              disponibili.length > 0 ? (
                <label className="flex items-center justify-between gap-2 text-sm text-slate-300">
                  Slot da usare
                  <select
                    value={livelloScelto}
                    onChange={e => setLivelloScelto(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  >
                    {disponibili.map(l => <option key={l} value={l}>{l}° livello</option>)}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-rose-300">Nessuno slot libero di {spell.livello}° livello o superiore.</p>
              )
            )}
            {spell.livello > 0 && !spell.preparato && (
              <p className="text-xs text-slate-400">
                Non preparato{puoRituale ? ": puoi lanciarlo solo come rituale." : "."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {puoLanciare && (
                <button onClick={() => lancia(spell.livello === 0 ? null : livelloScelto)} className={`${pulsante} flex-1 bg-indigo-600 hover:bg-indigo-500 text-white`}>
                  <Sparkles className="w-4 h-4" /> Lancia{spell.livello > 0 && ` (slot di ${livelloScelto}°)`}
                </button>
              )}
              {puoRituale && (
                <button onClick={() => lancia(null, true)} className={`${pulsante} flex-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-200 border border-sky-500/30`}>
                  <Hourglass className="w-4 h-4" /> Come rituale (+10 min, niente slot)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-xl p-4 space-y-3">
            <p className="text-sm text-indigo-200 font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {lancio.rituale ? "Lanciato come rituale." : lancio.livelloSlot ? `Lanciato con uno slot di ${lancio.livelloSlot}° livello.` : "Lanciato."}
            </p>

            {totAttacchi > 0 && (
              <div className="space-y-2">
                {attacchi.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                    <span className="text-slate-300">
                      Attacco {i + 1}: <span className="font-mono">d20 = {a.risultato} {segno(d.attaccoMagico)}</span> →{" "}
                      <strong className="text-amber-400">{a.totale}</strong>
                      {a.risultato === 20 && <span className="text-amber-300"> · Critico!</span>}
                      {a.risultato === 1 && <span className="text-rose-300"> · Mancato</span>}
                    </span>
                    {danni && scheda?.danni?.perAttacco && a.risultato !== 1 && (
                      a.danni === undefined ? (
                        <button onClick={() => tiraDanniAttacco(i)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border border-rose-500/30">
                          Danni {testoDanni(a.risultato === 20 ? critico(danni) : danni)}
                        </button>
                      ) : (
                        <span className="text-sm">Danni: <strong className="text-rose-400">{a.danni}</strong> {danni.tipo}</span>
                      )
                    )}
                  </div>
                ))}
                {attacchi.length < totAttacchi && (
                  <button onClick={tiraAttacco} className={`${pulsante} w-full bg-indigo-600 hover:bg-indigo-500 text-white`}>
                    <Target className="w-4 h-4" /> Tiro per colpire{totAttacchi > 1 && ` ${attacchi.length + 1}/${totAttacchi}`}
                  </button>
                )}
              </div>
            )}

            {danni && !scheda?.danni?.perAttacco && (
              danniTirati ? (
                <p className="text-sm text-slate-300">
                  Danni: <span className="font-mono text-slate-400">{danniTirati.tiri.join(" + ")}{danni.mod !== 0 && ` ${segno(danni.mod)}`}</span> ={" "}
                  <strong className="text-rose-400 text-lg">{danniTirati.totale}</strong> {danni.tipo}
                  {scheda?.tiroSalvezza && <span className="text-slate-500"> (metà a chi supera il TS: {Math.floor(danniTirati.totale / 2)})</span>}
                </p>
              ) : (
                <button onClick={tiraDanniSemplici} className={`${pulsante} w-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border border-rose-500/30`}>
                  <Flame className="w-4 h-4" /> Tira danni {testoDanni(danni)}
                </button>
              )
            )}

            <button onClick={onChiudi} className={`${pulsante} w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`}>
              Fatto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
