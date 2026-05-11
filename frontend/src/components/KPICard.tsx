import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KPICardProps {
  titel: string;
  wert: ReactNode;
  hinweis?: string;
  icon?: ReactNode;
}

export function KPICard({ titel, wert, hinweis, icon }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          {titel}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-800 tabular-nums">{wert}</div>
        {hinweis && <p className="mt-1 text-xs text-muted-foreground">{hinweis}</p>}
      </CardContent>
    </Card>
  );
}
