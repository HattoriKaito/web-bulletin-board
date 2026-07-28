import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const inputClass =
  "rounded-lg border border-navy-500 bg-navy-900 px-3 py-2 text-ink-100 focus:border-accent-400 focus:outline-none";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password, displayName);
      navigate("/races");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-navy-950 p-4">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <h1 className="font-heading text-3xl font-bold text-ink-100">BoatAI</h1>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-xl border border-navy-600 bg-navy-800 p-4 shadow-md shadow-black/20"
        >
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            表示名
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            メールアドレス
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            パスワード
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <span className="text-xs text-ink-400">8文字以上で入力してください</span>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent-500 px-3 py-2 font-medium text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600 disabled:opacity-50"
          >
            {submitting ? "登録中..." : "新規登録"}
          </button>
        </form>
        <p className="text-center text-sm text-ink-400">
          すでにアカウントをお持ちの方は{" "}
          <Link to="/login" className="text-accent-400 underline">
            ログインはこちら
          </Link>
        </p>
      </div>
    </div>
  );
}
