import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Users, WifiOff, CheckCircle2 } from "lucide-react";

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

  const selectAll = () => onSelectionChange(filteredGroups.map((g: any) => g.id || g.jid));
  const deselectAll = () => onSelectionChange([]);

  if (!configId) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
        <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Selecione uma instância primeiro.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 p-6 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Buscando grupos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <WifiOff className="h-5 w-5 text-destructive mx-auto mb-2" />
        <p className="text-sm text-destructive">Erro ao buscar grupos</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background/50 border-border/50"
          />
        </div>
        <button type="button" className="text-xs text-primary font-medium hover:underline px-2 py-1 rounded-md hover:bg-primary/5 transition-colors" onClick={selectAll}>
          Todos
        </button>
        <button type="button" className="text-xs text-muted-foreground font-medium hover:underline px-2 py-1 rounded-md hover:bg-muted transition-colors" onClick={deselectAll}>
          Nenhum
        </button>
      </div>

      <ScrollArea className="h-36 rounded-xl border border-border/50 bg-background/30">
        {filteredGroups.length === 0 ? (
          <div className="p-6 text-center">
            <Users className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {filteredGroups.map((group: any) => {
              const gid = group.id || group.jid;
              const selected = selectedIds.includes(gid);
              return (
                <label
                  key={gid}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                    selected
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleGroup(gid)}
                    className={selected ? "border-primary data-[state=checked]:bg-primary" : ""}
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                      selected ? "bg-primary/20" : "bg-muted"
                    }`}>
                      <Users className={`h-3.5 w-3.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <span className={`text-sm truncate ${selected ? "text-foreground font-medium" : "text-foreground"}`}>
                      {group.subject || group.name || "Sem nome"}
                    </span>
                  </div>
                  {group.size != null && (
                    <span className="text-xs text-muted-foreground shrink-0">{group.size}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center gap-2">
        {selectedIds.length > 0 ? (
          <Badge className="gap-1 bg-primary/15 text-primary border-primary/20 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            {selectedIds.length} grupo{selectedIds.length !== 1 ? "s" : ""} selecionado{selectedIds.length !== 1 ? "s" : ""}
          </Badge>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum grupo selecionado</p>
        )}
      </div>
    </div>
  );
}
