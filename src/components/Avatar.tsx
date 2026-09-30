import { useRef, type ChangeEvent } from "react";
import { Camera, UserRound, X } from "lucide-react";
import { ridimensionaAvatar } from "../immagini";

interface Props {
  avatar: string;
  nome: string;
  dimensione?: "piccola" | "grande";
  onCambia?: (avatar: string) => void; // senza: solo lettura
}

const DIMENSIONI = { piccola: "w-10 h-10", grande: "w-16 h-16 sm:w-20 sm:h-20" };

// Immagine del personaggio. Se modificabile, un clic sceglie un file (ridotto a 256 px) e la X la toglie.
export default function Avatar({ avatar, nome, dimensione = "grande", onCambia }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const scegli = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onCambia) return;
    try {
      onCambia(await ridimensionaAvatar(file));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const rimuovi = () => {
    if (onCambia && confirm(`Rimuovere l'immagine di ${nome || "questo personaggio"}?`)) onCambia("");
  };

  const cornice = `${DIMENSIONI[dimensione]} shrink-0 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center`;
  const contenuto = avatar
    ? <img src={avatar} alt={nome} className="w-full h-full object-cover" />
    : <UserRound className={`${dimensione === "grande" ? "w-8 h-8" : "w-5 h-5"} text-slate-500`} />;

  if (!onCambia) return <div className={cornice}>{contenuto}</div>;
  return (
    <div className="relative shrink-0 group">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        title={avatar ? "Cambia immagine" : "Aggiungi un'immagine"}
        className={`${cornice} relative hover:border-indigo-500 transition`}
      >
        {contenuto}
        <span className="absolute inset-0 rounded-full bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
          <Camera className="w-5 h-5 text-slate-200" />
        </span>
      </button>
      {avatar && (
        <button
          type="button"
          onClick={rimuovi}
          title="Rimuovi immagine"
          className="absolute -top-1 -right-1 p-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-300"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <input ref={fileInput} type="file" accept="image/*" onChange={scegli} className="hidden" />
    </div>
  );
}
