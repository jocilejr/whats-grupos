import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Loader2 } from "lucide-react";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { TemplateFormDialog } from "@/components/templates/TemplateFormDialog";

const CATEGORIES = [
  { value: "all", label: "Todos" },
  { value: "geral", label: "Geral" },
  { value: "marketing", label: "Marketing" },
  { value: "informativo", label: "Informativo" },
  { value: "suporte", label: "Suporte" },
];

export default function Templates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-templates"] });
      toast({ title: "Template excluído" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const filtered = templates?.filter((t) => filter === "all" || t.category === filter) || [];

  return (
    <div className="space-y-8">
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(28_85%_56%/0.15)]">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Modelos de mensagens reutilizáveis</p>
          </div>
        </div>
        <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-[0_4px_20px_hsl(28_85%_56%/0.3)]" onClick={() => { setEditTemplate(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" />Novo Template
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <Badge
            key={c.value}
            variant={filter === c.value ? "default" : "outline"}
            className="cursor-pointer text-xs px-3 py-1"
            onClick={() => setFilter(c.value)}
          >
            {c.label}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50 mx-auto">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            {templates?.length ? "Nenhum template nesta categoria" : "Nenhum template criado ainda"}
          </p>
          {!templates?.length && (
            <Button variant="outline" className="gap-2" onClick={() => { setEditTemplate(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />Criar primeiro template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => { setEditTemplate(t); setFormOpen(true); }}
              onDelete={() => setDeleteId(t.id)}
            />
          ))}
        </div>
      )}

      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editTemplate}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
