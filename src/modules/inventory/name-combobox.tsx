"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

const MAX_SHOWN = 8;

/** Type freely, or pick a name already saved in this office. */
export function NameCombobox({
  id,
  value,
  names,
  onChange,
}: {
  id: string;
  value: string;
  names: readonly string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = value.trim().toLowerCase();
  const matches = names.filter((name) => name.toLowerCase().includes(typed) && name.toLowerCase() !== typed).slice(0, MAX_SHOWN);
  const showing = open && matches.length > 0;

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <Input
        id={id}
        required
        role="combobox"
        aria-expanded={showing}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        aria-activedescendant={showing && active >= 0 ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (!showing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((active + step + matches.length) % matches.length);
          }
          // Only when a suggestion is highlighted. Otherwise Enter saves the form as usual.
          if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            pick(matches[active]);
          }
        }}
      />
      {showing && (
        <ul id={`${id}-options`} role="listbox" aria-label="Saved names" className="bg-popover text-popover-foreground shadow-overlay absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border p-1 text-sm">
          {matches.map((name, index) => (
            <li
              key={name}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              className={`cursor-pointer truncate rounded-md px-2 py-1.5 ${index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}`}
              // Before the input loses focus, which would close the list first.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(name);
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
