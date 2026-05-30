import { memo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-border bg-background/70">
      <div className="flex items-center justify-between border-b border-border/60 bg-surface/40 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-foreground/90">{content}</code>
      </pre>
    </div>
  );
}

export const AssistantMessage = memo(function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 whitespace-pre-wrap">{children}</p>,
          h1: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-3 mb-1 text-sm font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-2 mb-1 text-sm font-semibold">{children}</h4>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-border bg-surface/40 px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
          code: ({ inline, className, children }: any) => {
            const text = String(children ?? "").replace(/\n$/, "");
            if (!inline && /language-/.test(className ?? "")) {
              const lang = (className ?? "").replace("language-", "").toLowerCase() || "lua";
              return <CodeBlock lang={lang} content={text} />;
            }
            if (!inline && text.includes("\n")) {
              return <CodeBlock lang="text" content={text} />;
            }
            return (
              <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-foreground">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
