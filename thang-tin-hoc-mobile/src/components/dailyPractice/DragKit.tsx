import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';

type ViewType = React.ComponentRef<typeof View>;
type Rect = { x: number; y: number; w: number; h: number };
type DragCtx = {
  register: (id: string, ref: React.RefObject<ViewType | null>) => () => void;
  measureAll: () => void;
  findZone: (x: number, y: number) => string | null;
  setDragging: (dragging: boolean) => void;
};

const Ctx = createContext<DragCtx | null>(null);

/** Bọc khu vực kéo thả; khóa cuộn màn hình khi đang kéo. */
export function DragProvider({ onDraggingChange, children }: { onDraggingChange?: (dragging: boolean) => void; children: React.ReactNode }) {
  const zones = useRef(new Map<string, { ref: React.RefObject<ViewType | null>; rect?: Rect }>());

  const register = useCallback((id: string, ref: React.RefObject<ViewType | null>) => {
    zones.current.set(id, { ref });
    return () => { zones.current.delete(id); };
  }, []);

  const measureAll = useCallback(() => {
    zones.current.forEach((zone) => {
      zone.ref.current?.measureInWindow((x, y, w, h) => { zone.rect = { x, y, w, h }; });
    });
  }, []);

  const findZone = useCallback((x: number, y: number) => {
    for (const [id, zone] of zones.current) {
      const r = zone.rect;
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
    }
    return null;
  }, []);

  const value = useMemo(() => ({ register, measureAll, findZone, setDragging: (d: boolean) => onDraggingChange?.(d) }), [findZone, measureAll, onDraggingChange, register]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Ô nhận thả; chạm vào ô để đặt thẻ đang chọn (chế độ chạm-chọn). */
export function DropZone({ id, style, onPress, disabled, children }: {
  id: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const ctx = useContext(Ctx);
  const ref = useRef<ViewType | null>(null);
  useEffect(() => ctx?.register(id, ref), [ctx, id]);
  return (
    <View ref={ref} collapsable={false}>
      <Pressable onPress={onPress} disabled={disabled || !onPress} style={style}>
        {children}
      </Pressable>
    </View>
  );
}

/** Thẻ kéo được: kéo thả vào DropZone, hoặc chạm (không di chuyển) để chọn. */
export function Draggable({ id, disabled, onDrop, onTap, onPick, style, children }: {
  id: string;
  disabled?: boolean;
  onDrop: (id: string, zoneId: string) => void;
  onTap: (id: string) => void;
  onPick?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const ctx = useContext(Ctx);
  const pan = useRef(new Animated.ValueXY()).current;
  const [dragging, setDragging] = useState(false);
  const handlers = useRef({ onDrop, onTap, onPick, disabled, ctx, id });
  handlers.current = { onDrop, onTap, onPick, disabled, ctx, id };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !handlers.current.disabled,
    onMoveShouldSetPanResponder: () => !handlers.current.disabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      handlers.current.ctx?.measureAll();
    },
    onPanResponderMove: (_, g) => {
      if (Math.hypot(g.dx, g.dy) > 6) {
        setDragging((prev) => {
          if (!prev) {
            handlers.current.ctx?.setDragging(true);
            handlers.current.onPick?.();
          }
          return true;
        });
      }
      pan.setValue({ x: g.dx, y: g.dy });
    },
    onPanResponderRelease: (_, g) => {
      const h = handlers.current;
      const moved = Math.hypot(g.dx, g.dy) > 6;
      if (!moved) h.onTap(h.id);
      else {
        const zone = h.ctx?.findZone(g.moveX, g.moveY);
        if (zone) h.onDrop(h.id, zone);
      }
      setDragging(false);
      h.ctx?.setDragging(false);
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, useNativeDriver: false }).start();
    },
    onPanResponderTerminate: () => {
      setDragging(false);
      handlers.current.ctx?.setDragging(false);
      pan.setValue({ x: 0, y: 0 });
    },
  }), [pan]);

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        style,
        { transform: pan.getTranslateTransform() },
        dragging ? { zIndex: 999, elevation: 12, opacity: 0.95, boxShadow: '0px 12px 24px rgba(15,23,42,0.25)' } as ViewStyle : null,
      ]}
    >
      {children}
    </Animated.View>
  );
}
