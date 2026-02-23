import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserPlus, UserMinus, TrendingUp, TrendingDown } from "lucide-react";

interface GroupSummaryCardsProps {
  totalGroups: number;
  totalMembers: number;
  totalJoined: number;
  totalLeft: number;
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value === prevRef.current) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 1200);

    // Animate count
    const start = prevRef.current;
    const diff = value - start;
    const steps = Math.min(Math.abs(diff), 20);
    const stepTime = 300 / Math.max(steps, 1);
    let step = 0;

    const interval = setInterval(() => {
      step++;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(interval);
      } else {
        setDisplay(Math.round(start + (diff * step) / steps));
      }
    }, stepTime);

    prevRef.current = value;
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [value]);

  return (
    <span className={`transition-all duration-300 ${flash ? "scale-110 text-primary" : ""}`} style={{ display: "inline-block" }}>
      {prefix}{typeof display === "number" ? display.toLocaleString("pt-BR") : display}
    </span>
  );
}

export default function GroupSummaryCards({ totalGroups, totalMembers, totalJoined, totalLeft }: GroupSummaryCardsProps) {
  const net = totalJoined - totalLeft;

  const cards = [
    {
      title: "Total de Grupos",
      value: totalGroups,
      prefix: "",
      icon: Users,
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
    },
    {
      title: "Total de Membros",
      value: totalMembers,
      prefix: "",
      icon: Users,
      gradient: "from-[hsl(262_60%_55%/0.2)] to-[hsl(262_60%_55%/0.05)]",
      iconColor: "text-[hsl(262,60%,55%)]",
      borderColor: "border-[hsl(262_60%_55%/0.2)]",
      delta: net !== 0 ? net : undefined,
    },
    {
      title: "Entradas Hoje",
      value: totalJoined,
      prefix: "+",
      icon: UserPlus,
      gradient: "from-[hsl(142_71%_45%/0.2)] to-[hsl(142_71%_45%/0.05)]",
      iconColor: "text-[hsl(142,71%,45%)]",
      borderColor: "border-[hsl(142_71%_45%/0.2)]",
    },
    {
      title: "Saídas Hoje",
      value: totalLeft,
      prefix: "-",
      icon: UserMinus,
      gradient: "from-[hsl(0_62%_50%/0.2)] to-[hsl(0_62%_50%/0.05)]",
      iconColor: "text-destructive",
      borderColor: "border-destructive/20",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={`relative overflow-hidden border ${card.borderColor} hover:scale-[1.02] transition-all duration-300`}
        >
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${card.gradient}`} />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
              {"delta" in card && card.delta !== undefined && (
                <div className={`flex items-center gap-0.5 text-xs font-semibold ${
                  card.delta > 0 ? "text-[hsl(142,71%,45%)]" : "text-destructive"
                }`}>
                  {card.delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {card.delta > 0 ? "+" : ""}{card.delta}
                </div>
              )}
            </div>
            <p className="text-3xl font-bold tracking-tighter">
              <AnimatedNumber value={card.value} prefix={card.prefix} />
            </p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{card.title}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
