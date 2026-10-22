"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import "./quiz-animations.css";

export type QuizQuestion = {
  id: string | number;
  question: string;
  options: string[];
  correctAnswer: number; // Index bắt đầu từ 0
  explanation?: string;
};

type Props = {
  questions: QuizQuestion[];
  title?: string;
  onComplete?: (result: {
    correct: number;
    total: number;
    percentage: number;
    wrong: number;
    bestStreak: number;
  }) => void;
};

const PRAISES = [
  { text: "Bạn giỏi quá!", icon: "🌟" },
  { text: "Quá đỉnh!", icon: "⚡" },
  { text: "Quá VIP!", icon: "🔥" },
  { text: "Xuất sắc luôn!", icon: "🏆" },
  { text: "Siêu trí tuệ!", icon: "🧠" },
  { text: "Đỉnh của chóp!", icon: "🚀" },
  { text: "Không thể tin nổi!", icon: "🤩" },
  { text: "Cao thủ xuất hiện!", icon: "👑" },
  { text: "Bạn quá tuyệt vời!", icon: "💎" },
  { text: "HOÀN HẢO! Bạn là nhà vô địch!", icon: "🥇" },
];

const ENCOURAGEMENTS = [
  { text: "Không sao đâu, cố lên nhé!", icon: "💛" },
  { text: "Sai một chút, hiểu thêm một điều!", icon: "📚" },
  { text: "Bạn đang tiến bộ từng ngày!", icon: "🌱" },
  { text: "Thử lại nhé, bạn sắp hiểu rồi!", icon: "💡" },
  { text: "Kiên trì là sẽ làm được!", icon: "💪" },
  { text: "Học từng bước, giỏi từng ngày!", icon: "🌈" },
  { text: "Đừng bỏ cuộc, bạn nhé!", icon: "🤗" },
  { text: "Xem lại kiến thức rồi thử tiếp nào!", icon: "✨" },
  { text: "Mỗi lần thử là một lần tiến bộ!", icon: "🎯" },
  { text: "Bạn làm được mà, cố lên!", icon: "❤️" },
];

function playTone(correct: boolean) {
  // Chỉ gọi sau thao tác người dùng để tránh trình duyệt chặn âm thanh.
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const notes = correct ? [523.25, 659.25, 783.99] : [392, 329.63];

    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * 0.12;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.10, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });

    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Lỗi âm thanh không được làm gián đoạn bài trắc nghiệm.
  }
}

export default function QuizWithAnimations({
  questions,
  title = "Thử thách kiến thức",
  onComplete,
}: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    text: string;
    icon: string;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const completionHandled = useRef(false);

  const total = questions.length;
  const question = questions[index];
  const percentage =
    total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const perfectScore = total > 0 && correctCount === total;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("quiz-sound-enabled");
      if (saved !== null) setSoundEnabled(saved === "true");
    } catch {
      // Giữ thiết lập mặc định nếu localStorage không khả dụng.
    }
  }, []);

  useEffect(() => {
    if (!completed || completionHandled.current) return;
    completionHandled.current = true;

    if (perfectScore) {
      const endTime = Date.now() + 2200;
      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 65,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 65,
          origin: { x: 1 },
        });
        if (Date.now() < endTime) requestAnimationFrame(frame);
      };
      frame();
    }

    onComplete?.({
      correct: correctCount,
      total,
      percentage,
      wrong: wrongCount,
      bestStreak,
    });
  }, [
    completed,
    perfectScore,
    correctCount,
    total,
    percentage,
    wrongCount,
    bestStreak,
    onComplete,
  ]);

  function answerQuestion(optionIndex: number) {
    if (selected !== null || completed || !question) return;

    const isCorrect = optionIndex === question.correctAnswer;
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    const nextStreak = isCorrect ? streak + 1 : 0;
    const nextWrong = wrongCount + (isCorrect ? 0 : 1);

    setSelected(optionIndex);
    setCorrectCount(nextCorrect);
    setWrongCount(nextWrong);
    setStreak(nextStreak);
    setBestStreak((current) => Math.max(current, nextStreak));
    setAnimationKey((current) => current + 1);
    setShowExplanation(false);

    if (soundEnabled) playTone(isCorrect);

    if (isCorrect) {
      // Lời khen tăng theo số câu ĐÚNG, không phụ thuộc số thứ tự câu hỏi.
      const praise = PRAISES[(nextCorrect - 1) % PRAISES.length];
      setFeedback({ correct: true, text: praise.text, icon: praise.icon });
    } else {
      const encouragement = ENCOURAGEMENTS[(nextWrong - 1) % ENCOURAGEMENTS.length];
      setFeedback({
        correct: false,
        text: encouragement.text,
        icon: encouragement.icon,
      });
    }
  }

  function toggleSound() {
    setSoundEnabled((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("quiz-sound-enabled", String(next));
      } catch {
        // Không bắt buộc phải lưu được tùy chọn.
      }
      return next;
    });
  }

  function nextQuestion() {
    if (selected === null || completed) return;

    if (index === total - 1) {
      setCompleted(true);
      return;
    }

    setIndex((current) => current + 1);
    setSelected(null);
    setFeedback(null);
    setShowExplanation(false);
  }

  function restartQuiz() {
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setWrongCount(0);
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setCompleted(false);
    setShowExplanation(false);
    completionHandled.current = false;
  }

  if (total === 0) {
    return <div className="quiz-empty">Chưa có câu hỏi để luyện tập.</div>;
  }

  if (questions.some((item) =>
    !item.question ||
    !Array.isArray(item.options) ||
    item.options.length < 2 ||
    !Number.isInteger(item.correctAnswer) ||
    item.correctAnswer < 0 ||
    item.correctAnswer >= item.options.length
  )) {
    return (
      <div className="quiz-empty" role="alert">
        Dữ liệu câu hỏi chưa hợp lệ. Hãy kiểm tra nội dung, danh sách đáp án
        và correctAnswer (chỉ số bắt đầu từ 0).
      </div>
    );
  }

  return (
    <section className="quiz-shell">
      <header className="quiz-header">
        <div>
          <span className="quiz-eyebrow">LUYỆN TẬP TƯƠNG TÁC</span>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          className="quiz-sound-button"
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
        >
          {soundEnabled ? "🔊 Âm thanh" : "🔇 Tắt tiếng"}
        </button>
      </header>

      {!completed ? (
        <>
          <div className="quiz-stats">
            <span>
              Câu <strong>{index + 1}</strong> / {total}
            </span>
            <span>✅ Đúng: {correctCount}</span>
            <span>🔥 Chuỗi đúng: {streak}</span>
          </div>

          <div
            className="quiz-progress-track"
            role="progressbar"
            aria-label="Tiến độ làm bài"
            aria-valuenow={index + 1}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <div
              className="quiz-progress-fill"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>

          <h3 className="quiz-question">{question.question}</h3>

          <div className="quiz-options">
            {question.options.map((option, optionIndex) => {
              const isAnswer = optionIndex === question.correctAnswer;
              const isSelected = selected === optionIndex;
              let stateClass = "";

              if (selected !== null && isAnswer) stateClass = "is-correct";
              else if (isSelected && !isAnswer) stateClass = "is-wrong";

              return (
                <button
                  type="button"
                  key={`${question.id}-${optionIndex}`}
                  className={`quiz-option ${stateClass}`}
                  onClick={() => answerQuestion(optionIndex)}
                  disabled={selected !== null}
                  aria-pressed={isSelected}
                >
                  <span className="quiz-option-letter">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span>{option}</span>
                  {selected !== null && isAnswer && <span aria-label="Đáp án đúng">✓</span>}
                  {isSelected && !isAnswer && <span aria-label="Bạn đã chọn sai">✕</span>}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div
              key={animationKey}
              className={`quiz-feedback ${
                feedback.correct ? "feedback-correct" : "feedback-wrong"
              }`}
              role="status"
              aria-live="polite"
            >
              <span className="quiz-feedback-icon" aria-hidden="true">
                {feedback.icon}
              </span>
              <div>
                <strong>{feedback.text}</strong>
                <p>
                  {feedback.correct
                    ? streak >= 3
                      ? `Tuyệt vời! Bạn đã đúng ${streak} câu liên tiếp! 🔥`
                      : "Tiếp tục phát huy nhé!"
                    : "Đừng nản lòng, mình cùng học từ câu này nhé!"}
                </p>
              </div>
            </div>
          )}

          {selected !== null && question.explanation && (
            <div className="quiz-explanation">
              <button
                type="button"
                className="quiz-explanation-toggle"
                onClick={() => setShowExplanation((value) => !value)}
                aria-expanded={showExplanation}
              >
                💡 {showExplanation ? "Ẩn giải thích" : "Xem giải thích"}
              </button>
              {showExplanation && <p>{question.explanation}</p>}
            </div>
          )}

          {selected !== null && (
            <button
              type="button"
              className="quiz-next-button"
              onClick={nextQuestion}
            >
              {index === total - 1 ? "Xem kết quả 🏆" : "Câu tiếp theo →"}
            </button>
          )}
        </>
      ) : (
        <div className="quiz-result">
          <div className={`quiz-result-icon ${perfectScore ? "result-perfect" : ""}`}>
            {perfectScore ? "🏆" : percentage >= 70 ? "🎉" : "💪"}
          </div>
          <span className="quiz-eyebrow">HOÀN THÀNH BÀI TẬP</span>
          <h3>
            {perfectScore
              ? "HOÀN HẢO! Bạn là nhà vô địch!"
              : percentage >= 70
                ? "Làm tốt lắm! Hãy tiếp tục nhé!"
                : "Bạn đã hoàn thành! Cùng luyện tập thêm nhé!"}
          </h3>

          <div className="quiz-score">
            <strong>{correctCount}/{total}</strong>
            <span>câu trả lời đúng</span>
          </div>

          <div
            className="quiz-result-track"
            role="progressbar"
            aria-label="Điểm bài làm"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${percentage}%` }} />
          </div>

          <p className="quiz-result-message">
            Bạn đạt {percentage}% chính xác.
            {perfectScore
              ? " Thành tích xuất sắc, xin chúc mừng! 🎊"
              : " Mỗi lần luyện tập là một cơ hội tiến bộ."}
          </p>

          <div className="quiz-result-details">
            <span>✅ Đúng: {correctCount}</span>
            <span>❌ Sai: {wrongCount}</span>
            <span>🔥 Chuỗi đúng dài nhất: {bestStreak}</span>
          </div>

          <button type="button" className="quiz-next-button" onClick={restartQuiz}>
            ↻ Làm lại bài
          </button>
        </div>
      )}
    </section>
  );
}
