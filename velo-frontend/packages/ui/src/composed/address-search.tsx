"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";

export type AddressSuggestion = {
  label: string;
  fullAddress?: string;
  lat: number;
  lon: number;
  type: string;
};

export type AddressSearchOption = AddressSuggestion & { title?: string };
export type AddressSearchRequest = (query: string, near?: string) => Promise<AddressSuggestion[]>;

export function AddressSearch({
  className,
  label,
  near,
  onSelect,
  onValueChange,
  placeholder,
  preSearchLabel = "Recent places",
  preSearchPlaces = [],
  search,
  selected,
  value,
}: {
  label: string;
  value: string;
  selected: boolean;
  near?: string;
  placeholder?: string;
  className?: string;
  preSearchLabel?: string;
  preSearchPlaces?: AddressSearchOption[];
  search: AddressSearchRequest;
  onValueChange: (value: string) => void;
  onSelect: (suggestion: AddressSearchOption) => void;
}) {
  const inputId = `address-search-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const listId = `${inputId}-results`;
  const optionPrefix = `${inputId}-option`;
  const requestId = useRef(0);
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const options: AddressSearchOption[] = hasSearched ? results : preSearchPlaces;

  function selectOption(option: AddressSearchOption): void {
    requestId.current += 1;
    setOpen(false);
    setActiveIndex(-1);
    onSelect(option);
  }

  async function submitSearch(): Promise<void> {
    const query = value.trim();
    if (selected || query.length < 3) {
      setError(query.length < 3 ? "Enter at least 3 characters to search." : null);
      return;
    }
    const currentRequest = ++requestId.current;
    setHasSearched(true);
    setResults([]);
    setActiveIndex(-1);
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const nextResults = await search(query, near);
      if (requestId.current === currentRequest) setResults(nextResults);
    } catch (searchError) {
      if (requestId.current === currentRequest) {
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "Couldn't search addresses. Try again.");
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown" && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % options.length);
    } else if (event.key === "ArrowUp" && options.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && activeIndex >= 0 && options[activeIndex]) {
        selectOption(options[activeIndex]);
      } else {
        void submitSearch();
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    requestId.current += 1;
    setResults([]);
    setHasSearched(false);
    setError(null);
    setLoading(false);
    setActiveIndex(-1);
    setOpen(true);
    onValueChange(event.target.value);
  }

  const showList = open && options.length > 0;

  return (
    <div className={cn("address-search", showList && "address-search--open", className)}>
      <label className="ui-field-label" htmlFor={inputId}>{label}</label>
      <div className="address-search-controls">
        <input
          id={inputId}
          className="ui-control"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList && activeIndex >= 0 ? `${optionPrefix}-${activeIndex}` : undefined}
          aria-busy={loading}
          autoComplete="off"
          value={value}
          placeholder={placeholder ?? "Search an address"}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
        />
        <button
          className="address-search-submit"
          type="button"
          disabled={loading || selected || value.trim().length < 3}
          onClick={() => void submitSearch()}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      {loading ? <p className="address-search-status" role="status">Searching addresses…</p> : null}
      {error ? <p className="address-search-error" role="status">{error}</p> : null}
      {!loading && !error && hasSearched && results.length === 0 ? (
        <p className="address-search-status" role="status">No matching addresses.</p>
      ) : null}
      {showList ? (
        <div className="address-search-popup">
          {!hasSearched && preSearchLabel ? <p className="address-search-group-label">{preSearchLabel}</p> : null}
          {hasSearched ? <p className="address-search-group-label">Search results</p> : null}
          <ul id={listId} className="address-search-list" role="listbox" aria-label={`${label} places`}>
            {options.map((option, index) => (
              <li
                id={`${optionPrefix}-${index}`}
                key={`${option.lat}:${option.lon}:${option.label}:${option.title ?? ""}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                {option.title ? <strong>{option.title}</strong> : null}
                <span>{option.label}</span>
                {option.type ? <small>{option.type}</small> : null}
              </li>
            ))}
          </ul>
          {hasSearched ? (
            <p className="address-search-attribution">Address data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
