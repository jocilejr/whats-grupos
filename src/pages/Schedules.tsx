import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

export default function Schedules() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
        <p className="text-muted-foreground">Gerencie suas mensagens agendadas e recorrentes</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Agendamentos Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Nenhum agendamento configurado ainda.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
