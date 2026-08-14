"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export function RicoMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
          ),
          h1: ({ children }) => <p className="font-semibold">{children}</p>,
          h2: ({ children }) => <p className="font-semibold">{children}</p>,
          h3: ({ children }) => <p className="font-semibold">{children}</p>,
          hr: () => <hr className="border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
