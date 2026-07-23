import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createRule, deleteRule, listRules, updateRule } from "../api/rules";
import type { Rule } from "../types";

const inputClass =
  "rounded-lg border border-navy-500 bg-navy-900 px-2 py-1.5 text-base text-ink-100 placeholder:text-ink-400 focus:border-accent-400 focus:outline-none";

export function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // 初回GETより先にユーザーが作成/編集/削除を行った場合、後から届く
  // 初回GETの結果でその変更を上書きしてしまわないためのガード。
  const mutationCountRef = useRef(0);

  useEffect(() => {
    const mutationCountAtRequest = mutationCountRef.current;
    listRules()
      .then((data) => {
        if (mutationCountRef.current === mutationCountAtRequest) {
          setRules(data);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    mutationCountRef.current += 1;
    try {
      const rule = await createRule({
        rule_text: newText,
        category: newCategory.trim() === "" ? null : newCategory.trim(),
        is_active: true,
      });
      setRules((prev) => [rule, ...prev]);
      setNewText("");
      setNewCategory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(rule: Rule) {
    setError(null);
    mutationCountRef.current += 1;
    // 即座に切り替わったように見せる（失敗時は元に戻す）
    const nextActive = !rule.is_active;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: nextActive } : r)),
    );
    try {
      const updated = await updateRule(rule.id, { is_active: nextActive });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r)),
      );
      setError(err instanceof Error ? err.message : "切り替えに失敗しました");
    }
  }

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setEditText(rule.rule_text);
    setEditCategory(rule.category ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(ruleId: number) {
    setError(null);
    setSavingEdit(true);
    mutationCountRef.current += 1;
    try {
      const updated = await updateRule(ruleId, {
        rule_text: editText,
        category: editCategory.trim() === "" ? null : editCategory.trim(),
      });
      setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(ruleId: number) {
    if (!confirm("このルールを削除しますか？")) return;
    setError(null);
    mutationCountRef.current += 1;
    try {
      await deleteRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-heading text-xl font-bold text-ink-100">ルール管理</h1>
          <Link to="/races" className="text-sm text-ink-400 underline hover:text-ink-100">
            レース一覧へ
          </Link>
        </div>

        <form
          onSubmit={handleCreate}
          className="mb-6 flex flex-col gap-2 rounded-xl border border-navy-600 bg-navy-800 p-3 shadow-md shadow-black/20"
        >
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            新しいルール
            <textarea
              required
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="例：当地2連対率トップ艇は頭候補から消さない"
              rows={2}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            カテゴリ（任意）
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="例：当地成績"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="w-fit rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white shadow-md shadow-accent-500/20 hover:bg-accent-600 disabled:opacity-50"
          >
            {creating ? "追加中..." : "+ ルールを追加"}
          </button>
        </form>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {loading && <p className="text-ink-400">読み込み中...</p>}
        {!loading && rules.length === 0 && <p className="text-ink-400">まだルールが登録されていません。</p>}

        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="rounded-xl border border-navy-600 bg-navy-800 p-3 shadow-md shadow-black/20"
            >
              {editingId === rule.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="カテゴリ（任意）"
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(rule.id)}
                      disabled={savingEdit}
                      className="rounded-lg bg-accent-500 px-3 py-1 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-navy-500 px-3 py-1 text-sm text-ink-300 hover:text-ink-100"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className={rule.is_active ? "text-ink-100" : "text-ink-400 line-through"}>
                      {rule.rule_text}
                    </p>
                    {rule.category && (
                      <span className="mt-1 inline-block rounded-full bg-navy-700 px-2 py-0.5 text-xs text-ink-300">
                        {rule.category}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <label className="flex items-center gap-1 text-xs text-ink-300">
                      <input
                        type="checkbox"
                        checked={rule.is_active}
                        onChange={() => handleToggleActive(rule)}
                      />
                      有効
                    </label>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => startEdit(rule)}
                        className="text-accent-400 underline"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-400 underline"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
