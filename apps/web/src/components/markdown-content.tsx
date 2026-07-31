import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  // Split on markdown links first, then bold inside each segment.
  const linkSplit = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  const nodes: ReactNode[] = [];

  linkSplit.forEach((segment, segmentIndex) => {
    const linkMatch = segment.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const external = href.startsWith("http");
      nodes.push(
        <a
          key={`a-${segmentIndex}`}
          href={href}
          className="font-medium text-brand-blue underline-offset-2 hover:underline"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {label}
        </a>
      );
      return;
    }

    const parts = segment.split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        nodes.push(
          <strong key={`b-${segmentIndex}-${index}`} className="font-semibold text-forward-900">
            {part.slice(2, -2)}
          </strong>
        );
      } else if (part) {
        nodes.push(<span key={`t-${segmentIndex}-${index}`}>{part}</span>);
      }
    });
  });

  return nodes;
}

export function MarkdownContent({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm leading-relaxed text-forward-700">
          {renderInline(text)}
        </p>
      );
    }
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-2 pl-5 text-sm text-forward-700">
        {listItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      flushParagraph();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="text-xl font-semibold text-forward-900">
          {trimmed.slice(2).trim()}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      flushParagraph();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="text-lg font-semibold text-forward-900">
          {trimmed.slice(3).trim()}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      flushParagraph();
      blocks.push(
        <h4 key={`h4-${blocks.length}`} className="text-base font-semibold text-forward-900">
          {trimmed.slice(4).trim()}
        </h4>
      );
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushList();
  flushParagraph();

  return <div className="space-y-4">{blocks}</div>;
}
