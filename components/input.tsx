import { ArrowUp } from "lucide-react";
import { Input as ShadcnInput } from "./ui/input";

interface InputProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isInitializing: boolean;
  isLoading: boolean;
  status: string;
  stop: () => void;
}

export const Input = ({
  input,
  handleInputChange,
  isInitializing,
  isLoading,
  status,
  stop,
}: InputProps) => {
  return (
    <div className="relative w-full group">
      <ShadcnInput
        className="bg-zinc-900/40 border border-zinc-800/50 py-6 w-full rounded-2xl pr-14 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700/50 focus:ring-1 focus:ring-zinc-700/20 transition-all duration-300 backdrop-blur-sm font-normal"
        value={input}
        autoFocus
        placeholder={"What should I do on the computer?"}
        onChange={handleInputChange}
        disabled={isLoading || isInitializing}
      />
      {status === "streaming" || status === "submitted" ? (
        <button
          type="button"
          onClick={stop}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all duration-200"
        >
          <div className="size-4 flex items-center justify-center">
            <div className="size-2 bg-red-500 rounded-sm animate-pulse" />
          </div>
        </button>
      ) : (
        <button
          type="submit"
          disabled={isLoading || !input.trim() || isInitializing}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2.5 bg-zinc-100 hover:bg-white text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all duration-200 shadow-lg shadow-white/5 active:scale-95"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
