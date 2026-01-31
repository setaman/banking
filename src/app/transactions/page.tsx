"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
} from "date-fns";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  X,
  ShoppingCart,
  Home,
  CreditCard,
  Bus,
  Film,
  Heart,
  ShoppingBag,
  Coffee,
  Repeat,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { getTransactions } from "@/actions/transactions.actions";
import { getAccounts } from "@/actions/accounts.actions";
import { categorizeTransaction, CATEGORIES } from "@/lib/stats/categories";
import type { UnifiedTransaction, UnifiedAccount } from "@/lib/banking/types";
import { cn } from "@/lib/utils";
import type { DateRangePreset } from "@/hooks/use-date-range";

type SortField =
  | "date"
  | "description"
  | "counterparty"
  | "category"
  | "amount"
  | "account";
type SortDirection = "asc" | "desc";

function TransactionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 50;

  // add local preset state for the DateRangePicker
  const [pickerPreset, setPickerPreset] = useState<DateRangePreset>(
    // default to custom if URL already has dateFrom/dateTo, otherwise allTime (unset)
    searchParams.get("dateFrom") || searchParams.get("dateTo")
      ? "custom"
      : "allTime"
  );

  // URL-based state
  const searchQuery = searchParams.get("search") || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const sortField = (searchParams.get("sort") as SortField) || "date";
  const sortDirection = (searchParams.get("dir") as SortDirection) || "desc";
  const selectedCategories = useMemo(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const selectedAccounts = useMemo(
    () => searchParams.get("accounts")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const minAmount = searchParams.get("minAmount")
    ? parseFloat(searchParams.get("minAmount")!)
    : undefined;
  const maxAmount = searchParams.get("maxAmount")
    ? parseFloat(searchParams.get("maxAmount")!)
    : undefined;
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;

  // Local state for filter inputs
  const [minAmountInput, setMinAmountInput] = useState(
    minAmount?.toString() || ""
  );
  const [maxAmountInput, setMaxAmountInput] = useState(
    maxAmount?.toString() || ""
  );

  // Helper function to update URL params
  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "" || value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    router.push(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [txData, accountData] = await Promise.all([
          getTransactions(),
          getAccounts(),
        ]);
        setTransactions(txData);
        setAccounts(accountData);
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Create account lookup map
  const accountMap = useMemo(() => {
    const map = new Map<string, UnifiedAccount>();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  // Filter transactions based on all filters
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.description.toLowerCase().includes(query) ||
          tx.counterparty.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((tx) => {
        const category = categorizeTransaction(tx);
        return selectedCategories.includes(category);
      });
    }

    // Account filter
    if (selectedAccounts.length > 0) {
      filtered = filtered.filter((tx) =>
        selectedAccounts.includes(tx.accountId)
      );
    }

    // Amount range filter
    if (minAmount !== undefined) {
      filtered = filtered.filter((tx) => Math.abs(tx.amount) >= minAmount);
    }
    if (maxAmount !== undefined) {
      filtered = filtered.filter((tx) => Math.abs(tx.amount) <= maxAmount);
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter((tx) => tx.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((tx) => tx.date <= dateTo);
    }

    return filtered;
  }, [
    transactions,
    searchQuery,
    selectedCategories,
    selectedAccounts,
    minAmount,
    maxAmount,
    dateFrom,
    dateTo,
  ]);

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];

    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "date":
          aValue = a.date;
          bValue = b.date;
          break;
        case "description":
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case "counterparty":
          aValue = a.counterparty.toLowerCase();
          bValue = b.counterparty.toLowerCase();
          break;
        case "category":
          aValue = categorizeTransaction(a).toLowerCase();
          bValue = categorizeTransaction(b).toLowerCase();
          break;
        case "amount":
          aValue = Math.abs(a.amount);
          bValue = Math.abs(b.amount);
          break;
        case "account":
          aValue = accountMap.get(a.accountId)?.name.toLowerCase() || "";
          bValue = accountMap.get(b.accountId)?.name.toLowerCase() || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredTransactions, sortField, sortDirection, accountMap]);

  // Paginate transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedTransactions.slice(startIndex, endIndex);
  }, [sortedTransactions, currentPage]);

  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    const newDirection =
      sortField === field ? (sortDirection === "asc" ? "desc" : "asc") : "desc";
    updateParams({
      sort: field,
      dir: newDirection,
      page: "1",
    });
  };

  const handlePageChange = (page: number) => {
    updateParams({ page: page.toString() });
  };

  const handleSearchChange = (value: string) => {
    updateParams({
      search: value,
      page: "1",
    });
  };

  const toggleCategory = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];

    updateParams({
      categories: newCategories.join(","),
      page: "1",
    });
  };

  const toggleAccount = (accountId: string) => {
    const newAccounts = selectedAccounts.includes(accountId)
      ? selectedAccounts.filter((a) => a !== accountId)
      : [...selectedAccounts, accountId];

    updateParams({
      accounts: newAccounts.join(","),
      page: "1",
    });
  };

  const handleAmountFilterApply = () => {
    updateParams({
      minAmount: minAmountInput || undefined,
      maxAmount: maxAmountInput || undefined,
      page: "1",
    });
  };

  const handleDateRangeChange = (
    from: Date | undefined,
    to: Date | undefined
  ) => {
    updateParams({
      dateFrom: from ? format(from, "yyyy-MM-dd") : undefined,
      dateTo: to ? format(to, "yyyy-MM-dd") : undefined,
      page: "1",
    });
  };

  const clearAllFilters = () => {
    setMinAmountInput("");
    setMaxAmountInput("");
    setPickerPreset("allTime");
    router.push("/transactions");
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedCategories.length > 0) count++;
    if (selectedAccounts.length > 0) count++;
    if (minAmount !== undefined || maxAmount !== undefined) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [
    searchQuery,
    selectedCategories,
    selectedAccounts,
    minAmount,
    maxAmount,
    dateFrom,
    dateTo,
  ]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ChevronsUpDown className="ml-1 inline-block h-4 w-4 opacity-30" />
      );
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 inline-block h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 inline-block h-4 w-4" />
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const getAmountColor = (amount: number) => {
    if (amount < 0) return "text-red-500 dark:text-red-400";
    if (amount > 0) return "text-green-500 dark:text-green-400";
    return "text-foreground";
  };

  const getCategoryIcon = (category: string) => {
    const iconClass = "h-4 w-4";
    switch (category) {
      case "Groceries":
        return <ShoppingCart className={iconClass} />;
      case "Rent":
        return <Home className={iconClass} />;
      case "Bills":
        return <CreditCard className={iconClass} />;
      case "Transport":
        return <Bus className={iconClass} />;
      case "Entertainment":
        return <Film className={iconClass} />;
      case "Healthcare":
        return <Heart className={iconClass} />;
      case "Shopping":
        return <ShoppingBag className={iconClass} />;
      case "Dining":
        return <Coffee className={iconClass} />;
      case "Subscriptions":
        return <Repeat className={iconClass} />;
      case "Income":
        return <TrendingUp className={iconClass} />;
      default:
        return <MoreHorizontal className={iconClass} />;
    }
  };

  // NOTE: we intentionally avoid forcing pickerPreset from URL on every searchParams change
  // Initial state is already derived from search params; when the user picks a preset we set
  // the local pickerPreset and update the URL. When clearing filters we reset to the default.

  // Compute the range to pass into the DateRangePicker: prefer URL values, otherwise derive from the selected preset
  const pickerRange = useMemo(() => {
    if (dateFrom || dateTo) {
      return {
        from: dateFrom ? new Date(dateFrom) : new Date(),
        to: dateTo ? new Date(dateTo) : new Date(),
      };
    }

    const now = new Date();
    switch (pickerPreset) {
      case "last7days":
        return { from: subDays(now, 7), to: now };
      case "last30days":
        return { from: subDays(now, 30), to: now };
      case "thisMonth":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "lastMonth": {
        const lastMonth = subMonths(now, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      }
      case "thisYear":
        return { from: startOfYear(now), to: endOfYear(now) };
      case "lastYear": {
        const lastYear = subYears(now, 1);
        return { from: startOfYear(lastYear), to: endOfYear(lastYear) };
      }
      case "allTime":
        // 'All Time' represents no active date filter; DateRangePicker shows the preset label
        return { from: now, to: now };
      default:
        // If no preset chosen, default to a neutral same-day range (picker will show preset label if not custom)
        return { from: now, to: now };
    }
  }, [dateFrom, dateTo, pickerPreset]);

  // localRange mirrors pickerRange but updates immediately when user picks a preset/custom range
  const [localRange, setLocalRange] = useState(pickerRange);

  // sync localRange whenever derived pickerRange changes (e.g., after navigation completes)
  useEffect(() => {
    setLocalRange(pickerRange);
  }, [pickerRange.from.getTime(), pickerRange.to.getTime()]);

  // Map preset -> actual from/to dates and update URL
  const handlePresetChange = (preset: DateRangePreset) => {
    const now = new Date();
    let from: Date | undefined = undefined;
    let to: Date | undefined = undefined;

    switch (preset) {
      case "last7days":
        from = subDays(now, 7);
        to = now;
        break;
      case "last30days":
        from = subDays(now, 30);
        to = now;
        break;
      case "thisMonth":
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case "lastMonth": {
        const lastMonth = subMonths(now, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      }
      case "thisYear":
        from = startOfYear(now);
        to = endOfYear(now);
        break;
      case "lastYear": {
        const lastYear = subYears(now, 1);
        from = startOfYear(lastYear);
        to = endOfYear(lastYear);
        break;
      }
      case "allTime":
        // 'All Time' should clear the date filters (no dateFrom/dateTo in URL)
        from = undefined;
        to = undefined;
        break;
      default:
        from = undefined;
        to = undefined;
    }

    // update local picker preset so the picker shows the selected preset label
    setPickerPreset(preset);
    // update localRange immediately so the picker updates without waiting for router push
    setLocalRange({ from: from || new Date(), to: to || new Date() });

    handleDateRangeChange(from, to);
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-glow text-4xl font-bold tracking-tight">
          <span className="from-foreground to-foreground/50 bg-gradient-to-r bg-clip-text text-transparent">
            Transactions
          </span>
        </h1>
        <p className="text-muted-foreground">
          View and search all your banking transactions
        </p>
      </div>

      {/* Filters Section */}
      <Card className="shadow-primary/10 dark:shadow-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search by description or counterparty..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Controls - Desktop: Horizontal, Mobile: Vertical */}
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
              {/* Category Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      "bg-card/50 border-white/10 backdrop-blur-xl dark:border-white/5",
                      "hover:bg-card/70 hover:border-primary/20",
                      "transition-all duration-200",
                      selectedCategories.length > 0 && "border-primary/30"
                    )}
                  >
                    <Filter className="text-primary mr-2 h-4 w-4" />
                    Categories
                    {selectedCategories.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedCategories.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn(
                    "w-64 p-4",
                    "bg-card/95 border-white/10 backdrop-blur-xl dark:border-white/5",
                    "shadow-primary/5 shadow-xl"
                  )}
                  align="start"
                >
                  <div className="space-y-2">
                    <div className="mb-3 text-sm font-medium">
                      Filter by Category
                    </div>
                    {CATEGORIES.map((category) => (
                      <div
                        key={category}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`category-${category}`}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={() => toggleCategory(category)}
                        />
                        <label
                          htmlFor={`category-${category}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          {category}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Account Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      "bg-card/50 border-white/10 backdrop-blur-xl dark:border-white/5",
                      "hover:bg-card/70 hover:border-primary/20",
                      "transition-all duration-200",
                      selectedAccounts.length > 0 && "border-primary/30"
                    )}
                  >
                    <Filter className="text-primary mr-2 h-4 w-4" />
                    Accounts
                    {selectedAccounts.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedAccounts.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn(
                    "w-64 p-4",
                    "bg-card/95 border-white/10 backdrop-blur-xl dark:border-white/5",
                    "shadow-primary/5 shadow-xl"
                  )}
                  align="start"
                >
                  <div className="space-y-2">
                    <div className="mb-3 text-sm font-medium">
                      Filter by Account
                    </div>
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`account-${account.id}`}
                          checked={selectedAccounts.includes(account.id)}
                          onCheckedChange={() => toggleAccount(account.id)}
                        />
                        <label
                          htmlFor={`account-${account.id}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          {account.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Date Range Filter - render the dashboard picker directly (it manages its own popover) */}
              <div>
                <DateRangePicker
                  range={localRange}
                  preset={pickerPreset}
                  onPresetChange={handlePresetChange}
                  onCustomRangeChange={(range) => {
                    // update localRange immediately and mark as custom
                    setLocalRange({
                      from: range.from || new Date(),
                      to: range.to || new Date(),
                    });
                    setPickerPreset("custom");
                    handleDateRangeChange(range.from, range.to);
                    // Do not close anything here; the picker keeps the popover open for adjustments
                  }}
                />
              </div>

              {/* Amount Range Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      "bg-card/50 border-white/10 backdrop-blur-xl dark:border-white/5",
                      "hover:bg-card/70 hover:border-primary/20",
                      "transition-all duration-200",
                      (minAmount !== undefined || maxAmount !== undefined) &&
                        "border-primary/30"
                    )}
                  >
                    <Filter className="text-primary mr-2 h-4 w-4" />
                    Amount Range
                    {(minAmount !== undefined || maxAmount !== undefined) && (
                      <Badge variant="secondary" className="ml-2">
                        {minAmount !== undefined && maxAmount !== undefined
                          ? "2"
                          : "1"}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn(
                    "w-72 p-4",
                    "bg-card/95 border-white/10 backdrop-blur-xl dark:border-white/5",
                    "shadow-primary/5 shadow-xl"
                  )}
                  align="start"
                >
                  <div className="space-y-4">
                    <div className="text-sm font-medium">
                      Amount Range (EUR)
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">
                          Min Amount
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={minAmountInput}
                          onChange={(e) => setMinAmountInput(e.target.value)}
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-xs">
                          Max Amount
                        </label>
                        <Input
                          type="number"
                          placeholder="9999.99"
                          value={maxAmountInput}
                          onChange={(e) => setMaxAmountInput(e.target.value)}
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleAmountFilterApply}
                      size="sm"
                      className="w-full"
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Clear Filters Button */}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={clearAllFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear all
                  <Badge variant="outline" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="shadow-primary/10 dark:shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {filteredTransactions.length} Transaction
              {filteredTransactions.length !== 1 ? "s" : ""}
            </span>
            {filteredTransactions.length > 0 && (
              <span className="text-muted-foreground text-sm font-normal">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground">Loading transactions...</p>
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">
                {activeFilterCount > 0
                  ? "No transactions found matching your filters."
                  : "No transactions available."}
              </p>
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={clearAllFilters} size="sm">
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 dark:border-white/5">
                    <TableHead
                      className="hover:bg-accent/50 cursor-pointer select-none"
                      onClick={() => handleSort("date")}
                    >
                      Date{getSortIcon("date")}
                    </TableHead>
                    <TableHead
                      className="hover:bg-accent/50 cursor-pointer select-none"
                      onClick={() => handleSort("description")}
                    >
                      Description{getSortIcon("description")}
                    </TableHead>
                    <TableHead
                      className="hover:bg-accent/50 cursor-pointer select-none"
                      onClick={() => handleSort("category")}
                    >
                      Category{getSortIcon("category")}
                    </TableHead>
                    <TableHead
                      className="hover:bg-accent/50 cursor-pointer text-right select-none"
                      onClick={() => handleSort("amount")}
                    >
                      Amount{getSortIcon("amount")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((tx) => {
                    const category = categorizeTransaction(tx);

                    return (
                      <TableRow
                        key={tx.id}
                        className="hover:bg-accent/30 border-white/10 transition-colors dark:border-white/5"
                      >
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {format(new Date(tx.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="flex items-center gap-3">
                            {/* Merchant logo or placeholder */}
                            <div className="bg-muted/50 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10">
                              {(() => {
                                const merchantLogo = (tx.raw as any)?.attributes
                                  ?.merchant?.logo?.url;
                                return merchantLogo ? (
                                  <img
                                    src={merchantLogo}
                                    alt={tx.counterparty || "Merchant"}
                                    className="h-full w-full object-contain"
                                    onError={(e) => {
                                      // Fallback to placeholder if image fails to load
                                      e.currentTarget.style.display = "none";
                                      const sibling =
                                        e.currentTarget.nextElementSibling;
                                      if (sibling) {
                                        sibling.classList.remove("hidden");
                                      }
                                    }}
                                  />
                                ) : null;
                              })()}
                              <div
                                className={
                                  (tx.raw as any)?.attributes?.merchant?.logo
                                    ?.url
                                    ? "hidden"
                                    : ""
                                }
                              >
                                <ShoppingBag className="text-muted-foreground/50 h-5 w-5" />
                              </div>
                            </div>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate text-sm font-medium">
                                {tx.description}
                              </span>
                              {tx.counterparty && (
                                <span className="text-muted-foreground truncate text-xs">
                                  {tx.counterparty}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                              {getCategoryIcon(category)}
                            </div>
                            <span className="text-sm font-medium">
                              {category}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right text-base font-bold tabular-nums ${getAmountColor(tx.amount)}`}
                        >
                          {formatCurrency(tx.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handlePageChange(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="border-primary/30 border-t-primary h-12 w-12 animate-spin rounded-full border-4" />
        </div>
      }
    >
      <TransactionsPageContent />
    </Suspense>
  );
}
