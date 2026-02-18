import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Send,
  Clock,
  Brain,
  LayoutDashboard,
  BarChart3,
  FileVideo,
  Shield,
  Database,
  Check,
  Zap,
  ArrowRight,
  MessageSquare,
  Users,
  Star,
} from "lucide-react";
import logoImg from "@/assets/logo.png";

const CTA_LINK = "#";

const features = [
  {
    icon: Send,
    title: "Disparo Ilimitado",
    description:
      "Envie mensagens para centenas de grupos simultaneamente com apenas um clique. Sem limites de grupos ou envios.",
  },
  {
    icon: Clock,
    title: "Agendamento Inteligente",
    description:
      "Programe envios diários, semanais ou mensais. Suas mensagens são enviadas no piloto automático.",
  },
  {
    icon: Brain,
    title: "IA Integrada",
    description:
      "Gere mensagens persuasivas e personalizadas automaticamente com inteligência artificial.",
  },
  {
    icon: LayoutDashboard,
    title: "Campanhas Organizadas",
    description:
      "Organize seus envios em campanhas estruturadas. Gerencie tudo de forma visual e intuitiva.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Completo",
    description:
      "Acompanhe entregas, erros e taxa de sucesso em tempo real com métricas detalhadas.",
  },
  {
    icon: FileVideo,
    title: "Multimídia",
    description:
      "Envie textos, imagens, vídeos, áudios, documentos e enquetes. Tudo em um só lugar.",
  },
  {
    icon: Shield,
    title: "Anti-Ban",
    description:
      "Fila inteligente com delay automático entre envios para proteger seu número contra bloqueios.",
  },
  {
    icon: Database,
    title: "Backup Seguro",
    description:
      "Exporte e restaure seus dados, templates e configurações a qualquer momento.",
  },
];

const plans = [
  {
    name: "Básico",
    price: "97",
    instances: "1 número",
    highlighted: false,
  },
  {
    name: "Profissional",
    price: "197",
    instances: "3 números",
    highlighted: true,
  },
  {
    name: "Empresarial",
    price: "247",
    instances: "5 números",
    highlighted: false,
  },
];

const planFeatures = [
  "Grupos ilimitados",
  "Disparos ilimitados",
  "Agendamentos automáticos",
  "IA integrada",
  "Dashboard completo",
  "Multimídia completa",
  "Anti-ban inteligente",
  "Backup e restauração",
  "Suporte prioritário",
];

const faqs = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O Simplificando Grupos funciona 100% no navegador. Basta acessar o painel, conectar seu WhatsApp e começar a usar.",
  },
  {
    q: "Quantos grupos posso disparar por vez?",
    a: "Não há limite de grupos. Você pode disparar para todos os seus grupos simultaneamente, independente do plano.",
  },
  {
    q: "Meu número pode ser banido?",
    a: "Nosso sistema possui uma fila inteligente com delays automáticos entre os envios, reduzindo drasticamente o risco de bloqueio do seu número.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Não há fidelidade. Você pode cancelar sua assinatura a qualquer momento sem custos adicionais.",
  },
  {
    q: "Como funciona a IA integrada?",
    a: "A IA gera mensagens persuasivas e personalizadas para seus disparos. Basta descrever o que deseja comunicar e a IA cria o texto ideal.",
  },
  {
    q: "Quais tipos de mídia posso enviar?",
    a: "Você pode enviar textos, imagens, vídeos, áudios, documentos (PDF, DOC) e enquetes para todos os seus grupos.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <img src={logoImg} alt="Simplificando Grupos" className="h-10 object-contain" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild className="bg-[hsl(var(--accent-warm))] hover:bg-[hsl(var(--accent-warm))]/90 text-white">
              <a href={CTA_LINK}>Começar Agora</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[hsl(var(--accent-warm))]/8 rounded-full blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <Badge className="mb-6 border-primary/30 bg-primary/10 text-primary px-4 py-1.5 text-sm font-medium">
            <Zap className="mr-1.5 h-3.5 w-3.5" /> Automação para WhatsApp
          </Badge>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            Automatize seus Grupos de WhatsApp e{" "}
            <span className="bg-gradient-to-r from-primary to-[hsl(var(--accent-warm))] bg-clip-text text-transparent">
              Escale seus Resultados
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Envie mensagens em massa para todos os seus grupos no piloto automático.
            Agende, personalize com IA e acompanhe tudo em tempo real.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="h-14 px-8 text-base bg-[hsl(var(--accent-warm))] hover:bg-[hsl(var(--accent-warm))]/90 text-white shadow-[0_0_30px_hsl(var(--accent-warm)/0.3)]">
              <a href={CTA_LINK}>
                Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">
              Sem compromisso • Cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* Pain Section */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Cansado de enviar mensagens{" "}
            <span className="text-[hsl(var(--accent-warm))]">manualmente</span> em cada grupo?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground text-lg">
            Copiar, colar, trocar de grupo, repetir... Isso consome horas do seu dia e
            limita seu crescimento. Enquanto você perde tempo com tarefas repetitivas,
            seus concorrentes estão escalando no automático.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { icon: MessageSquare, label: "Horas perdidas", sub: "copiando e colando mensagens" },
              { icon: Users, label: "Grupos ignorados", sub: "por falta de tempo" },
              { icon: Star, label: "Resultados travados", sub: "sem escala possível" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border/50 bg-card/50 p-6 text-center">
                <item.icon className="mx-auto h-8 w-8 text-destructive mb-3" />
                <p className="font-semibold">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28 border-t border-border/30">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 border-primary/30 bg-primary/10 text-primary">Funcionalidades</Badge>
            <h2 className="text-3xl font-bold md:text-4xl">
              Tudo que você precisa para{" "}
              <span className="text-primary">dominar seus grupos</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Uma plataforma completa para gerenciar, automatizar e escalar seus envios em grupos de WhatsApp.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card
                key={f.title}
                className="group border-border/50 bg-card/60 backdrop-blur hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_hsl(var(--primary)/0.08)]"
              >
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 md:py-28 border-t border-border/30">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 border-[hsl(var(--accent-warm))]/30 bg-[hsl(var(--accent-warm))]/10 text-[hsl(var(--accent-warm))]">
              Planos
            </Badge>
            <h2 className="text-3xl font-bold md:text-4xl">
              Escolha o plano ideal para o seu negócio
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Todos os planos incluem grupos e disparos ilimitados. A diferença é a quantidade de números conectados.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative overflow-hidden border-border/50 transition-all duration-300 ${
                  plan.highlighted
                    ? "border-primary/60 shadow-[0_0_40px_hsl(var(--primary)/0.12)] scale-[1.03]"
                    : "bg-card/60 hover:border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-[hsl(var(--accent-warm))]" />
                )}
                <CardHeader className="text-center pb-2">
                  {plan.highlighted && (
                    <Badge className="mx-auto mb-2 bg-primary/15 text-primary border-primary/30 text-xs">
                      Mais Popular
                    </Badge>
                  )}
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.instances}</p>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="my-4">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-left text-sm">
                    {planFeatures.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
                        <span className="text-muted-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={`mt-8 w-full ${
                      plan.highlighted
                        ? "bg-[hsl(var(--accent-warm))] hover:bg-[hsl(var(--accent-warm))]/90 text-white"
                        : ""
                    }`}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    <a href={CTA_LINK}>Assinar Agora</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 border-t border-border/30">
        <div className="mx-auto max-w-3xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">Perguntas Frequentes</h2>
            <p className="mt-4 text-muted-foreground">Tire suas dúvidas sobre a plataforma</p>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-lg border border-border/50 bg-card/40 px-5 data-[state=open]:bg-card/70 transition-colors"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-20 md:py-28 border-t border-border/30">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold md:text-5xl">
            Pronto para automatizar seus grupos?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Pare de perder tempo com envios manuais. Comece agora e escale seus resultados no WhatsApp.
          </p>
          <Button
            size="lg"
            asChild
            className="mt-10 h-14 px-10 text-base bg-[hsl(var(--accent-warm))] hover:bg-[hsl(var(--accent-warm))]/90 text-white shadow-[0_0_40px_hsl(var(--accent-warm)/0.3)]"
          >
            <a href={CTA_LINK}>
              Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <img src={logoImg} alt="Simplificando Grupos" className="h-8 object-contain opacity-70" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Simplificando Grupos. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
