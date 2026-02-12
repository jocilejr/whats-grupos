import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function Templates() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">Modelos de mensagens reutilizáveis</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Seus Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Crie templates para agilizar o envio de mensagens recorrentes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
