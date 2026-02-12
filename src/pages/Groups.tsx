import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function Groups() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Grupos</h1>
        <p className="text-muted-foreground">Gerencie seus grupos do WhatsApp</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Grupos conectados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Configure uma instância da Evolution API nas Configurações para listar seus grupos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
