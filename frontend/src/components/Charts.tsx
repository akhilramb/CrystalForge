import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from "recharts";
export function Distribution({
  title,
  data,
  color = "#849442",
}: {
  title: string;
  data: any[];
  color?: string;
}) {
  return (
    <section className="chart panel">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="#e9eae4" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} width={45} />
          <Tooltip />
          <Bar
            dataKey="value"
            name="Records"
            fill={color}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
export function Predictions({ points }: { points: any[] }) {
  const v = points.flatMap((p) => [p.actual, p.predicted]);
  const min = Math.floor(Math.min(...v)),
    max = Math.ceil(Math.max(...v));
  return (
    <section className="panel chart">
      <h3>Actual vs predicted voltage</h3>
      <p className="muted">
        Held-out test records · ideal prediction on the diagonal
      </p>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ bottom: 30, right: 25, left: 5 }}>
          <CartesianGrid stroke="#e9eae4" />
          <XAxis
            type="number"
            dataKey="actual"
            name="Actual voltage"
            domain={[min, max]}
            label={{ value: "Actual voltage (V)", position: "bottom" }}
          />
          <YAxis
            type="number"
            dataKey="predicted"
            name="Predicted voltage"
            domain={[min, max]}
            label={{
              value: "Predicted (V)",
              angle: -90,
              position: "insideLeft",
            }}
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <ReferenceLine
            segment={[
              { x: min, y: min },
              { x: max, y: max },
            ]}
            stroke="#253229"
            strokeDasharray="5 5"
          />
          <Scatter data={points} fill="#92a24d" fillOpacity={0.45} />
        </ScatterChart>
      </ResponsiveContainer>
    </section>
  );
}
