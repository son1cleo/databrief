"use client";

import { FileText, FileType, Presentation } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ExportMenuProps {
  reportId: string;
  pdfReady: boolean;
  wordReady: boolean;
  pptxReady: boolean;
}

export function ExportMenu({ reportId, pdfReady, wordReady, pptxReady }: ExportMenuProps) {
  const options = [
    { format: "pdf", label: "Download PDF", icon: FileText, ready: pdfReady },
    { format: "word", label: "Download Word", icon: FileType, ready: wordReady },
    { format: "pptx", label: "Download PowerPoint", icon: Presentation, ready: pptxReady },
  ].filter((o) => o.ready);

  if (options.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="bg-brand hover:bg-brand-hover" />}>
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(({ format, label, icon: Icon }) => (
          <DropdownMenuItem key={format} render={<a href={`/api/download/${reportId}/${format}`} />}>
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
