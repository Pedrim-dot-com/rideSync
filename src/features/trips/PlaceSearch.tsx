import { useEffect, useId, useState } from "react";
import { geocoding, type Place } from "../../shared/maps/providers";
export function PlaceSearch({
  label,
  value,
  onChange,
  onSelect,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: Place) => void;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!focused || value.trim().length < 3) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setState("loading");
      void geocoding
        .search(value.trim(), abort.signal)
        .then((places) => {
          if (!abort.signal.aborted) {
            setResults(places);
            setState("done");
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            setResults([]);
            setState("error");
          }
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [value, focused]);
  function choose(place: Place) {
    onSelect(place);
    setFocused(false);
    setResults([]);
    setActive(-1);
    setState("idle");
  }
  const visible = focused && value.trim().length >= 3;
  return (
    <div className="place-search">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        maxLength={120}
        required
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={visible && results.length > 0}
        aria-controls={`${id}-results`}
        aria-activedescendant={
          active >= 0 && visible ? `${id}-option-${active}` : undefined
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setResults([]);
          setActive(-1);
          setState("idle");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setFocused(false);
            return;
          }
          if (e.key === "ArrowDown" && visible && results.length) {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          }
          if (e.key === "ArrowUp" && visible && results.length) {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
          if (e.key === "Enter" && visible && active >= 0 && results[active]) {
            e.preventDefault();
            choose(results[active]);
          }
        }}
      />
      {visible && (
        <>
          {state === "loading" && (
            <small role="status">A pesquisar lugares…</small>
          )}
          {state === "error" && (
            <small role="status">
              Pesquisa indisponível. Podes preencher as coordenadas manualmente.
            </small>
          )}
          {state === "done" && results.length === 0 && (
            <small role="status">
              Nenhum lugar encontrado. Revê a pesquisa ou usa coordenadas.
            </small>
          )}
          <ul
            id={`${id}-results`}
            role="listbox"
            aria-label={`Sugestões para ${label}`}
          >
            {results.map((place, index) => (
              <li
                role="presentation"
                key={`${place.label}-${place.latitude}-${place.longitude}`}
              >
                <button
                  type="button"
                  role="option"
                  id={`${id}-option-${index}`}
                  tabIndex={-1}
                  aria-selected={index === active}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    choose(place);
                  }}
                  onClick={() => choose(place)}
                >
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
