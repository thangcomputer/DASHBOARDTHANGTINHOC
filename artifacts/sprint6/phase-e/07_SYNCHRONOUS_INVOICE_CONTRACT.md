# 07. SYNCHRONOUS INVOICE CONTRACT
- Target DTO: `student.invoice.maHoaDon`
- Mechanism: `StudentApplicationOrchestrator` awaits `CreateInvoiceCommand` and merges results into HTTP 201 DTO.