import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TokenInput({ label, placeholder, values, onChange }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v || values.includes(v)) return setDraft("");
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" className="shrink-0" onClick={add}>Add</Button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
