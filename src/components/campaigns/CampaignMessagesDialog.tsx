import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignMessageList } from "./CampaignMessageList";
import { ScheduledMessageForm } from "./ScheduledMessageForm";
import { CalendarClock, Clock, CalendarDays, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: any;
}

export function CampaignMessagesDialog({ open, onOpenChange, campaign }: CampaignMessagesDialogProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formScheduleType, setFormScheduleType] = useState("once");
  const [editingMsg, setEditingMsg] = useState<any>(null);

  if (!campaign) return null;

  const handleAdd = (scheduleType: string) => {
    setEditingMsg(null);
    setFormScheduleType(scheduleType);
    setFormOpen(true);
  };

  const handleEdit = (msg: any) => {
    setEditingMsg(msg);
    setFormScheduleType(msg.schedule_type);
    setFormOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col sm:rounded-2xl border-border/50 bg-card p-0 gap-0">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <CalendarClock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">{campaign.name}</DialogTitle>
                  <DialogDescription className="text-sm">Gerencie as mensagens agendadas desta campanha</DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <Tabs defaultValue="once" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pt-4 pb-2">
              <TabsList className="w-full bg-secondary/50 h-11">
                <TabsTrigger value="once" className="flex-1 gap-2 data-[state=active]:bg-background">
                  <Clock className="h-4 w-4" />Único
                </TabsTrigger>
                <TabsTrigger value="daily" className="flex-1 gap-2 data-[state=active]:bg-background">
                  <CalendarClock className="h-4 w-4" />Diário
                </TabsTrigger>
                <TabsTrigger value="weekly" className="flex-1 gap-2 data-[state=active]:bg-background">
                  <CalendarDays className="h-4 w-4" />Semanal
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1 gap-2 data-[state=active]:bg-background">
                  <Calendar className="h-4 w-4" />Mensal
                </TabsTrigger>
              </TabsList>
            </div>

            {["once", "daily", "weekly", "monthly"].map((type) => (
              <TabsContent key={type} value={type} className="flex-1 flex flex-col min-h-0 px-6 pb-6 mt-0">
                {/* Add button */}
                <div className="flex items-center justify-between py-3 border-b border-border/20 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {type === "once" && "Mensagens de envio único"}
                      {type === "daily" && "Mensagens diárias"}
                      {type === "weekly" && "Mensagens semanais"}
                      {type === "monthly" && "Mensagens mensais"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {type === "once" && "Enviadas uma única vez na data e hora programadas"}
                      {type === "daily" && "Enviadas todos os dias no horário configurado"}
                      {type === "weekly" && "Enviadas nos dias da semana selecionados"}
                      {type === "monthly" && "Enviadas no dia do mês escolhido"}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleAdd(type)}
                    className="gap-2 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white shadow-[0_0_12px_hsl(var(--success)/0.3)]"
                    disabled={!campaign.api_config_id}
                  >
                    <Plus className="h-4 w-4" />Adicionar Mensagem
                  </Button>
                </div>

                {/* Message list */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  <CampaignMessageList
                    campaignId={campaign.id}
                    apiConfigId={campaign.api_config_id}
                    instanceName={campaign.instance_name || ""}
                    groupIds={campaign.group_ids || []}
                    scheduleType={type}
                    onEdit={handleEdit}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      <ScheduledMessageForm
        open={formOpen}
        onOpenChange={setFormOpen}
        campaignId={campaign.id}
        apiConfigId={campaign.api_config_id}
        instanceName={campaign.instance_name || ""}
        groupIds={campaign.group_ids || []}
        message={editingMsg}
        defaultScheduleType={formScheduleType}
      />
    </>
  );
}
