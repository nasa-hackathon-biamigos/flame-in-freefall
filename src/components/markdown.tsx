import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders curated Markdown (fichas). No raw HTML is allowed through. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 leading-relaxed text-foreground/90 [&_a]:text-plasma [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_code]:font-mono [&_strong]:text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
