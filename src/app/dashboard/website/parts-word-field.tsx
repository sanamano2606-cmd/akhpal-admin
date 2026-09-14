"use client";

import type { WebsiteField } from "@/lib/website-fields";

/**
 * One box on a Website screen.
 *
 * It shows how many characters are left, because the server refuses anything
 * over the limit and finding that out only after pressing Save - having typed
 * a paragraph - is a miserable way to learn about it.
 */
export function WordField({
  field,
  value,
  onChange,
  placeholder,
}: {
  field: WebsiteField;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const used = value.trim().length;
  const over = used > field.max;
  const near = !over && used > field.max * 0.9;

  return (
    <div>
      <label className="block text-sm font-semibold text-takal-ink" htmlFor={field.key}>
        {field.label}
      </label>
      <p className="text-xs text-takal-ink-soft mt-1">{field.hint}</p>

      {field.long ? (
        <textarea
          id={field.key}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${
            over ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
        />
      ) : (
        <input
          id={field.key}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${
            over ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
        />
      )}

      <div className="mt-1 flex items-center justify-between text-xs">
        {/* An empty box is not a mistake, so it must not look like one. It
            means "use the wording already built into the website". */}
        <span className="text-takal-ink-soft">
          {used === 0 ? "Empty — the website uses its own wording" : " "}
        </span>
        <span className={over ? "text-red-600 font-semibold" : near ? "text-amber-600" : "text-gray-400"}>
          {used} / {field.max}
        </span>
      </div>
    </div>
  );
}
