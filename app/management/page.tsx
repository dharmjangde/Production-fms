"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CheckCircle, History, Settings, MessageSquare } from "lucide-react"
import { format } from "date-fns"
// Shadcn UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"

// --- Configuration ---
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec"
const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4"
const ACTUAL_PRODUCTION_SHEET = "Actual Production"
const JOB_CARDS_SHEET = "JobCards"

// --- Column Mapping for Management Approval ---
const MANAGEMENT_COLUMNS = {
  planned4: 70, // Column BR (0-based index: 69)
  actual4: 71,  // Column BS (0-based index: 70)
  remarks1: 72, // Column BT (0-based index: 71)
}

// --- Type Definitions ---
interface PendingApprovalItem {
  jobCardNo: string
  deliveryOrderNo: string
  productName: string
  firmName: string
  partyName: string
  planned4: string
}

interface HistoryApprovalItem {
  jobCardNo: string
  deliveryOrderNo: string
  productName: string
  firmName: string
  partyName: string
  approvalDate: string
  remarks: string
}

interface GvizRow {
  c: ({ v: any; f?: string } | null)[]
}

// --- Column Definitions ---
const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Planned 4", dataKey: "planned4", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Approval Date", dataKey: "approvalDate", toggleable: true },
  { header: "Remarks", dataKey: "remarks", toggleable: true },
]

// Helper function to parse Google's date format
function parseGvizDate(gvizDateString: string | null | undefined): Date | null {
  if (!gvizDateString || typeof gvizDateString !== "string" || !gvizDateString.startsWith("Date(")) return null
  const numbers = gvizDateString.match(/\d+/g)
  if (!numbers || numbers.length < 3) return null
  const [year, month, day, hours = 0, minutes = 0, seconds = 0] = numbers.map(Number)
  const date = new Date(year, month, day, hours, minutes, seconds)
  return isNaN(date.getTime()) ? null : date
}

const initialFormState = {
  remarks: "",
}

export default function ManagementApprovalPage() {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([])
  const [historyApprovals, setHistoryApprovals] = useState<HistoryApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<PendingApprovalItem | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const initializeVisibility = (columnsMeta: any[]) => {
      const visibility: Record<string, boolean> = {}
      columnsMeta.forEach((col) => {
        visibility[col.dataKey] = col.alwaysVisible || col.toggleable
      })
      return visibility
    }
    setVisiblePendingColumns(initializeVisibility(PENDING_COLUMNS_META))
    setVisibleHistoryColumns(initializeVisibility(HISTORY_COLUMNS_META))
  }, [])

  const fetchDataWithGviz = useCallback(async (sheetName: string, headersCount?: number) => {
    // headersCount tells gviz how many header rows to skip in the sheet.
    // For "Actual Production" this is 5 (rows 1-5 are headers, data starts at row 6).
    let url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      sheetName,
    )}&cb=${new Date().getTime()}`
    if (headersCount !== undefined) {
      url += `&headers=${headersCount}`
    }
    try {
      const response = await fetch(url, { cache: "no-store" })
      if (!response.ok) throw new Error(`Network response was not ok for ${sheetName}.`)
      const text = await response.text()
      const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1)
      const data = JSON.parse(jsonText)
      if (!data.table) throw new Error(`Invalid data structure from ${sheetName}.`)
      return data.table
    } catch (err) {
      console.error(`Failed to fetch or parse ${sheetName}:`, err)
      throw err
    }
  }, [])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [actualProductionTable, jobCardsTable] = await Promise.all([
        // Pass headers=5: the Actual Production sheet has 5 header rows (rows 1-5),
        // so gviz will skip them and table.rows[0] will be the first real data row (row 6).
        fetchDataWithGviz(ACTUAL_PRODUCTION_SHEET, 5),
        fetchDataWithGviz(JOB_CARDS_SHEET).catch(() => ({ rows: [] })),
      ])

      const processGvizTable = (table: any) => {
        if (!table || !table.rows || table.rows.length === 0) return []
        // No slice needed: for Actual Production, gviz already skipped the 5 header rows
        // via the &headers=5 URL parameter, so table.rows[0] is the first real data row.
        return table.rows
          .map((row: GvizRow, index: number) => {
            if (!row.c || !row.c.some((cell) => cell && cell.v !== null)) return null
            const rowData: { [key: string]: any } = { _originalIndex: index }
            row.c.forEach((cell, cellIndex) => {
              rowData[`col${cellIndex}`] = cell ? cell.v : null
            })
            return rowData
          })
          .filter(Boolean)
      }

      const actualProductionRows = processGvizTable(actualProductionTable)
      const jobCardsRows = processGvizTable(jobCardsTable)

      // Log to see actual data structure
      console.log('Sample row:', actualProductionRows[0]);

      // --- Pending Logic: Planned4 (BR/col69) is NOT null AND Actual4 (BS/col70) IS null ---
      const pendingData: PendingApprovalItem[] = actualProductionRows
        .filter(
          (row: { [key: string]: any }) => {
            // Check if Planned4 has value (col69) - handles dates, strings, numbers
            const p4val = row.col69;
            const hasPlanned4 = (
              p4val !== null &&
              p4val !== undefined &&
              String(p4val).trim() !== "" &&
              String(p4val).trim().toLowerCase() !== "null"
            );

            // Check if Actual4 is empty (col70)
            const a4val = row.col70;
            const isActual4Empty = (
              a4val === null ||
              a4val === undefined ||
              String(a4val).trim() === "" ||
              String(a4val).trim().toLowerCase() === "null"
            );

            // Log for debugging
            if (hasPlanned4) {
              console.log('Found Planned4:', {
                jobCardNo: row.col1,
                planned4: row.col69,
                actual4: row.col70,
                showInPending: hasPlanned4 && isActual4Empty
              });
            }

            return (
              // MUST have Job Card No
              row.col1 !== null &&
              row.col1 !== undefined &&
              String(row.col1).trim() !== "" &&

              // Planned4 has value
              hasPlanned4 &&

              // Actual4 is empty
              isActual4Empty
            );
          }
        )
        .map((row: { [key: string]: any }) => {
          const jobCard = jobCardsRows.find((jc: { [key: string]: any }) =>
            String(jc.col1 || '').trim() === String(row.col1 || '').trim()
          );

          const plannedDate = parseGvizDate(row.col69);

          return {
            jobCardNo: String(row.col1 || ""),
            deliveryOrderNo: String(row.col4 || ""),
            productName: String(row.col5 || ""),
            firmName: String(row.col2 || ""),
            partyName: String(jobCard?.col5 || ""),
            planned4: plannedDate
              ? format(plannedDate, "dd/MM/yy")
              : String(row.col69 || ""),
          };
        });

      setPendingApprovals(pendingData);
      console.log('Pending count:', pendingData.length);

      // --- History Logic: Both Planned4 (col69) and Actual4 (col70) are NOT NULL ---
      const historyData: HistoryApprovalItem[] = actualProductionRows
        .filter(
          (row: { [key: string]: any }) => {
            const hasPlanned4 = (
              row.col69 !== null &&
              row.col69 !== undefined &&
              String(row.col69).trim() !== "" &&
              String(row.col69).trim().toLowerCase() !== "null"
            );

            const hasActual4 = (
              row.col70 !== null &&
              row.col70 !== undefined &&
              String(row.col70).trim() !== "" &&
              String(row.col70).trim().toLowerCase() !== "null"
            );

            return hasPlanned4 && hasActual4;
          }
        )
        .map((row: { [key: string]: any }) => {
          const jobCard = jobCardsRows.find((jc: { [key: string]: any }) =>
            String(jc.col1 || '').trim() === String(row.col1 || '').trim()
          );

          const approvalDate = parseGvizDate(row.col70);
          const remarks = String(row.col71 || "");

          return {
            jobCardNo: String(row.col1 || ""),
            deliveryOrderNo: String(row.col4 || ""),
            productName: String(row.col5 || ""),
            firmName: String(row.col2 || ""),
            partyName: String(jobCard?.col5 || ""),
            approvalDate: approvalDate ? format(approvalDate, "dd/MM/yy HH:mm") : String(row.col70 || ""),
            remarks: remarks || "-",
          };
        })
        .sort((a, b) => new Date(b.approvalDate).getTime() - new Date(a.approvalDate).getTime());

      setHistoryApprovals(historyData);
      console.log('History count:', historyData.length);

    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fetchDataWithGviz])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.remarks || formData.remarks.trim() === "") {
      errors.remarks = "Remarks are required."
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleApproval = (item: PendingApprovalItem) => {
    setSelectedApproval(item)
    setFormData(initialFormState)
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleSaveApproval = async () => {
    if (!validateForm() || !selectedApproval) return
    setIsSubmitting(true)
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss")
      const columnUpdates = {
        [MANAGEMENT_COLUMNS.actual4]: timestamp,
        [MANAGEMENT_COLUMNS.remarks1]: formData.remarks,
      }

      const body = new URLSearchParams({
        sheetName: ACTUAL_PRODUCTION_SHEET,
        action: "updateByJobCard",
        jobCardNo: selectedApproval.jobCardNo.trim().toUpperCase(),
        columnUpdates: JSON.stringify(columnUpdates),
      })

      const res = await fetch(WEB_APP_URL, {
        method: "POST",
        body: body,
      })
      const result = await res.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to update approval data.")
      }

      alert("Management approval completed successfully!")
      setIsDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      alert(`Error: ${err instanceof Error ? err.message : "An unknown error occurred"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleColumn = (tab: string, dataKey: string, checked: boolean) => {
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns
    setter((prev) => ({ ...prev, [dataKey]: checked }))
  }

  const handleSelectAllColumns = (tab: string, columnsMeta: any[], checked: boolean) => {
    const newVisibility: Record<string, boolean> = {}
    columnsMeta.forEach((col) => {
      if (col.toggleable) newVisibility[col.dataKey] = checked
    })
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns
    setter((prev) => ({ ...prev, ...newVisibility }))
  }

  const visiblePendingColumnsMeta = useMemo(
    () => PENDING_COLUMNS_META.filter((col) => visiblePendingColumns[col.dataKey]),
    [visiblePendingColumns],
  )

  const visibleHistoryColumnsMeta = useMemo(
    () => HISTORY_COLUMNS_META.filter((col) => visibleHistoryColumns[col.dataKey]),
    [visibleHistoryColumns],
  )

  const ColumnToggler = ({ tab, columnsMeta }: { tab: string; columnsMeta: any[] }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent ml-auto">
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          View Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3">
        <div className="grid gap-2">
          <p className="text-sm font-medium">Toggle Columns</p>
          <div className="flex items-center justify-between mt-1 mb-2">
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => handleSelectAllColumns(tab, columnsMeta, true)}
            >
              Select All
            </Button>
            <span className="text-gray-300 mx-1">|</span>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => handleSelectAllColumns(tab, columnsMeta, false)}
            >
              Deselect All
            </Button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {columnsMeta
              .filter((col) => col.toggleable)
              .map((col) => (
                <div key={`toggle-${tab}-${col.dataKey}`} className="flex items-center space-x-2">
                  <Checkbox
                    id={`toggle-${tab}-${col.dataKey}`}
                    checked={
                      tab === "pending" ? !!visiblePendingColumns[col.dataKey] : !!visibleHistoryColumns[col.dataKey]
                    }
                    onCheckedChange={(checked) => handleToggleColumn(tab, col.dataKey, Boolean(checked))}
                  />
                  <Label htmlFor={`toggle-${tab}-${col.dataKey}`} className="text-xs font-normal cursor-pointer">
                    {col.header}
                  </Label>
                </div>
              ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
        <p className="ml-4 text-lg">Loading Management Approval Data...</p>
      </div>
    )

  if (error)
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p>{error}</p>
        <Button onClick={loadAllData} className="mt-4">
          Retry
        </Button>
      </div>
    )

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white min-h-screen">
      <Card className="shadow-md border-none">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <CheckCircle className="h-6 w-6 text-blue-600" />
            Management Approval
          </CardTitle>
          <CardDescription className="text-gray-700">
            Review and approve production items with remarks.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Pending Approval
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingApprovals.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Approval History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyApprovals.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-blue-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <CheckCircle className="h-5 w-5 text-primary mr-2" />
                      Pending Items ({pendingApprovals.length})
                    </CardTitle>
                    <ColumnToggler tab="pending" columnsMeta={PENDING_COLUMNS_META} />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visiblePendingColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingApprovals.length > 0 ? (
                          pendingApprovals.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-blue-50/50">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleApproval(item)}
                                      className="bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Add Remarks
                                    </Button>
                                  ) : (
                                    item[col.dataKey as keyof PendingApprovalItem] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-blue-200/50 bg-blue-50/50 rounded-lg mx-4 my-4 flex-1">
                                <CheckCircle className="h-12 w-12 text-blue-500 mb-3" />
                                <p className="font-medium text-foreground">No Pending Approval Items</p>
                                <p className="text-sm text-muted-foreground">
                                  All production items have been approved.
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-blue-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <History className="h-5 w-5 text-primary mr-2" />
                      History Items ({historyApprovals.length})
                    </CardTitle>
                    <ColumnToggler tab="history" columnsMeta={HISTORY_COLUMNS_META} />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleHistoryColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyApprovals.length > 0 ? (
                          historyApprovals.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-blue-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "remarks" ? (
                                    <span className="max-w-[200px] truncate block" title={item.remarks}>
                                      {item.remarks}
                                    </span>
                                  ) : (
                                    item[col.dataKey as keyof HistoryApprovalItem] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-blue-200/50 bg-blue-50/50 rounded-lg mx-4 my-4 flex-1">
                                <History className="h-12 w-12 text-blue-500 mb-3" />
                                <p className="font-medium text-foreground">No Approval History</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed approval records will appear here.
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Management Approval for JC: {selectedApproval?.jobCardNo}</DialogTitle>
            <DialogDescription>Add your remarks to approve this production item.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveApproval()
            }}
            className="space-y-4 pt-4"
          >
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs">DO No.</Label>
                <p className="text-sm font-semibold">{selectedApproval?.deliveryOrderNo}</p>
              </div>
              <div>
                <Label className="text-xs">Product Name</Label>
                <p className="text-sm font-semibold">{selectedApproval?.productName}</p>
              </div>
              <div>
                <Label className="text-xs">Firm Name</Label>
                <p className="text-sm font-semibold">{selectedApproval?.firmName}</p>
              </div>
              <div>
                <Label className="text-xs">Party Name</Label>
                <p className="text-sm font-semibold">{selectedApproval?.partyName}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Planned 4 Value</Label>
                <p className="text-sm font-semibold text-blue-600">{selectedApproval?.planned4}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks *</Label>
              <Textarea
                id="remarks"
                rows={4}
                placeholder="Enter your approval remarks, comments, or notes..."
                value={formData.remarks}
                onChange={(e) => handleFormChange("remarks", e.target.value)}
                className={formErrors.remarks ? "border-red-500" : ""}
              />
              {formErrors.remarks && <p className="text-xs text-red-600 mt-1">{formErrors.remarks}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Approval
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}