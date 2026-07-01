import DOMPurify from "isomorphic-dompurify";

interface ReportViewerProps {
  html: string;
}

export function ReportViewer({ html }: ReportViewerProps) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "p", "ul", "ol", "li", "em", "strong", "br", "img", "div"],
    ALLOWED_ATTR: ["src", "style", "alt"],
    ADD_DATA_URI_TAGS: ["img"],
  });

  return (
    <article
      className="prose-invert max-w-none [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-brand [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-zinc-300 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:text-[15px] [&_li]:text-zinc-300 [&_li]:mb-2"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
