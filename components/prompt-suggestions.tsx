import { ArrowUpRight } from "lucide-react";
import { Button } from "./ui/button";

const suggestions = [
  {
    text: "Get the latest Vercel blog post",
    prompt: "Go to vercel.com/blog and get the latest post",
  },
  // {
  //   text: "search google for cute dogs",
  //   prompt: "Launch browser and search Google for labradoodle puppies. Show me images.",
  // },
  {
    text: "Create a new text file",
    prompt: "Open a text editor and create a new file called notes.txt and write 'we are so back!'",
  },
  // {
  //   text: "Check system memory usage",
  //   prompt: "Run the top command to show system resource usage",
  // },
  {
    text: "Get the latest rauchg tweet",
    prompt: "Go to twitter.com/rauchg and get the latest tweet",
  },
  // {
  //   text: "What do you see",
  //   prompt:
  //     "Capture a screenshot of the current screen and tell me what you see",
  // },
];

export const PromptSuggestions = ({
  submitPrompt,
  disabled,
}: {
  submitPrompt: (prompt: string) => void;
  disabled: boolean;
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4">
      {suggestions.map((suggestion, index) => (
        <Button
          key={index}
          variant="pill"
          size="pill"
          className="rounded-full shadow-lg shadow-black/20 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all duration-300 backdrop-blur-sm"
          onClick={() => submitPrompt(suggestion.prompt)}
          disabled={disabled}
        >
          <span className="text-[13px] font-medium tracking-tight">
            {suggestion.text}
          </span>
          <ArrowUpRight className="ml-1.5 h-3 w-3 text-zinc-500 transition-colors group-hover:text-zinc-300" />
        </Button>
      ))}
    </div>
  );
};
