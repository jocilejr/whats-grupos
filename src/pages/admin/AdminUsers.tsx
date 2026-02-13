import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, UserX, UserCheck, Users, Sparkles } from "lucide-react";

async function callAdminApi(action: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api?action=${action}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Erro na API");
  return data;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [maxInstances, setMaxInstances] = useState(1);
  const [maxMsgs, setMaxMsgs] = useState(100);
  const [maxCampaigns, setMaxCampaigns] = useState(5);
  const [maxAiRequests, setMaxAiRequests] = useState(50);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => callAdminApi("listUsers"),
  });

  const createUser = useMutation({
    mutationFn: () =>
      callAdminApi("createUser", {
        email, password, display_name: displayName,
        max_instances: maxInstances, max_messages_per_hour: maxMsgs, max_campaigns: maxCampaigns,
        max_ai_requests_per_month: maxAiRequests,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreate(false);
      resetForm();
      toast({ title: "Usuário criado com sucesso!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updatePlan = useMutation({
    mutationFn: (data: any) => callAdminApi("updatePlan", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setEditUser(null);
      toast({ title: "Plano atualizado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleUser = useMutation({
    mutationFn: (data: { user_id: string; is_active: boolean }) => callAdminApi("updatePlan", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const resetForm = () => {
    setEmail(""); setPassword(""); setDisplayName("");
    setMaxInstances(1); setMaxMsgs(100); setMaxCampaigns(5); setMaxAiRequests(50);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setMaxInstances(u.plan?.max_instances ?? 1);
    setMaxMsgs(u.plan?.max_messages_per_hour ?? 100);
    setMaxCampaigns(u.plan?.max_campaigns ?? 5);
    setMaxAiRequests(u.plan?.max_ai_requests_per_month ?? 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">Crie e gerencie contas de usuários</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                   <TableHead>Instâncias</TableHead>
                   <TableHead>Msgs/h</TableHead>
                   <TableHead>Campanhas</TableHead>
                   <TableHead>I.A./mês</TableHead>
                   <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u: any) => (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.display_name || "-"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                    </TableCell>
                    <TableCell>{u.plan?.max_instances ?? "-"}</TableCell>
                    <TableCell>{u.plan?.max_messages_per_hour ?? "-"}</TableCell>
                    <TableCell>{u.plan?.max_campaigns ?? "-"}</TableCell>
                    <TableCell>{u.plan?.max_ai_requests_per_month ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={u.plan?.is_active !== false ? "default" : "destructive"}>
                        {u.plan?.is_active !== false ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {u.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleUser.mutate({ user_id: u.user_id, is_active: u.plan?.is_active === false })}
                          >
                            {u.plan?.is_active !== false ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4 text-primary" />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Novo Usuário</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createUser.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Instâncias</Label>
                <Input type="number" min={1} value={maxInstances} onChange={(e) => setMaxInstances(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Msgs/hora</Label>
                <Input type="number" min={1} value={maxMsgs} onChange={(e) => setMaxMsgs(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Campanhas</Label>
                <Input type="number" min={1} value={maxCampaigns} onChange={(e) => setMaxCampaigns(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>I.A. / mês</Label>
                <Input type="number" min={0} value={maxAiRequests} onChange={(e) => setMaxAiRequests(Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Plano - {editUser?.display_name || editUser?.email}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updatePlan.mutate({ user_id: editUser.user_id, max_instances: maxInstances, max_messages_per_hour: maxMsgs, max_campaigns: maxCampaigns, max_ai_requests_per_month: maxAiRequests }); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Instâncias</Label>
                <Input type="number" min={1} value={maxInstances} onChange={(e) => setMaxInstances(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Msgs/hora</Label>
                <Input type="number" min={1} value={maxMsgs} onChange={(e) => setMaxMsgs(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Campanhas</Label>
                <Input type="number" min={1} value={maxCampaigns} onChange={(e) => setMaxCampaigns(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>I.A. / mês</Label>
                <Input type="number" min={0} value={maxAiRequests} onChange={(e) => setMaxAiRequests(Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={updatePlan.isPending}>
                {updatePlan.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
