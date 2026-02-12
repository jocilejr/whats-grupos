import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Image, Video, File, Loader2 } from "lucide-react";

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: any) => void;
}

const typeIcons: Record<string, any> = {
  text: FileText,
  image: Image,
  video: Video,
  document: File,
};

export function TemplateSelector({ open, onOpenChange, onSelect }: TemplateSelectorProps) {
  const { user } = useAuth();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["message-templates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:rounded-2xl border-border/50 bg-card">
        <DialogHeader>
          <DialogTitle>Selecionar Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
            </div>
          ) : !templates?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum template salvo.</p>
          ) : (
            templates.map((t) => {
              const Icon = typeIcons[t.message_type] || FileText;
              const content = t.content as any;
              const preview = content?.text || content?.caption || "(sem conteúdo)";
              return (
                <button
                  key={t.id}
                  onClick={() => { onSelect(t); onOpenChange(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{preview}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{t.message_type}</Badge>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
