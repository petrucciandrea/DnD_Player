// Scelta multipla con un massimo di voci (trucchetti, incantesimi, metamagie...).
export default function ScegliMolti({ titolo, opzioni, scelte, massimo, onCambia, nome = (v: string) => v, suggerimento }: {
  titolo: string;
  opzioni: string[];
  scelte: string[];
  massimo: number;
  onCambia: (v: string[]) => void;
  nome?: (v: string) => string;
  suggerimento?: (v: string) => string | undefined; // testo al passaggio del mouse (la descrizione della voce)
}) {
  const cambia = (v: string) =>
    onCambia(scelte.includes(v) ? scelte.filter(x => x !== v) : scelte.length < massimo ? [...scelte, v] : scelte);
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
        {titolo} <span className="normal-case text-slate-500">({scelte.length}/{massimo})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {opzioni.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => cambia(v)}
            title={suggerimento?.(v)}
            className={`px-2.5 py-1 rounded-lg border text-xs transition ${scelte.includes(v)
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600 disabled:opacity-40"}`}
            disabled={!scelte.includes(v) && scelte.length >= massimo}
          >
            {nome(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
