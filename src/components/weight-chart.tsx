import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { ThemeColors } from '@/constants/theme';
import { type WeightEntry } from '@/context/weight-context';

const HEIGHT = 170;
const M = { top: 14, right: 14, bottom: 24, left: 44 }; // room for axis labels

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};
const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// Line chart of recent weigh-ins with a weight (y) axis and a time (x) axis,
// one dot per entry. With fewer than two entries there is no trend to draw, so
// it falls back to a flat baseline line at the user's current weight (or the
// single logged value) so the chart is never empty.
export function WeightChart({
  colors,
  entries,
  format,
  baseline,
}: {
  colors: ThemeColors;
  entries: WeightEntry[];
  format: (kg: number) => string;
  baseline: number; // current weight (kg), used for the flat baseline
}) {
  const styles = createStyles(colors);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const points = entries.slice(-30);
  const hasTrend = points.length >= 2;

  // Each node is a real weigh-in with its horizontal position as a 0..1
  // fraction of the time span. Non-trend cases synthesize a single node.
  let nodes: { frac: number; v: number; date: string }[];
  if (hasTrend) {
    const times = points.map((p) => Date.parse(p.date));
    const tMin = Math.min(...times);
    const span = Math.max(...times) - tMin || 1;
    nodes = points.map((p, i) => ({ frac: (times[i] - tMin) / span, v: p.weightKg, date: p.date }));
  } else if (points.length === 1) {
    nodes = [{ frac: 1, v: points[0].weightKg, date: points[0].date }];
  } else {
    nodes = [{ frac: 1, v: baseline, date: todayISO() }];
  }

  const vals = nodes.map((n) => n.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.25 || 1; // min==max on a flat line -> keep it mid-chart
  const lo = min - pad;
  const hi = max + pad;

  const plotW = Math.max(width - M.left - M.right, 1);
  const plotH = HEIGHT - M.top - M.bottom;
  const x = (frac: number) => M.left + frac * plotW;
  const y = (v: number) => M.top + (1 - (v - lo) / (hi - lo)) * plotH;

  // For a flat baseline the line spans the full width; otherwise it connects
  // the real nodes in time order.
  const linePts = hasTrend ? nodes : [{ frac: 0, v: nodes[0].v }, { frac: 1, v: nodes[0].v }];
  const d = linePts
    .map((n, i) => `${i === 0 ? 'M' : 'L'}${x(n.frac).toFixed(1)},${y(n.v).toFixed(1)}`)
    .join(' ');

  const axis = colors.muted;

  return (
    <View onLayout={onLayout} style={styles.plot}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {/* y-axis reference lines + weight labels at the data extremes */}
          {(hasTrend ? [max, min] : [min]).map((v) => (
            <Line
              key={`g${v}`}
              x1={M.left}
              y1={y(v)}
              x2={M.left + plotW}
              y2={y(v)}
              stroke={axis}
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          ))}
          {(hasTrend ? [max, min] : [min]).map((v) => (
            <SvgText key={`yl${v}`} x={M.left - 6} y={y(v) + 3} fontSize={10} fill={axis} textAnchor="end">
              {format(v)}
            </SvgText>
          ))}

          {/* axes */}
          <Line x1={M.left} y1={M.top} x2={M.left} y2={M.top + plotH} stroke={axis} strokeOpacity={0.4} strokeWidth={1} />
          <Line
            x1={M.left}
            y1={M.top + plotH}
            x2={M.left + plotW}
            y2={M.top + plotH}
            stroke={axis}
            strokeOpacity={0.4}
            strokeWidth={1}
          />

          {/* x-axis date labels */}
          {hasTrend ? (
            <>
              <SvgText x={M.left} y={HEIGHT - 8} fontSize={10} fill={axis} textAnchor="start">
                {shortDate(nodes[0].date)}
              </SvgText>
              <SvgText x={M.left + plotW} y={HEIGHT - 8} fontSize={10} fill={axis} textAnchor="end">
                {shortDate(nodes[nodes.length - 1].date)}
              </SvgText>
            </>
          ) : (
            <SvgText x={M.left + plotW} y={HEIGHT - 8} fontSize={10} fill={axis} textAnchor="end">
              {shortDate(nodes[0].date)}
            </SvgText>
          )}

          {/* trend line + a dot on each real entry */}
          <Path d={d} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          {nodes.map((n, i) => (
            <Circle
              key={`d${i}`}
              cx={x(n.frac)}
              cy={y(n.v)}
              r={i === nodes.length - 1 ? 4 : 3}
              fill={colors.accent}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    plot: { height: HEIGHT },
  });
}
