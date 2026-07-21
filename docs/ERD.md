# QUANLYCMS — ERD (Entity Relationship)

Sơ đồ quan hệ logic MongoDB (Mongoose). Không phải SQL FK cứng; quan hệ qua `ObjectId` / string id.

## Tổng quan

```mermaid
erDiagram
  Tenant ||--o{ Branch : has
  Branch ||--o{ Student : enrolls
  Branch ||--o{ Teacher : works
  Branch ||--o{ Schedule : hosts
  Teacher ||--o{ Student : teaches
  Teacher ||--o{ Schedule : teaches
  Student ||--o{ Schedule : attends
  Student ||--o{ Invoice : billed
  Student ||--o{ ExamResult : takes
  Teacher ||--o{ Transaction : payout
  Teacher ||--o{ Evaluation : rated
  Student ||--o{ Evaluation : rates
  Course ||--o{ Student : catalog
  FormDefinition ||--o{ FormSubmission : collects
  FormDefinition ||--o{ ReportDefinition : "source form:"
  Notification }o--|| Student : receivers
  FileAsset }o--|| Teacher : uploadedBy
  WorkflowInstance }o--|| Teacher : entity
  WorkflowInstance }o--|| Student : entity
  BackupJob }o--|| Tenant : "platform scope"
```

## Multi-tenant & chi nhánh

```mermaid
erDiagram
  Tenant {
    ObjectId _id
    string code UK
    string name
    string status
    bool isDefault
  }
  Branch {
    ObjectId _id
    string code UK
    string name
    ObjectId tenantId FK
    bool isActive
  }
  Student {
    ObjectId _id
    string name
    ObjectId branchId FK
    ObjectId teacherId FK
    bool paid
  }
  Teacher {
    ObjectId _id
    string name
    ObjectId branchId FK
    string status
    string role
  }
  Tenant ||--o{ Branch : owns
  Branch ||--o{ Student : scopes
  Branch ||--o{ Teacher : scopes
```

## Học vụ & tài chính

```mermaid
erDiagram
  Student ||--o{ Schedule : "studentId"
  Teacher ||--o{ Schedule : "teacherId"
  Student ||--o{ Invoice : "hocVien"
  Teacher ||--o{ Transaction : "teacherId"
  Schedule {
    ObjectId _id
    ObjectId studentId
    ObjectId teacherId
    date date
    string status
  }
  Invoice {
    ObjectId _id
    ObjectId hocVien
    number hocPhi
    string maHoaDon
  }
  Transaction {
    ObjectId _id
    ObjectId teacherId
    number amount
    string status
  }
```

## Module nền tảng (Phase 7–14)

| Collection | Quan hệ chính |
|------------|----------------|
| `notifications` | `receivers[]`, `read_by[]`, `dismissed_by[]` |
| `fileassets` | `category`, `uploadedBy`, `diskPath` |
| `backupjobs` | file `.json.gz` trên disk `backups/` |
| `workflowinstances` | `definitionKey` + `entityType`/`entityId` |
| `formdefinitions` / `formsubmissions` | form → answers |
| `reportdefinitions` | `source` + `columns[]` |

## Ghi chú

- Super Admin (`id=admin`) không nằm trong collection `teachers`.
- Staff là `Teacher` với `role=staff` / `adminRole=STAFF`.
- SystemSettings: singleton `_key=main` (cấu hình web, MFA, training data).