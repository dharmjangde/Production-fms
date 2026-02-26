"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CheckCircle, History, Settings, User } from "lucide-react"
import { format } from "date-fns"
// Shadcn UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"

// --- Configuration ---
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec"
const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4"
const ACTUAL_PRODUCTION_SHEET = "Actual Production"
const MASTER_SHEET = "Master"
const JOB_CARDS_SHEET = "JobCards"

// --- Column Mapping based on your sheet structure ---
// Column indices (0-based, A=0, B=1, etc.)
const COLUMNS = {
  // Basic Info (Columns A-E)
  timestamp: 0,           // Column A
  jobCardNo: 1,           // Column B
  firmName: 2,            // Column C
  dateOfProduction: 3,    // Column D
  supervisorName: 4,      // Column E
  
  // Product Info (Columns F-H)
  productName: 5,         // Column F
  quantityFG: 6,          // Column G
  serialNumber: 7,        // Column H
  
  // Raw Materials (Columns I to whatever - up to 20 pairs)
  // Each raw material has Name at even indices, Quantity at odd indices
  // Starting from Column I (index 8)
  
  // Other fields after raw materials
  machineRunningHour: 48,  // Column AV (approx - count may vary)
  remarks1: 49,            // Column AW
  ppBagUsed: 50,           // Column AX
  ppBagToBeUsed: 51,       // Column AY
  partyName: 52,           // Column AZ
  ppBagSmall: 53,          // Column BA
  costingAmount: 54,       // Column BB
  colorCondition: 55,      // Column BC
  orderNo: 56,             // Column BD
  
  // Planned/Actual cycles (Starting from Column BE)
  planned1: 57,            // Column BE
  actual1: 58,             // Column BF
  timeDelay1: 59,          // Column BG
  remarks: 60,             // Column BH
  actualQty1: 61,          // Column BI
  
  planned2: 62,            // Column BJ
  actual2: 63,             // Column BK
  timeDelay2: 64,          // Column BL
  remarks2: 65,            // Column BM
  
  planned3: 66,            // Column BN
  actual3: 67,             // Column BO
  costingAmount2: 68,      // Column BP
  
  planned4: 69,            // Column BQ
  actual4: 70,             // Column BR
  remarks1_4: 71,          // Column BS
  
  planned5: 72,            // Column BT - Hemlal Planned
  actual5: 73,             // Column BU - Hemlal Actual
  remarks2_5: 74,          // Column BV - Hemlal Remarks (Remakrs2)
  
  planned6: 75,            // Column BW - Jitendra Planned
  actual6: 76,             // Column BX - Jitendra Actual
  remarks3_6: 77,          // Column BY - Jitendra Remarks (Remakrs3)
}

// --- Type Definitions ---
interface ActualProductionItem {
  // Basic Info
  timestamp: string
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  supervisorName: string
  productName: string
  quantityFG: number
  serialNumber: string
  
  // Raw Materials (up to 20 pairs)
  rawMaterials: Array<{ name: string; quantity: number }>
  
  // Other fields
  machineRunningHour: string
  remarks1: string
  ppBagUsed: string
  ppBagToBeUsed: string
  partyName: string
  ppBagSmall: string
  costingAmount: string
  colorCondition: string
  orderNo: string
  
  // Planned/Actual cycles
  planned1: string
  actual1: string
  timeDelay1: string
  remarks: string
  actualQty1: number
  
  planned2: string
  actual2: string
  timeDelay2: string
  remarks2: string
  
  planned3: string
  actual3: string
  costingAmount2: string
  
  planned4: string
  actual4: string
  remarks1_4: string
  
  // Hemlal (Planned5/Actual5)
  planned5: string
  actual5: string
  remarks2_5: string
  
  // Jitendra (Planned6/Actual6)
  planned6: string
  actual6: string
  remarks3_6: string
  
  // Row index for updates
  rowIndex: number
}

interface HemlalPendingItem {
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  supervisorName: string
  productName: string
  quantityFG: number
  serialNumber: string
  rawMaterials: Array<{ name: string; quantity: number }>
  partyName: string
  planned5: string
  rowIndex: number
}

interface JitendraPendingItem {
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  supervisorName: string
  productName: string
  quantityFG: number
  serialNumber: string
  rawMaterials: Array<{ name: string; quantity: number }>
  partyName: string
  planned6: string
  rowIndex: number
}

interface DevshreePendingItem {
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  supervisorName: string
  productName: string
  quantityFG: number
  serialNumber: string
  rawMaterials: Array<{ name: string; quantity: number }>
  partyName: string
  plannedTest: string
  actualQty1?: number
  labTest1: string  // Added from JobCards
  labTest2: string  // Added from JobCards
  chemicalTest: string  // Added from JobCards
  rowIndex: number
}

interface CombinedHistoryItem {
  id: string
  type: 'devshree' | 'hemlal' | 'jitendra'
  jobCardNo: string
  firmName: string
  productName: string
  partyName: string
  completedAt: string
  status?: string
  actualQty?: number
  remarks?: string
}

interface GvizRow {
  c: ({ v: any; f?: string } | null)[]
}

// --- Column Definitions for Tables ---
const HEMLAL_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Date Of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor", dataKey: "supervisorName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity FG", dataKey: "quantityFG", toggleable: true },
  { header: "Serial Number", dataKey: "serialNumber", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Planned Date (Planned5)", dataKey: "planned5", toggleable: true },
]

// Add raw material columns dynamically (up to 20)
for (let i = 1; i <= 20; i++) {
  HEMLAL_COLUMNS_META.push(
    { header: `Raw Material ${i}`, dataKey: `rawMaterial${i}`, toggleable: true },
    { header: `Qty RM ${i}`, dataKey: `rawMaterialQty${i}`, toggleable: true }
  )
}

const JITENDRA_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Date Of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor", dataKey: "supervisorName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity FG", dataKey: "quantityFG", toggleable: true },
  { header: "Serial Number", dataKey: "serialNumber", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Planned Date (Planned6)", dataKey: "planned6", toggleable: true },
]

for (let i = 1; i <= 20; i++) {
  JITENDRA_COLUMNS_META.push(
    { header: `Raw Material ${i}`, dataKey: `rawMaterial${i}`, toggleable: true },
    { header: `Qty RM ${i}`, dataKey: `rawMaterialQty${i}`, toggleable: true }
  )
}

// Updated Devshree columns with Lab Test columns
const DEVSHREE_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Date Of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor", dataKey: "supervisorName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity FG", dataKey: "quantityFG", toggleable: true },
  { header: "Serial Number", dataKey: "serialNumber", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Lab Test 1", dataKey: "labTest1", toggleable: true },
  { header: "Lab Test 2", dataKey: "labTest2", toggleable: true },
  { header: "Chemical Test", dataKey: "chemicalTest", toggleable: true },
  { header: "Planned Test", dataKey: "plannedTest", toggleable: true },
  { header: "Actual Qty 1", dataKey: "actualQty1", toggleable: true },
]

for (let i = 1; i <= 20; i++) {
  DEVSHREE_COLUMNS_META.push(
    { header: `Raw Material ${i}`, dataKey: `rawMaterial${i}`, toggleable: true },
    { header: `Qty RM ${i}`, dataKey: `rawMaterialQty${i}`, toggleable: true }
  )
}

const HISTORY_COLUMNS_META = [
  { header: "Type", dataKey: "type", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Completed At", dataKey: "completedAt", toggleable: true },
  { header: "Status/Remarks", dataKey: "statusOrRemarks", toggleable: true },
  { header: "Actual Qty", dataKey: "actualQty", toggleable: true },
]

// Helper function to parse Google's date format
function parseGvizDate(gvizDateString: string | null | undefined): Date | null {
  if (!gvizDateString || typeof gvizDateString !== "string" || !gvizDateString.startsWith("Date(")) return null
  const numbers = gvizDateString.match(/\d+/g)
  if (!numbers || numbers.length < 3) return null
  const [year, month, day, hours = 0, minutes = 0, seconds = 0] = numbers.map(Number)
  return new Date(year, month, day, hours, minutes, seconds)
}

// Helper to format date
function formatDate(date: Date | string | null): string {
  if (!date) return "-"
  if (typeof date === 'string') return date
  return format(date, "dd/MM/yy HH:mm")
}

// Parse a row from Actual Production sheet
function parseActualProductionRow(row: any, index: number): ActualProductionItem {
  // Extract raw materials (pairs of name and quantity from column I onwards)
  const rawMaterials: Array<{ name: string; quantity: number }> = []
  for (let i = 0; i < 20; i++) {
    const nameCol = 8 + (i * 2) // Column I (8) + (i*2)
    const qtyCol = 9 + (i * 2)  // Column J (9) + (i*2)
    
    const name = row[`col${nameCol}`]
    const qty = row[`col${qtyCol}`]
    
    if (name && String(name).trim() !== "") {
      rawMaterials.push({
        name: String(name || ""),
        quantity: Number(qty) || 0
      })
    } else {
      break
    }
  }

  return {
    // Basic Info
    timestamp: formatDate(parseGvizDate(row.col0)),
    jobCardNo: String(row.col1 || ""),
    firmName: String(row.col2 || ""),
    dateOfProduction: formatDate(parseGvizDate(row.col3)),
    supervisorName: String(row.col4 || ""),
    productName: String(row.col5 || ""),
    quantityFG: Number(row.col6) || 0,
    serialNumber: String(row.col7 || ""),
    
    // Raw Materials
    rawMaterials,
    
    // Other fields
    machineRunningHour: String(row.col48 || ""),
    remarks1: String(row.col49 || ""),
    ppBagUsed: String(row.col50 || ""),
    ppBagToBeUsed: String(row.col51 || ""),
    partyName: String(row.col52 || ""),
    ppBagSmall: String(row.col53 || ""),
    costingAmount: String(row.col54 || ""),
    colorCondition: String(row.col55 || ""),
    orderNo: String(row.col56 || ""),
    
    // Planned/Actual cycles
    planned1: formatDate(parseGvizDate(row.col57)),
    actual1: formatDate(parseGvizDate(row.col58)),
    timeDelay1: String(row.col59 || ""),
    remarks: String(row.col60 || ""),
    actualQty1: Number(row.col61) || 0,
    
    planned2: formatDate(parseGvizDate(row.col62)),
    actual2: formatDate(parseGvizDate(row.col63)),
    timeDelay2: String(row.col64 || ""),
    remarks2: String(row.col65 || ""),
    
    planned3: formatDate(parseGvizDate(row.col66)),
    actual3: formatDate(parseGvizDate(row.col67)),
    costingAmount2: String(row.col68 || ""),
    
    planned4: formatDate(parseGvizDate(row.col69)),
    actual4: formatDate(parseGvizDate(row.col70)),
    remarks1_4: String(row.col71 || ""),
    
    // Hemlal (Planned5/Actual5)
    planned5: formatDate(parseGvizDate(row.col72)),
    actual5: formatDate(parseGvizDate(row.col73)),
    remarks2_5: String(row.col74 || ""),
    
    // Jitendra (Planned6/Actual6)
    planned6: formatDate(parseGvizDate(row.col75)),
    actual6: formatDate(parseGvizDate(row.col76)),
    remarks3_6: String(row.col77 || ""),
    
    rowIndex: index + 4 // +2 because of header row and 1-based index
  }
}

const initialHemlalFormState = {
  remarks: "",
}

const initialJitendraFormState = {
  remarks: "",
}

const initialDevshreeFormState = {
  status: "",
  actualQty: "",
}

export default function CheckPage() {
  const [hemlalPending, setHemlalPending] = useState<HemlalPendingItem[]>([])
  const [jitendraPending, setJitendraPending] = useState<JitendraPendingItem[]>([])
  const [devshreePending, setDevshreePending] = useState<DevshreePendingItem[]>([])
  const [combinedHistory, setCombinedHistory] = useState<CombinedHistoryItem[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isHemlalDialogOpen, setIsHemlalDialogOpen] = useState(false)
  const [isJitendraDialogOpen, setIsJitendraDialogOpen] = useState(false)
  const [isDevshreeDialogOpen, setIsDevshreeDialogOpen] = useState(false)
  const [selectedHemlal, setSelectedHemlal] = useState<HemlalPendingItem | null>(null)
  const [selectedJitendra, setSelectedJitendra] = useState<JitendraPendingItem | null>(null)
  const [selectedDevshree, setSelectedDevshree] = useState<DevshreePendingItem | null>(null)
  const [hemlalFormData, setHemlalFormData] = useState(initialHemlalFormState)
  const [jitendraFormData, setJitendraFormData] = useState(initialJitendraFormState)
  const [devshreeFormData, setDevshreeFormData] = useState(initialDevshreeFormState)
  const [hemlalFormErrors, setHemlalFormErrors] = useState<Record<string, string | null>>({})
  const [jitendraFormErrors, setJitendraFormErrors] = useState<Record<string, string | null>>({})
  const [devshreeFormErrors, setDevshreeFormErrors] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState("hemlal")
  
  // Column visibility states
  const [visibleHemlalColumns, setVisibleHemlalColumns] = useState<Record<string, boolean>>({})
  const [visibleJitendraColumns, setVisibleJitendraColumns] = useState<Record<string, boolean>>({})
  const [visibleDevshreeColumns, setVisibleDevshreeColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const initializeVisibility = (columnsMeta: any[]) => {
      const visibility: Record<string, boolean> = {}
      columnsMeta.forEach((col) => {
        visibility[col.dataKey] = col.alwaysVisible || col.toggleable
      })
      return visibility
    }
    setVisibleHemlalColumns(initializeVisibility(HEMLAL_COLUMNS_META))
    setVisibleJitendraColumns(initializeVisibility(JITENDRA_COLUMNS_META))
    setVisibleDevshreeColumns(initializeVisibility(DEVSHREE_COLUMNS_META))
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

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [actualProductionTable, masterTable, jobCardsTable] = await Promise.all([
        fetchDataWithGviz(ACTUAL_PRODUCTION_SHEET),
        fetchDataWithGviz(MASTER_SHEET).catch(() => ({ rows: [] })),
        fetchDataWithGviz(JOB_CARDS_SHEET).catch(() => ({ rows: [] })),
      ])

      const processGvizTable = (table: any) => {
        if (!table || !table.rows || table.rows.length === 0) return []
        return table.rows
          .slice(1) // Skip header row
          .map((row: GvizRow, index: number) => {
            if (!row.c || !row.c.some((cell) => cell && cell.v !== null)) return null
            const rowData: { [key: string]: any } = {}
            row.c.forEach((cell, cellIndex) => {
              rowData[`col${cellIndex}`] = cell ? cell.v : null
            })
            return rowData
          })
          .filter(Boolean)
      }

      const actualProductionRows = processGvizTable(actualProductionTable)
      const masterDataRows = processGvizTable(masterTable)
      const jobCardsRows = processGvizTable(jobCardsTable)

      // Parse all rows
      const allItems = actualProductionRows.map((row: any, index: number) => 
        parseActualProductionRow(row, index)
      )

      // Hemlal Pending: Planned5 (BT) is not null AND Actual5 (BU) is null
      const hemlalPendingData: HemlalPendingItem[] = allItems
        .filter(item => 
          item.jobCardNo && 
          item.planned5 && item.planned5 !== "-" && 
          (!item.actual5 || item.actual5 === "-")
        )
        .map(item => ({
          jobCardNo: item.jobCardNo,
          firmName: item.firmName,
          dateOfProduction: item.dateOfProduction,
          supervisorName: item.supervisorName,
          productName: item.productName,
          quantityFG: item.quantityFG,
          serialNumber: item.serialNumber,
          rawMaterials: item.rawMaterials,
          partyName: item.partyName,
          planned5: item.planned5,
          rowIndex: item.rowIndex,
        }))

      setHemlalPending(hemlalPendingData)

      // Jitendra Pending: Planned6 (BW) is not null AND Actual6 (BX) is null
      const jitendraPendingData: JitendraPendingItem[] = allItems
        .filter(item => 
          item.jobCardNo && 
          item.planned6 && item.planned6 !== "-" && 
          (!item.actual6 || item.actual6 === "-")
        )
        .map(item => ({
          jobCardNo: item.jobCardNo,
          firmName: item.firmName,
          dateOfProduction: item.dateOfProduction,
          supervisorName: item.supervisorName,
          productName: item.productName,
          quantityFG: item.quantityFG,
          serialNumber: item.serialNumber,
          rawMaterials: item.rawMaterials,
          partyName: item.partyName,
          planned6: item.planned6,
          rowIndex: item.rowIndex,
        }))

      setJitendraPending(jitendraPendingData)

      // Devshree Pending: Planned test exists (Planned1) and verification not done
      // Enhanced with Lab Test data from JobCards
      const devshreePendingData: DevshreePendingItem[] = allItems
        .filter(item => 
          item.jobCardNo && 
          item.planned1 && item.planned1 !== "-" && 
          (!item.actual1 || item.actual1 === "-")
        )
        .map(item => {
          // Find matching job card to get lab test data
          const jobCard = jobCardsRows.find((jc: any) => 
            String(jc.col1 || '').trim() === String(item.jobCardNo).trim()
          )

          return {
            jobCardNo: item.jobCardNo,
            firmName: item.firmName,
            dateOfProduction: item.dateOfProduction,
            supervisorName: item.supervisorName,
            productName: item.productName,
            quantityFG: item.quantityFG,
            serialNumber: item.serialNumber,
            rawMaterials: item.rawMaterials,
            partyName: item.partyName,
            plannedTest: item.planned1,
            actualQty1: item.actualQty1,
            // Lab test data from JobCards sheet
            labTest1: String(jobCard?.col21 || "N/A"), // Column V from JobCards sheet
            labTest2: String(jobCard?.col33 || "N/A"), // Column AH from JobCards sheet
            chemicalTest: String(jobCard?.col44 || "N/A"), // Column AS from JobCards sheet
            rowIndex: item.rowIndex,
          }
        })

      setDevshreePending(devshreePendingData)

      // Combined History
      const historyData: CombinedHistoryItem[] = []

      // Devshree completed (Actual1 is not null)
      allItems
        .filter(item => item.actual1 && item.actual1 !== "-")
        .forEach(item => {
          historyData.push({
            id: `devshree-${item.jobCardNo}-${item.actual1}`,
            type: 'devshree',
            jobCardNo: item.jobCardNo,
            firmName: item.firmName,
            productName: item.productName,
            partyName: item.partyName,
            completedAt: item.actual1,
            status: item.remarks || "Completed",
            actualQty: item.actualQty1,
          })
        })

      // Hemlal completed (Actual5 is not null)
      allItems
        .filter(item => item.actual5 && item.actual5 !== "-")
        .forEach(item => {
          historyData.push({
            id: `hemlal-${item.jobCardNo}-${item.actual5}`,
            type: 'hemlal',
            jobCardNo: item.jobCardNo,
            firmName: item.firmName,
            productName: item.productName,
            partyName: item.partyName,
            completedAt: item.actual5,
            remarks: item.remarks2_5,
          })
        })

      // Jitendra completed (Actual6 is not null)
      allItems
        .filter(item => item.actual6 && item.actual6 !== "-")
        .forEach(item => {
          historyData.push({
            id: `jitendra-${item.jobCardNo}-${item.actual6}`,
            type: 'jitendra',
            jobCardNo: item.jobCardNo,
            firmName: item.firmName,
            productName: item.productName,
            partyName: item.partyName,
            completedAt: item.actual6,
            remarks: item.remarks3_6,
          })
        })

      // Sort by completion date (newest first)
      historyData.sort((a, b) => {
        const dateA = new Date(a.completedAt).getTime()
        const dateB = new Date(b.completedAt).getTime()
        return dateB - dateA
      })

      setCombinedHistory(historyData)

      // Get Status options from Master Sheet
      const statuses: string[] = [
        ...new Set(masterDataRows.map((row: any) => String(row.col5 || "")).filter(Boolean)),
      ]
      setStatusOptions(statuses)

    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fetchDataWithGviz])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Form handlers
  const handleHemlalFormChange = (field: string, value: any) => {
    setHemlalFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleJitendraFormChange = (field: string, value: any) => {
    setJitendraFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleDevshreeFormChange = (field: string, value: any) => {
    setDevshreeFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Validation functions
  const validateHemlalForm = () => {
    const errors: Record<string, string> = {}
    if (!hemlalFormData.remarks?.trim()) {
      errors.remarks = "Remarks are required."
    }
    setHemlalFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateJitendraForm = () => {
    const errors: Record<string, string> = {}
    if (!jitendraFormData.remarks?.trim()) {
      errors.remarks = "Remarks are required."
    }
    setJitendraFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateDevshreeForm = () => {
    const errors: Record<string, string> = {}
    if (!devshreeFormData.status) errors.status = "Status is required."
    if (!devshreeFormData.actualQty || Number(devshreeFormData.actualQty) <= 0) {
      errors.actualQty = "Valid actual quantity is required."
    }
    setDevshreeFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Action handlers
  const handleHemlalMarkDone = (item: HemlalPendingItem) => {
    setSelectedHemlal(item)
    setHemlalFormData({ remarks: "" })
    setHemlalFormErrors({})
    setIsHemlalDialogOpen(true)
  }

  const handleJitendraMarkDone = (item: JitendraPendingItem) => {
    setSelectedJitendra(item)
    setJitendraFormData({ remarks: "" })
    setJitendraFormErrors({})
    setIsJitendraDialogOpen(true)
  }

  const handleDevshreeVerify = (item: DevshreePendingItem) => {
    setSelectedDevshree(item)
    setDevshreeFormData({ status: "", actualQty: "" })
    setDevshreeFormErrors({})
    setIsDevshreeDialogOpen(true)
  }

  // Save functions
  const handleSaveHemlal = async () => {
    if (!validateHemlalForm() || !selectedHemlal) return
    setIsSubmitting(true)
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss")
      
      const columnUpdates = {
        "74": timestamp, // Column BU (Actual5)
        "75": hemlalFormData.remarks, // Column BV (Remarks2_5)
      }

      const body = new URLSearchParams({
        sheetName: ACTUAL_PRODUCTION_SHEET,
        action: "updateCells",
        rowIndex: String(selectedHemlal.rowIndex),
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
        throw new Error(result.error || "Failed to update Hemlal data.")
      }

      alert("Hemlal production marked as done successfully!")
      setIsHemlalDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      console.error("Submission error:", err)
      alert(`Error: ${err instanceof Error ? err.message : "An unknown error occurred"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveJitendra = async () => {
    if (!validateJitendraForm() || !selectedJitendra) return
    setIsSubmitting(true)
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss")
      
      const columnUpdates = {
        "77": timestamp, // Column BX (Actual6)
        "78": jitendraFormData.remarks, // Column BY (Remarks3_6)
      }

      const body = new URLSearchParams({
        sheetName: ACTUAL_PRODUCTION_SHEET,
        action: "updateCells",
        rowIndex: String(selectedJitendra.rowIndex),
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
        throw new Error(result.error || "Failed to update Jitendra data.")
      }

      alert("Jitendra production marked as done successfully!")
      setIsJitendraDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      console.error("Submission error:", err)
      alert(`Error: ${err instanceof Error ? err.message : "An unknown error occurred"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDevshree = async () => {
    if (!validateDevshreeForm() || !selectedDevshree) return
    setIsSubmitting(true)
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss")
      
      const columnUpdates = {
        "59": timestamp, // Column BF (Actual1)
        "61": devshreeFormData.status, // Column BH (Remarks)
        "62": devshreeFormData.actualQty, // Column BI (ActualQty1)
      }

      const body = new URLSearchParams({
        sheetName: ACTUAL_PRODUCTION_SHEET,
        action: "updateCells",
        rowIndex: String(selectedDevshree.rowIndex),
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
        throw new Error(result.error || "Failed to update verification data.")
      }

      alert("Devshree verification completed successfully!")
      setIsDevshreeDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      console.error("Submission error:", err)
      alert(`Error: ${err instanceof Error ? err.message : "An unknown error occurred"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Column toggle handlers
  const handleToggleColumn = (tab: string, dataKey: string, checked: boolean) => {
    const setters: Record<string, any> = {
      hemlal: setVisibleHemlalColumns,
      jitendra: setVisibleJitendraColumns,
      devshree: setVisibleDevshreeColumns,
      history: setVisibleHistoryColumns,
    }
    const setter = setters[tab]
    if (setter) {
      setter((prev: any) => ({ ...prev, [dataKey]: checked }))
    }
  }

  const handleSelectAllColumns = (tab: string, columnsMeta: any[], checked: boolean) => {
    const newVisibility: Record<string, boolean> = {}
    columnsMeta.forEach((col) => {
      if (col.toggleable) newVisibility[col.dataKey] = checked
    })
    
    const setters: Record<string, any> = {
      hemlal: setVisibleHemlalColumns,
      jitendra: setVisibleJitendraColumns,
      devshree: setVisibleDevshreeColumns,
      history: setVisibleHistoryColumns,
    }
    const setter = setters[tab]
    if (setter) {
      setter((prev: any) => ({ ...prev, ...newVisibility }))
    }
  }

  // Memoized visible columns
  const visibleHemlalColumnsMeta = useMemo(
    () => HEMLAL_COLUMNS_META.filter((col) => visibleHemlalColumns[col.dataKey]),
    [visibleHemlalColumns],
  )

  const visibleJitendraColumnsMeta = useMemo(
    () => JITENDRA_COLUMNS_META.filter((col) => visibleJitendraColumns[col.dataKey]),
    [visibleJitendraColumns],
  )

  const visibleDevshreeColumnsMeta = useMemo(
    () => DEVSHREE_COLUMNS_META.filter((col) => visibleDevshreeColumns[col.dataKey]),
    [visibleDevshreeColumns],
  )

  const visibleHistoryColumnsMeta = useMemo(
    () => HISTORY_COLUMNS_META.filter((col) => visibleHistoryColumns[col.dataKey]),
    [visibleHistoryColumns],
  )

  // Column Toggler Component
  const ColumnToggler = ({ tab, columnsMeta, title }: { tab: string; columnsMeta: any[]; title: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent ml-auto">
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          {title}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3">
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
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {columnsMeta
              .filter((col) => col.toggleable)
              .map((col) => {
                const visibilityMap = {
                  hemlal: visibleHemlalColumns,
                  jitendra: visibleJitendraColumns,
                  devshree: visibleDevshreeColumns,
                  history: visibleHistoryColumns,
                }
                const isVisible = visibilityMap[tab as keyof typeof visibilityMap]?.[col.dataKey]

                return (
                  <div key={`toggle-${tab}-${col.dataKey}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`toggle-${tab}-${col.dataKey}`}
                      checked={isVisible}
                      onCheckedChange={(checked) => handleToggleColumn(tab, col.dataKey, Boolean(checked))}
                    />
                    <Label htmlFor={`toggle-${tab}-${col.dataKey}`} className="text-xs font-normal cursor-pointer">
                      {col.header}
                    </Label>
                  </div>
                )
              })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
        <p className="ml-4 text-lg">Loading Production Data...</p>
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
        <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <CheckCircle className="h-6 w-6 text-purple-600" />
            Production Tracking System
          </CardTitle>
          <CardDescription className="text-gray-700">
            Track production stages from Actual Production sheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="hemlal" className="flex items-center gap-2">
                <User className="h-4 w-4" /> ANAND
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {hemlalPending.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="jitendra" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Jitendra
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {jitendraPending.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="devshree" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Devshree
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {devshreePending.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> All History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {combinedHistory.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Hemlal Tab */}
            <TabsContent value="hemlal">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-blue-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <User className="h-5 w-5 text-blue-600 mr-2" />
                      Hemlal Pending Items ({hemlalPending.length})
                    </CardTitle>
                    <ColumnToggler tab="hemlal" columnsMeta={HEMLAL_COLUMNS_META} title="View Columns" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleHemlalColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hemlalPending.length > 0 ? (
                          hemlalPending.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-blue-50/50">
                              {visibleHemlalColumnsMeta.map((col) => {
                                if (col.dataKey === "actionColumn") {
                                  return (
                                    <TableCell key={col.dataKey}>
                                      <Button
                                        size="sm"
                                        onClick={() => handleHemlalMarkDone(item)}
                                        className="bg-blue-600 text-white hover:bg-blue-700"
                                      >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Mark Done
                                      </Button>
                                    </TableCell>
                                  )
                                }
                                
                                // Direct property mapping
                                if (col.dataKey in item) {
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {item[col.dataKey as keyof typeof item] || "-"}
                                    </TableCell>
                                  )
                                }
                                
                                // Raw material cells
                                if (col.dataKey.startsWith('rawMaterial') && !col.dataKey.includes('Qty')) {
                                  const idx = parseInt(col.dataKey.replace('rawMaterial', '')) - 1
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {item.rawMaterials[idx]?.name || "-"}
                                    </TableCell>
                                  )
                                }
                                if (col.dataKey.startsWith('rawMaterialQty')) {
                                  const idx = parseInt(col.dataKey.replace('rawMaterialQty', '')) - 1
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {item.rawMaterials[idx]?.quantity || "-"}
                                    </TableCell>
                                  )
                                }
                                
                                return <TableCell key={col.dataKey}>-</TableCell>
                              })}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHemlalColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-blue-200/50 bg-blue-50/50 rounded-lg mx-4 my-4 flex-1">
                                <User className="h-12 w-12 text-blue-500 mb-3" />
                                <p className="font-medium text-foreground">No Hemlal Pending Items</p>
                                <p className="text-sm text-muted-foreground">
                                  All Hemlal production tasks are completed.
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

            {/* Jitendra Tab */}
            <TabsContent value="jitendra">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-green-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <User className="h-5 w-5 text-green-600 mr-2" />
                      Jitendra Pending Items ({jitendraPending.length})
                    </CardTitle>
                    <ColumnToggler tab="jitendra" columnsMeta={JITENDRA_COLUMNS_META} title="View Columns" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleJitendraColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jitendraPending.length > 0 ? (
                          jitendraPending.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-green-50/50">
                              {visibleJitendraColumnsMeta.map((col) => {
                                if (col.dataKey === "actionColumn") {
                                  return (
                                    <TableCell key={col.dataKey}>
                                      <Button
                                        size="sm"
                                        onClick={() => handleJitendraMarkDone(item)}
                                        className="bg-green-600 text-white hover:bg-green-700"
                                      >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Mark Done
                                      </Button>
                                    </TableCell>
                                  )
                                }
                                
                                // Direct property mapping
                                if (col.dataKey in item) {
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {item[col.dataKey as keyof typeof item] || "-"}
                                    </TableCell>
                                  )
                                }
                                
                                // Raw material cells
                                if (col.dataKey.startsWith('rawMaterial') && !col.dataKey.includes('Qty')) {
                                  const idx = parseInt(col.dataKey.replace('rawMaterial', '')) - 1
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {item.rawMaterials[idx]?.name || "-"}
                                    </TableCell>
                                  )
                                }
                                if (col.dataKey.startsWith('rawMaterialQty')) {
                                  const idx = parseInt(col.dataKey.replace('rawMaterialQty', '')) - 1
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {item.rawMaterials[idx]?.quantity || "-"}
                                    </TableCell>
                                  )
                                }
                                
                                return <TableCell key={col.dataKey}>-</TableCell>
                              })}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleJitendraColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-green-200/50 bg-green-50/50 rounded-lg mx-4 my-4 flex-1">
                                <User className="h-12 w-12 text-green-500 mb-3" />
                                <p className="font-medium text-foreground">No Jitendra Pending Items</p>
                                <p className="text-sm text-muted-foreground">
                                  All Jitendra production tasks are completed.
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

            {/* Devshree Tab - Enhanced with Lab Test columns */}
            <TabsContent value="devshree">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-purple-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <CheckCircle className="h-5 w-5 text-purple-600 mr-2" />
                      Devshree Pending Items ({devshreePending.length})
                    </CardTitle>
                    <ColumnToggler tab="devshree" columnsMeta={DEVSHREE_COLUMNS_META} title="View Columns" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleDevshreeColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {devshreePending.length > 0 ? (
                          devshreePending.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-purple-50/50">
                              {visibleDevshreeColumnsMeta.map((col) => {
                                if (col.dataKey === "actionColumn") {
                                  return (
                                    <TableCell key={col.dataKey}>
                                      <Button
                                        size="sm"
                                        onClick={() => handleDevshreeVerify(item)}
                                        className="bg-purple-600 text-white hover:bg-purple-700"
                                      >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Verify
                                      </Button>
                                    </TableCell>
                                  )
                                }
                                
                                // Handle lab test columns with badges
                                if (col.dataKey === "labTest1" || col.dataKey === "labTest2" || col.dataKey === "chemicalTest") {
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      <Badge
                                        variant={
                                          item[col.dataKey as keyof DevshreePendingItem] === "Pass" ||
                                          item[col.dataKey as keyof DevshreePendingItem] === "Accepted"
                                            ? "default"
                                            : "destructive"
                                        }
                                      >
                                        {item[col.dataKey as keyof DevshreePendingItem] || "N/A"}
                                      </Badge>
                                    </TableCell>
                                  )
                                }
                                
                                // Direct property mapping for other fields
                                if (col.dataKey in item) {
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {col.dataKey === 'plannedTest' ? item.plannedTest :
                                       col.dataKey === 'actualQty1' ? item.actualQty1 :
                                       item[col.dataKey as keyof typeof item] || "-"}
                                    </TableCell>
                                  )
                                }
                                
                                // Raw material cells
                                if (col.dataKey.startsWith('rawMaterial') && !col.dataKey.includes('Qty')) {
                                  const idx = parseInt(col.dataKey.replace('rawMaterial', '')) - 1
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {item.rawMaterials[idx]?.name || "-"}
                                    </TableCell>
                                  )
                                }
                                if (col.dataKey.startsWith('rawMaterialQty')) {
                                  const idx = parseInt(col.dataKey.replace('rawMaterialQty', '')) - 1
                                  return (
                                    <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                      {item.rawMaterials[idx]?.quantity || "-"}
                                    </TableCell>
                                  )
                                }
                                
                                return <TableCell key={col.dataKey}>-</TableCell>
                              })}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleDevshreeColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-purple-200/50 bg-purple-50/50 rounded-lg mx-4 my-4 flex-1">
                                <CheckCircle className="h-12 w-12 text-purple-500 mb-3" />
                                <p className="font-medium text-foreground">No Devshree Pending Items</p>
                                <p className="text-sm text-muted-foreground">
                                  All production items have been verified by Devshree.
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

            {/* Combined History Tab */}
            <TabsContent value="history">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <History className="h-5 w-5 text-gray-600 mr-2" />
                      Complete History ({combinedHistory.length})
                    </CardTitle>
                    <ColumnToggler tab="history" columnsMeta={HISTORY_COLUMNS_META} title="View Columns" />
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
                        {combinedHistory.length > 0 ? (
                          combinedHistory.map((item, index) => (
                            <TableRow key={item.id || index} className="hover:bg-gray-50/50">
                              {visibleHistoryColumnsMeta.map((col) => {
                                if (col.dataKey === "type") {
                                  return (
                                    <TableCell key={col.dataKey}>
                                      <Badge 
                                        variant="outline"
                                        className={
                                          item.type === 'hemlal' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                          item.type === 'jitendra' ? 'bg-green-50 text-green-700 border-green-200' :
                                          'bg-purple-50 text-purple-700 border-purple-200'
                                        }
                                      >
                                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                      </Badge>
                                    </TableCell>
                                  )
                                }
                                if (col.dataKey === "jobCardNo") {
                                  return <TableCell key={col.dataKey}>{item.jobCardNo}</TableCell>
                                }
                                if (col.dataKey === "firmName") {
                                  return <TableCell key={col.dataKey}>{item.firmName}</TableCell>
                                }
                                if (col.dataKey === "productName") {
                                  return <TableCell key={col.dataKey}>{item.productName}</TableCell>
                                }
                                if (col.dataKey === "completedAt") {
                                  return <TableCell key={col.dataKey}>{item.completedAt}</TableCell>
                                }
                                if (col.dataKey === "statusOrRemarks") {
                                  return (
                                    <TableCell key={col.dataKey}>
                                      {item.type === 'devshree' ? (
                                        <Badge variant="default">{item.status || "Completed"}</Badge>
                                      ) : (
                                        item.remarks || "-"
                                      )}
                                    </TableCell>
                                  )
                                }
                                if (col.dataKey === "actualQty") {
                                  return <TableCell key={col.dataKey}>{item.actualQty || "-"}</TableCell>
                                }
                                return <TableCell key={col.dataKey}>-</TableCell>
                              })}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200/50 bg-gray-50/50 rounded-lg mx-4 my-4 flex-1">
                                <History className="h-12 w-12 text-gray-500 mb-3" />
                                <p className="font-medium text-foreground">No History Available</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed tasks will appear here.
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

      {/* Hemlal Mark Done Dialog */}
      <Dialog open={isHemlalDialogOpen} onOpenChange={setIsHemlalDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Mark Hemlal Production Done</DialogTitle>
            <DialogDescription>
              Job Card: {selectedHemlal?.jobCardNo} - {selectedHemlal?.productName}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveHemlal()
            }}
            className="space-y-4 pt-4"
          >
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs">Firm Name</Label>
                <p className="text-sm font-semibold">{selectedHemlal?.firmName}</p>
              </div>
              <div>
                <Label className="text-xs">Product</Label>
                <p className="text-sm font-semibold">{selectedHemlal?.productName}</p>
              </div>
              <div>
                <Label className="text-xs">Supervisor</Label>
                <p className="text-sm font-semibold">{selectedHemlal?.supervisorName}</p>
              </div>
              <div>
                <Label className="text-xs">Planned Date (Planned5)</Label>
                <p className="text-sm font-semibold">{selectedHemlal?.planned5}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hemlalRemarks">Remarks (Remarks2) *</Label>
              <Textarea
                id="hemlalRemarks"
                value={hemlalFormData.remarks}
                onChange={(e) => handleHemlalFormChange("remarks", e.target.value)}
                placeholder="Enter completion remarks..."
                className={hemlalFormErrors.remarks ? "border-red-500" : ""}
                rows={3}
              />
              {hemlalFormErrors.remarks && <p className="text-xs text-red-600 mt-1">{hemlalFormErrors.remarks}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsHemlalDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mark as Done
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Jitendra Mark Done Dialog */}
      <Dialog open={isJitendraDialogOpen} onOpenChange={setIsJitendraDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Mark Jitendra Production Done</DialogTitle>
            <DialogDescription>
              Job Card: {selectedJitendra?.jobCardNo} - {selectedJitendra?.productName}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveJitendra()
            }}
            className="space-y-4 pt-4"
          >
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs">Firm Name</Label>
                <p className="text-sm font-semibold">{selectedJitendra?.firmName}</p>
              </div>
              <div>
                <Label className="text-xs">Product</Label>
                <p className="text-sm font-semibold">{selectedJitendra?.productName}</p>
              </div>
              <div>
                <Label className="text-xs">Supervisor</Label>
                <p className="text-sm font-semibold">{selectedJitendra?.supervisorName}</p>
              </div>
              <div>
                <Label className="text-xs">Planned Date (Planned6)</Label>
                <p className="text-sm font-semibold">{selectedJitendra?.planned6}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jitendraRemarks">Remarks (Remarks3) *</Label>
              <Textarea
                id="jitendraRemarks"
                value={jitendraFormData.remarks}
                onChange={(e) => handleJitendraFormChange("remarks", e.target.value)}
                placeholder="Enter completion remarks..."
                className={jitendraFormErrors.remarks ? "border-red-500" : ""}
                rows={3}
              />
              {jitendraFormErrors.remarks && <p className="text-xs text-red-600 mt-1">{jitendraFormErrors.remarks}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsJitendraDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-green-600 text-white hover:bg-green-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mark as Done
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Devshree Verification Dialog - Enhanced with Lab Test display */}
      <Dialog open={isDevshreeDialogOpen} onOpenChange={setIsDevshreeDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Devshree Verification</DialogTitle>
            <DialogDescription>
              Job Card: {selectedDevshree?.jobCardNo} - {selectedDevshree?.productName}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveDevshree()
            }}
            className="space-y-4 pt-4"
          >
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs">Firm Name</Label>
                <p className="text-sm font-semibold">{selectedDevshree?.firmName}</p>
              </div>
              <div>
                <Label className="text-xs">Product</Label>
                <p className="text-sm font-semibold">{selectedDevshree?.productName}</p>
              </div>
              <div>
                <Label className="text-xs">Supervisor</Label>
                <p className="text-sm font-semibold">{selectedDevshree?.supervisorName}</p>
              </div>
              <div>
                <Label className="text-xs">Planned Test (Planned1)</Label>
                <p className="text-sm font-semibold">{selectedDevshree?.plannedTest}</p>
              </div>
              <div>
                <Label className="text-xs">Lab Test 1</Label>
                <p className="text-sm font-semibold">
                  <Badge variant={selectedDevshree?.labTest1 === "Pass" ? "default" : "destructive"}>
                    {selectedDevshree?.labTest1 || "N/A"}
                  </Badge>
                </p>
              </div>
              <div>
                <Label className="text-xs">Lab Test 2</Label>
                <p className="text-sm font-semibold">
                  <Badge variant={selectedDevshree?.labTest2 === "Pass" ? "default" : "destructive"}>
                    {selectedDevshree?.labTest2 || "N/A"}
                  </Badge>
                </p>
              </div>
              <div>
                <Label className="text-xs">Chemical Test</Label>
                <p className="text-sm font-semibold">
                  <Badge variant={selectedDevshree?.chemicalTest === "Pass" ? "default" : "destructive"}>
                    {selectedDevshree?.chemicalTest || "N/A"}
                  </Badge>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="devshreeStatus">Status *</Label>
              <Select value={devshreeFormData.status} onValueChange={(v) => handleDevshreeFormChange("status", v)}>
                <SelectTrigger className={devshreeFormErrors.status ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select verification status..." />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {devshreeFormErrors.status && <p className="text-xs text-red-600 mt-1">{devshreeFormErrors.status}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="devshreeActualQty">Actual Quantity *</Label>
              <Input
                id="devshreeActualQty"
                type="number"
                step="1"
                min="0"
                value={devshreeFormData.actualQty}
                onChange={(e) => handleDevshreeFormChange("actualQty", e.target.value)}
                className={devshreeFormErrors.actualQty ? "border-red-500" : ""}
              />
              {devshreeFormErrors.actualQty && <p className="text-xs text-red-600 mt-1">{devshreeFormErrors.actualQty}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDevshreeDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-purple-600 text-white hover:bg-purple-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Verification
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}