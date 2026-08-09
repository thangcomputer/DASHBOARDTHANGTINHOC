const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../routes/invoiceRoutes.js');
let s = fs.readFileSync(p, 'utf8');
const re = /const invoices = await Invoice\.find\(filter\)\r?\n\s*\.populate\('hocVien', 'name course phone zalo paid paidAt branchId branchCode'\)\r?\n\s*\.sort\(\{ createdAt: -1 \}\);\r?\n\r?\n\s*res\.json\(\{ success: true, count: invoices\.length, data: invoices \}\);/;
const neu = `const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('hocVien', 'name course phone sbd paid paidAt branchId branchCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: invoices.length,
      total,
      page: pageNum,
      limit: limitNum,
      data: invoices,
    });`;
if (!re.test(s)) {
  console.error('pattern not found');
  process.exit(1);
}
fs.writeFileSync(p, s.replace(re, neu));
console.log('ok');
