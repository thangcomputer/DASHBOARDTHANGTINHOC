import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { strToU8, zipSync } from 'fflate';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react-native';
import { useAuth } from '../app/AuthContext';
import {
  AppHeader,
  AppScreen,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from '../components/ui';
import { useMockResource } from '../hooks/useMockResource';
import { scheduleService, teacherFinanceService } from '../services/mockService';
import type { TeacherFinanceOverview } from '../services/teacherApi';
import { SOCKET_EVENTS } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Payment = TeacherFinanceOverview['transactions'][number] & { synthetic: boolean };
type PaymentFilter = 'all' | 'paid' | 'pending';

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

function formatPaymentDate(value: string, month: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('vi-VN')
    : month || 'Chưa có ngày';
}

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function spreadsheetColumn(index: number) {
  let column = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function createWorkbookBytes(rows: Array<Array<string | number>>) {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${spreadsheetColumn(columnIndex)}${rowIndex + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        const style = columnIndex === 4 ? (rowIndex > 3 && String(row[0] || '').toLocaleLowerCase().includes('tổng') ? 5 : 1) : 0;
        return `<c r="${reference}"${style ? ` s="${style}"` : ''}><v>${value}</v></c>`;
      }
      const firstCell = String(row[0] || '').toLocaleLowerCase();
      const style = rowIndex === 0 ? 3 : rowIndex === 3 ? 2 : firstCell.startsWith('tổng') ? 4 : 0;
      return `<c r="${reference}"${style ? ` s="${style}"` : ''} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="28" customHeight="1"' : ''}>${cells}</row>`;
  }).join('');
  const xmlFiles: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bang ke thu nhap" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="32" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="4" width="18" customWidth="1"/><col min="5" max="5" width="22" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><mergeCells count="1"><mergeCell ref="A1:E1"/></mergeCells></worksheet>`,
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0 &quot;đ&quot;"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF172033"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF047857"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F5EE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="1" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  };
  return zipSync(Object.fromEntries(
    Object.entries(xmlFiles).map(([path, content]) => [path, strToU8(content)]),
  ));
}

function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return globalThis.btoa(binary);
}

export function TeacherFinanceScreen() {
  const { user } = useAuth();
  const loader = useCallback(() => teacherFinanceService.overview(user), [user]);
  const resource = useMockResource(loader);
  const overview = resource.data;
  const [filterStatus, setFilterStatus] = useState<PaymentFilter>('all');
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    DeviceEventEmitter.emit('mobile:finance-viewed');
    resource.reload();
  }, [resource.reload]));

  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.FINANCE_TRANSACTION, () => { void resource.reload(); }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.NOTIFICATION, (notification: { type?: string }) => {
        if (notification?.type === 'FINANCE') void resource.reload();
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [resource.reload]);

  const displayPayments = useMemo<Payment[]>(() => {
    if (!overview) return [];
    const payments: Payment[] = overview.transactions.map((transaction) => ({ ...transaction, synthetic: false }));
    const recordedPending = payments
      .filter((payment) => payment.status === 'pending')
      .reduce((sum, payment) => sum + Math.max(0, payment.amount), 0);
    const syntheticAmount = Math.max(0, overview.unpaidAmount - recordedPending);
    if (syntheticAmount > 0) {
      payments.unshift({
        id: 'synthetic-pending-commission',
        description: overview.pendingSessionsCount > 0
          ? `Hoa hồng ${overview.pendingSessionsCount} buổi dạy đã hoàn thành - chờ Admin chuyển`
          : 'Hoa hồng buổi dạy đã hoàn thành - chờ Admin chuyển',
        month: 'Hiện tại',
        amount: syntheticAmount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        confirmedBy: 'Admin',
        note: '',
        sessions: overview.pendingSessionsCount,
        starBonusAmount: 0,
        paymentSessionDetails: [],
        synthetic: true,
      });
    }
    return payments;
  }, [overview]);

  const filteredPayments = useMemo(() => displayPayments.filter((payment) => {
    if (filterStatus === 'paid') return payment.status === 'confirmed';
    if (filterStatus === 'pending') return payment.status === 'pending';
    return true;
  }), [displayPayments, filterStatus]);

  const paymentGroups = useMemo(() => {
    const groups = new Map<string, Payment[]>();
    filteredPayments.forEach((payment) => {
      const month = payment.month || 'Không rõ';
      const group = groups.get(month) || [];
      group.push(payment);
      groups.set(month, group);
    });
    return [...groups.entries()];
  }, [filteredPayments]);

  const chartData = useMemo(() => {
    const totals = new Map<string, number>();
    (overview?.transactions || [])
      .filter((transaction) => transaction.status === 'confirmed')
      .forEach((transaction) => {
        const month = transaction.month || 'Không rõ';
        totals.set(month, (totals.get(month) || 0) + transaction.amount);
      });
    return [...totals.entries()].reverse();
  }, [overview]);
  const maxChartAmount = Math.max(1, ...chartData.map((item) => item[1]));

  const exportMonthlyExcel = async () => {
    if (!overview) return;
    setExporting(true);
    try {
      const schedules = await scheduleService.list('teacher');
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthTitle = `Tháng ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const completedSessions = schedules
        .filter((session) => session.status === 'completed' && session.date?.startsWith(monthKey))
        .sort((left, right) => `${left.date || ''} ${left.startTime || ''}`.localeCompare(`${right.date || ''} ${right.startTime || ''}`));
      const allCompleted = schedules
        .filter((session) => session.status === 'completed')
        .sort((left, right) => `${left.date || ''} ${left.startTime || ''}`.localeCompare(`${right.date || ''} ${right.startTime || ''}`));

      const paidAmounts = new Map<string, number>();
      overview.transactions.forEach((payment) => {
        payment.paymentSessionDetails.forEach((detail) => {
          if (detail.sessionId) paidAmounts.set(detail.sessionId, detail.allocatedAmount);
        });
      });
      const sessionNumberById = new Map<string, number>();
      const numberCounters = new Map<string, number>();
      allCompleted.forEach((session) => {
        const key = `${session.studentId || session.studentName || 'unknown'}|${session.courseName || session.subject}`;
        const next = (numberCounters.get(key) || 0) + 1;
        numberCounters.set(key, next);
        sessionNumberById.set(session.id, next);
      });

      const studentRows = new Map<string, {
        studentName: string;
        sessions: Array<{ course: string; date: string; number: number; amount: number }>;
        total: number;
      }>();
      completedSessions.forEach((session) => {
        const studentKey = session.studentId || session.studentName || 'unknown';
        const student = studentRows.get(studentKey) || {
          studentName: session.studentName || 'Học viên',
          sessions: [],
          total: 0,
        };
        const amount = paidAmounts.get(session.id) ?? overview.salaryPerSession;
        student.sessions.push({
          course: session.courseName || session.subject,
          date: session.date || '',
          number: sessionNumberById.get(session.id) || 0,
          amount,
        });
        student.total += amount;
        studentRows.set(studentKey, student);
      });

      const rows: Array<Array<string | number>> = [
        [`BẢNG KÊ THU NHẬP ${monthTitle.toUpperCase()}`],
        [`Giảng viên: ${user?.name || '-'}`],
        [],
        ['Học viên', 'Khóa học', 'Ngày dạy', 'Buổi số', 'Tiền/buổi (VNĐ)'],
      ];
      let totalAmount = 0;
      studentRows.forEach((student) => {
        student.sessions.forEach((session) => {
          rows.push([
            student.studentName,
            session.course,
            session.date ? new Date(`${session.date}T12:00:00`).toLocaleDateString('vi-VN') : '-',
            session.number || '-',
            session.amount,
          ]);
        });
        rows.push([student.studentName, '', '', `Tổng ${student.sessions.length} buổi`, student.total]);
        totalAmount += student.total;
      });
      if (!completedSessions.length) rows.push(['Không có buổi dạy hoàn thành trong tháng này']);
      rows.push([]);
      rows.push(['TỔNG TOÀN BỘ HỌC VIÊN', '', '', `${completedSessions.length} buổi`, totalAmount]);

      const workbookBytes = createWorkbookBytes(rows);
      const fileMonth = `${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;
      const fileName = `Bang_ke_thu_nhap_Thang_${fileMonth}.xlsx`;
      if (Platform.OS === 'web') {
        const blob = new Blob([workbookBytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        if (!FileSystem.cacheDirectory) throw new Error('Không thể truy cập vùng lưu tệp trên thiết bị.');
        const uri = `${FileSystem.cacheDirectory}${fileName}`;
        const base64 = encodeBase64(workbookBytes);
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (!(await Sharing.isAvailableAsync())) throw new Error('Thiết bị không hỗ trợ chia sẻ hoặc lưu tệp Excel.');
        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Lưu bảng kê ${monthTitle}`,
        });
      }
    } catch (error) {
      Alert.alert('Không thể xuất Excel', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppScreen contentStyle={styles.financeScreen}>
      <AppHeader title="Tài chính & Hoa hồng" centered showBackButton={false} />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState message={resource.errorMessage} onRetry={resource.reload} /> : null}
      {overview ? (
        <>

          <Card style={styles.financeHeroCard}>
            <View style={styles.financeLabelRow}>
              <TrendingUp size={16} color="#059669" />
              <Text style={styles.financeStatLabel}>Tổng đã nhận</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.financeHeroAmount}>{formatCurrency(overview.paidAmount)}</Text>
            <Text style={styles.financeHint}>Tổng các giao dịch đã xác nhận</Text>
          </Card>
          <View style={styles.financeStats}>
            <Card style={styles.financeStatCard}>
              <View style={styles.financeLabelRow}>
                <AlertCircle size={15} color="#F59E0B" />
                <Text style={styles.financeStatLabel}>Chưa nhận</Text>
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.financePendingAmount}>{formatCurrency(overview.unpaidAmount)}</Text>
              <Text style={styles.financeHint}>Đang chờ Admin chuyển</Text>
            </Card>
            <Card style={styles.financeStatCard}>
              <View style={styles.financeLabelRow}>
                <CalendarDays size={15} color="#F43F5E" />
                <Text style={styles.financeStatLabel}>Tổng buổi đã dạy</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tải bảng kê Excel tháng này"
                  disabled={exporting}
                  onPress={() => { void exportMonthlyExcel(); }}
                  style={styles.financeExcelButton}
                >
                  <FileSpreadsheet size={16} color="#059669" />
                </Pressable>
              </View>
              <Text style={styles.financeSessionAmount}>{overview.totalSessions}</Text>
              <Text style={styles.financeHint}>{exporting ? 'Đang tạo file Excel…' : 'Tất cả các tháng · Excel tháng này'}</Text>
            </Card>
          </View>
          <Card style={styles.financeChartCard}>
            <View style={styles.financeCardHeading}>
              <BarChart3 size={18} color="#2563EB" />
              <Text style={styles.financeCardTitle}>Biểu đồ thu nhập</Text>
            </View>
            {chartData.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.financeChartContent}>
                {chartData.map(([month, amount]) => (
                  <View key={month} style={styles.financeChartColumn}>
                    <Text numberOfLines={1} style={styles.financeChartValue}>{formatCurrency(amount)}</Text>
                    <View style={styles.financeChartTrack}>
                      <View style={[styles.financeChartBar, { height: `${Math.max(8, (amount / maxChartAmount) * 100)}%` }]} />
                    </View>
                    <Text numberOfLines={1} style={styles.financeChartMonth}>{month.replace('Tháng ', 'T')}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.financeChartEmpty}>
                <BarChart3 size={24} color="#CBD5E1" />
                <Text style={styles.financeHint}>Chưa có dữ liệu thống kê</Text>
              </View>
            )}
          </Card>
          <Card style={styles.financeHistoryCard}>
            <View style={styles.financeCardHeading}>
              <CreditCard size={17} color="#059669" />
              <Text style={styles.financeCardTitle}>Lịch sử chuyển tiền hoa hồng</Text>
            </View>
            <View style={styles.financeFilters}>
              {([
                ['all', 'Tất cả'],
                ['paid', 'Đã nhận'],
                ['pending', 'Chưa nhận'],
              ] as const).map(([key, label]) => (
                <Pressable key={key} onPress={() => setFilterStatus(key)} style={[styles.financeFilter, filterStatus === key && styles.financeFilterActive]}>
                  <Text style={[styles.financeFilterText, filterStatus === key && styles.financeFilterTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {!filteredPayments.length ? (
              <EmptyState title="Không có giao dịch nào" message="Giao dịch sẽ xuất hiện tại đây sau khi được cập nhật." />
            ) : null}
            {paymentGroups.map(([month, payments]) => (
              <View key={month} style={styles.financeMonthGroup}>
                <View style={styles.financeMonthHeading}>
                  <View style={styles.financeLabelRow}>
                    <CalendarDays size={13} color="#94A3B8" />
                    <Text style={styles.financeMonthTitle}>{month}</Text>
                  </View>
                  <Text style={styles.financeHint}>{payments.length} giao dịch</Text>
                </View>
                {payments.map((payment) => {
                  const isPaid = payment.status === 'confirmed';
                  const isCancelled = payment.status === 'cancelled';
                  const studentGroups = new Map<string, {
                    studentName: string;
                    sessions: number;
                    amount: number;
                    dates: string[];
                  }>();
                  payment.paymentSessionDetails.forEach((session) => {
                    const key = session.studentId || session.studentName || 'unknown';
                    const student = studentGroups.get(key) || {
                      studentName: session.studentName || 'Học viên',
                      sessions: 0,
                      amount: 0,
                      dates: [],
                    };
                    student.sessions += 1;
                    student.amount += session.allocatedAmount;
                    if (session.date) student.dates.push(new Date(session.date).toLocaleDateString('vi-VN'));
                    studentGroups.set(key, student);
                  });
                  const expanded = expandedPaymentId === payment.id;
                  return (
                    <View key={payment.id} style={[styles.financePaymentCard, isPaid ? styles.financePaymentPaid : styles.financePaymentPending]}>
                      <View style={styles.financePaymentTop}>
                        <View style={styles.financePaymentCopy}>
                          <View style={styles.financeLabelRow}>
                            <Text numberOfLines={1} style={styles.financePaymentAmount}>{formatCurrency(payment.amount)}</Text>
                            <View style={[styles.financeStatusPill, isPaid ? styles.financeStatusPaid : styles.financeStatusPending]}>
                              {isPaid
                                ? <CheckCircle2 size={11} color="#047857" />
                                : <Clock3 size={11} color={isCancelled ? '#64748B' : '#B45309'} />}
                              <Text style={[styles.financeStatusText, isPaid ? styles.financeStatusTextPaid : styles.financeStatusTextPending]}>
                                {payment.synthetic ? 'Tạm tính' : isPaid ? 'Đã nhận' : isCancelled ? 'Đã hủy' : 'Chưa nhận'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.financePaymentDescription}>
                            {payment.synthetic ? 'Tạm tính · ' : ''}{payment.note || payment.description || 'Thanh toán hoa hồng'}
                          </Text>
                          <View style={styles.financePaymentMeta}>
                            <Text style={styles.financePaymentMetaText}>{formatPaymentDate(payment.createdAt, payment.month)}</Text>
                            <Text style={styles.financePaymentMetaText}>{payment.sessions || payment.paymentSessionDetails.length} buổi</Text>
                            <Text style={styles.financePaymentMetaText}>{payment.confirmedBy || 'Admin'}</Text>
                          </View>
                        </View>
                        {!payment.synthetic && payment.paymentSessionDetails.length ? (
                          <Pressable onPress={() => setExpandedPaymentId(expanded ? null : payment.id)} style={styles.financeExpandButton}>
                            {expanded ? <ChevronDown size={14} color="#475569" /> : <ChevronRight size={14} color="#475569" />}
                            <Text style={styles.financeExpandText}>{expanded ? 'Thu gọn' : `Chi tiết (${studentGroups.size})`}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {!payment.synthetic && expanded ? (
                        <View style={styles.financeDetails}>
                          <Text style={styles.financeDetailsTitle}>Phân bổ theo học viên · {studentGroups.size} học viên</Text>
                          {[...studentGroups.values()].map((student, index) => (
                            <View key={`${payment.id}-${student.studentName}-${index}`} style={styles.financeStudentRow}>
                              <View style={styles.financeStudentCopy}>
                                <Text style={styles.financeStudentName}>{student.studentName}</Text>
                                <Text style={styles.financeHint}>{student.dates.join(', ') || 'Không có ngày'}</Text>
                              </View>
                              <View style={styles.financeStudentTotals}>
                                <Text style={styles.financeStudentSessions}>{student.sessions} buổi</Text>
                                <Text style={styles.financeHint}>{formatCurrency(student.amount)}</Text>
                              </View>
                            </View>
                          ))}
                          <View style={styles.financeConfirmedBy}>
                            <Text style={styles.financeHint}>Người chuyển: {payment.confirmedBy || 'Admin'}</Text>
                            {payment.starBonusAmount > 0 ? <Text style={styles.financeBonus}>Thưởng: {formatCurrency(payment.starBonusAmount)}</Text> : null}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
            <View style={styles.financeTotals}>
              <View style={styles.financeTotalRow}>
                <Text style={styles.financeHint}>Tổng đã nhận:</Text>
                <Text style={styles.financeTotalPaid}>{formatCurrency(overview.paidAmount)}</Text>
              </View>
              {overview.unpaidAmount > 0 ? (
                <View style={styles.financeTotalRow}>
                  <Text style={styles.financeHint}>Chờ nhận:</Text>
                  <Text style={styles.financeTotalPending}>{formatCurrency(overview.unpaidAmount)}</Text>
                </View>
              ) : null}
            </View>
          </Card>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  financeScreen: { gap: spacing.md, paddingBottom: spacing.xl },
  financeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: 2 },
  financeSectionTitle: { flex: 1, color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  financeTeacherName: { maxWidth: '44%', color: colors.muted, fontSize: typography.micro, lineHeight: 17, textAlign: 'right' },
  financeHeroCard: { gap: spacing.xs, padding: spacing.lg, borderColor: '#A7F3D0', backgroundColor: '#FFFFFF' },
  financeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  financeStatLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.35 },
  financeHeroAmount: { color: '#059669', fontSize: 30, fontWeight: '900', marginTop: 1 },
  financeHint: { color: colors.muted, fontSize: typography.micro, lineHeight: 18 },
  financeStats: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  financeStatCard: { flex: 1, minWidth: 0, gap: spacing.xs, padding: spacing.md, borderColor: '#E2E8F0' },
  financeExcelButton: { width: 30, height: 30, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: radius.sm, backgroundColor: '#ECFDF5' },
  financePendingAmount: { color: '#D97706', fontSize: typography.small, fontWeight: '900', marginTop: 3 },
  financeSessionAmount: { color: '#E11D48', fontSize: typography.small, fontWeight: '900', marginTop: 3 },
  financeChartCard: { gap: spacing.sm, padding: spacing.md },
  financeCardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  financeCardTitle: { flex: 1, color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  financeChartContent: { height: 136, minWidth: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: colors.line },
  financeChartColumn: { width: 72, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  financeChartValue: { maxWidth: 90, color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  financeChartTrack: { width: 34, flex: 1, justifyContent: 'flex-end', overflow: 'hidden', borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: '#EFF6FF' },
  financeChartBar: { width: '100%', minHeight: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: '#4F46E5' },
  financeChartMonth: { maxWidth: 72, color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  financeChartEmpty: { height: 84, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  financeHistoryCard: { gap: spacing.md, padding: spacing.md },
  financeFilters: { minHeight: 40, flexDirection: 'row', alignItems: 'center', padding: 3, borderRadius: radius.md, backgroundColor: '#F1F5F9' },
  financeFilter: { minHeight: 34, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  financeFilterActive: { backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  financeFilterText: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  financeFilterTextActive: { color: colors.ink, fontWeight: '800' },
  financeMonthGroup: { gap: spacing.sm },
  financeMonthHeading: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  financeMonthTitle: { color: colors.muted, fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.7 },
  financePaymentCard: { overflow: 'hidden', borderWidth: 1, borderRadius: radius.md },
  financePaymentPaid: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF9' },
  financePaymentPending: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  financePaymentTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, padding: spacing.sm },
  financePaymentCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  financePaymentAmount: { flexShrink: 1, color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  financeStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: radius.pill },
  financeStatusPaid: { backgroundColor: '#D1FAE5' },
  financeStatusPending: { backgroundColor: '#FEF3C7' },
  financeStatusText: { fontSize: typography.micro, fontWeight: '800' },
  financeStatusTextPaid: { color: '#047857' },
  financeStatusTextPending: { color: '#B45309' },
  financePaymentDescription: { color: '#475569', fontSize: typography.caption, lineHeight: 19 },
  financePaymentMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  financePaymentMetaText: { color: colors.muted, fontSize: typography.micro },
  financeExpandButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: '#FFFFFF' },
  financeExpandText: { color: '#475569', fontSize: typography.micro, fontWeight: '700' },
  financeDetails: { gap: spacing.xs, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: '#F8FAFC' },
  financeDetailsTitle: { color: colors.muted, fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.6, marginBottom: 2 },
  financeStudentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: '#FFFFFF' },
  financeStudentCopy: { flex: 1, minWidth: 0, gap: 2 },
  financeStudentName: { color: colors.ink, fontSize: typography.micro, fontWeight: '700' },
  financeStudentTotals: { alignItems: 'flex-end', gap: 2 },
  financeStudentSessions: { color: '#475569', fontSize: typography.micro, fontWeight: '800' },
  financeConfirmedBy: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs, marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line },
  financeBonus: { color: '#B45309', fontSize: typography.micro, fontWeight: '700' },
  financeTotals: { gap: spacing.xs, marginTop: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: colors.line },
  financeTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  financeTotalPaid: { color: '#047857', fontSize: typography.body, fontWeight: '900' },
  financeTotalPending: { color: '#D97706', fontSize: typography.body, fontWeight: '900' },
});
