// G59-S1 — Düzenleyicide katman: tek parmak sürükle, iki parmak büyüt + döndür (tasarım "placed": kesikli seçim
// çerçevesi + köşe tutamaçları, ortaya yapışma kılavuzu, çöp alanına sürükleyince sil). Dokunma (kısa, hareketsiz)
// → onTap (yazıyı/etiketi yeniden düzenle). VoiceOver: katman düğme; "sil" ve "öne getir" özel eylemleri.
import React, { useMemo, useRef } from 'react';
import { PanResponder, View, type GestureResponderEvent } from 'react-native';
import { haptic } from '../../../../core/design';
import { inTrashZone, pinchTransform, snapCenter } from '../../overlays';
import type { StoryOverlay } from '../../types';
import { OverlayAt } from '../StoryCanvas';

export interface DragState {
  id: string;
  overTrash: boolean;
  guideV: boolean;
  guideH: boolean;
}

function touchGeo(e: GestureResponderEvent): { dist: number; angle: number } | null {
  const ts = e.nativeEvent.touches;
  if (!ts || ts.length < 2) return null;
  const dx = ts[1].pageX - ts[0].pageX;
  const dy = ts[1].pageY - ts[0].pageY;
  return { dist: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

export function EditableOverlay({
  overlay,
  w,
  h,
  selected,
  enabled,
  label,
  onChange,
  onDragState,
  onDelete,
  onTap,
  onSelect,
  children,
}: {
  overlay: StoryOverlay;
  w: number;
  h: number;
  selected: boolean;
  enabled: boolean;
  label: string;
  onChange: (o: StoryOverlay) => void;
  onDragState: (s: DragState | null) => void;
  onDelete: (id: string) => void;
  onTap?: (o: StoryOverlay) => void;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  const cur = useRef(overlay);
  cur.current = overlay;
  const start = useRef({ x: 0, y: 0, scale: 1, rotation: 0, dist: 0, angle: 0, t: 0, moved: false, pinching: false });
  const lastTrash = useRef(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const o = cur.current;
          const g = touchGeo(e);
          start.current = { x: o.x, y: o.y, scale: o.scale, rotation: o.rotation, dist: g?.dist ?? 0, angle: g?.angle ?? 0, t: Date.now(), moved: false, pinching: !!g };
          lastTrash.current = false;
          onSelect(o.id);
        },
        onPanResponderMove: (e, gs) => {
          const o = cur.current;
          const g = touchGeo(e);
          if (g) {
            if (!start.current.pinching) {
              start.current = { ...start.current, scale: o.scale, rotation: o.rotation, dist: g.dist, angle: g.angle, pinching: true };
              return;
            }
            const tr = pinchTransform(start.current, g);
            start.current.moved = true;
            onChange({ ...o, scale: tr.scale, rotation: tr.rotation } as StoryOverlay);
            return;
          }
          if (Math.abs(gs.dx) + Math.abs(gs.dy) < 4 && !start.current.moved) return;
          start.current.moved = true;
          const sx = snapCenter(Math.min(1, Math.max(0, start.current.x + gs.dx / w)));
          const sy = snapCenter(Math.min(1, Math.max(0, start.current.y + gs.dy / h)));
          const over = inTrashZone(sx.v, sy.v);
          if (over !== lastTrash.current) {
            lastTrash.current = over;
            if (over) haptic('light');
          }
          onDragState({ id: o.id, overTrash: over, guideV: sx.snapped, guideH: sy.snapped });
          onChange({ ...o, x: sx.v, y: sy.v } as StoryOverlay);
        },
        onPanResponderRelease: () => {
          const o = cur.current;
          const s = start.current;
          onDragState(null);
          if (!s.moved && Date.now() - s.t < 350) {
            onTap?.(o);
            return;
          }
          if (inTrashZone(o.x, o.y)) {
            haptic('medium');
            onDelete(o.id);
          }
        },
        onPanResponderTerminate: () => onDragState(null),
      }),
    [enabled, w, h, onChange, onDragState, onDelete, onTap, onSelect],
  );

  return (
    <OverlayAt overlay={overlay} w={w} h={h}>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        accessibilityActions={[{ name: 'delete', label: 'Sil' }, { name: 'activate' }]}
        onAccessibilityAction={(ev) => {
          if (ev.nativeEvent.actionName === 'delete') onDelete(overlay.id);
          if (ev.nativeEvent.actionName === 'activate') onTap?.(overlay);
        }}
      >
        {children}
        {selected ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: -8, right: -8, top: -8, bottom: -8 }}>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#FFFFFF', borderRadius: 28 }} />
            {[
              { left: -7, top: -7 },
              { right: -7, top: -7 },
              { left: -7, bottom: -7 },
              { right: -7, bottom: -7 },
            ].map((p, i) => (
              <View key={i} style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#0A0A0A', ...p }} />
            ))}
          </View>
        ) : null}
      </View>
    </OverlayAt>
  );
}
