/**
 * TagAutocomplete - Multi-select tag input with autocomplete
 * 
 * Allows adding/removing tags with suggestions from previously used tags.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface TagAutocompleteProps {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
    suggestions: string[];
    placeholder?: string;
    disabled?: boolean;
}

export default function TagAutocomplete({
    tags,
    onTagsChange,
    suggestions,
    placeholder = 'Etiket ekle...',
    disabled = false
}: TagAutocompleteProps) {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter suggestions: match input and exclude already selected tags
    const filteredSuggestions = suggestions.filter(s =>
        s.toLowerCase().includes(inputValue.toLowerCase()) &&
        !tags.includes(s)
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset highlighted index when suggestions change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [filteredSuggestions.length]);

    const addTag = (tag: string) => {
        const trimmedTag = tag.trim();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            onTagsChange([...tags, trimmedTag]);
        }
        setInputValue('');
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const removeTag = (tagToRemove: string) => {
        onTagsChange(tags.filter(t => t !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
                addTag(filteredSuggestions[highlightedIndex]);
            } else if (inputValue.trim()) {
                addTag(inputValue);
            }
            return;
        }

        if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
            return;
        }

        if (!isOpen || filteredSuggestions.length === 0) {
            if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
                setIsOpen(true);
                setHighlightedIndex(0);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredSuggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    return (
        <div className="relative">
            {/* Tags display */}
            <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, idx) => (
                    <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-sm"
                    >
                        {tag}
                        {!disabled && (
                            <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ml-2 hover:text-primary-900"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </span>
                ))}
            </div>

            {/* Input with autocomplete */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={e => {
                        setInputValue(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="input w-full"
                />

                {isOpen && filteredSuggestions.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 w-full mt-1 bg-dark-800/60 border border-white/[0.06] rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                        {filteredSuggestions.map((suggestion, index) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => addTag(suggestion)}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-primary-50 transition-colors ${
                                    index === highlightedIndex ? 'bg-primary-100 text-primary-700' : 'text-gray-300'
                                }`}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
