import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Markdown } from "./markdown";

const render = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

describe("Markdown render safety", () => {
  it("does not emit a script element from model output", () => {
    const html = render("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("does not emit event-handler attributes", () => {
    const html = render('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=");
  });

  it("keeps markdown links external-safe", () => {
    const html = render("[x](https://example.com)");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it("renders inline and block math through KaTeX", () => {
    expect(render("$x^2$")).toContain("katex");
    expect(render("$$\na^2+b^2\n$$")).toContain("katex-display");
  });

  it("falls back to plain text for a mermaid block when the renderer cannot run", () => {
    // Server render has no effects, so the diagram is still empty: the fallback path must hold the source.
    const html = render("```mermaid\ngraph TD; A-->B;\n```");
    expect(html).toContain("graph TD");
    expect(html).toContain("<pre");
  });

  it("keeps fenced code copyable as source text", () => {
    const html = render("```js\nconst a = 1 < 2;\n```");
    expect(html).toContain('aria-label="Salin kode"');
    expect(html).toContain("&lt;");
    expect(html).not.toContain("<script");
  });

  it("wraps tables so they scroll instead of breaking the bubble", () => {
    const html = render("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("<table");
  });
});
