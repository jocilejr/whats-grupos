import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, Image, Video, File, Mic, Sticker, MapPin,
  Contact, BarChart3, List, Pencil, Trash2,
} from "lucide-react";
import { format } from "date-fns";

const TYPE_META: Record<string, { icon: any; label: string }> = {
  text: { icon: FileText, label: "Texto" },
  image: { icon: Image, label: "Imagem" },
  video: { icon: Video, label: "Vídeo" },
  document: { icon: File, label: "Documento" },
  audio: { icon: Mic, label: "Áudio" },
  sticker: { icon: Sticker, label: "Figurinha" },
  location: { icon: MapPin, label: "Localização" },
  contact: { icon: Contact, label: "Contato" },
  poll: { icon: BarChart3, label: "Enquete" },
  list: { icon: List, label: "Lista" },
};

const CATEGORY_COLORS: Record<string, string> = {
  geral: "bg-secondary text-secondary-foreground",
  marketing: "bg-primary/15 text-primary",
  informativo: "bg-blue-500/15 text-blue-600",
  suporte: "bg-amber-500/15 text-amber-600",
};

interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    message_type: string;
    category: string | null;
    content: any;
    created_at: string;
  };
  onEdit: () => void;
  onDelete: () => void;
}

export function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const meta = TYPE_META[template.message_type] || TYPE_META.text;
  const Icon = meta.icon;
  const content = template.content as any;
  const preview =
    content?.text || content?.caption || content?.pollName ||
    content?.listTitle || content?.contactName || "(sem conteúdo)";
  const category = template.category || "geral";

  return (
    <Card className="group border-border/50 hover:border-primary/30 transition-all hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{template.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{preview}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{meta.label}</Badge>
          <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 ${CATEGORY_COLORS[category] || CATEGORY_COLORS.geral}`}>
            {category}
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(template.created_at), "dd/MM/yyyy")}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
