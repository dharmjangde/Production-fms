"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CalendarIcon, TestTube2, History, Settings } from "lucide-react"
import { format } from "date-fns"
import { useGoogleSheet, parseGvizDate } from "@/lib/g-sheets"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

// Configuration
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec"
const COSTING_RESPONSE_SHEET = "Costing Response"
const MASTER_SHEET = "Master"

// Column mappings for Costing Response sheet
const COSTING_RESPONSE_COLUMNS = {
  timestamp: 1,           // Column A: TIMESTAMP
  compositionNo: 2,       // Column B: Composition No.
  orderNo: 3,             // Column C: Order No.
  productName: 4,         // Column D: product name
  variableCost: 5,        // Column E: VARIABLE COST
  manufacturingCost: 6,   // Column F: Manufacturing Cost
  interestDays: 7,        // Column G: Interest (days)
  interestCost: 8,        // Column H: Interest Cost
  transportingFor: 9,     // Column I: Transporting (FOR)
  sellingPrice: 10,       // Column J: SELLING PRICE
  gpPercentage: 11,       // Column K: GP %AGE
  alumina: 12,            // Column L: alumina
  iron: 13,               // Column M: iron
  bd: 14,                 // Column N: BD
  ap: 15,                 // Column O: AP
  planned1: 56,           // Column BD: Planned 1
  actual2: 57,            // Column BE: Actual 2
  timeDelay1: 58,         // Column BF: Time Delay 1
  wc: 59,                 // Column BG: W/C
  ist: 60,                // Column BH: IST
  fst: 61,                // Column BI: FST
  ccsAt110: 62,           // Column BJ: CCS at 110
  ccsAt1100: 63,          // Column BK: CCS at 1100
  plc: 64,                // Column BL: PLC
  bdValue: 65,            // Column BM: BD
  apValue: 66,            // Column BN: AP
  testedBy: 67,           // Column BO: Tested By
  dateOfTest: 68,
  remarks: 69,            // Column BP: Remarks
}

// Type Definitions
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
  ccsAt110: string
  ccsAt1100: string
  plc: string
  bdValue: string
  apValue: string
  testedBy: string
  dateOfTest: string
  remarks: string
}

interface HistoryItem extends CostingItem { }

// Format date from Google Sheets format
const formatDisplayDate = (dateValue: any): string => {
  if (!dateValue) return "-"

  // If it's already a formatted date string, return it
  if (typeof dateValue === 'string' && dateValue.includes('/')) {
    return dateValue
  }

  try {
    const date = parseGvizDate(dateValue)
    if (date && !isNaN(date.getTime())) {
      return format(date, "dd/MM/yyyy HH:mm")
    }
  } catch (e) {
    // If parsing fails, return the original value
  }

  return String(dateValue)
}

// Column Definitions for Pending Tests - ONLY the columns you want
const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true, toggleable: false },
  { header: "Composition No.", dataKey: "compositionNo", toggleable: true },
  { header: "Order No.", dataKey: "orderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "VARIABLE COST", dataKey: "variableCost", toggleable: true },
  { header: "Manufacturing Cost", dataKey: "manufacturingCost", toggleable: true },
  { header: "Interest (days)", dataKey: "interestDays", toggleable: true },
  { header: "Interest Cost", dataKey: "interestCost", toggleable: true },
  { header: "Transporting (FOR)", dataKey: "transportingFor", toggleable: true },
  { header: "SELLING PRICE", dataKey: "sellingPrice", toggleable: true },
]

// Column Definitions for History - Keep as is
const HISTORY_COLUMNS_META = [
  { header: "Composition No.", dataKey: "compositionNo", toggleable: true },
  { header: "Order No.", dataKey: "orderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  // { header: "Actual 2", dataKey: "actual2", toggleable: true },
  // { header: "Time Delay 1", dataKey: "timeDelay1", toggleable: true },
  { header: "W/C", dataKey: "wc", toggleable: true },
  { header: "IST", dataKey: "ist", toggleable: true },
  { header: "FST", dataKey: "fst", toggleable: true },
  { header: "CCS at 110", dataKey: "ccsAt110", toggleable: true },
  { header: "CCS at 1100", dataKey: "ccsAt1100", toggleable: true },
  { header: "PLC", dataKey: "plc", toggleable: true },
  { header: "BD", dataKey: "bdValue", toggleable: true },
  { header: "AP", dataKey: "apValue", toggleable: true },
  { header: "Planned 1", dataKey: "planned1", toggleable: true },
  { header: "Remarks", dataKey: "remarks", toggleable: true },

  // { header: "Tested By", dataKey: "testedBy", toggleable: true },
  // { header: "Date Of Test", dataKey: "dateOfTest", toggleable: true },
]

const initialFormState = {
  wc: "",
  ist: "",
  fst: "",
  ccsAt110: "",
  ccsAt1100: "",
  plc: "",
  bdValue: "",
  apValue: "",
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

  const processGvizTable = (table) => {
    if (!table || !table.rows || table.rows.length === 0) {
      return []
    }

    const firstDataRowIndex = table.rows.findIndex(
      (r) => r && r.c && r.c.some((cell) => cell && cell.v !== null && cell.v !== ""),
    )
    if (firstDataRowIndex === -1) return []

    const colIds = table.cols.map((col) => col.id)
    const dataRows = table.rows.slice(firstDataRowIndex)

    return dataRows
      .map((row, rowIndex) => {
        if (!row || !row.c || row.c.every((cell) => !cell || cell.v === null || cell.v === "")) {
          return null
        }
        const rowData: any = {
          _rowIndex: firstDataRowIndex + rowIndex + 2 // +2 because sheets are 1-based and we skip header
        }

        // Map each column by index
        const columnLetters = [
          'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
          'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL',
          'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC',
          'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP','BQ'
        ]

        row.c.forEach((cell, cellIndex) => {
          if (cellIndex < columnLetters.length) {
            const colLetter = columnLetters[cellIndex]
            rowData[colLetter] = cell ? cell.v : null
          }
        })

        return rowData
      })
      .filter(Boolean)
  }

  useEffect(() => {
    const initializeVisibility = (columnsMeta) => {
      const visibility = {}
      // Set all toggleable columns to visible by default
      columnsMeta.forEach((col) => {
        if (col.toggleable) {
          visibility[col.dataKey] = true
        } else if (col.alwaysVisible) {
          visibility[col.dataKey] = true
        }
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

      console.log("Costing table received:", costingTable)

      const costingRows = processGvizTable(costingTable)
      console.log("Processed costing rows:", costingRows.length)

      const masterRows = processGvizTable(masterTable)

      // Process costing data into items
      const allItems: CostingItem[] = costingRows.map((row) => {
        const item = {
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
          planned1: String(row.BD || ""),
          actual2: String(row.BE || ""),
          timeDelay1: String(row.BF || ""),
          wc: String(row.BG || ""),
          ist: String(row.BH || ""),
          fst: String(row.BI || ""),
          ccsAt110: String(row.BJ || ""),
          ccsAt1100: String(row.BK || ""),
          plc: String(row.BL || ""),
          bdValue: String(row.BM || ""),
          apValue: String(row.BN || ""),
          testedBy: String(row.BO || ""),
          dateOfTest: String(row.BP || ""),
          remarks: String(row.BQ || ""),      // NEW: Map remarks column

        }
        return item
      })

      console.log("All items mapped:", allItems.length)

      // Filter pending: Planned 1 is not null/empty AND Actual 2 is null/empty
      const pending = allItems.filter((item) => {
        const hasPlanned1 = item.planned1 &&
          item.planned1.trim() !== "" &&
          item.planned1 !== "null" &&
          item.planned1 !== "undefined"
        const hasActual2 = item.actual2 &&
          item.actual2.trim() !== "" &&
          item.actual2 !== "null" &&
          item.actual2 !== "undefined"
        return hasPlanned1 && !hasActual2
      })

      console.log("Pending tests:", pending.length)

      // Filter history: Both Planned 1 and Actual 2 are not null/empty
      const history = allItems
        .filter((item) => {
          const hasPlanned1 = item.planned1 &&
            item.planned1.trim() !== "" &&
            item.planned1 !== "null" &&
            item.planned1 !== "undefined"
          const hasActual2 = item.actual2 &&
            item.actual2.trim() !== "" &&
            item.actual2 !== "null" &&
            item.actual2 !== "undefined"
          return hasPlanned1 && hasActual2
        })
        .sort((a, b) => {
          // Sort by dateOfTest if available
          if (a.dateOfTest && b.dateOfTest) {
            return new Date(b.dateOfTest).getTime() - new Date(a.dateOfTest).getTime()
          }
          return 0
        })

      console.log("History tests:", history.length)

      setPendingTests(pending)
      setHistoryTests(history)

      // Set tested by options from master sheet
      const testedByOpts = [...new Set(masterRows.map((row) => String(row.E || "")).filter(Boolean))]
      setTestedByOptions(testedByOpts.length > 0 ? testedByOpts : ["Dr. Arjun Patel", "Dr. Kavita Sharma", "Dr. Rajesh Gupta"])

    } catch (err) {
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

    // Clear error for this field if it exists
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validateForm = () => {
    return true
  }

  const handleOpenLabTesting = (test: CostingItem) => {
    console.log("Opening test:", test)
    setSelectedTest(test)
    // Pre-fill form with existing values from the row
    setFormData({
      wc: test.wc || "",
      ist: test.ist || "",
      fst: test.fst || "",
      ccsAt110: test.ccsAt110 || "",
      ccsAt1100: test.ccsAt1100 || "",
      plc: test.plc || "",
      bdValue: test.bdValue || "",
      apValue: test.apValue || "",
      remarks: test.remarks || "",  // NEW

    })
    setIsDialogOpen(true)   // ✅ ADD THIS

  }
  const handleSaveLabTest = async () => {
    if (!validateForm() || !selectedTest) return

    setIsSubmitting(true)
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss")
      const actual2Value = format(new Date(), "dd/MM/yyyy HH:mm")

      // Prepare column updates with 'col' prefix as expected by Apps Script
      const columnUpdates: Record<string, string> = {
        // Update Actual 2 (Column BE - index 57)
        "col57": actual2Value,

        // Update test results

      }

      // Update the test input fields if they have values
      if (formData.wc) columnUpdates["col59"] = formData.wc // wc - column BG
      if (formData.ist) columnUpdates["col60"] = formData.ist // ist - column BH
      if (formData.fst) columnUpdates["col61"] = formData.fst // fst - column BI
      if (formData.ccsAt110) columnUpdates["col62"] = formData.ccsAt110 // ccsAt110 - column BJ
      if (formData.ccsAt1100) columnUpdates["col63"] = formData.ccsAt1100 // ccsAt1100 - column BK
      if (formData.plc) columnUpdates["col64"] = formData.plc // plc - column BL
      if (formData.bdValue) columnUpdates["col65"] = formData.bdValue // bdValue - column BM
      if (formData.apValue) columnUpdates["col66"] = formData.apValue // apValue - column BN
     if (formData.remarks) columnUpdates["col69"] = formData.remarks // remarks - column BQ (NEW)

      console.log("Updating row:", selectedTest._rowIndex, "with updates:", columnUpdates)

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
    } catch (err) {
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
                <CardHeader className="py-3 px-4 bg-purple-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
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
                <CardHeader className="py-3 px-4 bg-purple-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
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
                                  {col.dataKey === "planned1" || col.dataKey === "actual2" || col.dataKey === "dateOfTest" ? (
                                    formatDisplayDate(test[col.dataKey as keyof HistoryItem])
                                  ) : (
                                    test[col.dataKey as keyof HistoryItem] || "-"
                                  )}
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
              Fill out the test results below. Fields with * are required.
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
                <p className="text-sm font-semibold">{formatDisplayDate(selectedTest?.planned1)}</p>
              </div>
            </div>

            
            {/* Form Fields - Reorganized with CCS at 110 in second row */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {/* First Row */}
  <div className="space-y-2">
    <Label htmlFor="wc">W/C</Label>
    <Input
      id="wc"
      value={formData.wc}
      onChange={(e) => handleFormChange("wc", e.target.value)}
      placeholder="Enter W/C"
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="ist">IST</Label>
    <Input
      id="ist"
      value={formData.ist}
      onChange={(e) => handleFormChange("ist", e.target.value)}
      placeholder="Enter IST"
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="fst">FST</Label>
    <Input
      id="fst"
      value={formData.fst}
      onChange={(e) => handleFormChange("fst", e.target.value)}
      placeholder="Enter FST"
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="plc">PLC</Label>
    <Input
      id="plc"
      type="number"
      step="0.01"
      value={formData.plc}
      onChange={(e) => handleFormChange("plc", e.target.value)}
      placeholder="Enter PLC"
    />
  </div>
</div>

{/* Second Row - CCS at 110 and other fields */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <div className="space-y-2">
    <Label htmlFor="ccsAt110">CCS at 110 *</Label>
    <Input
      id="ccsAt110"
      type="number"
      step="0.01"
      value={formData.ccsAt110}
      onChange={(e) => handleFormChange("ccsAt110", e.target.value)}
      placeholder="Enter CCS at 110"
      className="border-purple-300 focus:border-purple-600"
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="ccsAt1100">CCS at 1100</Label>
    <Input
      id="ccsAt1100"
      type="number"
      step="0.01"
      value={formData.ccsAt1100}
      onChange={(e) => handleFormChange("ccsAt1100", e.target.value)}
      placeholder="Enter CCS at 1100"
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="bdValue">BD</Label>
    <Input
      id="bdValue"
      type="number"
      step="0.01"
      value={formData.bdValue}
      onChange={(e) => handleFormChange("bdValue", e.target.value)}
      placeholder="Enter BD"
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="apValue">AP</Label>
    <Input
      id="apValue"
      type="number"
      step="0.01"
      value={formData.apValue}
      onChange={(e) => handleFormChange("apValue", e.target.value)}
      placeholder="Enter AP"
    />
  </div>
</div>

{/* Third Row - Remarks (full width) */}
<div className="grid grid-cols-1 gap-4">
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