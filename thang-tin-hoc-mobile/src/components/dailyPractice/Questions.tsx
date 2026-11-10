import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Check, GripVertical, Lock, X } from 'lucide-react-native';
import type { DpAnswer, DpAnswerResult, DpQuestion, DpReveal } from '../../services/dailyPracticeApi';
import { Draggable, DropZone } from './DragKit';
import type { GameSound } from './useGameSounds';

export type QuestionProps = {
  question: DpQuestion;
  reveal: DpReveal | null;
  result: DpAnswerResult | null;
  play: (sound: GameSound) => void;
  onChange: (answer: DpAnswer | null) => void;
};

const norm = (value: string) => value.trim().toLowerCase();

function Mark({ ok }: { ok: boolean }) {
  return (
    <View style={{
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: ok ? '#10B981' : '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {ok ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : <X size={15} color="#FFFFFF" strokeWidth={3} />}
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
  const twoColumns = width >= 500;
  const eliminated = new Set(reveal?.eliminate || []);
  return (
    <View style={[styles.gap, twoColumns && styles.mcqGrid]}>
      {(question.options || []).map((option, index) => {
        const isCorrect = Boolean(result) && result?.correctAnswer.correctIndex === index;
        const isWrong = Boolean(result) && chosen === index && !isCorrect;
        const isChosen = chosen === index;
        const out = eliminated.has(index);
        return (
          <Pressable
            key={option}
            disabled={Boolean(result) || out}
            onPress={() => { play('tap'); onSubmit({ index }); }}
            style={({ pressed }) => [
              styles.option,
              twoColumns && styles.optionHalf,
              isChosen && !result && styles.optionSelected,
              isCorrect && styles.chipOk,
              isWrong && styles.chipBad,
              out && styles.optionOut,
              pressed && !result && !out && styles.optionPressed,
            ]}
            accessibilityRole="button"
          >
            <View style={[
              styles.letter,
              isChosen && !result && { backgroundColor: '#E0F2FE', borderColor: '#38BDF8' },
              isCorrect && { backgroundColor: '#10B981', borderColor: '#047857' },
              isWrong && { backgroundColor: '#EF4444', borderColor: '#B91C1C' },
            ]}>
              <Text style={[
                styles.letterText,
                isChosen && !result && { color: '#0369A1' },
                (isCorrect || isWrong) && { color: '#FFFFFF' },
              ]}>{String.fromCharCode(65 + index)}</Text>
            </View>
            <Text style={[
              styles.optionText,
              isChosen && !result && { color: '#0369A1', fontWeight: '700' },
              isCorrect && { color: '#065F46', fontWeight: '700' },
              isWrong && { color: '#991B1B', fontWeight: '700' },
              out && styles.optionTextOut,
            ]}>{option}</Text>
            {isCorrect ? <Mark ok /> : isWrong ? <Mark ok={false} /> : null}
          </Pressable>
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
            style={[styles.tf, isCorrect && styles.chipOk, isWrong && styles.chipBad]}
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
    borderWidth: 2, borderColor: '#E2E8F0', borderBottomWidth: 4, borderBottomColor: '#CBD5E1', backgroundColor: '#FFFFFF',
  },
  chipSelected: { borderColor: '#38BDF8', borderBottomColor: '#0284C7', backgroundColor: '#F0F9FF' },
  chipLocked: { borderColor: '#FCD34D', borderBottomColor: '#D97706', backgroundColor: '#FFFBEB' },
  chipOk: { borderColor: '#34D399', borderBottomColor: '#059669', backgroundColor: '#ECFDF5' },
  chipBad: { borderColor: '#FCA5A5', borderBottomColor: '#DC2626', backgroundColor: '#FEF2F2' },
  chipText: { color: '#1E293B', fontSize: 14, fontWeight: '800' },
  chipTextSelected: { color: '#075985' },
  mcqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 2,
    borderColor: '#E2E8F0', borderBottomWidth: 4, borderBottomColor: '#CBD5E1', backgroundColor: '#FFFFFF', minHeight: 56,
  },
  optionPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  optionSelected: {
    borderColor: '#0284C7',
    borderBottomColor: '#0369A1',
    backgroundColor: '#F0F9FF',
  },
  optionHalf: { width: '48%', flexGrow: 1 },
  optionOut: { opacity: 0.45, backgroundColor: '#F8FAFC' },
  optionText: { flex: 1, color: '#1E293B', fontSize: 15, fontWeight: '700', lineHeight: 22 },
  optionTextOut: { textDecorationLine: 'line-through', color: '#94A3B8' },
  letter: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1' },
  letterText: { color: '#475569', fontSize: 14, fontWeight: '900' },
  tf: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 20, borderRadius: 18, borderWidth: 2,
    borderColor: '#E2E8F0', borderBottomWidth: 4, borderBottomColor: '#CBD5E1', backgroundColor: '#FFFFFF',
  },
  tfIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tfText: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  orderNumText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  orderChip: { flex: 1 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchLeft: { width: '40%', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: '#0F172A' },
  matchLeftText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  slot: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10, borderRadius: 12,
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC',
  },
  slotFilled: { borderStyle: 'solid', borderColor: '#7DD3FC', backgroundColor: '#F0F9FF' },
  slotText: { flex: 1, color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  slotTextFilled: { color: '#075985', fontWeight: '900' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 54, padding: 10, borderRadius: 16, backgroundColor: '#F1F5F9' },
  bankDone: { color: '#94A3B8', fontSize: 13, fontWeight: '700', padding: 6 },
  fillText: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 10, padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  fillWord: { color: '#1E293B', fontSize: 16, fontWeight: '600' },
  blank: {
    minWidth: 76, minHeight: 34, marginHorizontal: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 2,
    borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
  },
  blankText: { color: '#075985', fontSize: 15, fontWeight: '900' },
  blankFix: { color: '#059669', fontSize: 12, fontWeight: '800' },
  bins: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  binWrap: { flexGrow: 1, flexBasis: '45%' },
  bin: { minHeight: 120, padding: 8, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  binTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center', paddingVertical: 4, borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  binItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
