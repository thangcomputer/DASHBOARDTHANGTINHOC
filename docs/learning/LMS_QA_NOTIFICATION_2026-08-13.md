# LMS Q&A + Notification (Module 7–8) — 2026-08-13

## Problem
Tab **Hỏi đáp** dưới player chỉ ghi `localStorage` → Admin/Teacher không thấy, chuông không báo.

## Solution
| Surface | Behavior |
|---------|----------|
| Student LMS → tab Hỏi đáp | `POST /api/training-lms/qa` → Mongo `LmsLessonQa` |
| Teacher LMS → tab Hỏi đáp | Cùng API (`audience=teacher`), GV có thể trả lời |
| Admin/Teacher chuông | `NotificationService` `COURSE` + payload `kind=lms_qa` |
| Click chuông Admin | `/admin/notifications?qaId=...` → modal trả lời |
| Click chuông Teacher (GV phụ trách) | `/teacher/notifications?qaId=...` → modal trả lời |
| Click chuông Student (đã trả lời) | Deep-link `#materials?courseId&lessonId&tab=qa&qaId` |

## Where to view questions
1. Mở khóa học LMS (Student: Tài liệu / Teacher: Đào tạo)
2. Chọn bài
3. Tab **Hỏi đáp** ngay dưới video

## Deploy note
Cần `pm2 restart` + `npm run build --prefix client` trên VPS.
