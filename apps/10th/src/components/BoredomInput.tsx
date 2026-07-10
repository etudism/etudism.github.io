import { useState } from "react";
import {
  MAX_READER_INPUT_LENGTH,
  MIN_READER_INPUT_LENGTH,
} from "../narrative/constants";

interface BoredomInputProps {
  initialValue?: string;
  disabled?: boolean;
  onSubmit: (readerInput: string) => void;
}

export function BoredomInput({
  initialValue = "",
  disabled = false,
  onSubmit,
}: BoredomInputProps) {
  const [value, setValue] = useState(initialValue);
  const [submitted, setSubmitted] = useState(false);
  const trimmed = value.trim();
  const tooShort = trimmed.length < MIN_READER_INPUT_LENGTH;
  const tooLong = value.length > MAX_READER_INPUT_LENGTH;
  const showError = submitted && (tooShort || tooLong);

  return (
    <section className="intro-panel" aria-labelledby="boredom-heading">
      <p className="eyebrow">THE FIRST PAGE</p>
      <h1 id="boredom-heading">あなたが今退屈しているのは？</h1>
      <p className="lead">入力した内容は、この端末の中で物語へ変換されます。</p>
      <form
        className="input-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (!tooShort && !tooLong) onSubmit(trimmed);
        }}
        noValidate
      >
        <label htmlFor="reader-input" className="field-label">
          いま感じている停滞や、変わらなさ
        </label>
        <textarea
          id="reader-input"
          name="reader-input"
          rows={6}
          value={value}
          disabled={disabled}
          maxLength={MAX_READER_INPUT_LENGTH + 40}
          aria-describedby="reader-input-help reader-input-count reader-input-error"
          aria-invalid={showError}
          onChange={(event) => setValue(event.target.value)}
          placeholder="短い言葉でもかまいません"
        />
        <div className="field-meta">
          <span id="reader-input-help">5〜300文字で入力してください。</span>
          <span
            id="reader-input-count"
            className={tooLong ? "text-error" : undefined}
          >
            {value.length} / {MAX_READER_INPUT_LENGTH}
          </span>
        </div>
        <p id="reader-input-error" className="field-error" aria-live="polite">
          {showError
            ? tooLong
              ? "300文字以内に収めてください。"
              : "空白を除いて5文字以上入力してください。"
            : ""}
        </p>
        <button className="button primary" type="submit" disabled={disabled}>
          物語の入口へ
        </button>
      </form>
    </section>
  );
}
