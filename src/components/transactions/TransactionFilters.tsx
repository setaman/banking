import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import type { TransactionCategory } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

export interface TransactionFilters {
  categories: TransactionCategory[];
  minAmount?: number;
  maxAmount?: number;
  searchQuery: string;
  dateFrom?: Date;
  dateTo?: Date;
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  className?: string;
}

type DatePreset = '7days' | '30days' | '3months' | 'year' | 'custom';

/**
 * TransactionFilters - Filter bar for transactions
 * 
 * Features:
 * - Multi-select category filter
 * - Amount range filter (min/max)
 * - Search by description/merchant
 * - Date range picker with presets
 * - Clear all filters button
 * 
 * @example
 * ```tsx
 * const [filters, setFilters] = useState<TransactionFilters>({
 *   categories: [],
 *   searchQuery: '',
 * });
 * 
 * <TransactionFilters filters={filters} onChange={setFilters} />
 * ```
 */
export function TransactionFilters({ filters, onChange, className }: TransactionFiltersProps) {
  const { categories, getCategoryInfo } = useCategories();
  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Toggle category selection
  const toggleCategory = (category: TransactionCategory) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    
    onChange({ ...filters, categories: newCategories });
  };

  // Update search query
  const handleSearchChange = (value: string) => {
    onChange({ ...filters, searchQuery: value });
  };

  // Update amount range
  const handleMinAmountChange = (value: string) => {
    const amount = value ? parseFloat(value) * 100 : undefined; // Convert to cents
    onChange({ ...filters, minAmount: amount });
  };

  const handleMaxAmountChange = (value: string) => {
    const amount = value ? parseFloat(value) * 100 : undefined; // Convert to cents
    onChange({ ...filters, maxAmount: amount });
  };

  // Apply date preset
  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined = new Date(now);

    switch (preset) {
      case '7days':
        dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - 7);
        break;
      case '30days':
        dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - 30);
        break;
      case '3months':
        dateFrom = new Date(now);
        dateFrom.setMonth(dateFrom.getMonth() - 3);
        break;
      case 'year':
        dateFrom = new Date(now);
        dateFrom.setFullYear(dateFrom.getFullYear() - 1);
        break;
      case 'custom':
        dateFrom = undefined;
        dateTo = undefined;
        break;
    }

    onChange({ ...filters, dateFrom, dateTo });
  };

  // Update custom date range
  const handleDateFromChange = (value: string) => {
    const date = value ? new Date(value) : undefined;
    onChange({ ...filters, dateFrom: date });
    if (date) setDatePreset('custom');
  };

  const handleDateToChange = (value: string) => {
    const date = value ? new Date(value) : undefined;
    onChange({ ...filters, dateTo: date });
    if (date) setDatePreset('custom');
  };

  // Clear all filters
  const clearAllFilters = () => {
    onChange({
      categories: [],
      searchQuery: '',
      minAmount: undefined,
      maxAmount: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
    setDatePreset('30days');
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.categories.length > 0 ||
      filters.searchQuery.length > 0 ||
      filters.minAmount !== undefined ||
      filters.maxAmount !== undefined ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined
    );
  }, [filters]);

  return (
    <div className={cn('space-y-4 p-4 bg-muted/50 rounded-lg border', className)}>
      {/* Search and Clear */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Search description or merchant..."
          value={filters.searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1"
        />
        {hasActiveFilters && (
          <Button variant="outline" onClick={clearAllFilters}>
            Clear All
          </Button>
        )}
      </div>

      {/* Date Range Presets */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-muted-foreground self-center">Period:</span>
        {(['7days', '30days', '3months', 'year'] as DatePreset[]).map((preset) => (
          <Button
            key={preset}
            variant={datePreset === preset ? 'default' : 'outline'}
            size="sm"
            onClick={() => applyDatePreset(preset)}
          >
            {preset === '7days' && 'Last 7 days'}
            {preset === '30days' && 'Last 30 days'}
            {preset === '3months' && 'Last 3 months'}
            {preset === 'year' && 'This year'}
          </Button>
        ))}
        <Button
          variant={datePreset === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => applyDatePreset('custom')}
        >
          Custom
        </Button>
      </div>

      {/* Custom Date Range */}
      {datePreset === 'custom' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              type="date"
              value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
              onChange={(e) => handleDateFromChange(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              type="date"
              value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
              onChange={(e) => handleDateToChange(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Amount Range */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground">Min Amount (€)</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={filters.minAmount !== undefined ? (filters.minAmount / 100).toFixed(2) : ''}
            onChange={(e) => handleMinAmountChange(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground">Max Amount (€)</label>
          <Input
            type="number"
            step="0.01"
            placeholder="999.99"
            value={filters.maxAmount !== undefined ? (filters.maxAmount / 100).toFixed(2) : ''}
            onChange={(e) => handleMaxAmountChange(e.target.value)}
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Categories</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            {showCategoryDropdown ? 'Hide' : 'Show'} Categories
          </Button>
        </div>

        {/* Selected Categories */}
        {filters.categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.categories.map((category) => {
              const info = getCategoryInfo(category);
              return (
                <Badge
                  key={category}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/60"
                  onClick={() => toggleCategory(category)}
                >
                  <span>{info.icon}</span>
                  <span className="ml-1">{info.label}</span>
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              );
            })}
          </div>
        )}

        {/* Category Selection Grid */}
        {showCategoryDropdown && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-3 bg-background rounded-md border">
            {categories.map((categoryInfo) => {
              const isSelected = filters.categories.includes(categoryInfo.value);
              return (
                <button
                  key={categoryInfo.value}
                  onClick={() => toggleCategory(categoryInfo.value)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md border text-sm transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input'
                  )}
                >
                  <span>{categoryInfo.icon}</span>
                  <span className="truncate">{categoryInfo.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="text-xs text-muted-foreground">
          {filters.categories.length > 0 && (
            <span>{filters.categories.length} categor{filters.categories.length === 1 ? 'y' : 'ies'} • </span>
          )}
          {filters.searchQuery && <span>Search: &quot;{filters.searchQuery}&quot; • </span>}
          {(filters.minAmount !== undefined || filters.maxAmount !== undefined) && <span>Amount range • </span>}
          {(filters.dateFrom || filters.dateTo) && <span>Date range • </span>}
          Active
        </div>
      )}
    </div>
  );
}
