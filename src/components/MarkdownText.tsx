import { Fragment, type ReactNode } from "react";

type MarkdownTextProps = {
  text?: string | null;
  className?: string;
};

const TOKEN_RE = /(\*\*[^*\n][\s\S]*?[^*\n]\*\*|\*[^*\n][^*\n]*?[^*\n]\*)/g;

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`${match.index}-i`}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownText({ text, className = "" }: MarkdownTextProps) {
  const value = text ?? "";
  if (!value) return null;
  return (
    <span className={className}>
      {value.split("\n").map((line, index) => (
        <Fragment key={`${index}-${line}`}>
          {index > 0 ? <br /> : null}
          {renderInline(line)}
        </Fragment>
      ))}
    </span>
  );
}
