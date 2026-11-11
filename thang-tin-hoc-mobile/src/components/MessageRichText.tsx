import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';

export interface MessageRichTextProps {
  text: string;
  mine?: boolean;
  highlight?: string;
}

/** Deep-link token embedded in chat text: ⟦chat:student:ID|Display Name⟧ */
const EMBED_RE = /⟦chat:(student|teacher|admin|staff):([^|⟧]+)\|([^⟧]+)⟧|⟦go:(\/[^|⟧]+)\|([^⟧]+)⟧|⟦student_detail:([^|⟧:]+)(?::([^|⟧:]+))?(?::([^|⟧]+))?\|([^⟧]+)⟧/g;
const URL_RE = /(https?:\/\/[^\s<]+[^.,;:!?\s<])/gi;
const MARK_RE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

/** Function badge color classification matching web app */
export function getFnStyle(name: string) {
  const u = String(name || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (u.startsWith('SUM')) {
    return {
      bg: '#D1FAE5', // emerald-100
      text: '#065F46', // emerald-800
      border: '#A7F3D0',
    };
  }
  if (u.includes('LOOKUP')) {
    return {
      bg: '#EDE9FE', // violet-100
      text: '#5B21B6', // violet-800
      border: '#DDD6FE',
    };
  }
  if (u === 'IF' || u.startsWith('IF') || u.includes('COUNTIF')) {
    return {
      bg: '#FEF3C7', // amber-100
      text: '#92400E', // amber-900
      border: '#FDE68A',
    };
  }
  // Formula ranges/literals like ">100", 10 + 20, A2:A5, etc.
  return {
    bg: '#E0F2FE', // sky-100
    text: '#0369A1', // sky-800
    border: '#BAE6FD',
  };
}

export function parseTableCells(line: string): string[] {
  let text = String(line || '').trim().replace(/^Dòng\s*\d+\s*:\s*/i, '');
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);
  return text.split('|').map((cell) => cell.trim());
}

export function isSeparatorRow(line: string): boolean {
  const cells = parseTableCells(line).filter(Boolean);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

export function isTableRow(line: string): boolean {
  const text = String(line || '').trim();
  if (!text) return false;
  if (isSeparatorRow(text)) return true;
  if (/^\|(.+)\|$/.test(text)) return (text.match(/\|/g) || []).length >= 2;
  const stripped = text.replace(/^Dòng\s*\d+\s*:\s*/i, '');
  return (stripped.match(/\|/g) || []).length >= 2;
}

export function excelColLabel(index: number): string {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

const STEP_ACTION_RE = /^(Vào|Vào menu|Mở|Chọn|Bấm|Nhấn|Click|Tạo|Điền|Gõ|Nhập|Lưu|Sắp xếp|Thiết lập|Kéo|Copy|Sao chép|Dán|Xóa|Chèn|Áp dụng|Kiểm tra|Viết|Bôi|Tô|Đặt|Gán|Format|Right-click|Chuột phải|Tab|Home|Insert|range|criteria|sum_range)/i;

export function emphasizeStepLine(line: string): string {
  const text = String(line || '');
  if (/^\s*\*\*Bước\s+\d+/i.test(text)) return text;
  if (/^\s*Bước\s+\d+\s*:/i.test(text)) {
    return text.replace(/^(\s*)(Bước\s+\d+\s*:)/i, '$1**$2**');
  }
  const match = text.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (match) {
    const rest = match[3].trim();
    if (STEP_ACTION_RE.test(rest) || /^[a-z_]+\s*:/i.test(rest)) {
      const colonIdx = rest.indexOf(':');
      if (colonIdx > 0 && colonIdx < 30) {
        return `${match[1]}**${match[2]}. ${rest.slice(0, colonIdx + 1)}**${rest.slice(colonIdx + 1)}`;
      }
      return `${match[1]}**Bước ${match[2]}:** ${match[3]}`;
    }
  }
  return text;
}

/** Check if a line is a standalone formula line (e.g. `=SUMIF(...)`) */
function isFormulaLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('=') && /^[=][A-Z0-9_.]+\(/i.test(trimmed);
}

/** Regex to match Excel function keywords, ranges, criteria even outside backticks */
const EXCEL_KEYWORD_RE = /\b(SUMIFS?|COUNTIFS?|AVERAGEIFS?|[VHX]LOOKUP|IFERROR)\b|(\b[A-Z]\d+:[A-Z]\d+\b)|("[><=][^"]*")|(\b\d+\s*[\+\-\*\/]\s*\d+\b)/g;

/** Render plain text chunk, optionally badging Excel tokens */
function renderPlainTextChunk(
  text: string,
  subKey: string,
  mine: boolean
): React.ReactNode[] {
  if (!text) return [];
  if (mine) {
    return [
      <Text key={subKey} style={styles.textMine}>
        {text}
      </Text>,
    ];
  }

  const nodes: React.ReactNode[] = [];
  const re = new RegExp(EXCEL_KEYWORD_RE.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Text key={`${subKey}-p-${lastIndex}`} style={styles.textOther}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }
    const token = match[0];
    const fnStyle = getFnStyle(token);
    nodes.push(
      <Text
        key={`${subKey}-kw-${match.index}`}
        style={[
          styles.inlineBadge,
          {
            backgroundColor: fnStyle.bg,
            color: fnStyle.text,
            borderColor: fnStyle.border,
          },
        ]}
      >
        {` ${token} `}
      </Text>
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Text key={`${subKey}-tail`} style={styles.textOther}>
        {text.slice(lastIndex)}
      </Text>
    );
  }
  return nodes;
}

/**
 * Render inline marks: backticks `CODE`, bold **BOLD**, italic *ITALIC*, URLs
 */
function renderInlineMarks(
  chunk: string,
  keyPrefix: string,
  mine: boolean,
  _highlight = ''
): React.ReactNode[] {
  if (!chunk) return [];
  const nodes: React.ReactNode[] = [];
  const urlRe = new RegExp(URL_RE.source, 'gi');
  let tLast = 0;
  let tMatch: RegExpExecArray | null;

  const parseMarksOnly = (textSegment: string, subKey: string) => {
    const subNodes: React.ReactNode[] = [];
    const markRe = new RegExp(MARK_RE.source, 'g');
    let mLast = 0;
    let mMatch: RegExpExecArray | null;

    while ((mMatch = markRe.exec(textSegment)) !== null) {
      if (mMatch.index > mLast) {
        const plain = textSegment.slice(mLast, mMatch.index);
        subNodes.push(...renderPlainTextChunk(plain, `${subKey}-plain-${mLast}`, mine));
      }
      const token = mMatch[0];
      const k = `${subKey}-m-${mMatch.index}`;

      if (token.startsWith('`') && token.endsWith('`')) {
        const inner = token.slice(1, -1);
        const fnStyle = getFnStyle(inner);
        subNodes.push(
          <Text
            key={k}
            style={[
              styles.inlineBadge,
              {
                backgroundColor: fnStyle.bg,
                color: fnStyle.text,
                borderColor: fnStyle.border,
              },
            ]}
          >
            {` ${inner} `}
          </Text>
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        const inner = token.slice(2, -2);
        subNodes.push(
          <Text key={k} style={mine ? styles.boldMine : styles.boldOther}>
            {inner}
          </Text>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        const inner = token.slice(1, -1);
        subNodes.push(
          <Text key={k} style={mine ? styles.italicMine : styles.italicOther}>
            {inner}
          </Text>
        );
      } else {
        subNodes.push(...renderPlainTextChunk(token, k, mine));
      }
      mLast = mMatch.index + token.length;
    }

    if (mLast < textSegment.length) {
      const tail = textSegment.slice(mLast);
      subNodes.push(...renderPlainTextChunk(tail, `${subKey}-tail`, mine));
    }
    return subNodes;
  };

  while ((tMatch = urlRe.exec(chunk)) !== null) {
    if (tMatch.index > tLast) {
      nodes.push(...parseMarksOnly(chunk.slice(tLast, tMatch.index), `${keyPrefix}-${tLast}`));
    }
    const url = tMatch[0];
    nodes.push(
      <Text
        key={`${keyPrefix}-url-${tMatch.index}`}
        onPress={() => { void Linking.openURL(url); }}
        style={mine ? styles.linkMine : styles.linkOther}
      >
        {url}
      </Text>
    );
    tLast = tMatch.index + url.length;
  }

  if (tLast < chunk.length) {
    nodes.push(...parseMarksOnly(chunk.slice(tLast), `${keyPrefix}-tail`));
  }
  return nodes;
}

/** Render Excel Grid Table */
function renderExcelTable(rawRows: string[], key: string, mine: boolean) {
  const rows: string[][] = [];
  rawRows.forEach((line) => {
    if (isSeparatorRow(line)) return;
    rows.push(parseTableCells(line));
  });
  if (rows.length < 2) return null;

  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const pad = (row: string[]) => {
    const next = [...row];
    while (next.length < colCount) next.push('');
    return next.slice(0, colCount);
  };

  return (
    <View key={key} style={[styles.tableWrapper, mine && styles.tableWrapperMine]}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tableScrollContent}
      >
        <View style={styles.tableGrid}>
          {/* Header row: Blank corner cell + Excel Col Letters A, B, C... */}
          <View style={styles.tableRow}>
            <View style={[styles.gutterCell, styles.cornerCell, mine && styles.gutterCellMine]}>
              <Text style={styles.gutterText}>{''}</Text>
            </View>
            {Array.from({ length: colCount }, (_, i) => (
              <View
                key={`${key}-col-${i}`}
                style={[styles.gutterCell, styles.colHeaderCell, mine && styles.gutterCellMine]}
              >
                <Text style={[styles.colHeaderText, mine && styles.colHeaderTextMine]}>
                  {excelColLabel(i)}
                </Text>
              </View>
            ))}
          </View>

          {/* Data rows: Row Number Gutter + Data Cells */}
          {rows.map((row, ri) => {
            const isTitleRow = ri === 0;
            return (
              <View
                key={`${key}-r-${ri}`}
                style={[
                  styles.tableRow,
                  isTitleRow && (mine ? styles.tableTitleRowMine : styles.tableTitleRow),
                ]}
              >
                {/* Left Gutter: Row number 1, 2, 3... */}
                <View
                  style={[styles.gutterCell, styles.rowNumCell, mine && styles.gutterCellMine]}
                >
                  <Text style={[styles.gutterText, mine && styles.gutterTextMine]}>{ri + 1}</Text>
                </View>

                {/* Table Cells */}
                {pad(row).map((cellText, ci) => (
                  <View
                    key={`${key}-r-${ri}-c-${ci}`}
                    style={[
                      styles.dataCell,
                      isTitleRow && (mine ? styles.dataTitleCellMine : styles.dataTitleCell),
                    ]}
                  >
                    <Text style={isTitleRow ? styles.dataTitleText : styles.dataCellText}>
                      {renderInlineMarks(cellText, `${key}-r-${ri}-c-${ci}`, mine)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export const MessageRichText: React.FC<MessageRichTextProps> = ({
  text,
  mine = false,
  highlight = '',
}) => {
  const raw = String(text || '');

  // Strip embed tokens like ⟦chat:...⟧, ⟦go:...⟧, ⟦student_detail:...⟧ to clean label
  const cleanedText = useMemo(() => {
    return raw
      .replace(EMBED_RE, (_match, _p1, _p2, p3, _p4, p5, _p6, _p7, _p8, p9) => {
        return p3 || p5 || p9 || '';
      })
      .trim();
  }, [raw]);

  const blocks = useMemo(() => {
    if (!cleanedText) return [];
    const lines = cleanedText.replace(/\r\n/g, '\n').split('\n');
    const out: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      // 1. Check if start of table
      if (isTableRow(lines[i])) {
        const start = i;
        const tableLines: string[] = [];
        while (i < lines.length && isTableRow(lines[i])) {
          tableLines.push(lines[i]);
          i += 1;
        }
        const dataRows = tableLines.filter((r) => !isSeparatorRow(r));
        if (dataRows.length >= 2) {
          const tblNode = renderExcelTable(tableLines, `tbl-${start}`, mine);
          if (tblNode) {
            out.push(tblNode);
            continue;
          }
        }
        // If not a valid table, render as normal lines
        tableLines.forEach((tLine, li) => {
          const emphasized = emphasizeStepLine(tLine);
          out.push(
            <Text key={`line-${start}-${li}`} style={styles.paragraphLine}>
              {renderInlineMarks(emphasized, `m-${start}-${li}`, mine, highlight)}
            </Text>
          );
        });
        continue;
      }

      // 2. Check if standalone formula line (e.g. `=SUMIF(...)`)
      const curLine = lines[i];
      if (isFormulaLine(curLine)) {
        out.push(
          <View
            key={`formula-${i}`}
            style={[styles.formulaBox, mine && styles.formulaBoxMine]}
          >
            <Text
              selectable
              style={[styles.formulaText, mine && styles.formulaTextMine]}
            >
              {curLine.trim()}
            </Text>
          </View>
        );
        i += 1;
        continue;
      }

      // 3. Regular text line
      const emphasized = emphasizeStepLine(curLine);
      if (curLine.trim() === '') {
        // Blank line spacer
        out.push(<View key={`spacer-${i}`} style={styles.lineSpacer} />);
      } else {
        out.push(
          <Text key={`line-${i}`} style={styles.paragraphLine}>
            {renderInlineMarks(emphasized, `m-${i}`, mine, highlight)}
          </Text>
        );
      }
      i += 1;
    }

    return out;
  }, [cleanedText, mine, highlight]);

  if (!cleanedText) return null;

  return <View style={styles.container}>{blocks}</View>;
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  paragraphLine: {
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 1.5,
  },
  lineSpacer: {
    height: 6,
  },
  textOther: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 20,
  },
  textMine: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 20,
  },
  boldOther: {
    fontWeight: '800',
    color: '#0F172A',
  },
  boldMine: {
    fontWeight: '800',
    color: '#0F172A',
  },
  italicOther: {
    fontStyle: 'italic',
    color: '#475569',
  },
  italicMine: {
    fontStyle: 'italic',
    color: '#475569',
  },
  linkOther: {
    color: '#2563EB',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  linkMine: {
    color: '#2563EB',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  inlineBadge: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    fontSize: 12,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  formulaBox: {
    marginVertical: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignSelf: 'stretch',
  },
  formulaBoxMine: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  formulaText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    lineHeight: 18,
  },
  formulaTextMine: {
    color: '#166534',
  },
  tableWrapper: {
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  tableWrapperMine: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  tableScrollContent: {
    padding: 0,
  },
  tableGrid: {
    flexDirection: 'column',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tableTitleRow: {
    backgroundColor: '#F8FAFC',
  },
  tableTitleRowMine: {
    backgroundColor: '#F8FAFC',
  },
  gutterCell: {
    backgroundColor: '#E9EDF2',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  gutterCellMine: {
    backgroundColor: '#E9EDF2',
    borderColor: '#CBD5E1',
  },
  cornerCell: {
    width: 32,
    minWidth: 32,
  },
  rowNumCell: {
    width: 32,
    minWidth: 32,
  },
  colHeaderCell: {
    minWidth: 78,
    paddingHorizontal: 8,
  },
  colHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  colHeaderTextMine: {
    color: '#475569',
  },
  gutterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  gutterTextMine: {
    color: '#64748B',
  },
  dataCell: {
    minWidth: 78,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dataTitleCell: {
    backgroundColor: '#F1F5F9',
  },
  dataTitleCellMine: {
    backgroundColor: '#F1F5F9',
  },
  dataCellText: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 17,
  },
  dataTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 17,
  },
});
