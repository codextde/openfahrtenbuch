import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { GeoPoint } from '@/core/types';
import { useColors } from '@/theme';

type P = { lat: number; lng: number };

export function RouteSketch({ points, start, end, height = 150, color }: { points: P[]; start: GeoPoint | null; end: GeoPoint | null; height?: number; color: string }) {
  const c = useColors();
  const width = 340;
  const path = useMemo(() => {
    const all = points.length >= 2 ? points : ([start, end].filter(Boolean) as P[]);
    if (all.length < 2) return null;
    const midLat = all.reduce((s, p) => s + p.lat, 0) / all.length;
    const kx = Math.cos((midLat * Math.PI) / 180);
    const xs = all.map((p) => p.lng * kx);
    const ys = all.map((p) => -p.lat);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 22;
    const span = Math.max(maxX - minX, ((maxY - minY) * (width - 2 * pad)) / (height - 2 * pad), 1e-6);
    const scale = (width - 2 * pad) / span;
    const ox = (width - (maxX - minX) * scale) / 2;
    const oy = (height - (maxY - minY) * scale) / 2;
    const pt = (i: number) => [ox + (xs[i] - minX) * scale, oy + (ys[i] - minY) * scale] as const;
    const step = Math.max(1, Math.floor(all.length / 400));
    let d = '';
    for (let i = 0; i < all.length; i += step) {
      const [x, y] = pt(i);
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    const [lx, ly] = pt(all.length - 1);
    d += `L${lx.toFixed(1)},${ly.toFixed(1)}`;
    return { d, a: pt(0), b: pt(all.length - 1), straight: points.length < 2 };
  }, [points, start, end, height]);

  if (!path) return null;
  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden', backgroundColor: c.surfaceSunken }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 9 }).map((_, i) => (
          <Rect key={i} x={(i * width) / 8} y={0} width={0.6} height={height} fill={c.border} />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <Rect key={`h${i}`} x={0} y={(i * height) / 4} width={width} height={0.6} fill={c.border} />
        ))}
        <Path d={path.d} stroke={color} strokeOpacity={0.25} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={path.d} stroke={color} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={path.straight ? '2 8' : undefined} />
        <Circle cx={path.a[0]} cy={path.a[1]} r={6} fill={c.surface} stroke={c.text} strokeWidth={2.5} />
        <Circle cx={path.b[0]} cy={path.b[1]} r={7} fill={color} stroke={c.surface} strokeWidth={2.5} />
      </Svg>
    </View>
  );
}
