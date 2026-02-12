import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CampaignMessageList } from "./CampaignMessageList";
import { CalendarClock } from "lucide-react";

interface CampaignMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: any;
}

export function CampaignMessagesDialog({ open, onOpenChange, campaign }: CampaignMessagesDialogProps) {
  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col sm:rounded-2xl border-border/50 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Mensagens — {campaign.name}</DialogTitle>
              <DialogDescription className="text-xs">Gerencie as mensagens agendadas desta campanha</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-2">
          <CampaignMessageList
            campaignId={campaign.id}
            apiConfigId={campaign.api_config_id}
            instanceName={campaign.instance_name || ""}
            groupIds={campaign.group_ids || []}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
