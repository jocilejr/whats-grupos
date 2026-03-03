import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GroupSelector } from "./GroupSelector";

import { useToast } from "@/hooks/use-toast";
import { Loader2, Megaphone, Users, Zap } from "lucide-react";

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: any;
}

export function CampaignDialog({ open, onOpenChange, campaign }: CampaignDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configId, setConfigId] = useState("");
  const [evolutionInstance, setEvolutionInstance] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Build list of instances from user's api_configs, each with its config id
  const instanceOptions = configs?.map((c) => ({ configId: c.id, instanceName: c.instance_name })).filter(o => o.instanceName) || [];

  // When user selects an instance, auto-resolve the configId
  const handleInstanceSelect = (instName: string) => {
    setEvolutionInstance(instName);
    const matched = configs?.find((c) => c.instance_name === instName);
    setConfigId(matched?.id || "");
    setGroupIds([]);
  };

  useEffect(() => {
    if (open) {
      if (campaign) {
        setName(campaign.name || "");
        setDescription(campaign.description || "");
        setEvolutionInstance(campaign.instance_name || "");
        setGroupIds(campaign.group_ids || []);
        setIsActive(campaign.is_active ?? true);
        // Resolve configId: use campaign's value, or look up from configs by instance name
        const resolvedConfigId = campaign.api_config_id || configs?.find((c) => c.instance_name === campaign.instance_name)?.id || "";
        setConfigId(resolvedConfigId);
      } else {
        setName("");
        setDescription("");
        setConfigId("");
        setEvolutionInstance("");
        setGroupIds([]);
        setIsActive(true);
      }
    }
  }, [open, campaign, configs]);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    // configId is now optional — campaigns can exist without an instance

    setSaving(true);
    try {
      if (campaign) {
        const { error } = await supabase.from("campaigns").update({
          name: name.trim(),
          description: description.trim() || null,
          api_config_id: configId || null,
          instance_name: evolutionInstance || null,
          group_ids: groupIds,
          is_active: isActive,
        }).eq("id", campaign.id);
        if (error) throw error;
        toast({ title: "Campanha atualizada" });
      } else {
        const { error } = await supabase.from("campaigns").insert({
          user_id: user!.id,
          name: name.trim(),
          description: description.trim() || null,
          api_config_id: configId || null,
          instance_name: evolutionInstance || null,
          group_ids: groupIds,
          is_active: isActive,
        });
        if (error) throw error;
        toast({ title: "Campanha criada" });
      }
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col sm:rounded-2xl border-border/50 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">{campaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
              <DialogDescription className="text-xs">
                {campaign ? "Atualize os dados da campanha" : "Configure sua nova campanha de mensagens"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* Nome */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção Black Friday" className="bg-background/50 border-border/50 focus:border-primary/50" />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o objetivo da campanha" rows={2} className="bg-background/50 border-border/50 focus:border-primary/50 resize-none" />
          </div>

          {/* Instância WhatsApp */}
          {instanceOptions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-3 w-3" />Instância WhatsApp
              </Label>
              <Select value={evolutionInstance} onValueChange={handleInstanceSelect}>
                <SelectTrigger className="bg-background/50 border-border/50"><SelectValue placeholder="Selecione a instância" /></SelectTrigger>
                <SelectContent>
                  {instanceOptions.map((opt) => (
                    <SelectItem key={opt.configId} value={opt.instanceName}>
                      {opt.instanceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Grupos */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3 w-3" />Grupos
            </Label>
            <GroupSelector configId={configId} instanceName={evolutionInstance} selectedIds={groupIds} onSelectionChange={setGroupIds} />
          </div>

          {/* Switch ativa */}
          <div className="flex items-center justify-between rounded-xl bg-background/50 border border-border/50 p-4">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <Label className="font-medium">Campanha ativa</Label>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Mensagens agendadas foram movidas para dialog separado */}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border/50">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {campaign ? "Salvar" : "Criar Campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
