import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Users, WifiOff } from "lucide-react";

interface GroupSelectorProps {
  configId: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function GroupSelector({ configId, selectedIds, onSelectionChange }: GroupSelectorProps) {
  const [search, setSearch] = useState("");

  const { data: groups, isLoading, error } = useQuery({
    queryKey: ["groups", configId],
    queryFn: async () => {
      if (!configId) return [];
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=fetchGroups&configId=${configId}`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!resp.ok) throw new Error("Erro ao buscar grupos");
      return await resp.json();
    },
    enabled: !!configId,
  });

  const filteredGroups = Array.isArray(groups)
    ? groups.filter((g: any) =>
        (g.subject || g.name || "").toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const toggleGroup = (groupId: string) => {
    onSelectionChange(
      selectedIds.includes(groupId)
        ? selectedIds.filter((id) => id !== groupId)
        : [...selectedIds, groupId]
    );
  };

  const selectAll = () => {
    onSelectionChange(filteredGroups.map((g: any) => g.id || g.jid));
  };

  const deselectAll = () => onSelectionChange([]);

  if (!configId) return <p className="text-sm text-muted-foreground">Selecione uma instância primeiro.</p>;

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" />Buscando grupos...</div>;

  if (error) return <div className="flex items-center gap-2 text-sm text-destructive py-4"><WifiOff className="h-4 w-4" />Erro ao buscar grupos</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar grupo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <button type="button" className="text-xs text-primary hover:underline" onClick={selectAll}>Todos</button>
        <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={deselectAll}>Nenhum</button>
      </div>

      <ScrollArea className="h-48 rounded-md border p-2">
        {filteredGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum grupo encontrado.</p>
        ) : (
          <div className="space-y-1">
            {filteredGroups.map((group: any) => {
              const gid = group.id || group.jid;
              return (
                <label key={gid} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={selectedIds.includes(gid)} onCheckedChange={() => toggleGroup(gid)} />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{group.subject || group.name || "Sem nome"}</span>
                  </div>
                  {group.size != null && <span className="text-xs text-muted-foreground">{group.size}</span>}
                </label>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <p className="text-xs text-muted-foreground">{selectedIds.length} grupo(s) selecionado(s)</p>
    </div>
  );
}
