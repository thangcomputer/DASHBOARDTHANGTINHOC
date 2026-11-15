/**
 * Tải thư viện xlsx (≈ 425 KB) theo yêu cầu, chỉ khi người dùng thực sự Xuất/Nhập Excel.
 * Kết quả được cache để các lần sau dùng ngay.
 */
let xlsxPromise = null;

export function loadXlsx() {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx')
      .then((mod) => (mod?.utils ? mod : mod?.default || mod))
      .catch((err) => {
        xlsxPromise = null;
        throw err;
      });
  }
  return xlsxPromise;
}

