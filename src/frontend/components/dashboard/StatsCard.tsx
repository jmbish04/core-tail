import { Card } from '../ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  className?: string;
}

export function StatsCard({ title, value, className = '' }: StatsCardProps) {
  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </Card>
  );
}
