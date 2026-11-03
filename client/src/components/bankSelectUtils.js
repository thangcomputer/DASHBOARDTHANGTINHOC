export function generateVietQRUrl(bankCode, accountNumber, amount, description = '', accountName = '') {
  if (!bankCode || !accountNumber) return null;
  const params = new URLSearchParams({
    amount: String(Math.round(Number(amount) || 0)),
    addInfo: description,
    accountName,
  });
  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-qr_only.png?${params.toString()}`;
}
