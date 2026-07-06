import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-forward-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
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
