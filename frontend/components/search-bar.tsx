"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);
  const debouncedValue = useDebounce(inputValue, 500);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    onChange(debouncedValue);
  }, [debouncedValue, onChange]);

  return (
    <div className="w-full max-w-md">
      <label className="sr-only" htmlFor="search-items">
        搜索文章
      </label>
      <Input
        id="search-items"
        placeholder="搜索标题或摘要..."
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
      />
    </div>
  );
}
