"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, TestTube2, History, Settings } from "lucide-react"
import { format } from "date-fns"
import { useGoogleSheet, parseGvizDate } from "@/lib/g-sheets"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

// Configuration
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec"
const COSTING_RESPONSE_SHEET = "Costing Response"
const MASTER_SHEET = "Master"

// Column mappings for Costing Response sheet
const COSTING_RESPONSE_COLUMNS = {
  timestamp: 1,
  compositionNo: 2,
  orderNo: 3,
  productName: 4,
  variableCost: 5,
  manufacturingCost: 6,
  interestDays: 7,
  interestCost: 8,
  transportingFor: 9,
  sellingPrice: 10,
  gpPercentage: 11,
  alumina: 12,
  iron: 13,
  bd: 14,
  ap: 15,
  planned1: 56,
  actual2: 57,
  timeDelay1: 58,
  wc: 59,
  ist: 60,
  fst: 61,
  remarks: 69,
}

interface CostingItem {
  _rowIndex: number
  compositionNo: string
  orderNo: string
  productName: string
  variableCost: string
  manufacturingCost: string
  interestDays: string
  interestCost: string
  transportingFor: string
  sellingPrice: string
  gpPercentage: string
  alumina: string
  iron: string
  bd: string
  ap: string
  planned1: string
  actual2: string
  timeDelay1: string
  wc: string
  ist: string
  fst: string
  status: string
  remarks: string
}

interface HistoryItem extends CostingItem {}

// Column Definitions for Pending Tests
const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true, toggleable: false },
  { header: "Composition No.", dataKey: "compositionNo", toggleable: true },
  { header: "Order No.", dataKey: "orderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Planned Date", dataKey: "planned1", toggleable: true }, // 👈 ADD THIS
  { header: "VARIABLE COST", dataKey: "variableCost", toggleable: true },
  { header: "Manufacturing Cost", dataKey: "manufacturingCost", toggleable: true },
  { header: "Interest (days)", dataKey: "interestDays", toggleable: true },
  { header: "Interest Cost", dataKey: "interestCost", toggleable: true },
  { header: "Transporting (FOR)", dataKey: "transportingFor", toggleable: true },
  { header: "SELLING PRICE", dataKey: "sellingPrice", toggleable: true },
]

// Column Definitions for History
const HISTORY_COLUMNS_META = [
  { header: "Timestamp", dataKey: "actual2", toggleable: true },
  { header: "Composition No.", dataKey: "compositionNo", toggleable: true },
  { header: "Order No.", dataKey: "orderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Alumina Percentage %", dataKey: "wc", toggleable: true },
  { header: "Iron Percentage %", dataKey: "ist", toggleable: true },
  // { header: "FST", dataKey: "fst", toggleable: true },
  { header: "Remarks", dataKey: "remarks", toggleable: true },
]

const initialFormState = {
  wc: "",
  ist: "",
  status: "",
  remarks: "",
}

export default function LabTestingPage() {
  const [pendingTests, setPendingTests] = useState<CostingItem[]>([])
  const [historyTests, setHistoryTests] = useState<HistoryItem[]>([])
  const [testedByOptions, setTestedByOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState<CostingItem | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})

  const { fetchData: fetchCostingData } = useGoogleSheet(COSTING_RESPONSE_SHEET)
  const { fetchData: fetchMasterData } = useGoogleSheet(MASTER_SHEET)
const formatDateValue = (value: any) => {
  if (!value) return ""

  try {
    // If Google GViz Date format
    if (typeof value === "string" && value.startsWith("Date(")) {
      const parsed = parseGvizDate(value)
      if (parsed) return format(parsed, "dd/MM/yy")
    }

    // Normal Date object
    if (value instanceof Date) {
      return format(value, "dd/MM/yy")
    }

    // ISO string
    return format(new Date(value), "dd/MM/yy")
  } catch {
    return ""
  }
}
  const processGvizTable = (table: any) => {
    if (!table?.rows?.length) return []

    const firstDataRowIndex = table.rows.findIndex(
      (r: any) => r?.c?.some((cell: any) => cell?.v !== null && cell?.v !== "")
    )
    if (firstDataRowIndex === -1) return []

    const dataRows = table.rows.slice(firstDataRowIndex)

    return dataRows
      .map((row: any, rowIndex: number) => {
        if (!row?.c || row.c.every((cell: any) => !cell?.v)) return null

        const rowData: any = {
          _rowIndex: firstDataRowIndex + rowIndex + 2
        }

        const columnLetters = [
          'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
          'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL',
          'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC',
          'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ'
        ]

        row.c.forEach((cell: any, cellIndex: number) => {
          if (cellIndex < columnLetters.length) {
            rowData[columnLetters[cellIndex]] = cell?.v ?? null
          }
        })

        return rowData
      })
      .filter(Boolean)
  }

  useEffect(() => {
    const initializeVisibility = (columnsMeta: any[]) => {
      const visibility: Record<string, boolean> = {}
      columnsMeta.forEach((col) => {
        visibility[col.dataKey] = true
      })
      return visibility
    }

    setVisiblePendingColumns(initializeVisibility(PENDING_COLUMNS_META))
    setVisibleHistoryColumns(initializeVisibility(HISTORY_COLUMNS_META))
  }, [])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("Fetching data from Costing Response sheet...")
      const [costingTable, masterTable] = await Promise.all([
        fetchCostingData(),
        fetchMasterData(),
      ])

      const costingRows = processGvizTable(costingTable)
      const masterRows = processGvizTable(masterTable)

      const allItems: CostingItem[] = costingRows.map((row: any) => ({
        _rowIndex: row._rowIndex,
        compositionNo: String(row.B || ""),
        orderNo: String(row.C || ""),
        productName: String(row.D || ""),
        variableCost: String(row.E || ""),
        manufacturingCost: String(row.F || ""),
        interestDays: String(row.G || ""),
        interestCost: String(row.H || ""),
        transportingFor: String(row.I || ""),
        sellingPrice: String(row.J || ""),
        gpPercentage: String(row.K || ""),
        alumina: String(row.L || ""),
        iron: String(row.M || ""),
        bd: String(row.N || ""),
        ap: String(row.O || ""),
        planned1: formatDateValue(row.BD),
        actual2: formatDateValue(row.BE),
        timeDelay1: String(row.BF || ""),
        wc: String(row.BG || ""),
        ist: String(row.BH || ""),
      status: String(row.BI || ""),
        remarks: String(row.BQ || ""),
      }))

      const pending = allItems.filter((item) => {
        const hasPlanned1 = item.planned1?.trim() && 
          item.planned1 !== "null" && 
          item.planned1 !== "undefined"
        const hasActual2 = item.actual2?.trim() && 
          item.actual2 !== "null" && 
          item.actual2 !== "undefined"
        return hasPlanned1 && !hasActual2
      })

      const history = allItems
        .filter((item) => {
          const hasPlanned1 = item.planned1?.trim() && 
            item.planned1 !== "null" && 
            item.planned1 !== "undefined"
          const hasActual2 = item.actual2?.trim() && 
            item.actual2 !== "null" && 
            item.actual2 !== "undefined"
          return hasPlanned1 && hasActual2
        })
        .sort((a, b) => {
          if (a.actual2 && b.actual2) {
            return new Date(b.actual2).getTime() - new Date(a.actual2).getTime()
          }
          return 0
        })

      setPendingTests(pending)
      setHistoryTests(history)

      const testedByOpts = [...new Set(masterRows.map((row: any) => String(row.E || "").trim()).filter(Boolean))]
      setTestedByOptions(testedByOpts.length > 0 ? testedByOpts : ["Dr. Arjun Patel", "Dr. Kavita Sharma", "Dr. Rajesh Gupta"])

    } catch (err: any) {
      console.error("Error in loadAllData:", err)
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fetchCostingData, fetchMasterData])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validateForm = () => true

  const handleOpenLabTesting = (test: CostingItem) => {
    setSelectedTest(test)
    setFormData({
      wc: test.wc || "",
      ist: test.ist || "",
  status: test.status || "",
      remarks: test.remarks || "",
    })
    setIsDialogOpen(true)
  }

  const handleSaveLabTest = async () => {
    if (!validateForm() || !selectedTest) return

    setIsSubmitting(true)
    try {
const actual2Value = format(new Date(), "dd/MM/yy")
      const columnUpdates: Record<string, string> = {
        "col57": actual2Value,
      }

      if (formData.wc) columnUpdates["col59"] = formData.wc
      if (formData.ist) columnUpdates["col60"] = formData.ist
if (formData.status) columnUpdates["col61"] = formData.status      
if (formData.remarks) columnUpdates["col69"] = formData.remarks

      const body = new URLSearchParams({
        sheetName: COSTING_RESPONSE_SHEET,
        action: "updateCells",
        rowIndex: String(selectedTest._rowIndex),
        cellUpdates: JSON.stringify(columnUpdates),
      })

      const res = await fetch(WEB_APP_URL, {
        method: "POST",
        body: body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      const result = await res.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to update test data in Costing Response sheet.")
      }

      alert("Lab test data saved successfully!")
      setIsDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      console.error("Save error:", err)
      setError(err.message)
      alert(`Error: ${err.message}`)
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
        <p className="ml-4 text-lg">Loading Lab Test Data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p className="text-sm">{error}</p>
        <Button onClick={loadAllData} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white min-h-screen">
      <Card className="shadow-md border-none">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <TestTube2 className="h-6 w-6 text-purple-600" />
            Lab Testing
          </CardTitle>
          <CardDescription className="text-gray-700">
            Perform lab tests and record results for costing response items.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <TestTube2 className="h-4 w-4" /> Pending Tests
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingTests.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Test History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyTests.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-purple-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground flex items-center">
                      <TestTube2 className="h-5 w-5 text-primary mr-2" />
                      Pending Items ({pendingTests.length})
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
                            <TableHead key={col.dataKey} className="whitespace-nowrap">
                              {col.header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTests.length > 0 ? (
                          pendingTests.map((test, index) => (
                            <TableRow key={`${test._rowIndex}-${index}`} className="hover:bg-purple-50/50">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenLabTesting(test)}
                                      className="bg-purple-600 text-white hover:bg-purple-700"
                                    >
                                      <TestTube2 className="mr-2 h-4 w-4" />
                                      Perform Test
                                    </Button>
                                  ) : (
                                    test[col.dataKey as keyof CostingItem] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-purple-200/50 bg-purple-50/50 rounded-lg mx-4 my-4 flex-1">
                                <TestTube2 className="h-12 w-12 text-purple-500 mb-3" />
                                <p className="font-medium text-foreground">No Pending Tests</p>
                                <p className="text-sm text-muted-foreground">
                                  {pendingTests.length === 0 ? "No items with Planned 1 and without Actual 2 found." : "All required tests have been completed."}
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
                <CardHeader className="py-3 px-4 bg-purple-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground flex items-center">
                      <History className="h-5 w-5 text-primary mr-2" />
                      History Items ({historyTests.length})
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
                            <TableHead key={col.dataKey} className="whitespace-nowrap">
                              {col.header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyTests.length > 0 ? (
                          historyTests.map((test, index) => (
                            <TableRow key={`${test._rowIndex}-${index}`} className="hover:bg-purple-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {test[col.dataKey as keyof HistoryItem] || "-"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-purple-200/50 bg-purple-50/50 rounded-lg mx-4 my-4 flex-1">
                                <History className="h-12 w-12 text-purple-500 mb-3" />
                                <p className="font-medium text-foreground">No Test History</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed test records will appear here.
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lab Test Details</DialogTitle>
            <DialogDescription>
              Fill out the test results below.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveLabTest()
            }}
            className="space-y-4 pt-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs">Composition No.</Label>
                <p className="text-sm font-semibold">{selectedTest?.compositionNo || "-"}</p>
              </div>
              <div>
                <Label className="text-xs">Order No.</Label>
                <p className="text-sm font-semibold">{selectedTest?.orderNo || "-"}</p>
              </div>
              <div>
                <Label className="text-xs">Product Name</Label>
                <p className="text-sm font-semibold">{selectedTest?.productName || "-"}</p>
              </div>
              <div>
                <Label className="text-xs">Planned 1</Label>
                <p className="text-sm font-semibold">{selectedTest?.planned1 || "-"}</p>
              </div>
            </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

  {/* WC */}
  <div className="space-y-2">
    <Label htmlFor="wc">Alumina Percentage %</Label>
    <Input
      id="wc"
      value={formData.wc}
      onChange={(e) => handleFormChange("wc", e.target.value)}
      placeholder="Enter Alumina %"
    />
  </div>

  {/* IST */}
  <div className="space-y-2">
    <Label htmlFor="ist">Iron Percentage %</Label>
    <Input
      id="ist"
      value={formData.ist}
      onChange={(e) => handleFormChange("ist", e.target.value)}
      placeholder="Enter Iron %"
    />
  </div>
  {/* Status */}
<div className="space-y-2">
  <Label htmlFor="status">Status</Label>
  <select
    id="status"
    value={formData.status}
    onChange={(e) => handleFormChange("status", e.target.value)}
    className="w-full border rounded-md p-2 text-sm"
  >
    <option value="">Select Status</option>
    <option value="Done">Done</option>
    <option value="Not Done">Not Done</option>
  </select>
</div>

  {/* FST (optional if needed)
  <div className="space-y-2">
    <Label htmlFor="fst">FST</Label>
    <Input
      id="fst"
      value={formData.fst}
      onChange={(e) => handleFormChange("fst", e.target.value)}
      placeholder="Enter FST"
    />
  </div> */}

</div>

            <div className="space-y-2">
              <Label htmlFor="remarks" className="flex items-center gap-2">
                <span>Remarks</span>
                <span className="text-xs text-gray-500">(Optional)</span>
              </Label>
              <Input
                id="remarks"
                value={formData.remarks}
                onChange={(e) => handleFormChange("remarks", e.target.value)}
                placeholder="Enter any remarks or notes about the test"
                className="w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-purple-600 text-white hover:bg-purple-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Test Results
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}