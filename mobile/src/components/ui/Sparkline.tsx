import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Polygon } from 'react-native-svg';

import { useLocale } from '@/providers/LocaleProvider';
import { colors } from '@/theme/tokens';

type Props = {
  values: number[];
  /** Score range. Wellbeing scores are 1 (poor) to 5 (excellent). */
  min?: number;
  max?: number;
  height?: number;
  label: string;
};

/**
 * A small dependency-free trend line (react-native-svg only). Time runs with the reading
 * direction: oldest to newest left-to-right in English/French, right-to-left in Arabic.
 */
export function Sparkline({ values, min = 1, max = 5, height = 56, label }: Props) {
  const { isRTL } = useLocale();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pad = 6;
  const n = values.length;
  const x = (i: number) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const pos = isRTL ? 1 - t : t;
    return pad + pos * Math.max(0, width - pad * 2);
  };
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - pad * 2);

  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const base = height - pad;
  const area = n > 1 ? `${x(0)},${base} ${points} ${x(n - 1)},${base}` : '';

  return (
    <View onLayout={onLayout} style={{ height }} accessible accessibilityRole="image" accessibilityLabel={label}>
      {width > 0 && n > 0 ? (
        <Svg width={width} height={height}>
          {[min, (min + max) / 2, max].map((g) => (
            <Line key={g} x1={pad} x2={width - pad} y1={y(g)} y2={y(g)} stroke={colors.line} strokeWidth={1} strokeDasharray="2 4" />
          ))}
          {area ? <Polygon points={area} fill={colors.accentSoft} opacity={0.7} /> : null}
          {n > 1 ? <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {values.map((v, i) => (
            <Circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 4 : 2.5} fill={i === n - 1 ? colors.accent : colors.surface} stroke={colors.accent} strokeWidth={1.5} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
