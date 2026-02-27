"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, AlertTriangle, FileText, History, Package, DollarSign, Clock, User, Building, Hash, CheckCircle, Calendar } from "lucide-react"
import { format } from "date-fns"
// Shadcn UI components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

// --- Configuration ---
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec"
const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4"
const ACTUAL_PRODUCTION_SHEET = "Actual Production"

// --- Column Mapping for Tally Data ---
const TALLY_COLUMNS = {
  tallyTimestamp: 64, // Column BL (index 63, but 1-based = 64)
  remarks: 66, // Column BN (index 65, but 1-based = 66)
}

// --- Type Definitions for Actual Production Data ---
interface ActualProductionItem {
  // Basic Info (Columns 0-7)
  timestamp: string
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  nameOfSupervisor: string
  productName: string
  quantityOfFG: number
  serialNumber: string
  
  // Raw Materials (20 pairs - Columns 8-47)
  rawMaterials: {
    name: string
    quantity: string | number
  }[]
  
  // Additional Fields (Columns 48-68)
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
  
  // Tally specific fields
  checkStatus: string
  checkTimestamp: string
  tallyTimestamp: string | null
  tallyRemarks: string
  _rawCheckTimestamp: any
  _rawTallyTimestamp: any
}

interface GvizRow {
  c: ({ v: any; f?: string } | null)[]
}

// Helper function to parse Google's date format
function parseGvizDate(gvizDateString: string | null | undefined): Date | null {
  if (!gvizDateString || typeof gvizDateString !== "string" || !gvizDateString.startsWith("Date(")) return null
  const numbers = gvizDateString.match(/\d+/g)
  if (!numbers || numbers.length < 3) return null
  const [year, month, day, hours = 0, minutes = 0, seconds = 0] = numbers.map(Number)
  const date = new Date(year, month, day, hours, minutes, seconds)
  return isNaN(date.getTime()) ? null : date
}

// Helper function to format date values
function formatDateValue(value: any): string {
  if (!value) return "N/A"
  if (typeof value === 'string' && value.startsWith('Date(')) {
    const parsed = parseGvizDate(value)
    return parsed ? format(parsed, "dd/MM/yyyy HH:mm") : value
  }
  return String(value)
}

export default function TallyPage() {
  const [pendingTallies, setPendingTallies] = useState<ActualProductionItem[]>([])
  const [historyTallies, setHistoryTallies] = useState<ActualProductionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTally, setSelectedTally] = useState<ActualProductionItem | null>(null)
  const [remarks, setRemarks] = useState("")

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

  const processActualProductionRow = (row: any): ActualProductionItem => {
    // Extract raw materials (20 pairs from columns 8-47)
    const rawMaterials = []
    for (let i = 0; i < 20; i++) {
      const nameCol = 8 + (i * 2) // Raw Material Name columns
      const qtyCol = 9 + (i * 2)   // Quantity columns
      
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
      timestamp: formatDateValue(row.col0),
      jobCardNo: String(row.col1 || ""),
      firmName: String(row.col2 || ""),
      dateOfProduction: formatDateValue(row.col3),
      nameOfSupervisor: String(row.col4 || ""),
      productName: String(row.col5 || ""),
      quantityOfFG: Number(row.col6 || 0),
      serialNumber: String(row.col7 || ""),
      
      // Raw Materials
      rawMaterials,
      
      // Additional Fields (adjust indices based on your actual columns)
      machineRunningHour: String(row.col48 || ""),
      remarks1: String(row.col49 || ""),
      ppBagUsed: String(row.col50 || ""),
      ppBagToBeUsed: String(row.col51 || ""),
      partyName: String(row.col52 || ""),
      ppBagSmall: String(row.col53 || ""),
      costingAmount: Number(row.col54 || 0),
      colorCondition: String(row.col55 || ""),
      orderNo: String(row.col56 || ""),
      planned1: String(row.col57 || ""),
      actual1: String(row.col58 || ""),
      status: String(row.col59 || ""),
      actualQty1: String(row.col60 || ""),
      planned2: String(row.col61 || ""),
      actual2: String(row.col62 || ""),
      timeDelay2: String(row.col63 || ""),
      remarks: String(row.col64 || ""),
      planned3: String(row.col65 || ""),
      actual3: String(row.col66 || ""),
      costingAmount2: String(row.col67 || ""),
      planned4: String(row.col68 || ""),
      actual4: String(row.col69 || ""),
      remarks1_2: String(row.col70 || ""),
      planned5: String(row.col71 || ""),
      actual5: String(row.col72 || ""),
      remarks2: String(row.col73 || ""),
      planned6: String(row.col74 || ""),
      actual6: String(row.col75 || ""),
      remarks3: String(row.col76 || ""),
      
      // Tally specific fields
      checkStatus: String(row.col59 || "N/A"), // Status column
      checkTimestamp: row.col58 ? formatDateValue(row.col58) : "N/A", // Actual1 column
      tallyTimestamp: row.col63 ? formatDateValue(row.col63) : null, // Actual2 column (tally timestamp)
      tallyRemarks: String(row.col65 || ""), // Remarks column
      _rawCheckTimestamp: row.col58,
      _rawTallyTimestamp: row.col63,
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const actualProductionTable = await fetchDataWithGviz(ACTUAL_PRODUCTION_SHEET);

      const processGvizTable = (table: any) => {
        if (!table || !table.rows || table.rows.length === 0) return [];
        return table.rows
          .map((row: GvizRow) => {
            if (!row || !row.c) return null;
            const rowData: { [key: string]: any } = {};
            row.c.forEach((cell, cellIndex) => {
              rowData[`col${cellIndex}`] = cell ? cell.v : null;
            });
            return rowData;
          })
          .filter(Boolean);
      };

      const actualProductionRows = processGvizTable(actualProductionTable).slice(1); // Skip header row
      
      // Process all rows
      const allItems = actualProductionRows.map(row => processActualProductionRow(row));

      // Filter pending tallies (have check timestamp but no tally timestamp)
      const pendingData = allItems.filter(item => 
        item._rawCheckTimestamp && 
        (item._rawTallyTimestamp === null || String(item._rawTallyTimestamp).trim() === "")
      );
      setPendingTallies(pendingData);

      // Filter history (have tally timestamp)
      const historyData = allItems
        .filter(item => item._rawTallyTimestamp && String(item._rawTallyTimestamp).trim() !== "")
        .sort((a, b) => {
          if (a.tallyTimestamp && b.tallyTimestamp) {
            return new Date(b.tallyTimestamp).getTime() - new Date(a.tallyTimestamp).getTime()
          }
          return 0
        });
      setHistoryTallies(historyData);

    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchDataWithGviz]);

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleVerify = (tally: ActualProductionItem) => {
    setSelectedTally(tally)
    setRemarks("")
    setIsDialogOpen(true)
  }

  const handleSaveTally = async () => {
    if (!selectedTally) return
    setIsSubmitting(true)
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss")
      const columnUpdates = {
        [TALLY_COLUMNS.tallyTimestamp]: timestamp,
        [TALLY_COLUMNS.remarks]: remarks,
      }

      const body = new URLSearchParams({
        sheetName: ACTUAL_PRODUCTION_SHEET,
        action: "updateByJobCard",
        jobCardNo: selectedTally.jobCardNo.trim().toUpperCase(),
        columnUpdates: JSON.stringify(columnUpdates),
      })

      const res = await fetch(WEB_APP_URL, {
        method: "POST",
        body: body,
      })
      const result = await res.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to update tally data in Actual Production sheet.")
      }

      alert("Tally verification completed successfully!")
      setIsDialogOpen(false)
      await loadData()
    } catch (err: any) {
      setError(err.message)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- UI Rendering ---
  const pendingTableColumns = [
    {
      header: "Action",
      key: "actionColumn",
      render: (tally: ActualProductionItem) => (
        <Button size="sm" onClick={() => handleVerify(tally)} className="bg-purple-600 text-white hover:bg-purple-700">
          <FileText className="mr-2 h-4 w-4" />
          Verify Tally
        </Button>
      ),
    },
    {
      header: "Job Card No.",
      key: "jobCardNo",
      render: (tally: ActualProductionItem) => <span className="font-medium">{tally.jobCardNo}</span>,
    },
    {
      header: "Firm Name",
      key: "firmName",
      render: (tally: ActualProductionItem) => tally.firmName,
    },
    { 
      header: "Product Name", 
      key: "productName", 
      render: (tally: ActualProductionItem) => tally.productName 
    },
    { 
      header: "Quantity", 
      key: "quantityOfFG", 
      render: (tally: ActualProductionItem) => tally.quantityOfFG 
    },
    {
      header: "Status",
      key: "status",
      render: (tally: ActualProductionItem) => <Badge variant="default">{tally.status}</Badge>,
    },
  ]

  const historyTableColumns = [
    {
      header: "Job Card No.",
      key: "jobCardNo",
      render: (tally: ActualProductionItem) => <span className="font-medium">{tally.jobCardNo}</span>,
    },
    {
      header: "Firm Name",
      key: "firmName",
      render: (tally: ActualProductionItem) => tally.firmName,
    },
    { 
      header: "Product Name", 
      key: "productName", 
      render: (tally: ActualProductionItem) => tally.productName 
    },
    { 
      header: "Quantity", 
      key: "quantityOfFG", 
      render: (tally: ActualProductionItem) => tally.quantityOfFG 
    },
    { 
      header: "Tally Date", 
      key: "tallyTimestamp", 
      render: (tally: ActualProductionItem) => tally.tallyTimestamp || "N/A" 
    },
    {
      header: "Remarks",
      key: "tallyRemarks",
      render: (tally: ActualProductionItem) => (
        <span className="max-w-xs truncate" title={tally.tallyRemarks}>
          {tally.tallyRemarks || "-"}
        </span>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
        <p className="ml-4 text-lg">Loading Tally Data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p className="text-sm">{error}</p>
        <Button onClick={loadData} className="mt-4">
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
            <FileText className="h-6 w-6 text-purple-600" />
            Tally Management
          </CardTitle>
          <CardDescription className="text-gray-700">
            Manage and verify production tallies for completed items.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Pending Tallies
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingTallies.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Tally History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyTallies.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-purple-50 rounded-md">
                  <CardTitle className="text-md font-semibold">
                    Pending Tallies ({pendingTallies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {pendingTableColumns.map((col) => (
                            <TableHead key={col.key}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTallies.length > 0 ? (
                          pendingTallies.map((tally, index) => (
                            <TableRow key={`${tally.jobCardNo}-${index}`} className="hover:bg-purple-50/50">
                              {pendingTableColumns.map((col) => (
                                <TableCell key={col.key}>{col.render(tally)}</TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={pendingTableColumns.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center">
                                <FileText className="h-12 w-12 text-purple-500 mb-3" />
                                <p className="font-medium">No Pending Tallies</p>
                                <p className="text-sm text-muted-foreground">
                                  All production tallies have been verified.
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
                  <CardTitle className="text-md font-semibold">
                    Tally History ({historyTallies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {historyTableColumns.map((col) => (
                            <TableHead key={col.key}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyTallies.length > 0 ? (
                          historyTallies.map((tally, index) => (
                            <TableRow key={`${tally.jobCardNo}-${index}`} className="hover:bg-purple-50/50">
                              {historyTableColumns.map((col) => (
                                <TableCell key={col.key}>{col.render(tally)}</TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={historyTableColumns.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center">
                                <History className="h-12 w-12 text-purple-500 mb-3" />
                                <p className="font-medium">No Tally History</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed tally records will appear here.
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
              <Package className="h-5 w-5 text-purple-600" />
              Complete Production Details - Job Card: {selectedTally?.jobCardNo}
            </DialogTitle>
            <DialogDescription>
              All information from Actual Production sheet for this job card
            </DialogDescription>
          </DialogHeader>
          
          {selectedTally && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSaveTally()
              }}
              className="space-y-6 pt-2"
            >
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-purple-700 bg-purple-50 p-2 rounded">
                  <Building className="h-4 w-4" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Job Card Number
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.jobCardNo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Building className="h-3 w-3" /> Firm Name
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.firmName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Date of Production
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.dateOfProduction || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" /> Name of Supervisor
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.nameOfSupervisor || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Product Name
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.productName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Quantity of FG
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.quantityOfFG || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Serial Number
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.serialNumber || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Machine Running Hour
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.machineRunningHour || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Raw Materials */}
              {selectedTally.rawMaterials.length > 0 && (
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
                        {selectedTally.rawMaterials.map((material, idx) => (
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

              {/* Section 3: Costing Information */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded">
                  <DollarSign className="h-4 w-4" /> Costing Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-green-50/30">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Costing Amount</Label>
                    <p className="text-lg font-bold text-green-600">
                      ₹ {selectedTally.costingAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                    </p>
                  </div>
                  {selectedTally.costingAmount2 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Costing Amount 2</Label>
                      <p className="text-sm font-medium">{selectedTally.costingAmount2}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Additional Production Details */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-orange-700 bg-orange-50 p-2 rounded">
                  <FileText className="h-4 w-4" /> Additional Production Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Party Name</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.partyName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Order No.</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.orderNo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Color Condition</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.colorCondition || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag Used</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.ppBagUsed || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag To Be Used</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.ppBagToBeUsed || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag (Small)</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.ppBagSmall || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Section 5: Planning and Actual Data */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-indigo-700 bg-indigo-50 p-2 rounded">
                  <CheckCircle className="h-4 w-4" /> Planning & Actual Data
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Planned 1</Label>
                    <p className="text-sm">{selectedTally.planned1 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Actual 1</Label>
                    <p className="text-sm">{selectedTally.actual1 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Status</Label>
                    <p className="text-sm"><Badge>{selectedTally.status || "N/A"}</Badge></p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Actual Qty 1</Label>
                    <p className="text-sm">{selectedTally.actualQty1 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Planned 2</Label>
                    <p className="text-sm">{selectedTally.planned2 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Actual 2</Label>
                    <p className="text-sm">{selectedTally.actual2 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Time Delay 2</Label>
                    <p className="text-sm">{selectedTally.timeDelay2 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Remarks</Label>
                    <p className="text-sm">{selectedTally.remarks || "N/A"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tally Remarks Section */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-purple-700">
                  <FileText className="h-4 w-4" /> Tally Verification Remarks
                </h3>
                <div className="space-y-2">
                  <Textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter your remarks for this tally verification..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete Tally Verification
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}