import { Card, CardContent } from "@/components/ui/card";
import { Users, UserPlus, UserMinus } from "lucide-react";

interface GroupSummaryCardsProps {
  totalGroups: number;
  totalMembers: number;
  totalJoined: number;
  totalLeft: number;
}

export default function GroupSummaryCards({ totalGroups, totalMembers, totalJoined, totalLeft }: GroupSummaryCardsProps) {
  const cards = [
    {
      title: "Total de Grupos",
      value: totalGroups,
      icon: Users,
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
    },
    {
      title: "Total de Membros",
      value: totalMembers.toLocaleString("pt-BR"),
      icon: Users,
      gradient: "from-[hsl(262_60%_55%/0.2)] to-[hsl(262_60%_55%/0.05)]",
      iconColor: "text-[hsl(262,60%,55%)]",
      borderColor: "border-[hsl(262_60%_55%/0.2)]",
    },
    {
      title: "Entradas Hoje",
      value: `+${totalJoined}`,
      icon: UserPlus,
      gradient: "from-[hsl(142_71%_45%/0.2)] to-[hsl(142_71%_45%/0.05)]",
      iconColor: "text-[hsl(142,71%,45%)]",
      borderColor: "border-[hsl(142_71%_45%/0.2)]",
    },
    {
      title: "Saídas Hoje",
      value: `-${totalLeft}`,
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
            </div>
            <p className="text-3xl font-bold tracking-tighter">{card.value}</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{card.title}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
