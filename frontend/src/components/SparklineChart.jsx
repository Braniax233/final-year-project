import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * SparklineChart – miniature line chart with no axes or grid.
 * @param {number[]} data   - Array of numeric values
 * @param {string}   color  - Stroke color (CSS color string)
 * @param {boolean}  tooltip - Show tooltip on hover (default false)
 */
export default function SparklineChart({ data = [], color = '#3b82f6', tooltip = false }) {
  if (!data || data.length === 0) {
    return <div className="w-full h-full bg-gray-100 rounded" />;
  }

  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        {tooltip && (
          <Tooltip
            contentStyle={{ fontSize: 11, padding: '2px 6px' }}
            formatter={(v) => [v, '']}
            labelFormatter={() => ''}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
