"use client";
import { ArrowDown} from "lucide-react"
import { Button } from "@/src/components/ui/button"
import {useState} from "react";

export default function TransactionsCollapse({
  children,
}: {
    children: React.ReactNode

}) {
  const [showMore, setShowMore] = useState(false);

  const toggleShowMore = () => {
    setShowMore(!showMore);
  }

  return (
    <>
      {children}
      <Button>
                 Show more
        <ArrowDown className="mr-2 h-4 w-4" />
      </Button>
    </>
  )
}
