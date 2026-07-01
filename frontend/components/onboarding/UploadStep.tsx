import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/upload/Dropzone";

interface UploadStepProps {
  onFileSelected: (file: File | null) => void;
  onContinue: () => void;
}

export function UploadStep({ onFileSelected, onContinue }: UploadStepProps) {
  return (
    <div>
      <h2 className="mb-2 text-center font-display text-2xl font-bold tracking-tight text-foreground">
        Upload your first file
      </h2>
      <p className="mb-8 text-center font-mono text-xs text-muted-foreground">
        Optional — you can always do this later from your dashboard.
      </p>

      <div className="mb-10">
        <Dropzone onFileSelected={onFileSelected} />
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="outline" size="lg" onClick={onContinue} className="font-mono">
          Skip for now
        </Button>
        <Button size="lg" onClick={onContinue} className="bg-brand font-mono hover:bg-brand-hover">
          Continue →
        </Button>
      </div>
    </div>
  );
}
