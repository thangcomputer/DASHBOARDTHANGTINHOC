import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Check, ChevronDown, X } from 'lucide-react-native';
import { colors, spacing } from '../theme/tokens';

export type CoursePickerItem = {
  key: string;
  name: string;
  teacherName?: string;
  done: number;
  total: number;
  pct: number;
  completed: boolean;
};

/** Thanh chọn khóa học gọn (thay cho hàng thẻ khóa học lớn) — bấm để mở danh sách khóa. */
export function CompactCoursePicker({
  items,
  activeName,
  onChange,
  showProgress = true,
}: {
  items: CoursePickerItem[];
  activeName: string;
  onChange: (name: string) => void;
  showProgress?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = items.find((item) => item.name === activeName) || items[0];
  if (items.length <= 1 || !active) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.bar}
        accessibilityRole="button"
        accessibilityLabel={`Đổi khóa học, đang xem ${active.name}`}
      >
        <View style={styles.barIcon}><BookOpen size={18} color="#2563EB" /></View>
        <View style={styles.flex}>
          <Text style={styles.caption}>{`Khóa học đang xem · ${items.length} khóa`}</Text>
          <Text numberOfLines={1} style={styles.barName}>{active.name}</Text>
          {showProgress ? (
            <View style={styles.barProgressRow}>
              <View style={styles.track}><View style={[styles.fill, { width: `${active.pct}%` }]} /></View>
              <Text style={styles.progressText}>{`${active.done}/${active.total} · ${active.pct}%`}</Text>
            </View>
          ) : null}
        </View>
        <ChevronDown size={18} color="#94A3B8" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Đóng">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Chọn khóa học</Text>
              <Pressable onPress={() => setOpen(false)} style={styles.close} accessibilityRole="button" accessibilityLabel="Đóng">
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.list}>
              {items.map((item) => {
                const selected = item.name === active.name;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => { onChange(item.name); setOpen(false); }}
                    style={[styles.option, selected && styles.optionActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.flex}>
                      <Text numberOfLines={2} style={[styles.optionName, selected && styles.optionNameActive]}>{item.name}</Text>
                      <Text numberOfLines={1} style={styles.optionTeacher}>
                        {`GV: ${item.teacherName || 'Chưa phân công'}${item.completed ? ' · Đã hoàn thành' : ''}`}
                      </Text>
                      <View style={styles.barProgressRow}>
                        <View style={styles.track}>
                          <View style={[styles.fill, { width: `${item.pct}%`, backgroundColor: item.completed ? '#10B981' : selected ? '#3B82F6' : colors.red }]} />
                        </View>
                        <Text style={styles.progressText}>{`${item.done}/${item.total} · ${item.pct}%`}</Text>
                      </View>
                    </View>
                    {selected ? <Check size={18} color="#2563EB" /> : <View style={styles.checkSpace} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  barIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  caption: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  barName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  barProgressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  track: { flex: 1, height: 5, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#3B82F6' },
  progressText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, paddingBottom: spacing.xl },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  list: { paddingHorizontal: spacing.md, gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  optionActive: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  optionName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  optionNameActive: { color: '#1E40AF' },
  optionTeacher: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  checkSpace: { width: 18 },
});
