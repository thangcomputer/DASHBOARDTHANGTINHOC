import { toast } from 'react-hot-toast';

const A5_W_MM = 210;
const A5_H_MM = 148;
const MM_TO_PX = 3.7795275591;

let _pdfLibs = null;
async function getPdfLibs() {
  if (_pdfLibs) return _pdfLibs;
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  _pdfLibs = { jsPDF, html2canvas };
  return _pdfLibs;
}

const captureWidthPx = () => Math.round(A5_W_MM * MM_TO_PX);
const captureHeightPx = () => Math.round(A5_H_MM * MM_TO_PX);

const waitForImages = (root) => {
  const images = root.querySelectorAll('img');
  return Promise.all(
    Array.from(images).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );
};

/** Chuẩn hóa style clone để html2canvas render chữ tiếng Việt không bị chồng ký tự */
const prepareCloneForCapture = (clone) => {
  const w = captureWidthPx();
  const h = captureHeightPx();

  clone.removeAttribute('id');
  clone.style.cssText = `
    width: ${w}px !important;
    height: ${h}px !important;
    min-width: ${w}px !important;
    min-height: ${h}px !important;
    max-width: ${w}px !important;
    max-height: ${h}px !important;
    margin: 0 !important;
    padding: 6mm 10mm !important;
    transform: none !important;
    box-shadow: none !important;
    position: relative !important;
    left: 0 !important;
    top: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
    font-family: Arial, Helvetica, "Segoe UI", sans-serif !important;
    letter-spacing: normal !important;
    word-spacing: normal !important;
    -webkit-font-smoothing: antialiased !important;
  `;

  clone.querySelectorAll('*').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.letterSpacing = 'normal';
    node.style.wordSpacing = 'normal';
    const t = node.style.transform || '';
    if (t && !t.includes('rotate')) {
      node.style.transform = 'none';
    }
    if (node.classList.contains('font-black')) {
      node.style.fontWeight = '700';
    }
  });
};

/**
 * Clone template ra container tách biệt (không transform/scale của modal)
 * để html2canvas chụp đúng khổ A5 ngang.
 */
const buildCaptureRoot = (source) => {
  const container = document.createElement('div');
  container.id = '__invoice-pdf-capture__';
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: ${captureWidthPx()}px;
    height: ${captureHeightPx()}px;
    z-index: -1;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
    background: #ffffff;
  `;

  const clone = source.cloneNode(true);
  prepareCloneForCapture(clone);
  container.appendChild(clone);
  document.body.appendChild(container);

  return { container, clone };
};

/** Lấy template hóa đơn — ưu tiên bản đang hiển thị (modal) thay vì bản ẩn */
const getInvoiceElement = () => {
  const all = document.querySelectorAll('#invoice-template');
  if (!all.length) return null;
  for (let i = all.length - 1; i >= 0; i--) {
    const el = all[i];
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return all[all.length - 1];
};

/**
 * Xuất hóa đơn từ DOM element sang PDF khổ A5 ngang
 *
 * @param {Object} data
 * @param {string} data.studentName - Tên học viên (dùng cho tên file)
 */
const exportPDF = async (data = {}) => {
  const element = getInvoiceElement();

  if (!element) {
    toast.error('Không tìm thấy mẫu hóa đơn. Vui lòng thử lại.');
    return false;
  }

  const { container, clone } = buildCaptureRoot(element);

  try {
    await waitForImages(clone);
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const w = captureWidthPx();
    const h = captureHeightPx();

    const { jsPDF, html2canvas } = await getPdfLibs();

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: w,
      height: h,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: w,
      windowHeight: h,
      onclone: (_doc, clonedEl) => {
        prepareCloneForCapture(clonedEl);
      },
    });

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a5',
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Phủ kín trang A5 — nội dung đã đúng tỷ lệ khi chụp
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight);

    pdf.setProperties({
      title: 'Hóa Đơn Thu Học Phí - Thắng Tin Học',
      subject: 'Phiếu thu học phí',
      author: 'Trung Tâm Thắng Tin Học',
      keywords: 'hóa đơn, học phí, thắng tin học',
      creator: 'DashboardThangTinHoc v1.0',
    });

    const studentName = data.studentName || 'HocVien';
    const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
    const safeName = String(studentName)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'HocVien';
    const fileName = `HoaDon_${safeName}_${dateStr}.pdf`;

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return true;
  } catch (error) {
    toast.error('Có lỗi khi xuất PDF. Vui lòng thử lại.');
    return false;
  } finally {
    container.remove();
  }
};

/**
 * Hàm in trực tiếp (mở hộp thoại Print của trình duyệt)
 */
export const printInvoice = () => {
  const element = getInvoiceElement();
  if (!element) return toast.error('Không tìm thấy mẫu in');

  const oldContainer = document.getElementById('__invoice-print-container__');
  if (oldContainer) oldContainer.remove();

  const printContainer = document.createElement('div');
  printContainer.id = '__invoice-print-container__';

  const clone = element.cloneNode(true);
  prepareCloneForCapture(clone);
  clone.style.opacity = '1';
  clone.style.position = 'relative';
  clone.style.margin = '0 auto';
  clone.style.display = 'block';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';

  printContainer.appendChild(clone);
  document.body.appendChild(printContainer);

  const style = document.createElement('style');
  style.id = '__invoice-print-style__';
  style.innerHTML = `
    @media print {
      body > *:not(#__invoice-print-container__) {
        display: none !important;
      }
      #__invoice-print-container__ {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
      }
      #__invoice-print-container__ > div {
        width: 210mm !important;
        height: 148mm !important;
        margin: 0 auto !important;
        border: none !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @page {
        size: A5 landscape;
        margin: 0;
      }
    }
  `;
  document.head.appendChild(style);

  const runPrint = () => {
    window.print();
    setTimeout(() => {
      printContainer.remove();
      style.remove();
    }, 1000);
  };

  waitForImages(clone).then(() => {
    setTimeout(runPrint, 300);
  });
};

/**
 * Chụp phiếu thu đang hiện (#invoice-template) thành PNG blob.
 * Tách riêng — không đụng luồng In / Tải PDF.
 */
export async function captureInvoicePngBlob() {
  const element = getInvoiceElement();
  if (!element) {
    toast.error('Không tìm thấy mẫu hóa đơn. Vui lòng thử lại.');
    return null;
  }

  const { container, clone } = buildCaptureRoot(element);

  try {
    await waitForImages(clone);
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const w = captureWidthPx();
    const h = captureHeightPx();
    const { html2canvas } = await getPdfLibs();

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: w,
      height: h,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: w,
      windowHeight: h,
      onclone: (_doc, clonedEl) => {
        prepareCloneForCapture(clonedEl);
      },
    });

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (!blob) {
      toast.error('Không chụp được phiếu thu. Vui lòng thử lại.');
      return null;
    }
    return blob;
  } catch {
    toast.error('Không chụp được phiếu thu. Vui lòng thử lại.');
    return null;
  } finally {
    container.remove();
  }
}

let _zaloCaptureBusy = false;

/**
 * Chụp phiếu thu → copy ảnh vào clipboard → mở chat Zalo theo SĐT đã đăng ký.
 * Nhân viên dán (Ctrl+V) trong Zalo rồi gửi. Web không tự gửi ảnh vào Zalo.
 */
export async function captureAndSendZalo({ phone, zalo, studentName, courseName } = {}) {
  if (_zaloCaptureBusy) return false;
  _zaloCaptureBusy = true;

  try {
    const digits = String(zalo || phone || '').replace(/\D/g, '');
    if (!digits) {
      toast.error('Học viên chưa có số Zalo/SĐT.');
      return false;
    }

    const blob = await captureInvoicePngBlob();
    if (!blob) return false;

    let copied = false;
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        copied = true;
      }
    } catch {
      copied = false;
    }

    const parts = ['Phiếu thu học phí', studentName, courseName].filter(Boolean);
    const url = `https://zalo.me/${digits}?text=${encodeURIComponent(parts.join(' - '))}`;

    await new Promise((r) => setTimeout(r, 250));
    window.open(url, '_blank', 'noopener,noreferrer');

    if (copied) {
      toast.success('Đã copy phiếu thu. Dán (Ctrl+V) trong Zalo rồi gửi.');
    } else {
      toast.error('Đã mở Zalo nhưng chưa copy được ảnh. Hãy Tải PDF rồi gửi tay.');
    }
    return copied;
  } finally {
    _zaloCaptureBusy = false;
  }
}

export default exportPDF;
