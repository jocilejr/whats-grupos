import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, CheckSquare, XSquare } from "lucide-react";

interface AvailableGroup {
  group_id: string;
  group_name: string;
  instance_name: string;
  member_count: number;
}

interface GroupSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableGroups: AvailableGroup[];
  selectedGroupIds: Set<string>;
  onConfirm: (groups: { group_id: string; group_name: string; instance_name: string }[]) => Promise<void>;
  isLoading?: boolean;
}

export default function GroupSelectionDialog({
  open, onOpenChange, availableGroups, selectedGroupIds, onConfirm, isLoading,
}: GroupSelectionDialogProps) {
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedGroupIds));
  const [saving, setSaving] = useState(false);

  // Reset checked state when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setChecked(new Set(selectedGroupIds));
    onOpenChange(v);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return availableGroups;
    const q = search.toLowerCase();
    return availableGroups.filter(
      (g) => g.group_name.toLowerCase().includes(q) || g.instance_name.toLowerCase().includes(q)
    );
  }, [availableGroups, search]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setChecked(new Set(filtered.map((g) => g.group_id)));
  const clearAll = () => setChecked(new Set());

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const selected = availableGroups.filter((g) => checked.has(g.group_id)).map((g) => ({
        group_id: g.group_id,
        group_name: g.group_name,
        instance_name: g.instance_name,
      }));
      await onConfirm(selected);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Grupos Monitorados</DialogTitle>
          <DialogDescription>
            Selecione os grupos que deseja acompanhar no painel principal.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {checked.size} de {availableGroups.length} selecionados
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              Todos
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
              <XSquare className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[320px] -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {availableGroups.length === 0
                ? "Nenhum grupo encontrado. Sincronize primeiro."
                : "Nenhum grupo corresponde à busca."}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((group) => (
                <label
                  key={group.group_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={checked.has(group.group_id)}
                    onCheckedChange={() => toggle(group.group_id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{group.group_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">{group.instance_name}</Badge>
                      <span className="text-[11px] text-muted-foreground">{group.member_count} membros</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
