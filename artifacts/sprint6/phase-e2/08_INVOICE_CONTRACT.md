# 08_INVOICE_CONTRACT

## Objective
Verify the HTTP 201 response payload maintains exact structural compatibility for the `student.invoice.maHoaDon` and `tempPassword` fields.

## Evidence

### Legacy Payload Structure
The legacy `studentRoutes.js` route manually returns:
```javascript
studentObj.tempPassword = plainPassword;
if (newInvoice) {
  studentObj.invoice = {
    _id: newInvoice._id,
    maHoaDon: newInvoice.maHoaDon,
    hocPhi: newInvoice.hocPhi
  };
}
```

### CQRS Payload Structure
The `StudentApplicationOrchestrator.js` constructs the DTO:
```javascript
studentObj.tempPassword = payload.studentData.password;
if (invoiceResult) {
  studentObj.invoice = {
    _id: invoiceResult._id,
    maHoaDon: invoiceResult.maHoaDon,
    hocPhi: invoiceResult.hocPhi,
  };
}
```

### Runtime Verification
During `student_cqrs_migration.test.js` execution, the response returned:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Hoc Vien CQRS 1",
    "tempPassword": "password123",
    "invoice": {
      "_id": "...",
      "maHoaDon": "HD-...",
      "hocPhi": 5000000
    }
  },
  "message": "Tạo học viên thành công (CQRS Path)"
}
```

## Verdict
[IDENTICAL]
The CQRS Orchestrator was explicitly designed to synthesize the exact legacy DTO shape synchronously before returning HTTP 201. The fields `invoice.maHoaDon` and `tempPassword` are perfectly preserved.
