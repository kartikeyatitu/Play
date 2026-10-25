"use client"

import { useEffect, useState } from "react"
import { getFeeHistory } from "@/app/actions/fee-history"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge"

type FeeRecord = {
  id: string
  month: string
  amount: number
  status: string
  paymentMethod?: string | null
}

export function FeeHistory({ studentId }: { studentId: string }) {
  const [records, setRecords] = useState<FeeRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await getFeeHistory(studentId)
        setRecords(data as any[])
      } catch (error) {
        console.error("Error fetching fee history", error)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [studentId])

  if (loading) {
    return <div className="text-zinc-400 animate-pulse">Loading fee history...</div>
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
      <h3 className="text-base sm:text-lg font-medium text-zinc-100 mb-4">Fee History</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800">
              <TableHead className="text-zinc-400">Month</TableHead>
              <TableHead className="text-zinc-400">Amount</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-zinc-500">No fee records found.</TableCell>
              </TableRow>
            ) : records.map((record) => (
              <TableRow key={record.id} className="border-zinc-800">
                <TableCell className="text-zinc-100">{
                  new Date(record.month + "-01").toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                }</TableCell>
                <TableCell className="text-zinc-100">₹{record.amount}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={record.status === "PAID" ? "emerald" : "rose"}>
                      {record.status}
                    </Badge>
                    <PaymentMethodBadge status={record.status} method={record.paymentMethod} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
