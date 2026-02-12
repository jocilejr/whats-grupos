import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send } from "lucide-react";

export default function Messages() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Enviar Mensagem</h1>
        <p className="text-muted-foreground">Envie mensagens para grupos do WhatsApp</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Nova Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Configure uma instância da Evolution API nas Configurações para começar a enviar mensagens.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
