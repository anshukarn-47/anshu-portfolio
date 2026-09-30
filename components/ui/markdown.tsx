import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** react-markdown passes its AST `node` to components; keep it off the DOM. */
function domProps<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

type Level = 2 | 3 | 4;
const tag = (level: number) => `h${Math.min(level, 6)}` as "h2" | "h3" | "h4" | "h5" | "h6";

/**
 * Renders admin-authored markdown. Raw HTML is dropped (`skipHtml`), so content
 * can't inject scripts or markup.
 *
 * Markdown headings are shifted so they fit the page's outline: # and ## render at
 * `headingLevel`, ### one level below, deeper ones two below. Use 3 (default) under
 * an h2 section title, or 2 directly under the page's h1.
 */
export function Markdown({
  children,
  className = "",
  headingLevel = 3,
}: {
  children: string;
  className?: string;
  headingLevel?: Level;
}) {
  const H1 = tag(headingLevel);
  const H3 = tag(headingLevel + 1);
  const H4 = tag(headingLevel + 2);

  return (
    <div
      className={`prose prose-flight max-w-prose ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: (props) => <H1 {...domProps(props)} />,
          h2: (props) => <H1 {...domProps(props)} />,
          h3: (props) => <H3 {...domProps(props)} />,
          h4: (props) => <H4 {...domProps(props)} />,
          h5: (props) => <H4 {...domProps(props)} />,
          h6: (props) => <H4 {...domProps(props)} />,
          a: (props) => {
            const external = typeof props.href === "string" && /^https?:\/\//.test(props.href);
            return <a {...domProps(props)} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
