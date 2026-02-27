"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, DollarSign, History, Settings, Package, Building, User, Calendar, Clock, Hash, FileText, CheckCircle } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"

// --- Configuration ---
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec"
const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4"
const ACTUAL_PRODUCTION_SHEET = "Actual Production"
const JOB_CARDS_SHEET = "JobCards"

// --- Column Mapping for Costing Data ---
const COSTING_COLUMNS = {
  planned3: 67, // Column BO (0-based index: 66)
  actual3: 68,  // Column BP (0-based index: 67)
  costingAmount: 69, // Column BQ (0-based index: 68)
}

// --- Type Definitions ---
interface RawMaterial {
  name: string
  quantity: string | number
}

interface CompleteProductionDetails {
  // Basic Info
  timestamp: string
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  nameOfSupervisor: string
  productName: string
  quantityOfFG: number
  serialNumber: string
  
  // Raw Materials
  rawMaterials: RawMaterial[]
  
  // Additional Fields
  machineRunningHour: string
  remarks1: string
  ppBagUsed: string
  ppBagToBeUsed: string
  partyName: string
  ppBagSmall: string
  costingAmount: number
  colorCondition: string
  orderNo: string
  planned1: string
  actual1: string
  status: string
  actualQty1: string
  planned2: string
  actual2: string
  timeDelay2: string
  remarks: string
  planned3: string
  actual3: string
  costingAmount2: string
  planned4: string
  actual4: string
  remarks1_2: string
  planned5: string
  actual5: string
  remarks2: string
  planned6: string
  actual6: string
  remarks3: string
}

interface PendingCostingItem {
  jobCardNo: string
  deliveryOrderNo: string
  productName: string
  firmName: string
  partyName: string
  planned3: string
  completeDetails?: CompleteProductionDetails
}

interface HistoryCostingItem {
  jobCardNo: string
  deliveryOrderNo: string
  productName: string
  firmName: string
  partyName: string
  costingAmount: number
  costingDate: string
  completeDetails?: CompleteProductionDetails
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
  { header: "Planned 3", dataKey: "planned3", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Costing Amount", dataKey: "costingAmount", toggleable: true },
  { header: "Costing Date", dataKey: "costingDate", toggleable: true },
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

// Helper function to format date values in dd/mm/yy format
function formatDateValue(value: any): string {
  if (!value) return "N/A"
  if (typeof value === 'string' && value.startsWith('Date(')) {
    const parsed = parseGvizDate(value)
    return parsed ? format(parsed, "dd/MM/yy") : value
  }
  return String(value)
}

// Helper function to format datetime values in dd/mm/yy HH:mm format
function formatDateTimeValue(value: any): string {
  if (!value) return "N/A"
  if (typeof value === 'string' && value.startsWith('Date(')) {
    const parsed = parseGvizDate(value)
    return parsed ? format(parsed, "dd/MM/yy HH:mm") : value
  }
  return String(value)
}

const initialFormState = {
  costingAmount: "",
}

export default function CostingPage() {
  const [pendingCosting, setPendingCosting] = useState<PendingCostingItem[]>([])
  const [historyCosting, setHistoryCosting] = useState<HistoryCostingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedCosting, setSelectedCosting] = useState<PendingCostingItem | null>(null)
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

  const fetchDataWithGviz = useCallback(async (sheetName: string) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
      sheetName,
    )}&cb=${new Date().getTime()}`
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

  const processCompleteDetails = (row: any): CompleteProductionDetails => {
    // Extract raw materials (20 pairs from columns 8-47)
    const rawMaterials = []
    for (let i = 0; i < 20; i++) {
      const nameCol = 8 + (i * 2)
      const qtyCol = 9 + (i * 2)
      
      const rawMaterialName = row[`col${nameCol}`]
      const rawMaterialQty = row[`col${qtyCol}`]
      
      if (rawMaterialName && String(rawMaterialName).trim() !== "") {
        rawMaterials.push({
          name: String(rawMaterialName || ""),
          quantity: rawMaterialQty || 0
        })
      }
    }

    return {
      // Basic Info
      timestamp: formatDateTimeValue(row.col0),
      jobCardNo: String(row.col1 || ""),
      firmName: String(row.col2 || ""),
      dateOfProduction: formatDateValue(row.col3),
      nameOfSupervisor: String(row.col4 || ""),
      productName: String(row.col5 || ""),
      quantityOfFG: Number(row.col6 || 0),
      serialNumber: String(row.col7 || ""),
      
      // Raw Materials
      rawMaterials,
      
      // Additional Fields
      machineRunningHour: String(row.col48 || ""),
      remarks1: String(row.col49 || ""),
      ppBagUsed: String(row.col50 || ""),
      ppBagToBeUsed: String(row.col51 || ""),
      partyName: String(row.col52 || ""),
      ppBagSmall: String(row.col53 || ""),
      costingAmount: Number(row.col54 || 0),
      colorCondition: String(row.col55 || ""),
      orderNo: String(row.col56 || ""),
      planned1: formatDateValue(row.col57),
      actual1: formatDateTimeValue(row.col58),
      status: String(row.col59 || ""),
      actualQty1: String(row.col60 || ""),
      planned2: formatDateValue(row.col61),
      actual2: formatDateTimeValue(row.col62),
      timeDelay2: String(row.col63 || ""),
      remarks: String(row.col64 || ""),
      planned3: formatDateValue(row.col65),
      actual3: formatDateTimeValue(row.col66),
      costingAmount2: String(row.col67 || ""),
      planned4: formatDateValue(row.col68),
      actual4: formatDateTimeValue(row.col69),
      remarks1_2: String(row.col70 || ""),
      planned5: formatDateValue(row.col71),
      actual5: formatDateTimeValue(row.col72),
      remarks2: String(row.col73 || ""),
      planned6: formatDateValue(row.col74),
      actual6: formatDateTimeValue(row.col75),
      remarks3: String(row.col76 || ""),
    }
  }

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [actualProductionTable, jobCardsTable] = await Promise.all([
        fetchDataWithGviz(ACTUAL_PRODUCTION_SHEET),
        fetchDataWithGviz(JOB_CARDS_SHEET).catch(() => ({ rows: [] })),
      ])

      const processGvizTable = (table: any) => {
        if (!table || !table.rows || table.rows.length === 0) return []
        // Skip the first row (header row)
        return table.rows
          .slice(1)
          .map((row: GvizRow, index: number) => {
            if (!row.c || !row.c.some((cell) => cell && cell.v !== null)) return null
            const rowData: { [key: string]: any } = { _originalIndex: index + 2 }
            row.c.forEach((cell, cellIndex) => {
              rowData[`col${cellIndex}`] = cell ? cell.v : null
            })
            return rowData
          })
          .filter(Boolean)
      }

      const actualProductionRows = processGvizTable(actualProductionTable)
      const jobCardsRows = processGvizTable(jobCardsTable)

      // --- Pending Logic: Planned3 (col66) is NOT null AND Actual3 (col67) IS null ---
      const pendingData: PendingCostingItem[] = actualProductionRows
        .filter(
          (row: { [key: string]: any }) => {
            // Check if Planned3 has value (col66)
            const hasPlanned3 = (
              row.col66 !== null && 
              row.col66 !== undefined && 
              String(row.col66).trim() !== "" && 
              String(row.col66).trim() !== "null"
            );

            // Check if Actual3 is empty (col67)
            const isActual3Empty = (
              row.col67 === null || 
              row.col67 === undefined || 
              String(row.col67).trim() === "" || 
              String(row.col67).trim() === "null"
            );

            return (
              // MUST have Job Card No
              row.col1 !== null &&
              row.col1 !== undefined &&
              String(row.col1).trim() !== "" &&
              
              // Planned3 has value
              hasPlanned3 &&
              
              // Actual3 is empty
              isActual3Empty
            );
          }
        )
        .map((row: { [key: string]: any }) => {
          const jobCard = jobCardsRows.find((jc: { [key: string]: any }) => 
            String(jc.col1 || '').trim() === String(row.col1 || '').trim()
          );

          return {
            jobCardNo: String(row.col1 || ""),
            deliveryOrderNo: String(row.col4 || ""),
            productName: String(row.col5 || ""),
            firmName: String(row.col2 || ""),
            partyName: String(jobCard?.col5 || ""),
            planned3: formatDateValue(row.col66),
            completeDetails: processCompleteDetails(row),
          };
        });

      setPendingCosting(pendingData);

      // --- History Logic: Both Planned3 (col66) and Actual3 (col67) are NOT NULL ---
      const historyData: HistoryCostingItem[] = actualProductionRows
        .filter(
          (row: { [key: string]: any }) => {
            const hasPlanned3 = (
              row.col66 !== null && 
              row.col66 !== undefined && 
              String(row.col66).trim() !== "" && 
              String(row.col66).trim() !== "null"
            );

            const hasActual3 = (
              row.col67 !== null && 
              row.col67 !== undefined && 
              String(row.col67).trim() !== "" && 
              String(row.col67).trim() !== "null"
            );

            return hasPlanned3 && hasActual3;
          }
        )
        .map((row: { [key: string]: any }) => {
          const jobCard = jobCardsRows.find((jc: { [key: string]: any }) => 
            String(jc.col1 || '').trim() === String(row.col1 || '').trim()
          );

          const costingDate = parseGvizDate(row.col67);
          const costingAmount = Number(row.col68) || 0;

          return {
            jobCardNo: String(row.col1 || ""),
            deliveryOrderNo: String(row.col4 || ""),
            productName: String(row.col5 || ""),
            firmName: String(row.col2 || ""),
            partyName: String(jobCard?.col5 || ""),
            costingAmount: costingAmount,
            costingDate: costingDate ? format(costingDate, "dd/MM/yy HH:mm") : String(row.col67 || ""),
            completeDetails: processCompleteDetails(row),
          };
        })
        .sort((a, b) => new Date(b.costingDate).getTime() - new Date(a.costingDate).getTime());

      setHistoryCosting(historyData);

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
    if (!formData.costingAmount || Number(formData.costingAmount) <= 0) {
      errors.costingAmount = "Valid costing amount is required."
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCosting = (item: PendingCostingItem) => {
    setSelectedCosting(item)
    setFormData(initialFormState)
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleSaveCosting = async () => {
    if (!validateForm() || !selectedCosting) return
    setIsSubmitting(true)
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss")
      const columnUpdates = {
        [COSTING_COLUMNS.actual3]: timestamp,
        [COSTING_COLUMNS.costingAmount]: formData.costingAmount,
      }

      const body = new URLSearchParams({
        sheetName: ACTUAL_PRODUCTION_SHEET,
        action: "updateByJobCard",
        jobCardNo: selectedCosting.jobCardNo.trim().toUpperCase(),
        columnUpdates: JSON.stringify(columnUpdates),
      })

      const res = await fetch(WEB_APP_URL, {
        method: "POST",
        body: body,
      })
      const result = await res.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to update costing data.")
      }

      alert("Costing completed successfully!")
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
        <p className="ml-4 text-lg">Loading Costing Data...</p>
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
        <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <DollarSign className="h-6 w-6 text-green-600" />
            Production Costing
          </CardTitle>
          <CardDescription className="text-gray-700">
            Add costing amounts for production items that have completed planning.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Pending Costing
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingCosting.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Costing History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyCosting.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-green-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <DollarSign className="h-5 w-5 text-primary mr-2" />
                      Pending Items ({pendingCosting.length})
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
                        {pendingCosting.length > 0 ? (
                          pendingCosting.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-green-50/50">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCosting(item)}
                                      className="bg-green-600 text-white hover:bg-green-700"
                                    >
                                      <DollarSign className="mr-2 h-4 w-4" />
                                      Add Costing
                                    </Button>
                                  ) : (
                                    item[col.dataKey as keyof PendingCostingItem] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-green-200/50 bg-green-50/50 rounded-lg mx-4 my-4 flex-1">
                                <DollarSign className="h-12 w-12 text-green-500 mb-3" />
                                <p className="font-medium text-foreground">No Pending Costing Items</p>
                                <p className="text-sm text-muted-foreground">
                                  All production items have been costed.
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
                <CardHeader className="py-3 px-4 bg-green-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <History className="h-5 w-5 text-primary mr-2" />
                      History Items ({historyCosting.length})
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
                        {historyCosting.length > 0 ? (
                          historyCosting.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-green-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "costingAmount" ? (
                                    <span className="font-medium text-green-600">
                                      ₹{Number(item.costingAmount).toLocaleString('en-IN')}
                                    </span>
                                  ) : (
                                    item[col.dataKey as keyof HistoryCostingItem] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-green-200/50 bg-green-50/50 rounded-lg mx-4 my-4 flex-1">
                                <History className="h-12 w-12 text-green-500 mb-3" />
                                <p className="font-medium text-foreground">No Costing History</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed costing records will appear here.
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
            <DialogTitle className="flex items-center gap-2 text-xl border-b pb-2">
              <Package className="h-5 w-5 text-green-600" />
              Complete Production Details - Job Card: {selectedCosting?.jobCardNo}
            </DialogTitle>
            <DialogDescription>
              All information from Actual Production sheet for this job card
            </DialogDescription>
          </DialogHeader>
          
          {selectedCosting?.completeDetails && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSaveCosting()
              }}
              className="space-y-6 pt-2"
            >
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded">
                  <Building className="h-4 w-4" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Job Card Number
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.jobCardNo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Building className="h-3 w-3" /> Firm Name
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.firmName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Date of Production
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.dateOfProduction || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" /> Name of Supervisor
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.nameOfSupervisor || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Product Name
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.productName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Quantity of FG
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.quantityOfFG || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Serial Number
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.serialNumber || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Machine Running Hour
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.machineRunningHour || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Delivery Order No.
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.deliveryOrderNo || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Raw Materials */}
              {selectedCosting.completeDetails.rawMaterials.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-md font-semibold flex items-center gap-2 text-blue-700 bg-blue-50 p-2 rounded">
                    <Package className="h-4 w-4" /> Raw Materials Used
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-blue-50">
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Raw Material Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCosting.completeDetails.rawMaterials.map((material, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>{material.name}</TableCell>
                            <TableCell className="text-right">{material.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Section 3: Additional Production Details */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-orange-700 bg-orange-50 p-2 rounded">
                  <FileText className="h-4 w-4" /> Additional Production Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Party Name</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.partyName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Order No.</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.orderNo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Color Condition</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.colorCondition || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag Used</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.ppBagUsed || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag To Be Used</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.ppBagToBeUsed || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag (Small)</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.ppBagSmall || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Remarks 1</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.remarks1 || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Section 4: Planning and Actual Data */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-indigo-700 bg-indigo-50 p-2 rounded">
                  <CheckCircle className="h-4 w-4" /> Planning & Actual Data
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 1</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned1 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 1</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual1 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Status</Label>
                    <p className="text-sm"><Badge variant="outline">{selectedCosting.completeDetails.status || "N/A"}</Badge></p>
                  </div>
                  {/* <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual Qty 1</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actualQty1 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Time Delay 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.timeDelay2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Remarks</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.remarks || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 3</Label>
                    <p className="text-sm font-medium text-green-600">{selectedCosting.completeDetails.planned3 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 3</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual3 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Costing Amount 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.costingAmount2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 4</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned4 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 4</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual4 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Remarks 1.2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.remarks1_2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 5</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned5 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 5</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual5 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Remarks 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.remarks2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 6</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned6 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 6</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual6 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Remarks 3</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.remarks3 || "N/A"}</p>
                  </div> */}
                </div>
              </div>

              <Separator />

              {/* Costing Amount Input Section */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold flex items-center gap-2 text-green-700">
                  <DollarSign className="h-4 w-4" /> Costing Amount
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="costingAmount">Costing Amount (₹) *</Label>
                  <Input
                    id="costingAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter costing amount"
                    value={formData.costingAmount}
                    onChange={(e) => handleFormChange("costingAmount", e.target.value)}
                    className={formErrors.costingAmount ? "border-red-500" : ""}
                  />
                  {formErrors.costingAmount && <p className="text-xs text-red-600 mt-1">{formErrors.costingAmount}</p>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Costing Amount
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}