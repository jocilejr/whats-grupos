import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GroupSelector } from "./GroupSelector";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

  useEffect(() => {
    if (open) {
      if (campaign) {
        setName(campaign.name || "");
        setDescription(campaign.description || "");
        setConfigId(campaign.api_config_id || "");
        setGroupIds(campaign.group_ids || []);
        setIsActive(campaign.is_active ?? true);
      } else {
        setName("");
        setDescription("");
        setConfigId(configs?.[0]?.id || "");
        setGroupIds([]);
        setIsActive(true);
      }
    }
  }, [open, campaign, configs]);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (!configId) { toast({ title: "Selecione uma instância", variant: "destructive" }); return; }

    setSaving(true);
    try {
      if (campaign) {
        const { error } = await supabase.from("campaigns").update({
          name: name.trim(),
          description: description.trim() || null,
          api_config_id: configId,
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
          api_config_id: configId,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção Black Friday" />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o objetivo da campanha" rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Instância</Label>
            <Select value={configId} onValueChange={setConfigId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent>
                {configs?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.instance_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Grupos</Label>
            <GroupSelector configId={configId} selectedIds={groupIds} onSelectionChange={setGroupIds} />
          </div>

          <div className="flex items-center justify-between">
            <Label>Campanha ativa</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {campaign ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
