"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Check,
  CreditCard,
  Landmark,
  Lock,
  MoreVertical,
  PiggyBank,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { closeAccount, reactivateAccount } from "@/actions/accounts.actions";
import type { UnifiedAccount } from "@/lib/banking/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountManagementCardProps {
  accounts: UnifiedAccount[];
  activeAccountIds: Set<string>;
  onChanged?: () => void | Promise<void>;
}

type DialogAction =
  | { type: "close"; account: UnifiedAccount }
  | { type: "reactivate"; account: UnifiedAccount }
  | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAccountIcon(type: UnifiedAccount["type"]) {
  switch (type) {
    case "checking":
      return Landmark;
    case "savings":
      return PiggyBank;
    case "credit":
      return CreditCard;
    default:
      return Landmark;
  }
}

function maskIban(iban?: string): string {
  if (!iban) return "";
  if (iban.length <= 8) return iban;
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

function formatAccountType(type: UnifiedAccount["type"]): string {
  switch (type) {
    case "checking":
      return "Checking";
    case "savings":
      return "Savings";
    case "credit":
      return "Credit";
    case "investment":
      return "Investment";
    default:
      return type;
  }
}

function formatLastSeen(account: UnifiedAccount): string {
  const raw = account.lastSeenAt ?? account.lastSyncedAt;
  if (!raw) return "";
  try {
    return format(parseISO(raw), "d MMM");
  } catch {
    return "";
  }
}

function formatLastSeenFull(account: UnifiedAccount): string {
  const raw = account.lastSeenAt ?? account.lastSyncedAt;
  if (!raw) return "";
  try {
    return format(parseISO(raw), "d MMM yyyy");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountManagementCard({
  accounts,
  activeAccountIds,
  onChanged,
}: AccountManagementCardProps) {
  const router = useRouter();
  const [pendingDialog, setPendingDialog] = React.useState<DialogAction>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    if (!pendingDialog) return;
    setIsSubmitting(true);

    const { type, account } = pendingDialog;

    try {
      const result =
        type === "close"
          ? await closeAccount(account.id)
          : await reactivateAccount(account.id);

      if (result.success) {
        toast.success(
          type === "close" ? "Account closed" : "Account reactivated",
          {
            description:
              type === "close"
                ? `${account.name} is now hidden from your total balance and charts.`
                : `${account.name} is now included in your total balance and charts.`,
          }
        );
        await onChanged?.();
        router.refresh();
      } else {
        toast.error(
          type === "close"
            ? "Could not close account"
            : "Could not reactivate account",
          {
            description: result.error,
          }
        );
      }
    } catch (err) {
      toast.error("Something went wrong", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setIsSubmitting(false);
      setPendingDialog(null);
    }
  };

  return (
    <>
      <Card className="border-primary/10 relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="to-primary/5 absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent opacity-50" />

        {/* Content */}
        <div className="relative z-10">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="text-primary h-5 w-5" />
              Your Accounts
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              View and manage accounts synced from your bank.
            </p>
          </CardHeader>

          <CardContent className="px-6 pt-0 pb-4">
            {accounts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No accounts synced yet. Connect your bank and run a sync.
              </p>
            ) : (
              <ul className="space-y-2" role="list" aria-label="Bank accounts">
                {accounts.map((account) => {
                  const isActive = activeAccountIds.has(account.id);
                  const isClosed = account.status === "closed";
                  // Stale = not in active set but not manually closed
                  const isStale = !isActive && !isClosed;
                  const AccountIcon = getAccountIcon(account.type);
                  const lastSeenLabel = formatLastSeen(account);
                  const lastSeenFullLabel = formatLastSeenFull(account);

                  return (
                    <li
                      key={account.id}
                      className={cn(
                        "flex items-center gap-4 rounded-lg border p-4",
                        isActive
                          ? "bg-card/30 border-white/10"
                          : "bg-muted/10 border-white/5 opacity-70"
                      )}
                    >
                      {/* Account type icon */}
                      <div className="bg-background/20 rounded-xl p-2 backdrop-blur-md">
                        <AccountIcon className="h-5 w-5" />
                      </div>

                      {/* Account info */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isClosed && "text-muted-foreground line-through"
                          )}
                        >
                          {account.name}
                        </p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {maskIban(account.iban)}{" "}
                          <span className="font-sans not-italic">
                            &middot; {formatAccountType(account.type)}
                          </span>
                        </p>
                      </div>

                      {/* Status badge */}
                      <div className="flex shrink-0 items-center gap-2">
                        {isClosed && (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground border-muted-foreground/30"
                          >
                            Closed
                          </Badge>
                        )}
                        {isStale && lastSeenLabel && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            aria-label={`This account was not returned by your bank since ${lastSeenFullLabel}`}
                          >
                            Not seen since {lastSeenLabel}
                          </Badge>
                        )}
                        {isStale && !lastSeenLabel && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            aria-label="This account was not returned by your bank recently"
                          >
                            Not seen recently
                          </Badge>
                        )}

                        {/* Actions dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              aria-label={`Account options for ${account.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isClosed && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setPendingDialog({
                                    type: "reactivate",
                                    account,
                                  })
                                }
                              >
                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                Reactivate account
                              </DropdownMenuItem>
                            )}
                            {isActive && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setPendingDialog({ type: "close", account })
                                }
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Mark as closed
                              </DropdownMenuItem>
                            )}
                            {isStale && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setPendingDialog({ type: "close", account })
                                  }
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Confirm &mdash; mark as closed
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    toast.info(
                                      `${account.name} will stay active.`
                                    );
                                  }}
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  Dismiss &mdash; keep active
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>

          <CardFooter className="p-6 pt-2">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <Lock className="h-3 w-3 shrink-0" />
              Closing an account here only hides it from totals &mdash; your
              history is always kept.
            </p>
          </CardFooter>
        </div>
      </Card>

      {/* Confirmation dialogs */}
      {pendingDialog?.type === "close" && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !isSubmitting) setPendingDialog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark this account as closed?</AlertDialogTitle>
              <AlertDialogDescription>
                This hides <strong>{pendingDialog.account.name}</strong> from
                your total balance and charts. Your transaction history will be
                kept &mdash; nothing is deleted. You can reactivate it anytime
                from Settings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isSubmitting}
                onClick={() => setPendingDialog(null)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmitting}
                onClick={handleConfirm}
              >
                Mark as Closed
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {pendingDialog?.type === "reactivate" && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !isSubmitting) setPendingDialog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reactivate this account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will include <strong>{pendingDialog.account.name}</strong>{" "}
                in your total balance and charts again, using the last known
                balance.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isSubmitting}
                onClick={() => setPendingDialog(null)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmitting}
                onClick={handleConfirm}
              >
                Reactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
