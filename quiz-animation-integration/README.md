# Quiz Animation Integration (React / Next.js)

## File trong gói
- `components/quiz/QuizWithAnimations.tsx`: component client-side tái sử dụng.
- `components/quiz/quiz-animations.css`: giao diện và animation.
- `PROMPT_VISUAL_STUDIO_CODE.txt`: prompt để AI Agent tích hợp vào dự án thật.

## Cài thư viện
Tại thư mục gốc dự án, chạy:
```bash
npm install canvas-confetti
npm install -D @types/canvas-confetti
```
Nếu dự án đã có thư viện pháo giấy tương đương, hãy nhờ AI dùng thư viện sẵn có thay vì cài trùng.

## Dùng thử
```tsx
import QuizWithAnimations, { type QuizQuestion } from "@/components/quiz/QuizWithAnimations";

const questions: QuizQuestion[] = [
  {
    id: "q1",
    question: "Phím nào dùng để tạo khoảng trắng?",
    options: ["Enter", "Spacebar", "Esc", "Tab"],
    correctAnswer: 1,
    explanation: "Spacebar là phím dài ở hàng dưới cùng bàn phím."
  }
];

export default function PracticePage() {
  return (
    <QuizWithAnimations
      title="Tin học cơ bản"
      questions={questions}
      onComplete={(result) => {
        // Gắn API lưu kết quả tại đây nếu phù hợp.
        console.log(result);
      }}
    />
  );
}
```

## Lưu ý quan trọng khi tích hợp
1. `correctAnswer` là chỉ số đáp án bắt đầu từ 0: đáp án đầu tiên là `0`, thứ hai là `1`.
2. Đây là component mẫu độc lập. Với website đang có, ưu tiên tái sử dụng giao diện/cơ chế chấm điểm hiện hữu và chỉ tích hợp phần phản hồi animation nếu thay component hoàn toàn sẽ làm mất tính năng.
3. Module không tự ghi kết quả lên backend. Chỉ kết nối `onComplete` với API hiện tại sau khi kiểm tra hợp đồng API.
4. Không đưa đáp án đúng vào client nếu nền tảng yêu cầu bảo mật đáp án; khi đó server cần xác thực câu trả lời.
5. Chạy lint, typecheck, test và build theo scripts hiện có trong `package.json`.
