import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Check, GripVertical, Lock, X } from 'lucide-react-native';
import type { DpAnswer, DpAnswerResult, DpQuestion, DpReveal } from '../../services/dailyPracticeApi';
import { Draggable, DropZone } from './DragKit';
import type { GameSound } from './useGameSounds';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export type QuestionProps = {
  question: DpQuestion;
  reveal: DpReveal | null;
  result: DpAnswerResult | null;
  play: (sound: GameSound) => void;
  onChange: (answer: DpAnswer | null) => void;
};

const norm = (value: string) => value.trim().toLowerCase();

function Mark({ ok }: { ok: boolean }) {
  const pop = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    pop.setValue(0.45);
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 160,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [ok, pop]);

  return (
    <Animated.View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: ok ? '#10B981' : '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pop }],
      }}
    >
      {ok ? <Check size={15} color="#FFFFFF" strokeWidth={3.2} /> : <X size={15} color="#FFFFFF" strokeWidth={3} />}
    </Animated.View>
  );
}

function OptionBurstRays() {
  return (
    <View style={styles.optionBurstRays} pointerEvents="none">
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 14L2 11M10 10L8 5M15 11L16 6"
          stroke="#10B981"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

function Chip({ label, selected, locked, state }: { label: string; selected?: boolean; locked?: boolean; state?: 'ok' | 'bad' }) {
  return (
    <View style={[
      styles.chip,
      selected && styles.chipSelected,
      locked && styles.chipLocked,
      state === 'ok' && styles.chipOk,
      state === 'bad' && styles.chipBad,
    ]}
    >
      {locked ? <Lock size={13} color="#F59E0B" /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </View>
  );
}

// ── Trắc nghiệm ──────────────────────────────────────────────────────────────
export function McqQuestion({ question, reveal, result, chosen, onSubmit, play }: {
  question: DpQuestion;
  reveal: DpReveal | null;
  result: DpAnswerResult | null;
  chosen: number | null;
  onSubmit: (answer: DpAnswer) => void;
  play: (sound: GameSound) => void;
}) {
  const { width } = useWindowDimensions();
  const allShort = useMemo(
    () => (question.options || []).every((opt) => String(opt || '').length <= 28),
    [question.options],
  );
  const twoColumns = width >= 500 || (width >= 340 && allShort);
  const eliminated = new Set(reveal?.eliminate || []);
  const selectedScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!result) return;
    selectedScale.setValue(0.98);
    Animated.timing(selectedScale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [result, selectedScale]);

  return (
    <View style={[styles.gap, twoColumns && styles.mcqGrid]}>
      {(question.options || []).map((option, index) => {
        const isCorrect = Boolean(result) && (
          result?.correctAnswer?.correctIndex === index
          || (result?.correct && chosen === index)
        );
        const isWrong = Boolean(result) && chosen === index && !isCorrect;
        const isChosen = chosen === index;
        const out = eliminated.has(index);
        return (
          <Animated.View
            key={`${index}-${option}`}
            style={[
              twoColumns ? styles.optionHalf : { width: '100%' },
              (isCorrect || isWrong) && { transform: [{ scale: selectedScale }] },
            ]}
          >
            <Pressable
              disabled={Boolean(result) || out}
              onPress={() => { play('tap'); onSubmit({ index }); }}
              style={({ pressed }) => [
                styles.option,
                isChosen && !result && styles.optionSelected,
                isCorrect && styles.optionCorrect,
                isWrong && styles.optionWrong,
                out && styles.optionOut,
                pressed && !result && !out && styles.optionPressed,
              ]}
              accessibilityRole="button"
            >
              {isCorrect ? <OptionBurstRays /> : null}
              <View style={[
                styles.letter,
                isChosen && !result && { backgroundColor: '#DCFCE7', borderColor: '#34D399' },
                isCorrect && { backgroundColor: '#10B981', borderColor: '#059669' },
                isWrong && { backgroundColor: '#EF4444', borderColor: '#DC2626' },
              ]}>
                <Text style={[
                  styles.letterText,
                  isChosen && !result && { color: '#047857' },
                  (isCorrect || isWrong) && { color: '#FFFFFF' },
                ]}>{String.fromCharCode(65 + index)}</Text>
              </View>
              <Text style={[
                styles.optionText,
                twoColumns && width < 500 && { fontSize: 13.5, lineHeight: 19 },
                isChosen && !result && { color: '#065F46', fontWeight: '700' },
                isCorrect && { color: '#064E3B', fontWeight: '800' },
                isWrong && { color: '#991B1B', fontWeight: '800' },
                out && styles.optionTextOut,
              ]}>{option}</Text>
              {isCorrect ? <Mark ok /> : isWrong ? <Mark ok={false} /> : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Đúng / Sai ───────────────────────────────────────────────────────────────
export function TrueFalseQuestion({ result, chosen, onSubmit, play }: {
  result: DpAnswerResult | null;
  chosen: boolean | null;
  onSubmit: (answer: DpAnswer) => void;
  play: (sound: GameSound) => void;
}) {
  return (
    <View style={styles.row}>
      {[true, false].map((value) => {
        const isCorrect = Boolean(result) && result?.correctAnswer.answerBool === value;
        const isWrong = Boolean(result) && chosen === value && !isCorrect;
        return (
          <Pressable
            key={String(value)}
            disabled={Boolean(result)}
            onPress={() => { play('tap'); onSubmit({ value }); }}
            style={({ pressed }) => [
              styles.tf,
              isCorrect && styles.chipOk,
              isWrong && styles.chipBad,
              pressed && !result && styles.optionPressed,
            ]}
            accessibilityRole="button"
          >
            <View style={[styles.tfIcon, { backgroundColor: value ? '#10B981' : '#EF4444' }]}>
              {value ? <Check size={26} color="#FFFFFF" strokeWidth={3} /> : <X size={26} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.tfText}>{value ? 'Đúng' : 'Sai'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Sắp xếp ──────────────────────────────────────────────────────────────────
export function OrderQuestion({ question, reveal, result, play, onChange }: QuestionProps) {
  const [list, setList] = useState<string[]>(() => question.items || []);
  const [selected, setSelected] = useState<string | null>(null);
  const lockedItem = reveal?.first || null;
  const locked = Boolean(result);

  useEffect(() => {
    if (lockedItem) setList((prev) => [lockedItem, ...prev.filter((item) => item !== lockedItem)]);
  }, [lockedItem]);
  useEffect(() => { onChange({ items: list }); }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  const swap = (a: number, b: number) => {
    if (a === b || a < 0 || b < 0) return;
    setList((prev) => {
      if (lockedItem && (prev[a] === lockedItem || prev[b] === lockedItem)) return prev;
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  return (
    <View style={styles.gap}>
      {list.map((item, index) => {
        const isLocked = item === lockedItem;
        const ok = locked && result?.correctAnswer.items?.[index] === item;
        return (
          <DropZone
            key={item}
            id={`order-${index}`}
            disabled={locked}
            onPress={selected && selected !== item ? () => { swap(list.indexOf(selected), index); play('drop'); setSelected(null); } : undefined}
            style={styles.orderRow}
          >
            <View style={styles.orderNum}><Text style={styles.orderNumText}>{index + 1}</Text></View>
            <Draggable
              id={item}
              disabled={locked || isLocked}
              onPick={() => play('pick')}
              onDrop={(id, zone) => { swap(list.indexOf(id), Number(zone.replace('order-', ''))); play('drop'); setSelected(null); }}
              onTap={(id) => {
                if (selected && selected !== id) { swap(list.indexOf(selected), list.indexOf(id)); play('drop'); setSelected(null); } else {
                  play('tap');
                  setSelected(selected === id ? null : id);
                }
              }}
              style={styles.flex}
            >
              <View style={[styles.chip, styles.orderChip, selected === item && styles.chipSelected, isLocked && styles.chipLocked, locked && (ok ? styles.chipOk : styles.chipBad)]}>
                {isLocked ? <Lock size={14} color="#F59E0B" /> : <GripVertical size={16} color="#CBD5E1" />}
                <Text style={[styles.chipText, styles.flex]}>{item}</Text>
                {locked ? <Mark ok={ok} /> : null}
              </View>
            </Draggable>
          </DropZone>
        );
      })}
    </View>
  );
}

// ── Ghép cặp ─────────────────────────────────────────────────────────────────
export function MatchQuestion({ question, reveal, result, play, onChange }: QuestionProps) {
  const lefts = question.lefts || [];
  const [assign, setAssign] = useState<Array<string | null>>(() => lefts.map(() => null));
  const [selected, setSelected] = useState<string | null>(null);
  const locked = Boolean(result);
  const lockedIndex = reveal?.pair ? lefts.indexOf(reveal.pair.left) : -1;

  useEffect(() => {
    if (lockedIndex < 0 || !reveal?.pair) return;
    const right = reveal.pair.right;
    setAssign((prev) => prev.map((value, index) => (index === lockedIndex ? right : value === right ? null : value)));
  }, [lockedIndex, reveal?.pair]);
  useEffect(() => {
    onChange(assign.every(Boolean) ? { pairs: lefts.map((left, index) => ({ left, right: assign[index] as string })) } : null);
  }, [assign]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (right: string, slot: number) => {
    if (slot === lockedIndex) return;
    setAssign((prev) => prev.map((value, index) => (index === slot ? right : value === right ? null : value)));
  };
  const correct = new Map((result?.correctAnswer.pairs || []).map((pair) => [pair.left, pair.right]));
  const bank = (question.rights || []).filter((right) => !assign.includes(right));

  return (
    <View style={styles.gapLg}>
      <View style={styles.gap}>
        {lefts.map((left, index) => {
          const value = assign[index];
          const ok = locked && correct.get(left) === value;
          return (
            <View key={left} style={styles.matchRow}>
              <View style={styles.matchLeft}><Text style={styles.matchLeftText}>{left}</Text></View>
              <View style={styles.flex}>
                <DropZone
                  id={`match-${index}`}
                  disabled={locked || index === lockedIndex}
                  onPress={() => {
                    if (selected) { place(selected, index); play('drop'); setSelected(null); } else if (value) {
                      play('tap');
                      setAssign((prev) => prev.map((v, i) => (i === index ? null : v)));
                    }
                  }}
                  style={[styles.slot, value ? styles.slotFilled : null, index === lockedIndex && styles.chipLocked, locked && (ok ? styles.chipOk : styles.chipBad)]}
                >
                  {index === lockedIndex ? <Lock size={13} color="#F59E0B" /> : null}
                  <Text style={[styles.slotText, value ? styles.slotTextFilled : null]}>{value || 'Thả thẻ vào đây'}</Text>
                  {locked ? <Mark ok={ok} /> : null}
                </DropZone>
              </View>
            </View>
          );
        })}
      </View>
      {!locked ? (
        <View style={styles.bank}>
          {bank.length ? bank.map((right) => (
            <Draggable
              key={right}
              id={right}
              onPick={() => play('pick')}
              onDrop={(id, zone) => { place(id, Number(zone.replace('match-', ''))); play('drop'); setSelected(null); }}
              onTap={(id) => { play('tap'); setSelected(selected === id ? null : id); }}
            >
              <Chip label={right} selected={selected === right} />
            </Draggable>
          )) : <Text style={styles.bankDone}>Đã ghép hết - bấm Kiểm tra nhé!</Text>}
        </View>
      ) : null}
    </View>
  );
}

// ── Điền vào chỗ trống ───────────────────────────────────────────────────────
export function FillQuestion({ question, reveal, result, play, onChange }: QuestionProps) {
  const segments = question.segments || [];
  const bankWords = question.bank || [];
  const blankCount = segments.filter((s) => s.blank !== undefined).length;
  const [blanks, setBlanks] = useState<Array<number | null>>(() => Array(blankCount).fill(null));
  const [selected, setSelected] = useState<number | null>(null);
  const locked = Boolean(result);
  const lockedBlank = reveal?.blank || null;

  useEffect(() => {
    if (!lockedBlank) return;
    const chip = bankWords.findIndex((word) => word === lockedBlank.word);
    if (chip < 0) return;
    setBlanks((prev) => prev.map((value, index) => (index === lockedBlank.index ? chip : value === chip ? null : value)));
  }, [lockedBlank?.index, lockedBlank?.word]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onChange(blanks.every((b) => b !== null) ? { blanks: blanks.map((i) => bankWords[i as number]) } : null);
  }, [blanks]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (chip: number, slot: number) => {
    if (lockedBlank && slot === lockedBlank.index) return;
    setBlanks((prev) => prev.map((value, index) => (index === slot ? chip : value === chip ? null : value)));
  };
  const answers = result?.correctAnswer.answers || [];

  return (
    <View style={styles.gapLg}>
      <View style={styles.fillText}>
        {segments.map((segment, index) => {
          if (segment.blank === undefined) {
            return segment.text?.split(/(\s+)/).filter(Boolean).map((word, wi) => (
              <Text key={`${index}-${wi}`} style={styles.fillWord}>{word}</Text>
            ));
          }
          const slot = segment.blank;
          const chip = blanks[slot];
          const word = chip === null ? '' : bankWords[chip];
          const isLocked = lockedBlank?.index === slot;
          const ok = locked && norm(answers[slot] || '') === norm(word);
          return (
            <DropZone
              key={index}
              id={`fill-${slot}`}
              disabled={locked || isLocked}
              onPress={() => {
                if (selected !== null) { place(selected, slot); play('drop'); setSelected(null); } else if (chip !== null) {
                  play('tap');
                  setBlanks((prev) => prev.map((v, i) => (i === slot ? null : v)));
                }
              }}
              style={[styles.blank, chip !== null && styles.slotFilled, isLocked && styles.chipLocked, locked && (ok ? styles.chipOk : styles.chipBad)]}
            >
              <Text style={styles.blankText}>{word || ' '}</Text>
              {locked && !ok ? <Text style={styles.blankFix}>{`(${answers[slot]})`}</Text> : null}
            </DropZone>
          );
        })}
      </View>
      {!locked ? (
        <View style={styles.bank}>
          {bankWords.map((word, index) => (blanks.includes(index) ? null : (
            <Draggable
              key={`${word}-${index}`}
              id={String(index)}
              onPick={() => play('pick')}
              onDrop={(id, zone) => { place(Number(id), Number(zone.replace('fill-', ''))); play('drop'); setSelected(null); }}
              onTap={(id) => { play('tap'); setSelected(selected === Number(id) ? null : Number(id)); }}
            >
              <Chip label={word} selected={selected === index} />
            </Draggable>
          )))}
        </View>
      ) : null}
    </View>
  );
}

// ── Phân loại ────────────────────────────────────────────────────────────────
const BIN_TONES = ['#0EA5E9', '#A855F7', '#F97316', '#10B981'];

export function SortQuestion({ question, reveal, result, play, onChange }: QuestionProps) {
  const groups = question.groups || [];
  const items = question.items || [];
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const locked = Boolean(result);
  const lockedItem = reveal?.item || null;

  useEffect(() => {
    if (lockedItem) setPlaced((prev) => ({ ...prev, [lockedItem.name]: lockedItem.group }));
  }, [lockedItem?.name, lockedItem?.group]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onChange(items.every((item) => placed[item]) ? { placements: placed } : null);
  }, [placed]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (item: string, group: string) => {
    if (lockedItem?.name === item) return;
    setPlaced((prev) => ({ ...prev, [item]: group }));
  };
  const expected = useMemo(() => {
    const map = new Map<string, string>();
    (result?.correctAnswer.groups || []).forEach((group) => group.items.forEach((item) => map.set(item, group.name)));
    return map;
  }, [result]);
  const bank = items.filter((item) => !placed[item]);

  return (
    <View style={styles.gapLg}>
      <View style={styles.bins}>
        {groups.map((group, groupIndex) => {
          const tone = BIN_TONES[groupIndex % BIN_TONES.length];
          return (
            <View key={group} style={styles.binWrap}>
              <DropZone
                id={`sort-${groupIndex}`}
                disabled={locked}
                onPress={selected ? () => { place(selected, group); play('drop'); setSelected(null); } : undefined}
                style={[styles.bin, { borderColor: `${tone}88` }]}
              >
                <Text style={[styles.binTitle, { backgroundColor: tone }]}>{group}</Text>
                <View style={styles.binItems}>
                  {items.filter((item) => placed[item] === group).map((item) => {
                    const isLocked = lockedItem?.name === item;
                    const ok = locked && expected.get(item) === group;
                    return (
                      <Pressable
                        key={item}
                        disabled={locked || isLocked}
                        onPress={() => {
                          play('tap');
                          setPlaced((prev) => {
                            const next = { ...prev };
                            delete next[item];
                            return next;
                          });
                        }}
                      >
                        <Chip label={item} locked={isLocked} state={locked ? (ok ? 'ok' : 'bad') : undefined} />
                      </Pressable>
                    );
                  })}
                </View>
              </DropZone>
            </View>
          );
        })}
      </View>
      {!locked ? (
        <View style={styles.bank}>
          {bank.length ? bank.map((item) => (
            <Draggable
              key={item}
              id={item}
              onPick={() => play('pick')}
              onDrop={(id, zone) => { place(id, groups[Number(zone.replace('sort-', ''))]); play('drop'); setSelected(null); }}
              onTap={(id) => { play('tap'); setSelected(selected === id ? null : id); }}
            >
              <Chip label={item} selected={selected === item} />
            </Draggable>
          )) : <Text style={styles.bankDone}>Đã phân loại hết - bấm Kiểm tra nhé!</Text>}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { gap: 8 },
  gapLg: { gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  chipSelected: { borderColor: '#38BDF8', backgroundColor: '#F0F9FF' },
  chipLocked: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  chipOk: { borderColor: '#34D399', backgroundColor: '#ECFDF5' },
  chipBad: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  chipText: { color: '#1E293B', fontSize: 14, fontWeight: '800' },
  chipTextSelected: { color: '#075985' },
  mcqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16, borderWidth: 1.5,
    borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', minHeight: 58, borderBottomWidth: 3, borderBottomColor: '#CBD5E1',
  },
  optionPressed: { opacity: 0.92, transform: [{ translateY: 1 }] },
  optionSelected: { borderColor: '#34D399', backgroundColor: '#ECFDF5', borderBottomColor: '#10B981' },
  optionCorrect: { borderColor: '#10B981', backgroundColor: '#ECFDF5', borderBottomColor: '#34D399' },
  optionWrong: { borderColor: '#F87171', backgroundColor: '#FEF2F2', borderBottomColor: '#FCA5A5' },
  optionBurstRays: { position: 'absolute', left: -8, top: -10, zIndex: 5 },
  optionHalf: { width: '48.2%', flexGrow: 1 },
  optionOut: { opacity: 0.45, backgroundColor: '#F8FAFC' },
  optionText: { flex: 1, color: '#1E293B', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  optionTextOut: { textDecorationLine: 'line-through', color: '#94A3B8' },
  letter: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#CBD5E1' },
  letterText: { color: '#475569', fontSize: 14, fontWeight: '900' },
  tf: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 20, borderRadius: 18, borderWidth: 1.5,
    borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  tfIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3 },
  tfText: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNum: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', borderWidth: 1.5, borderColor: '#059669' },
  orderNumText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  orderChip: { flex: 1 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchLeft: { width: '40%', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: '#0284C7', borderWidth: 1.5, borderColor: '#0369A1' },
  matchLeftText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  slot: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, paddingHorizontal: 12, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC',
  },
  slotFilled: { borderStyle: 'solid', borderColor: '#38BDF8', backgroundColor: '#F0F9FF' },
  slotText: { flex: 1, color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  slotTextFilled: { color: '#075985', fontWeight: '900' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 54, padding: 12, borderRadius: 18, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  bankDone: { color: '#94A3B8', fontSize: 13, fontWeight: '700', padding: 6 },
  fillText: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 10, padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0' },
  fillWord: { color: '#1E293B', fontSize: 16, fontWeight: '600' },
  blank: {
    minWidth: 76, minHeight: 34, marginHorizontal: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 2,
    borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
  },
  blankText: { color: '#075985', fontSize: 15, fontWeight: '900' },
  blankFix: { color: '#059669', fontSize: 12, fontWeight: '800' },
  bins: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  binWrap: { flexGrow: 1, flexBasis: '45%' },
  bin: { minHeight: 120, padding: 10, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  binTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center', paddingVertical: 4, borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  binItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
