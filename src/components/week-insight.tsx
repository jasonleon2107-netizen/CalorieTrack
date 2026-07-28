import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { roundedFont, Spacing, ThemeColors } from '@/constants/theme';
import { round } from '@/lib/health';

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function arcPath(cx: number, cy: number, r: number, f0: number, f1: number) {
  if (f1 >= 0.9999) f1 = 0.9999;
  const pt = (f: number) => {
    const a = ((-90 + 360 * f) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const [sx, sy] = pt(f0);
  const [ex, ey] = pt(f1);
  const large = f1 - f0 > 0.5 ? 1 : 0;
  return `M${sx.toFixed(2)} ${sy.toFixed(2)} A${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

function last7(): Date[] {
  const out: Date[] = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i));
  return out;
}

function MiniRing({ colors, kcal, goal }: { colors: ThemeColors; kcal: number; goal: number }) {
  const size = 34;
  const sw = 4;
  const r = (size - sw) / 2;
  const c = size / 2;
  const pct = goal > 0 ? Math.min(kcal / goal, 1) : 0;
  const over = kcal > goal;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={colors.cardElevated} strokeWidth={sw} fill="none" />
      {pct > 0 && (
        <Path d={arcPath(c, c, r, 0, Math.min(pct, 0.9999))} stroke={over ? colors.danger : colors.accent} strokeWidth={sw} fill="none" strokeLinecap="round" />
      )}
    </Svg>
  );
}

function WeekChart({ colors, days, vals, goal }: { colors: ThemeColors; days: Date[]; vals: number[]; goal: number }) {
  const [w, setW] = useState(0);
  const H = 118;
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const maxV = Math.max(goal, ...vals, 1) * 1.14;
  const pad = 2;
  const gap = w > 0 ? (w - pad * 2) / 7 : 0;
  const bw = gap * 0.56;
  const gy = H - (goal / maxV) * H;
  return (
    <View onLayout={onLayout} style={{ height: H + 18, marginTop: Spacing.three }}>
      {w > 0 && (
        <Svg width={w} height={H + 18}>
          <Line x1={0} y1={gy} x2={w} y2={gy} stroke={colors.muted} strokeWidth={1} strokeDasharray="4 4" />
          {days.map((d, i) => {
            const v = vals[i];
            const h = (v / maxV) * H;
            const x = pad + i * gap + (gap - bw) / 2;
            const on = v > 0 && goal > 0 && v >= goal * 0.9 && v <= goal * 1.1;
            const col = v === 0 ? colors.cardElevated : on ? colors.protein : colors.accent;
            return <Rect key={i} x={x} y={H - h} width={bw} height={Math.max(h, 2)} rx={3} fill={col} />;
          })}
          {days.map((d, i) => (
            <SvgText key={`t${i}`} x={pad + i * gap + gap / 2} y={H + 13} fill={colors.muted} fontSize={10} textAnchor="middle">
              {WD[d.getDay()]}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

export function WeekInsight({
  colors,
  goal,
  dayTotal,
  onSelectDay,
  streak,
}: {
  colors: ThemeColors;
  goal: number;
  dayTotal: (d: Date) => number;
  onSelectDay: (d: Date) => void;
  streak: number;
}) {
  const styles = createStyles(colors);
  const days = last7();
  const vals = days.map(dayTotal);
  const logged = vals.filter((v) => v > 0);
  const avg = logged.length ? round(logged.reduce((s, v) => s + v, 0) / logged.length) : 0;
  const onTarget = vals.filter((v) => v > 0 && goal > 0 && v >= goal * 0.9 && v <= goal * 1.1).length;
  const todayStr = new Date().toDateString();

  return (
    <View>
      <Text style={styles.label}>THIS WEEK</Text>
      <View style={styles.card}>
        <View style={styles.rings}>
          {days.map((d, i) => (
            <TouchableOpacity key={i} style={styles.ringItem} onPress={() => onSelectDay(d)} activeOpacity={0.6}>
              <Text style={[styles.wd, d.toDateString() === todayStr && { color: colors.accent }]}>{WD[d.getDay()]}</Text>
              <MiniRing colors={colors} kcal={vals[i]} goal={goal} />
            </TouchableOpacity>
          ))}
        </View>

        <WeekChart colors={colors} days={days} vals={vals} goal={goal} />

        <View style={styles.statsRow}>
          <Stat colors={colors} value={String(avg)} label="Avg calories" />
          <Stat colors={colors} value={`${onTarget}/7`} label="Days on target" />
          <Stat colors={colors} value={String(streak)} label="Streak" />
        </View>
      </View>
    </View>
  );
}

function Stat({ colors, value, label }: { colors: ThemeColors; value: string; label: string }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: { fontSize: 12, color: colors.muted, fontWeight: '700', letterSpacing: 0.5, marginBottom: Spacing.two },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: Spacing.three },
    rings: { flexDirection: 'row', justifyContent: 'space-between' },
    ringItem: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 2 },
    wd: { fontSize: 10, fontWeight: '700', color: colors.muted },
    statsRow: {
      flexDirection: 'row',
      marginTop: Spacing.two,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardElevated,
      paddingTop: Spacing.three,
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 17, fontWeight: '700', color: colors.text, fontFamily: roundedFont },
    statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  });
}
