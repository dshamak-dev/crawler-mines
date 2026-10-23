import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import type { ThemeTokens } from '../../../src/engine';

const LEAF = 'M0 0c4-6 12-8 18-6-2 7-9 11-18 6z';
const LEAF_VEIN = 'M0 0c5-2 10-4 15-5';
const LEAF_GREENS = ['#3e6a2a', '#5a8a3a', '#2e5420', '#6a9a40'];

function LeafCluster({ x, y, flipX, flipY }: { x: number; y: number; flipX: boolean; flipY: boolean }) {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  const leaves: Array<[number, number, number, number]> = [
    [2, 6, -10, 1.5],
    [10, 2, 25, 1.2],
    [4, 18, 60, 1.3],
    [18, 10, 5, 1],
    [0, 30, 80, 1.1],
  ];
  return (
    <G transform={`translate(${x} ${y}) scale(${sx * 1.6} ${sy * 1.6})`}>
      {leaves.map(([lx, ly, rot, s], i) => (
        <G key={i} transform={`translate(${lx} ${ly}) rotate(${rot}) scale(${s})`}>
          <Path d={LEAF} fill={LEAF_GREENS[i % LEAF_GREENS.length]} />
          <Path d={LEAF_VEIN} stroke="#1e3a14" strokeWidth="0.6" fill="none" opacity="0.6" />
        </G>
      ))}
    </G>
  );
}

/** Theme dressing painted behind every screen: neon edge rails or woodland planks and leaves. */
export default function Backdrop({ theme }: { theme: ThemeTokens }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  if (theme.backdrop === 'none') return null;
  const { w, h } = box;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
      }}
    >
      {w > 0 && h > 0 ? (
        <Svg width={w} height={h}>
          {theme.backdrop === 'neon' ? (
            <>
              <Path
                d={`M3 22L18 7H${w * 0.32}M${w * 0.68} 7H${w - 18}L${w - 3} 22V${h - 22}L${w - 18} ${h - 7}H${w * 0.68}M${w * 0.32} ${h - 7}H18L3 ${h - 22}Z`}
                stroke={theme.boardBorder}
                strokeWidth="1.2"
                fill="none"
              />
              <Path
                d={`M3 ${h * 0.3}V${h * 0.42}M${w - 3} ${h * 0.58}V${h * 0.7}`}
                stroke={theme.digBorder}
                strokeWidth="2"
                opacity="0.7"
              />
            </>
          ) : (
            <>
              {Array.from({ length: Math.ceil(w / 64) }, (_, i) => (
                <Path
                  key={`seam-${i}`}
                  d={`M${i * 64 + 32} 0V${h}`}
                  stroke={theme.stoneLo}
                  strokeWidth="1.5"
                  opacity="0.55"
                />
              ))}
              {Array.from({ length: Math.ceil(w / 16) }, (_, i) => (
                <Path
                  key={`grain-${i}`}
                  d={`M${i * 16 + 6} 0c3 ${h * 0.2} -3 ${h * 0.4} 0 ${h * 0.6}s-2 ${h * 0.3} 0 ${h * 0.4}`}
                  stroke={theme.grain}
                  strokeWidth="0.8"
                  fill="none"
                  opacity="0.5"
                />
              ))}
              <LeafCluster x={-4} y={-4} flipX={false} flipY={false} />
              <LeafCluster x={w + 4} y={-4} flipX flipY={false} />
              <LeafCluster x={-4} y={h + 4} flipX={false} flipY />
              <LeafCluster x={w + 4} y={h + 4} flipX flipY />
            </>
          )}
        </Svg>
      ) : null}
    </View>
  );
}
