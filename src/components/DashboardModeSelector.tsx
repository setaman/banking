"use client";

import {
  CreditCard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bird,
} from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Calendar } from "@/src/components/ui/calendar";
import { useState } from "react";
import { addMonths, format, subMonths } from "date-fns";

enum Mode {
  AllTime = "All time",
  Monthly = "Monthly",
}

export function DashboardModeSelector({
  mode = Mode.AllTime,
}: {
  mode?: Mode;
}) {
  const [date, setDate] = useState<Date>(new Date());
  const [currentMode, setCurrentMode] = useState<Mode>(mode);

  const isMonthMode = () => currentMode === Mode.Monthly;
  const formattedDate = () => format(date, "MMMM yyyy");
  const prevMonth = () => setDate((prevDate) => subMonths(prevDate, 1));
  const nextMonth = () => setDate((prevDate) => addMonths(prevDate, 1));

  return (
    <>
      {currentMode === Mode.Monthly && (
        <Button variant="ghost" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            style={{ width: isMonthMode() ? "170px" : "auto" }}
          >
            {currentMode === Mode.Monthly ? formattedDate() : currentMode}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Data mode</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setCurrentMode(Mode.AllTime)}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>{Mode.AllTime}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentMode(Mode.Monthly)}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>{Mode.Monthly}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentMode(Mode.Monthly)}>
              <div className="flex items-start gap-3 text-muted-foreground">
                <Bird className="size-5" />
                <div className="grid gap-0.5">
                  <p>
                    <span className="font-medium text-foreground">Hello</span>
                  </p>

                  <p className="text-xs">Subtext</p>
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuLabel>Pick a month</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <div className="relative p-5" style={{ width: "300px" }}>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="rounded-md border"
                />
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {currentMode === Mode.Monthly && (
        <Button variant="ghost" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}
