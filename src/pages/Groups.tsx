import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Loader2, WifiOff } from "lucide-react";

export default function Groups() {
  const { user } = useAuth();
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: configs } = useQuery({
    queryKey: ["api-configs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_configs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Auto-select first config
  const activeConfigId = selectedConfig || configs?.[0]?.id || "";

  const { data: groups, isLoading, error } = useQuery({
    queryKey: ["groups", activeConfigId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=fetchGroups&configId=${activeConfigId}`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to fetch groups");
      }
      return await resp.json();
    },
    enabled: !!activeConfigId,
  });

  const filteredGroups = Array.isArray(groups)
    ? groups.filter((g: any) =>
        (g.subject || g.name || "").toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Grupos</h1>
        <p className="text-muted-foreground">Grupos do WhatsApp conectados à sua instância</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {configs && configs.length > 1 && (
          <Select value={activeConfigId} onValueChange={setSelectedConfig}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Selecione a instância" />
            </SelectTrigger>
            <SelectContent>
              {configs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.instance_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {!configs?.length ? (
        <Card>
          <CardContent className="py-10 text-center">
            <WifiOff className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Configure uma instância da Evolution API nas <strong>Configurações</strong> para listar seus grupos.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Buscando grupos...</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <WifiOff className="mx-auto h-10 w-10 text-destructive mb-3" />
            <p className="text-destructive font-medium">Erro ao buscar grupos</p>
            <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {filteredGroups.length} grupo{filteredGroups.length !== 1 ? "s" : ""} encontrado{filteredGroups.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredGroups.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {search ? "Nenhum grupo encontrado com esse filtro." : "Nenhum grupo encontrado nesta instância."}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredGroups.map((group: any) => (
                  <div
                    key={group.id || group.jid}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    {group.imgUrl ? (
                      <img
                        src={group.imgUrl}
                        alt={group.subject || group.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.subject || group.name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {group.id || group.jid}
                      </p>
                    </div>
                    {group.size != null && (
                      <Badge variant="secondary">{group.size} membros</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
