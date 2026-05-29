/**
 * Font Picker Component (Radix UI)
 *
 * A dropdown selector for choosing font families using Radix Select.
 */

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './Select';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n';

// ============================================================================
// TYPES
// ============================================================================

export interface FontOption {
  name: string;
  fontFamily: string;
  category?: 'sans-serif' | 'serif' | 'monospace' | 'other';
}

export interface FontPickerProps {
  value?: string;
  onChange?: (fontFamily: string) => void;
  fonts?: FontOption[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  width?: number | string;
  showPreview?: boolean;
}

// ============================================================================
// DEFAULT FONTS
// ============================================================================

// Note: `fontFamily` is the CSS stack used only for the in-dropdown preview.
// The value emitted on selection is the clean font `name` (see handleValueChange),
// which is what gets stored in w:rFonts. Fallback stacks for rendering are derived
// at paint time from the name via the core font resolver.
const DEFAULT_FONTS: FontOption[] = [
  // Sans-serif
  { name: 'Arial', fontFamily: 'Arial, Helvetica, sans-serif', category: 'sans-serif' },
  { name: 'Calibri', fontFamily: '"Calibri", Arial, sans-serif', category: 'sans-serif' },
  { name: 'Helvetica', fontFamily: 'Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { name: 'Tahoma', fontFamily: 'Tahoma, Geneva, sans-serif', category: 'sans-serif' },
  {
    name: 'Trebuchet MS',
    fontFamily: '"Trebuchet MS", Helvetica, sans-serif',
    category: 'sans-serif',
  },
  { name: 'Verdana', fontFamily: 'Verdana, Geneva, sans-serif', category: 'sans-serif' },
  { name: 'Open Sans', fontFamily: '"Open Sans", sans-serif', category: 'sans-serif' },
  { name: 'Roboto', fontFamily: 'Roboto, sans-serif', category: 'sans-serif' },
  // Serif (legal-document fonts grouped here: Times New Roman, Century Schoolbook,
  // Bookman Old Style, Book Antiqua, Palatino Linotype, Garamond, etc.)
  { name: 'Times New Roman', fontFamily: '"Times New Roman", Times, serif', category: 'serif' },
  {
    name: 'Century Schoolbook',
    fontFamily: '"Century Schoolbook", "Noto Serif", Georgia, serif',
    category: 'serif',
  },
  {
    name: 'Bookman Old Style',
    fontFamily: '"Bookman Old Style", "Noto Serif", Georgia, serif',
    category: 'serif',
  },
  {
    name: 'Book Antiqua',
    fontFamily: '"Book Antiqua", Palatino, Georgia, serif',
    category: 'serif',
  },
  {
    name: 'Palatino Linotype',
    fontFamily: '"Palatino Linotype", Palatino, Georgia, serif',
    category: 'serif',
  },
  { name: 'Georgia', fontFamily: 'Georgia, serif', category: 'serif' },
  { name: 'Cambria', fontFamily: 'Cambria, Georgia, serif', category: 'serif' },
  { name: 'Garamond', fontFamily: 'Garamond, serif', category: 'serif' },
  // Monospace
  { name: 'Courier New', fontFamily: '"Courier New", Courier, monospace', category: 'monospace' },
  { name: 'Consolas', fontFamily: 'Consolas, monospace', category: 'monospace' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function FontPicker({
  value,
  onChange,
  fonts = DEFAULT_FONTS,
  disabled = false,
  className,
  placeholder = 'Arial',
  width = 120,
  showPreview = true,
}: FontPickerProps) {
  const { t } = useTranslation();
  // Find current font name for display
  const displayValue = React.useMemo(() => {
    if (!value) return placeholder;
    const font = fonts.find(
      (f) => f.fontFamily === value || f.name.toLowerCase() === value.toLowerCase()
    );
    return font?.name || value;
  }, [value, fonts, placeholder]);

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      const font = fonts.find((f) => f.name === newValue);
      // Emit the clean font name (not the CSS preview stack) so it is stored
      // verbatim in w:rFonts. Rendering fallbacks are derived from the name by
      // the core font resolver; emitting the stack here corrupts the saved font.
      onChange?.(font ? font.name : newValue);
    },
    [onChange, fonts]
  );

  // Group fonts by category
  const groupedFonts = React.useMemo(() => {
    const groups: Record<string, FontOption[]> = {
      'sans-serif': [],
      serif: [],
      monospace: [],
      other: [],
    };
    fonts.forEach((font) => {
      const category = font.category || 'other';
      groups[category].push(font);
    });
    return groups;
  }, [fonts]);

  return (
    <Select value={displayValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn('h-8 text-sm', className)}
        style={{ minWidth: typeof width === 'number' ? `${width}px` : width }}
        aria-label={t('font.selectAriaLabel')}
      >
        <SelectValue placeholder={placeholder}>{displayValue}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {groupedFonts['sans-serif'].length > 0 && (
          <SelectGroup>
            <SelectLabel>{t('font.sansSerif')}</SelectLabel>
            {groupedFonts['sans-serif'].map((font) => (
              <SelectItem
                key={font.name}
                value={font.name}
                style={showPreview ? { fontFamily: font.fontFamily } : undefined}
              >
                {font.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {groupedFonts['serif'].length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{t('font.serif')}</SelectLabel>
              {groupedFonts['serif'].map((font) => (
                <SelectItem
                  key={font.name}
                  value={font.name}
                  style={showPreview ? { fontFamily: font.fontFamily } : undefined}
                >
                  {font.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
        {groupedFonts['monospace'].length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{t('font.monospace')}</SelectLabel>
              {groupedFonts['monospace'].map((font) => (
                <SelectItem
                  key={font.name}
                  value={font.name}
                  style={showPreview ? { fontFamily: font.fontFamily } : undefined}
                >
                  {font.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
