import Image from "next/image";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { TransactionsByMonthI } from "@/src/types";
import Amount from "@/src/components/Amount";
import { format } from "date-fns";

export default function Transactions({
  transactions,
  count,
}: {
  transactions: TransactionsByMonthI[];
  count: number;
}) {
  const maxVisibleTransactions = 50;
  const collapsedTransactions = transactions.slice(0, maxVisibleTransactions);

  return (
    <div>
      <CardTitle className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Transactions
      </CardTitle>
      <CardDescription>Recent transactions from your account</CardDescription>
      {transactions.map((group) => (
        <div key={group.group}>
          <h2 className="mt-10 mb-5 scroll-m-20 text-xl font-semibold tracking-tight">
            {format(group.date, "MMMM yyyy")}
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden w-[100px] sm:table-cell">
                      <span className="sr-only">Image</span>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Price
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Created at
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.transactions.map((t) => (
                    <TableRow key={t.transaction_id}>
                      <TableCell className="hidden sm:table-cell">
                        {t.logo_url && (
                          <Image
                            alt="Product image"
                            className="aspect-square rounded-md object-cover"
                            height="64"
                            src={t.logo_url}
                            width="64"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium w-1/2">
                        <span>{t.merchant_name}</span>
                        <CardDescription>{t.name}</CardDescription>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {t.pending ? (
                          <Badge variant="destructive">Pending</Badge>
                        ) : (
                          <Badge variant="outline">Approved</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.category?.map((c) => (
                          <Badge key={c} variant="outline" className="mr-1">
                            {c}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Amount value={t.amount * -1} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(t.authorized_date ?? "", "dd.MM.yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ))}
      <Card>
        <CardFooter>
          <div className="w-full text-xs text-muted-foreground flex justify-center">
            <span>
              Showing <strong>{maxVisibleTransactions}</strong> of{" "}
              <strong>{count}</strong> transactions
            </span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
