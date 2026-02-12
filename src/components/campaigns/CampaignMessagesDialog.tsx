import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignMessageList } from "./CampaignMessageList";
import { ScheduledMessageForm } from "./ScheduledMessageForm";
import { CalendarClock, Clock, CalendarDays, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { value: 0, label: "Dom" }, { value: 1, label: "Seg" }, { value: 2, label: "Ter" },
  { value: 3, label: "Qua" }, { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" },
];

interface CampaignMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: any;
}

export function CampaignMessagesDialog({ open, onOpenChange, campaign }: CampaignMessagesDialogProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formScheduleType, setFormScheduleType] = useState("once");
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [weekdayFilter, setWeekdayFilter] = useState<number | null>(null);

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
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col sm:rounded-2xl border-border/50 bg-card p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold">{campaign.name}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Gerencie as mensagens agendadas desta campanha
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Tabs filling remaining space */}
          <Tabs defaultValue="once" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pt-3 pb-0 shrink-0">
              <TabsList className="w-full bg-secondary/40 h-10 p-1 rounded-lg">
                <TabsTrigger value="once" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md">
                  <Clock className="h-3.5 w-3.5" />Único
                </TabsTrigger>
                <TabsTrigger value="daily" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md">
                  <CalendarClock className="h-3.5 w-3.5" />Diário
                </TabsTrigger>
                <TabsTrigger value="weekly" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md">
                  <CalendarDays className="h-3.5 w-3.5" />Semanal
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md">
                  <Calendar className="h-3.5 w-3.5" />Mensal
                </TabsTrigger>
              </TabsList>
            </div>

            {["once", "daily", "weekly", "monthly"].map((type) => (
              <TabsContent key={type} value={type} className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
                {/* Subheader with add button */}
                <div className="flex items-center justify-between px-6 py-3 shrink-0">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                      {type === "once" && "Mensagens de envio único"}
                      {type === "daily" && "Mensagens diárias"}
                      {type === "weekly" && "Mensagens semanais"}
                      {type === "monthly" && "Mensagens mensais"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {type === "once" && "Enviadas uma única vez na data e hora programadas"}
                      {type === "daily" && "Enviadas todos os dias no horário configurado"}
                      {type === "weekly" && "Enviadas nos dias da semana selecionados"}
                      {type === "monthly" && "Enviadas no dia do mês escolhido"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAdd(type)}
                    className="gap-1.5 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white shadow-[0_0_10px_hsl(var(--success)/0.25)] shrink-0"
                    disabled={!campaign.api_config_id}
                  >
                    <Plus className="h-3.5 w-3.5" />Adicionar Mensagem
                  </Button>
                </div>

                {/* Weekday filter for weekly tab */}
                {type === "weekly" && (
                  <div className="flex items-center gap-1.5 px-6 pb-3 shrink-0">
                    <button
                      onClick={() => setWeekdayFilter(null)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all",
                        weekdayFilter === null
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                      )}
                    >Todos</button>
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => setWeekdayFilter(weekdayFilter === d.value ? null : d.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all",
                          weekdayFilter === d.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                        )}
                      >{d.label}</button>
                    ))}
                  </div>
                )}

                {/* Scrollable message list */}
                <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
                  <CampaignMessageList
                    campaignId={campaign.id}
                    apiConfigId={campaign.api_config_id}
                    instanceName={campaign.instance_name || ""}
                    groupIds={campaign.group_ids || []}
                    scheduleType={type}
                    onEdit={handleEdit}
                    weekdayFilter={type === "weekly" ? weekdayFilter : undefined}
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
