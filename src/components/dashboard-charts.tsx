import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

/**
 * Gráficos do dashboard isolados em um módulo próprio para que o recharts
 * (biblioteca pesada) seja carregado sob demanda via React.lazy, mantendo o
 * bundle inicial leve e reduzindo o tempo de execução de JS no primeiro paint.
 */

export const CHART_COLORS = [
  "hsl(215 85% 55%)",
  "hsl(148 65% 45%)",
  "hsl(35 90% 55%)",
  "hsl(270 60% 55%)",
  "hsl(0 70% 55%)",
];

export function ElpBarChart({ data }: { data: Array<Record<string, any>> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="nome" fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Compradas" fill="hsl(215 85% 55%)" />
        <Bar dataKey="Alocadas" fill="hsl(148 65% 45%)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CicloVidaPieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TcoCentroBarChart({
  rows,
  formatValue,
}: {
  rows: Array<{ nome: string; valor: number }>;
  formatValue: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis type="number" fontSize={10} tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="nome" fontSize={10} width={80} />
        <Tooltip formatter={(v: any) => formatValue(Number(v))} />
        <Bar dataKey="valor" fill="hsl(215 85% 55%)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
