# 11. APPLICATION ORCHESTRATOR
- Logic:
  1. Starts MongoDB Transaction.
  2. Dispatches CreateStudentCommand.
  3. Dispatches CreateInvoiceCommand (if paid).
  4. Returns legacy DTO structure.