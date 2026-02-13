import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileJson, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportBackup, downloadBackup, importBackup, validateBackupFile } from "@/lib/backup";

export default function BackupPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState<any>(null);

  const handleProgress = (s: string, p: number) => {
    setStep(s);
    setProgress(p);
  };

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    try {
      const backup = await exportBackup(handleProgress);
      downloadBackup(backup);
      toast({ title: "Backup exportado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao exportar", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
      setProgress(0);
      setStep("");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!validateBackupFile(data)) {
          toast({ title: "Arquivo inválido", description: "O arquivo não possui a estrutura esperada.", variant: "destructive" });
          return;
        }
        setPendingFile(data);
        setConfirmImport(true);
      } catch {
        toast({ title: "Erro ao ler arquivo", description: "O arquivo não é um JSON válido.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    setConfirmImport(false);
    setImporting(true);
    setProgress(0);
    try {
      await importBackup(pendingFile, handleProgress);
      toast({ title: "Restauração concluída com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao restaurar", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      setPendingFile(null);
      setProgress(0);
      setStep("");
    }
  };

  const busy = exporting || importing;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backup & Restauração</h1>
        <p className="text-muted-foreground">Exporte ou importe todos os dados do sistema</p>
      </div>

      {busy && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm font-medium">{step}</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportar Backup
            </CardTitle>
            <CardDescription>
              Gera um arquivo JSON com todos os dados, configurações e arquivos de mídia do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={busy} className="w-full">
              <FileJson className="h-4 w-4 mr-2" />
              {exporting ? "Exportando..." : "Gerar Backup"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restaurar Backup
            </CardTitle>
            <CardDescription>
              Importe um arquivo de backup para restaurar todos os dados em este sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              variant="outline"
              className="w-full"
            >
              <FileJson className="h-4 w-4 mr-2" />
              {importing ? "Restaurando..." : "Selecionar Arquivo"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Restauração
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá importar todos os dados do backup (instâncias, campanhas, mensagens, templates e mídias).
              Os dados existentes <strong>não serão apagados</strong>, mas dados duplicados podem ser criados.
              {pendingFile && (
                <span className="block mt-2 text-xs">
                  Backup de: <strong>{pendingFile.user_email}</strong> em{" "}
                  {new Date(pendingFile.created_at).toLocaleString("pt-BR")}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
