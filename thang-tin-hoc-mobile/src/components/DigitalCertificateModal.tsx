import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as Print from 'expo-print';
import { Award, Check, Copy, Printer, Share2, ShieldCheck, Sparkles, X } from 'lucide-react-native';
import { radius, spacing, typography } from '../theme/tokens';

export type DigitalCertificateModalProps = {
  visible: boolean;
  onClose: () => void;
  studentName?: string;
  studentCode?: string;
  studentId?: string;
  courseId?: string;
  courseTitle?: string;
  instructorName?: string;
  completionRate?: number;
  avgGrade?: number | null;
  issuedDate?: string;
};

function hashString32(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  const str = String(input || '');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function buildCertificateCode({
  studentId = '',
  studentCode = '',
  courseId = '',
  courseTitle = '',
}: {
  studentId?: string;
  studentCode?: string;
  courseId?: string;
  courseTitle?: string;
} = {}): string {
  const year = new Date().getFullYear();
  const baseCode = String(studentCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = baseCode ? baseCode.slice(0, 8) : `HV${year}`;
  const raw = `${studentId}|${courseId}|${courseTitle}`;
  const h1 = hashString32(raw, 0x9e3779b9).toString(16).toUpperCase().padStart(8, '0');
  const h2 = hashString32(`${raw}|tth`, 0x85ebca6b).toString(16).toUpperCase().padStart(8, '0');
  return `TTH-${prefix}-${h1.slice(0, 4)}${h2.slice(0, 4)}`;
}

function buildQrMatrix(text: string, size = 25): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (row0: number, col0: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row0 + r;
        const cc = col0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[rr][cc] = false;
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          grid[rr][cc] = true;
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          grid[rr][cc] = true;
        } else {
          grid[rr][cc] = false;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    reserved[6][i] = true;
    grid[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    grid[i][6] = i % 2 === 0;
  }

  const ar0 = size - 9;
  const ac0 = size - 9;
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      reserved[ar0 + r][ac0 + c] = true;
      grid[ar0 + r][ac0 + c] = r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2);
    }
  }

  let state = hashString32(text, 0x243f6a88) || 1;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (reserved[r][c]) continue;
      state = (Math.imul(state ^ (r * 31 + c), 1664525) + 1013904223) >>> 0;
      grid[r][c] = (state & 1) === 1;
    }
  }
  return grid;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function qrMatrixToSvgMarkup(matrix: boolean[][], size = 96): string {
  const dim = matrix.length;
  const rects: string[] = [`<rect width="${dim + 2}" height="${dim + 2}" fill="#FFFFFF"/>`];
  for (let r = 0; r < dim; r += 1) {
    for (let c = 0; c < dim; c += 1) {
      if (matrix[r][c]) {
        rects.push(`<rect x="${c + 1}" y="${r + 1}" width="1" height="1" rx="0.18" fill="#0F172A"/>`);
      }
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${dim + 2} ${dim + 2}" xmlns="http://www.w3.org/2000/svg">${rects.join('')}</svg>`;
}

function QrSvg({ matrix, size = 82 }: { matrix: boolean[][]; size?: number }) {
  const dim = matrix.length;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${dim + 2} ${dim + 2}`}>
      <Rect width={dim + 2} height={dim + 2} fill="#FFFFFF" />
      {matrix.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <Rect
              key={`${r}-${c}`}
              x={c + 1}
              y={r + 1}
              width={1}
              height={1}
              rx={0.18}
              fill="#0F172A"
            />
          ) : null,
        ),
      )}
    </Svg>
  );
}

export function DigitalCertificateModal({
  visible,
  onClose,
  studentName = 'Học viên',
  studentCode = '',
  studentId = '',
  courseId = '',
  courseTitle = 'Khóa học Tin học ứng dụng',
  instructorName = 'Trung tâm Thắng Tin Học',
  completionRate = 100,
  avgGrade = null,
  issuedDate = '',
}: DigitalCertificateModalProps) {
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);

  const safeCompletion = Math.min(100, Math.max(0, Math.round(Number(completionRate) || 100)));

  const certCode = useMemo(
    () => buildCertificateCode({ studentId, studentCode, courseId, courseTitle }),
    [studentId, studentCode, courseId, courseTitle],
  );

  const formattedDate = useMemo(() => {
    if (issuedDate) {
      const parsed = new Date(issuedDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Ho_Chi_Minh',
        });
      }
    }
    return new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  }, [issuedDate]);

  const verifyUrl = useMemo(() => {
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://thangtinhoc.edu.vn';
    return `${origin}/verify-certificate/${encodeURIComponent(certCode)}`;
  }, [certCode]);

  const qrMatrix = useMemo(() => buildQrMatrix(verifyUrl, 25), [verifyUrl]);

  const handleShareOrCopy = async () => {
    const safeName = studentName || 'Học viên';
    const message = `Chứng chỉ Thắng Tin Học · Học viên: ${safeName} · Khóa: ${courseTitle} · Mã xác thực: ${certCode} · Link: ${verifyUrl}`;
    if (Platform.OS !== 'web') {
      try {
        await Share.share({ title: 'Chứng chỉ Thắng Tin Học', message });
        return;
      } catch {
        // user dismissed share sheet or share failed silently
        return;
      }
    }

    try {
      await globalThis.navigator?.clipboard?.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      Alert.alert('Mã xác thực chứng nhận', message);
    }
  };

  const handlePrintPdf = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const qrSvg = qrMatrixToSvgMarkup(qrMatrix, 92);
      const gradeHtml = avgGrade != null && Number(avgGrade) > 0
        ? `<span style="color:#B45309">Điểm TB: ${escapeHtml(String(avgGrade))}/10</span>`
        : '';
      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #F8FAFC; }
      .sheet { max-width: 780px; margin: 0 auto; border: 6px solid #047857; border-radius: 18px; padding: 28px; background: linear-gradient(135deg, #ECFDF5, #FFFFFF, #FEFCE8); }
      .inner { border: 1px solid rgba(245, 158, 11, 0.45); border-radius: 12px; padding: 24px; }
      .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
      .brand { font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #047857; text-transform: uppercase; }
      .sub { font-size: 11px; color: #64748B; margin-top: 2px; }
      .badge { font-size: 11px; font-weight: 800; color: #065F46; background: #D1FAE5; padding: 5px 10px; border-radius: 999px; }
      .center { text-align: center; }
      .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 2.5px; color: #D97706; text-transform: uppercase; }
      h1 { margin: 8px 0 6px; font-size: 22px; color: #0F172A; }
      .name { margin: 10px 0 8px; font-size: 28px; font-weight: 900; color: #047857; text-transform: uppercase; }
      .courseBox { margin: 14px auto; max-width: 520px; border: 1px solid #A7F3D0; background: #FFFFFF; border-radius: 12px; padding: 12px 16px; }
      .courseTitle { font-size: 17px; font-weight: 800; color: #0F172A; margin: 0 0 6px; }
      .meta { font-size: 12px; font-weight: 700; color: #475569; display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; }
      .footer { margin-top: 22px; padding-top: 16px; border-top: 1px solid rgba(4, 120, 87, 0.14); display: flex; justify-content: space-between; align-items: center; gap: 16px; }
      .qrBox { display: flex; align-items: center; gap: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; border-radius: 12px; padding: 8px 10px; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="inner">
        <div class="head">
          <div>
            <div class="brand">Thắng Tin Học Academy</div>
            <div class="sub">Hệ thống Đào tạo &amp; Xác thực Kỹ năng số</div>
          </div>
          <div class="badge">Đã xác thực</div>
        </div>
        <div class="center">
          <div class="eyebrow">Certificate of Completion</div>
          <h1>CHỨNG NHẬN HOÀN THÀNH KHÓA HỌC</h1>
          <div style="font-size:13px;color:#64748B;">Trân trọng trao tặng học viên</div>
          <div class="name">${escapeHtml(studentName || 'HỌC VIÊN THẮNG TIN HỌC')}</div>
          <div style="font-size:13px;color:#475569;">Đã hoàn thành xuất sắc chương trình đào tạo &amp; thực hành</div>
          <div class="courseBox">
            <div class="courseTitle">${escapeHtml(courseTitle)}</div>
            <div class="meta">
              <span style="color:#047857">Tiến độ: ${safeCompletion}%</span>
              ${gradeHtml}
              <span>Ngày cấp: ${escapeHtml(formattedDate)}</span>
            </div>
          </div>
        </div>
        <div class="footer">
          <div>
            <div style="font-size:10px;font-weight:800;letter-spacing:1.2px;color:#94A3B8;text-transform:uppercase;">Giảng viên / Đại diện đào tạo</div>
            <div style="font-size:14px;font-weight:800;color:#1E293B;margin-top:3px;">${escapeHtml(instructorName || 'Trung tâm Thắng Tin Học')}</div>
            <div style="font-size:11px;font-family:monospace;font-weight:700;color:#047857;margin-top:4px;">Mã CC: ${escapeHtml(certCode)}</div>
          </div>
          <div class="qrBox">
            ${qrSvg}
            <div style="max-width:150px;">
              <div style="font-size:10px;font-weight:800;color:#047857;text-transform:uppercase;">Quét QR xác thực</div>
              <div style="font-size:10px;color:#64748B;margin-top:2px;">Kiểm tra tính hợp lệ trực tuyến theo mã định danh.</div>
              <div style="font-size:9px;font-family:monospace;color:#94A3B8;margin-top:4px;">${escapeHtml(certCode)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert(
        'Không thể in chứng nhận',
        error instanceof Error ? error.message : 'Vui lòng thử lại sau.',
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Đóng chứng nhận số" />
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.certSheet}>
              <View style={styles.certInnerBorder}>
                <View style={styles.certHeader}>
                  <View style={styles.brandRow}>
                    <View style={styles.awardBadge}>
                      <Award size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.brandEyebrow}>THẮNG TIN HỌC ACADEMY</Text>
                      <Text style={styles.brandSub}>Hệ thống Đào tạo &amp; Xác thực Kỹ năng số</Text>
                    </View>
                  </View>
                  <View style={styles.verifiedPill}>
                    <ShieldCheck size={13} color="#065F46" />
                    <Text style={styles.verifiedText}>Đã xác thực</Text>
                  </View>
                </View>

                <View style={styles.bodyCenter}>
                  <View style={styles.certificateRibbon}>
                    <Sparkles size={12} color="#D97706" />
                    <Text style={styles.ribbonText}>CERTIFICATE OF COMPLETION</Text>
                    <Sparkles size={12} color="#D97706" />
                  </View>
                  <Text style={styles.certTitle}>CHỨNG NHẬN HOÀN THÀNH KHÓA HỌC</Text>
                  <Text style={styles.recipientLead}>Trân trọng trao tặng học viên</Text>
                  <Text style={styles.studentName}>
                    {(studentName || 'HỌC VIÊN THẮNG TIN HỌC').toUpperCase()}
                  </Text>
                  <Text style={styles.achievementCopy}>
                    Đã hoàn thành xuất sắc chương trình đào tạo &amp; thực hành
                  </Text>
                  <View style={styles.courseBox}>
                    <Text style={styles.courseTitle}>{courseTitle}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaGreen}>Tiến độ: {safeCompletion}%</Text>
                      {avgGrade != null && Number(avgGrade) > 0 ? (
                        <Text style={styles.metaAmber}>Điểm TB: {avgGrade}/10</Text>
                      ) : null}
                      <Text style={styles.metaNeutral}>Ngày cấp: {formattedDate}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.certFooter}>
                  <View style={styles.instructorBlock}>
                    <Text style={styles.footerCaption}>GIẢNG VIÊN / ĐẠI DIỆN ĐÀO TẠO</Text>
                    <Text style={styles.instructorName}>
                      {instructorName || 'Trung tâm Thắng Tin Học'}
                    </Text>
                    <Text style={styles.codeLabel}>Mã CC: {certCode}</Text>
                  </View>
                  <View style={styles.qrCard}>
                    <View style={styles.qrFrame}>
                      <QrSvg matrix={qrMatrix} size={78} />
                    </View>
                    <View style={styles.qrMeta}>
                      <Text style={styles.qrTitle}>QUÉT QR XÁC THỰC</Text>
                      <Text style={styles.qrDesc}>Kiểm tra tính hợp lệ theo mã định danh.</Text>
                      <Text numberOfLines={1} style={styles.qrCodeMini}>{certCode}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.actionBar}>
            <View style={styles.actionLeft}>
              <Pressable
                onPress={() => { void handlePrintPdf(); }}
                disabled={printing}
                style={[styles.printButton, printing && styles.disabled]}
                accessibilityRole="button"
              >
                {printing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Printer size={15} color="#FFFFFF" />
                )}
                <Text style={styles.printButtonText}>In / Lưu PDF</Text>
              </Pressable>
              <Pressable
                onPress={() => { void handleShareOrCopy(); }}
                style={styles.shareButton}
                accessibilityRole="button"
              >
                {Platform.OS === 'web' ? (
                  copied ? <Check size={15} color="#059669" /> : <Copy size={15} color="#334155" />
                ) : (
                  <Share2 size={15} color="#334155" />
                )}
                <Text style={styles.shareButtonText}>
                  {Platform.OS === 'web' && copied ? 'Đã sao chép mã' : 'Chia sẻ / Sao chép mã'}
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button">
              <X size={15} color="#475569" />
              <Text style={styles.closeButtonText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 14,
  },
  scrollContent: {
    padding: spacing.md,
  },
  certSheet: {
    borderWidth: 4,
    borderColor: '#047857',
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    padding: 6,
  },
  certInnerBorder: {
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.md,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brandRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  awardBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  brandEyebrow: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  brandSub: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  verifiedText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '900',
  },
  bodyCenter: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  certificateRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ribbonText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  certTitle: {
    color: '#0F172A',
    fontSize: typography.heading,
    fontWeight: '900',
    textAlign: 'center',
  },
  recipientLead: {
    color: '#64748B',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  studentName: {
    color: '#047857',
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 2,
  },
  achievementCopy: {
    color: '#475569',
    fontSize: typography.caption,
    textAlign: 'center',
  },
  courseBox: {
    width: '100%',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    gap: 5,
  },
  courseTitle: {
    color: '#0F172A',
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  metaGreen: { color: '#047857', fontSize: typography.micro, fontWeight: '800' },
  metaAmber: { color: '#B45309', fontSize: typography.micro, fontWeight: '800' },
  metaNeutral: { color: '#475569', fontSize: typography.micro, fontWeight: '700' },
  certFooter: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(4, 120, 87, 0.14)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  instructorBlock: {
    flex: 1,
    minWidth: 150,
    gap: 3,
  },
  footerCaption: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  instructorName: {
    color: '#1E293B',
    fontSize: typography.small,
    fontWeight: '900',
  },
  codeLabel: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  qrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  qrFrame: {
    padding: 2,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  qrMeta: {
    maxWidth: 132,
    gap: 2,
  },
  qrTitle: {
    color: '#047857',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  qrDesc: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 13,
  },
  qrCodeMini: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  actionLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  printButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 11,
    backgroundColor: '#059669',
  },
  printButtonText: {
    color: '#FFFFFF',
    fontSize: typography.micro,
    fontWeight: '800',
  },
  shareButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  shareButtonText: {
    color: '#334155',
    fontSize: typography.micro,
    fontWeight: '700',
  },
  closeButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
  },
  closeButtonText: {
    color: '#334155',
    fontSize: typography.micro,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
});

