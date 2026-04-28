import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  className?: string;
  icon?: React.ReactNode;
}

export function StatsCard({ title, value, className = "", icon }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold text-foreground ${className}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
