"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CheckCircle, Settings, Plus, X, FileText, Eye, Calendar, Edit } from "lucide-react"
import { format, parse } from "date-fns"
import { useGoogleSheet, parseGvizDate } from "@/lib/g-sheets"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Shadcn UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

// --- Type Definitions ---
interface ProductionItem {
  _rowIndex: number
  timestamp: string
  firmName: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  producedQuantity: number
  expectedDeliveryDate: string
  priority: string
  note: string
  verificationTimestamp: string
  plannedDate?: string // Added planned date
}

interface KycProduct {
  productName: string
  alumina: number
  iron: number
  price: number
  bd: number
  ap: number
}

interface KittingFormRow {
  id: number
  productName: string
  percentage: string
  // Base values from KYC
  baseAlumina: number
  baseIron: number
  basePrice: number
  baseBd: number
  baseAp: number
  // Calculated values
  al: number
  fe: number
  bd: number
  ap: number
  price: number
}

// Updated Type for Costing History items with planned date
interface CostingHistoryItem {
  _rowIndex: number
  timestamp: string
  compositionNumber: string
  deliveryOrderNo: string
  productName: string
  variableCost: number
  manufacturingCost: number
  interestDays: number
  interestAmount: number
  transporting: number
  sellingPrice: number
  gpPercentage: string
  totalAl: number
  totalFe: number
  totalBd: number
  totalAp: number
  rawMaterials: string[]
  rawMaterialPercentages: string[]
  plannedDate?: string // Added planned date
  expectedDeliveryDate?: string // Added expected delivery date
  priority?: string // Added priority
}

// --- Constants ---
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec"
const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4"
const PRODUCTION_SHEET = "Production"
const KYC_SHEET = "KYC"
const COSTING_RESPONSE_SHEET = "Costing Response"

// --- Column Definitions ---
const FULL_KITTING_COLUMNS = {
  verificationTimestamp: 22, // Col V
  plannedDate: 20, // Col U - Planned 1 (index 20, 0-based)
  expectedDeliveryDate: 6, // Col G
  priority: 7, // Col H
}

const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true, toggleable: false },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Produced Quantity", dataKey: "producedQuantity", toggleable: true },
  { header: "Planned Date", dataKey: "plannedDate", toggleable: true },
]

// Updated History columns with timestamp and planned date
const HISTORY_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true, toggleable: false },
  { header: "Timestamp", dataKey: "timestamp", toggleable: true },
  { header: "Expected Delivery", dataKey: "expectedDeliveryDate", toggleable: true },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Composition No.", dataKey: "compositionNumber", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Variable Cost", dataKey: "variableCost", toggleable: true },
  { header: "Mfg Cost", dataKey: "manufacturingCost", toggleable: true },
  { header: "Interest", dataKey: "interestAmount", toggleable: true },
  { header: "Total AL", dataKey: "totalAl", toggleable: true },
  { header: "Total FE", dataKey: "totalFe", toggleable: true },
  { header: "Total BD", dataKey: "totalBd", toggleable: true },
  { header: "Total AP", dataKey: "totalAp", toggleable: true },
  { header: "Raw Materials", dataKey: "rawMaterials", toggleable: true },
]

export default function CheckPage() {
  const [pendingChecks, setPendingChecks] = useState<ProductionItem[]>([])
  const [historyChecks, setHistoryChecks] = useState<CostingHistoryItem[]>([])
  const [kycProducts, setKycProducts] = useState<KycProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dialog and Form State
  const [isKittingDialogOpen, setIsKittingDialogOpen] = useState(false)
  const [isReviseDialogOpen, setIsReviseDialogOpen] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState<ProductionItem | null>(null)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CostingHistoryItem | null>(null)
  const [kittingFormRows, setKittingFormRows] = useState<KittingFormRow[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // State for viewing raw materials
  const [viewingMaterials, setViewingMaterials] = useState<{names: string[], percentages: string[]} | null>(null)

  // Fixed values
  const MANUFACTURING_COST = 1500
  const INTEREST_DAYS = 30

  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})

  const { fetchData: fetchProductionSheetData } = useGoogleSheet(PRODUCTION_SHEET, SHEET_ID)
  const { fetchData: fetchKycSheetData } = useGoogleSheet(KYC_SHEET, SHEET_ID)
  const { fetchData: fetchCostingResponseData } = useGoogleSheet(COSTING_RESPONSE_SHEET, SHEET_ID)

  // Helper function to format date
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return "-"
    
    if (typeof dateValue === "string" && dateValue.startsWith("Date(")) {
      try {
        const parsed = parseGvizDate(dateValue)
        if (parsed) return format(parsed, "dd/MM/yyyy")
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Try to parse as regular date string
    try {
      const date = new Date(dateValue)
      if (!isNaN(date.getTime())) {
        return format(date, "dd/MM/yyyy")
      }
    } catch (e) {
      // Ignore
    }
    
    return String(dateValue)
  }

  const processGvizTable = (table: any) => {
    if (!table || !table.rows) return []
    return table.rows.map((row: any, index: number) => {
      const rowData: { [key: string]: any } = { _rowIndex: index + 3 }
      if (row.c) {
        row.c.forEach((cell: any, cellIndex: number) => {
          rowData[`col${cellIndex}`] = cell ? (cell.f ?? cell.v) : null
        })
      }
      return rowData
    })
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [productionTable, kycTable, costingResponseTable] = await Promise.all([
        fetchProductionSheetData(), 
        fetchKycSheetData(),
        fetchCostingResponseData()
      ])

      const allRows = processGvizTable(productionTable)
      const dataRows = allRows.filter((row) => row.col0 !== "Timestamp" && row.col0 !== null)

      // Create a map of delivery order to production data for enrichment
      const productionDataMap = new Map()
      dataRows.forEach((row: any) => {
        const doNo = String(row.col1 || "").trim()
        if (doNo) {
          productionDataMap.set(doNo, {
            plannedDate: formatDate(row.col19), // Col T - Date of Complete Planning
            expectedDeliveryDate: formatDate(row.col6), // Col G
            priority: String(row.col7 || ""),
          })
        }
      })

      // Pending items from Production sheet
      const pending = dataRows
        .filter((row: any) => row.col20 != null && row.col21 == null)
        .map(
          (row: any): ProductionItem => ({
            _rowIndex: row._rowIndex,
            timestamp: String(row.col0 || ""),
            deliveryOrderNo: String(row.col1 || ""),
            firmName: String(row.col2 || ""),
            partyName: String(row.col3 || ""),
            productName: String(row.col4 || ""),
            producedQuantity: Number(row.col5 || 0),
            expectedDeliveryDate: formatDate(row.col6),
            priority: String(row.col7 || ""),
            note: String(row.col8 || ""),
            verificationTimestamp: "",
            plannedDate: formatDate(row.col20), // Planned 1 from col20
          }),
        )

      // History items from Costing Response sheet enriched with production data
      const costingRows = processGvizTable(costingResponseTable)
      const history = costingRows
        .filter((row: any) => row.col0 !== null && row.col0 !== "Timestamp")
        .map((row: any): CostingHistoryItem => {
          // Extract raw materials (columns 15-34 are material names, 35-54 are percentages)
          const rawMaterials: string[] = []
          const rawMaterialPercentages: string[] = []
          
          for (let i = 15; i <= 34; i++) {
            const material = row[`col${i}`]
            if (material && String(material).trim() !== "") {
              rawMaterials.push(String(material))
            }
          }
          
          for (let i = 35; i <= 54; i++) {
            const percentage = row[`col${i}`]
            if (percentage && String(percentage).trim() !== "") {
              rawMaterialPercentages.push(String(percentage))
            }
          }

          const doNo = String(row.col2 || "").trim()
          const productionData = productionDataMap.get(doNo) || {}

          return {
            _rowIndex: row._rowIndex,
            timestamp: String(row.col0 || ""),
            compositionNumber: String(row.col1 || ""),
            deliveryOrderNo: doNo,
            productName: String(row.col3 || ""),
            variableCost: Number(row.col4 || 0),
            manufacturingCost: Number(row.col5 || 0),
            interestDays: Number(row.col6 || 0),
            interestAmount: Number(row.col7 || 0),
            transporting: Number(row.col8 || 0),
            sellingPrice: Number(row.col9 || 0),
            gpPercentage: String(row.col10 || ""),
            totalAl: Number(row.col11 || 0),
            totalFe: Number(row.col12 || 0),
            totalBd: Number(row.col13 || 0),
            totalAp: Number(row.col14 || 0),
            rawMaterials,
            rawMaterialPercentages,
            plannedDate: productionData.plannedDate, // Planned 1 from col20
            expectedDeliveryDate: productionData.expectedDeliveryDate,
            priority: productionData.priority,
          }
        })
        .sort((a, b) => {
          // Sort by timestamp descending (newest first)
          try {
            const dateA = parse(a.timestamp, "dd/MM/yyyy HH:mm:ss", new Date())
            const dateB = parse(b.timestamp, "dd/MM/yyyy HH:mm:ss", new Date())
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
              return dateB.getTime() - dateA.getTime()
            }
          } catch (e) {
            /* fallback to string sort */
          }
          return b.timestamp.localeCompare(a.timestamp)
        })

      const products = processGvizTable(kycTable).map(
        (row: any): KycProduct => ({
          productName: String(row.col0 || ""),
          alumina: Number(row.col1 || 0),
          iron: Number(row.col2 || 0),
          price: Number(row.col3 || 0),
          bd: Number(row.col4 || 0),
          ap: Number(row.col5 || 0),
        }),
      )

      setPendingChecks(pending)
      setHistoryChecks(history)
      setKycProducts(products.filter((p) => p.productName))
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fetchProductionSheetData, fetchKycSheetData, fetchCostingResponseData])

  useEffect(() => {
    const initializeVisibility = (columnsMeta: any[]) =>
      columnsMeta.reduce((acc, col) => ({ ...acc, [col.dataKey]: col.alwaysVisible !== false }), {})

    setVisiblePendingColumns(initializeVisibility(PENDING_COLUMNS_META))
    setVisibleHistoryColumns(initializeVisibility(HISTORY_COLUMNS_META))
    loadData()
  }, [loadData])

  // Reset kitting form
  const resetKittingForm = () => {
    setKittingFormRows([
      {
        id: 1,
        productName: "",
        percentage: "",
        baseAlumina: 0,
        baseIron: 0,
        basePrice: 0,
        baseBd: 0,
        baseAp: 0,
        al: 0,
        fe: 0,
        bd: 0,
        ap: 0,
        price: 0,
      },
    ])
    setShowPreview(false)
  }

  // Load history item into form for revision
  const loadHistoryItemForRevision = (item: CostingHistoryItem) => {
    setSelectedHistoryItem(item)
    
    // Find the corresponding production item
    const productionItem = pendingChecks.find(p => p.deliveryOrderNo === item.deliveryOrderNo) || {
      _rowIndex: 0,
      timestamp: "",
      firmName: "",
      deliveryOrderNo: item.deliveryOrderNo,
      partyName: "",
      productName: item.productName,
      producedQuantity: 0,
      expectedDeliveryDate: item.expectedDeliveryDate || "",
      priority: item.priority || "",
      note: "",
      verificationTimestamp: "",
      plannedDate: item.plannedDate
    }
    setSelectedCheck(productionItem)

    // Create form rows from the raw materials
    const rows: KittingFormRow[] = item.rawMaterials.map((materialName, index) => {
      const percentage = item.rawMaterialPercentages[index] || "0"
      const productData = kycProducts.find(p => p.productName === materialName) || {
        alumina: 0,
        iron: 0,
        price: 0,
        bd: 0,
        ap: 0
      }

      const percentageNum = Number.parseFloat(percentage) || 0

      return {
        id: index + 1,
        productName: materialName,
        percentage: percentage,
        baseAlumina: productData.alumina,
        baseIron: productData.iron,
        basePrice: productData.price,
        baseBd: productData.bd,
        baseAp: productData.ap,
        al: (productData.alumina * percentageNum) / 100,
        fe: (productData.iron * percentageNum) / 100,
        bd: (productData.bd * percentageNum) / 100,
        ap: (productData.ap * percentageNum) / 100,
        price: (productData.price * percentageNum) / 100,
      }
    })

    setKittingFormRows(rows)
setIsKittingDialogOpen(true)
  }

  const handleOpenKittingForm = (item: ProductionItem) => {
    setSelectedCheck(item)
    resetKittingForm()
    setIsKittingDialogOpen(true)
  }

  const addKittingFormRow = () => {
    if (kittingFormRows.length < 20) {
      setKittingFormRows([
        ...kittingFormRows,
        {
          id: (kittingFormRows[kittingFormRows.length - 1]?.id || 0) + 1,
          productName: "",
          percentage: "",
          baseAlumina: 0,
          baseIron: 0,
          basePrice: 0,
          baseBd: 0,
          baseAp: 0,
          al: 0,
          fe: 0,
          bd: 0,
          ap: 0,
          price: 0,
        },
      ])
    }
  }

  const removeKittingFormRow = (id: number) => {
    if (kittingFormRows.length > 1) {
      setKittingFormRows(kittingFormRows.filter((row) => row.id !== id))
    }
  }

  const handleKittingRowChange = (id: number, field: keyof KittingFormRow, value: any) => {
    const newRows = kittingFormRows.map((row) => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value }
        if (field === "productName") {
          const productData = kycProducts.find((p) => p.productName === value)
          if (productData) {
            updatedRow.baseAlumina = productData.alumina
            updatedRow.baseIron = productData.iron
            updatedRow.basePrice = productData.price
            updatedRow.baseBd = productData.bd
            updatedRow.baseAp = productData.ap
          }
        }
        const percentage = Number.parseFloat(updatedRow.percentage) || 0
        updatedRow.al = (updatedRow.baseAlumina * percentage) / 100
        updatedRow.fe = (updatedRow.baseIron * percentage) / 100
        updatedRow.price = (updatedRow.basePrice * percentage) / 100
        updatedRow.bd = (updatedRow.baseBd * percentage) / 100
        updatedRow.ap = (updatedRow.baseAp * percentage) / 100
        return updatedRow
      }
      return row
    })
    setKittingFormRows(newRows)
  }

  const kittingTotals = useMemo(() => {
    return kittingFormRows.reduce(
      (acc, row) => {
        acc.al += row.al
        acc.fe += row.fe
        acc.bd += row.bd
        acc.ap += row.ap
        acc.price += row.price
        acc.percentage += Number.parseFloat(row.percentage) || 0
        return acc
      },
      { al: 0, fe: 0, bd: 0, ap: 0, price: 0, percentage: 0 },
    )
  }, [kittingFormRows])

  const interestAmount = useMemo(() => {
    return (kittingTotals.price * 0.18 * INTEREST_DAYS) / 365
  }, [kittingTotals.price])

  const totalCost = useMemo(() => {
    return kittingTotals.price + MANUFACTURING_COST + interestAmount
  }, [kittingTotals.price, interestAmount])

  const variableCost = useMemo(() => kittingTotals.price, [kittingTotals.price])

  const generateCompositionNumber = async (): Promise<string> => {
    const table = await fetchCostingResponseData()
    const rows = processGvizTable(table)
    let maxNumber = 0
    rows.forEach((row) => {
      const cn = row.col1
      if (cn && typeof cn === "string" && cn.startsWith("CN-")) {
        const num = Number.parseInt(cn.substring(3))
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num
        }
      }
    })
    return `CN-${String(maxNumber + 1).padStart(3, "0")}`
  }

  const generatePDF = (forPreview: boolean = false) => {
    if (!selectedCheck) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Title
    doc.setFontSize(18)
    doc.setTextColor(40, 40, 40)
    doc.text("Full Kitting Details", pageWidth / 2, 15, { align: "center" })

    // Company details
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Date: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`, 14, 25)

    // Production Item Details
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text("Production Details:", 14, 35)

    const productionDetails = [
      ["Firm Name:", selectedCheck.firmName],
      ["Delivery Order No.:", selectedCheck.deliveryOrderNo],
      ["Party Name:", selectedCheck.partyName],
      ["Product Name:", selectedCheck.productName],
      ["Produced Quantity:", selectedCheck.producedQuantity.toString()],
      ["Planned Date:", selectedCheck.plannedDate || "-"],
      ["Expected Delivery:", selectedCheck.expectedDeliveryDate || "-"],
      ["Priority:", selectedCheck.priority || "-"],
    ]

    autoTable(doc, {
      startY: 40,
      head: [],
      body: productionDetails,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 }, 1: { cellWidth: 80 } },
    })

    // Raw Materials Table
    const tableHeaders = [["Sl no", "Particulars", "AL", "FE", "BD", "AP", "Price", "%", "AL", "FE", "BD", "AP", "Price"]]
    const tableBody = kittingFormRows.map((row, index) => [
      (index + 1).toString(),
      row.productName || "-",
      row.baseAlumina.toFixed(2),
      row.baseIron.toFixed(2),
      row.baseBd.toFixed(2),
      row.baseAp.toFixed(2),
      row.basePrice.toFixed(2),
      row.percentage || "0",
      row.al.toFixed(4),
      row.fe.toFixed(4),
      row.bd.toFixed(4),
      row.ap.toFixed(4),
      row.price.toFixed(2),
    ])

    // Add totals row
    tableBody.push([
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      kittingTotals.percentage.toFixed(2) + "%",
      kittingTotals.al.toFixed(4),
      kittingTotals.fe.toFixed(4),
      kittingTotals.bd.toFixed(4),
      kittingTotals.ap.toFixed(4),
      kittingTotals.price.toFixed(2),
    ])

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: tableHeaders,
      body: tableBody,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [100, 100, 100], textColor: 255 },
    })

    // Cost Summary
    const costSummary = [
      ["Raw Material Cost:", `₹${kittingTotals.price.toFixed(2)}`],
      ["Manufacturing Cost:", `₹${MANUFACTURING_COST.toFixed(2)}`],
      [`Interest (${INTEREST_DAYS} days @ 18%):`, `₹${interestAmount.toFixed(2)}`],
      ["Total Cost:", `₹${totalCost.toFixed(2)}`],
    ]

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      body: costSummary,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 }, 1: { cellWidth: 40 } },
    })

    if (forPreview) {
      const pdfBlob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      window.open(pdfUrl)
    } else {
      doc.save(`kitting-details-${selectedCheck.deliveryOrderNo}.pdf`)
    }
  }

  const handlePreviewPDF = () => {
    if (!selectedCheck) return
    generatePDF(true)
  }

  const handleSaveKittingForm = async () => {
    if (!selectedCheck) return
    setIsSubmitting(true)
    try {
      const submissionDate = new Date()
      const compositionNumber = await generateCompositionNumber()

      const rmNames = kittingFormRows.map((r) => r.productName)
      const rmQtys = kittingFormRows.map((r) => r.percentage)
      const paddedRmNames = [...rmNames, ...Array(20 - rmNames.length).fill("")]
      const paddedRmQtys = [...rmQtys, ...Array(20 - rmQtys.length).fill("")]

      const rowData = [
        format(submissionDate, "dd/MM/yyyy HH:mm:ss"),
        compositionNumber,
        selectedCheck.deliveryOrderNo,
        selectedCheck.productName,
        variableCost.toFixed(2),
        MANUFACTURING_COST.toString(),
        INTEREST_DAYS.toString(),
        interestAmount.toFixed(2),
        "0", // transporting
        "0", // selling price
        "0%", // gp percentage
        kittingTotals.al.toFixed(4),
        kittingTotals.fe.toFixed(4),
        kittingTotals.bd.toFixed(4),
        kittingTotals.ap.toFixed(4),
        ...paddedRmNames,
        ...paddedRmQtys,
      ]

      const costingBody = new URLSearchParams({
        sheetName: COSTING_RESPONSE_SHEET,
        action: "insert",
        rowData: JSON.stringify(rowData),
      })

      const costingRes = await fetch(WEB_APP_URL, { method: "POST", body: costingBody })
      const costingResult = await costingRes.json()
      if (!costingResult.success) throw new Error(costingResult.error || "Failed to save to Costing Response sheet.")

      if (selectedCheck._rowIndex && selectedCheck._rowIndex > 0) {
  const productionUpdateBody = new URLSearchParams({
    sheetName: PRODUCTION_SHEET,
    action: "updateCells",
    rowIndex: selectedCheck._rowIndex.toString(),
    cellUpdates: JSON.stringify({
      [FULL_KITTING_COLUMNS.verificationTimestamp]: format(submissionDate, "dd/MM/yyyy HH:mm:ss"),
    }),
  })

  const productionRes = await fetch(WEB_APP_URL, { method: "POST", body: productionUpdateBody })
  const productionResult = await productionRes.json()

  if (!productionResult.success)
    throw new Error(productionResult.error || "Failed to update Production sheet.")
}

     setIsKittingDialogOpen(false)
setSelectedCheck(null)
setSelectedHistoryItem(null)

await loadData()

alert("Full Kitting data submitted successfully!")
    } catch (err: any) {
      setError(err.message)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewMaterials = (materials: string[], percentages: string[]) => {
    setViewingMaterials({ names: materials, percentages })
  }

  // --- Column Toggling Logic ---
  const handleToggleColumn = (tab: "pending" | "history", dataKey: string, checked: boolean) => {
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns
    setter((prev) => ({ ...prev, [dataKey]: checked }))
  }

  const handleSelectAllColumns = (tab: "pending" | "history", columnsMeta: any[], checked: boolean) => {
    const newVisibility = columnsMeta.reduce(
      (acc, col) => {
        if (col.toggleable) acc[col.dataKey] = checked
        return acc
      },
      {} as Record<string, boolean>,
    )
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns
    setter((prev) => ({ ...prev, ...newVisibility }))
  }

  const visiblePendingColumnsMeta = useMemo(
    () => PENDING_COLUMNS_META.filter((c) => visiblePendingColumns[c.dataKey]),
    [visiblePendingColumns],
  )
  const visibleHistoryColumnsMeta = useMemo(
    () => HISTORY_COLUMNS_META.filter((c) => visibleHistoryColumns[c.dataKey]),
    [visibleHistoryColumns],
  )

  // --- Render Logic ---
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
      </div>
    )
  if (error)
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p>{error}</p>
        <Button onClick={loadData} className="mt-4 bg-purple-600 text-white hover:bg-purple-700">
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
            Full Kitting Verification
          </CardTitle>
          <CardDescription>Verify items after the full kitting process.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Pending Checks{" "}
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingChecks.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> History{" "}
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyChecks.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <div className="flex justify-between items-center bg-purple-50 rounded-md p-2">
                    <CardTitle>Pending Items</CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
                          <Settings className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56">
                        <div className="space-y-2 mb-4">
                          <h4 className="font-medium leading-none">Toggle Columns</h4>
                        </div>
                        <div className="flex justify-between">
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={() => handleSelectAllColumns("pending", PENDING_COLUMNS_META, true)}
                          >
                            Select All
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={() => handleSelectAllColumns("pending", PENDING_COLUMNS_META, false)}
                          >
                            Deselect All
                          </Button>
                        </div>
                        <hr className="my-2" />
                        {PENDING_COLUMNS_META.filter((c) => c.toggleable).map((col) => (
                          <div key={col.dataKey} className="flex items-center space-x-2 my-1">
                            <Checkbox
                              id={`toggle-pending-${col.dataKey}`}
                              checked={visiblePendingColumns[col.dataKey]}
                              onCheckedChange={(checked) => handleToggleColumn("pending", col.dataKey, !!checked)}
                            />
                            <Label htmlFor={`toggle-pending-${col.dataKey}`} className="font-normal">
                              {col.header}
                            </Label>
                          </div>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative max-h-[600px] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-slate-100">
                        <TableRow>
                          {visiblePendingColumnsMeta.map((c) => (
                            <TableHead key={c.dataKey}>{c.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingChecks.length > 0 ? (
                          pendingChecks.map((item) => (
                            <TableRow key={item._rowIndex}>
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey}>
                                  {col.dataKey === "actionColumn" ? (
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleOpenKittingForm(item)} 
                                      className="bg-purple-600 text-white hover:bg-purple-700"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" /> Verify
                                    </Button>
                                  ) : col.dataKey === "plannedDate" ? (
                                    item.plannedDate || "-"
                                  ) : (
                                    (item[col.dataKey as keyof ProductionItem] as React.ReactNode)
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-24 text-center">
                              No pending items.
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
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Costing Response History</CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56">
                        <div className="space-y-2 mb-4">
                          <h4 className="font-medium leading-none">Toggle Columns</h4>
                        </div>
                        <div className="flex justify-between">
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={() => handleSelectAllColumns("history", HISTORY_COLUMNS_META, true)}
                          >
                            Select All
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={() => handleSelectAllColumns("history", HISTORY_COLUMNS_META, false)}
                          >
                            Deselect All
                          </Button>
                        </div>
                        <hr className="my-2" />
                        {HISTORY_COLUMNS_META.filter((c) => c.toggleable).map((col) => (
                          <div key={col.dataKey} className="flex items-center space-x-2 my-1">
                            <Checkbox
                              id={`toggle-history-${col.dataKey}`}
                              checked={visibleHistoryColumns[col.dataKey]}
                              onCheckedChange={(checked) => handleToggleColumn("history", col.dataKey, !!checked)}
                            />
                            <Label htmlFor={`toggle-history-${col.dataKey}`} className="font-normal">
                              {col.header}
                            </Label>
                          </div>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative max-h-[600px] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-slate-100">
                        <TableRow>
                          {visibleHistoryColumnsMeta.map((c) => (
                            <TableHead key={c.dataKey}>{c.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyChecks.length > 0 ? (
                          historyChecks.map((item) => (
                            <TableRow key={item._rowIndex}>
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey}>
                                  {col.dataKey === "actionColumn" ? (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => loadHistoryItemForRevision(item)}
                                        className="h-8"
                                      >
                                        <Edit className="h-4 w-4 mr-1" />
                                        Revise
                                      </Button>
                                    </div>
                                  ) : col.dataKey === "timestamp" ? (
                                    item.timestamp
                                  ) : col.dataKey === "plannedDate" ? (
                                    item.plannedDate || "-"
                                  ) : col.dataKey === "expectedDeliveryDate" ? (
                                    item.expectedDeliveryDate || "-"
                                  ) : col.dataKey === "priority" ? (
                                    <Badge className={item.priority === "Urgent" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                                      {item.priority || "-"}
                                    </Badge>
                                  ) : col.dataKey === "compositionNumber" ? (
                                    item.compositionNumber
                                  ) : col.dataKey === "deliveryOrderNo" ? (
                                    item.deliveryOrderNo
                                  ) : col.dataKey === "productName" ? (
                                    item.productName
                                  ) : col.dataKey === "variableCost" ? (
                                    `₹${item.variableCost.toFixed(2)}`
                                  ) : col.dataKey === "manufacturingCost" ? (
                                    `₹${item.manufacturingCost.toFixed(2)}`
                                  ) : col.dataKey === "interestAmount" ? (
                                    `₹${item.interestAmount.toFixed(2)}`
                                  ) : col.dataKey === "totalAl" ? (
                                    item.totalAl.toFixed(4)
                                  ) : col.dataKey === "totalFe" ? (
                                    item.totalFe.toFixed(4)
                                  ) : col.dataKey === "totalBd" ? (
                                    item.totalBd.toFixed(4)
                                  ) : col.dataKey === "totalAp" ? (
                                    item.totalAp.toFixed(4)
                                  ) : col.dataKey === "rawMaterials" ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewMaterials(item.rawMaterials, item.rawMaterialPercentages)}
                                      className="h-7 text-xs"
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" />
                                      View ({item.rawMaterials.length})
                                    </Button>
                                  ) : null}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-24 text-center">
                              No history items found in Costing Response sheet.
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

      {/* Raw Materials View Dialog */}
      <Dialog open={!!viewingMaterials} onOpenChange={() => setViewingMaterials(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Raw Materials Used</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Percentage (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewingMaterials?.names.map((name, index) => (
                  <TableRow key={index}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{viewingMaterials.percentages[index] || "0"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Kitting Dialog */}
      <Dialog open={isKittingDialogOpen} onOpenChange={setIsKittingDialogOpen}>
        <DialogContent className="max-w-7xl w-full">
          <DialogHeader>
            <DialogTitle>Full Kitting Details</DialogTitle>
          </DialogHeader>
          
          {/* Preview Section */}
          {showPreview ? (
            <div className="max-h-[75vh] overflow-y-auto p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Preview</h3>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Back to Edit
                </Button>
              </div>
              
              {selectedCheck && (
                <div className="space-y-6">
                  {/* Production Details */}
                  <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-gray-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Firm Name</p>
                      <p className="text-lg">{selectedCheck.firmName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Delivery Order No.</p>
                      <p className="text-lg">{selectedCheck.deliveryOrderNo}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Party Name</p>
                      <p className="text-lg">{selectedCheck.partyName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Product Name</p>
                      <p className="text-lg">{selectedCheck.productName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Produced Quantity</p>
                      <p className="text-lg">{selectedCheck.producedQuantity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Planned Date</p>
                      <p className="text-lg">{selectedCheck.plannedDate || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Expected Delivery</p>
                      <p className="text-lg">{selectedCheck.expectedDeliveryDate || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Priority</p>
                      <p className="text-lg">{selectedCheck.priority || "-"}</p>
                    </div>
                  </div>

                  {/* Raw Materials Table */}
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-left">Sl no</th>
                          <th className="p-2 text-left">Particulars</th>
                          <th className="p-2 text-left">AL</th>
                          <th className="p-2 text-left">FE</th>
                          <th className="p-2 text-left">BD</th>
                          <th className="p-2 text-left">AP</th>
                          <th className="p-2 text-left">Price</th>
                          <th className="p-2 text-left">%</th>
                          <th className="p-2 text-left">AL</th>
                          <th className="p-2 text-left">FE</th>
                          <th className="p-2 text-left">BD</th>
                          <th className="p-2 text-left">AP</th>
                          <th className="p-2 text-left">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kittingFormRows.map((row, index) => (
                          <tr key={row.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2 font-medium">{row.productName || "-"}</td>
                            <td className="p-2">{row.baseAlumina.toFixed(2)}</td>
                            <td className="p-2">{row.baseIron.toFixed(2)}</td>
                            <td className="p-2">{row.baseBd.toFixed(2)}</td>
                            <td className="p-2">{row.baseAp.toFixed(2)}</td>
                            <td className="p-2">{row.basePrice.toFixed(2)}</td>
                            <td className="p-2 bg-yellow-50">{row.percentage || "0"}</td>
                            <td className="p-2">{row.al.toFixed(4)}</td>
                            <td className="p-2">{row.fe.toFixed(4)}</td>
                            <td className="p-2">{row.bd.toFixed(4)}</td>
                            <td className="p-2">{row.ap.toFixed(4)}</td>
                            <td className="p-2">{row.price.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold">
                          <td colSpan={7} className="p-2 text-right">TOTAL</td>
                          <td className="p-2 bg-yellow-50">{kittingTotals.percentage.toFixed(2)}%</td>
                          <td className="p-2">{kittingTotals.al.toFixed(4)}</td>
                          <td className="p-2">{kittingTotals.fe.toFixed(4)}</td>
                          <td className="p-2">{kittingTotals.bd.toFixed(4)}</td>
                          <td className="p-2">{kittingTotals.ap.toFixed(4)}</td>
                          <td className="p-2">{kittingTotals.price.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Cost Summary */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-2 max-w-md ml-auto">
                      <p className="font-semibold">Raw Material Cost:</p>
                      <p>₹{kittingTotals.price.toFixed(2)}</p>
                      <p className="font-semibold">Manufacturing Cost:</p>
                      <p>₹{MANUFACTURING_COST.toFixed(2)}</p>
                      <p className="font-semibold">Interest ({INTEREST_DAYS} days @ 18%):</p>
                      <p>₹{interestAmount.toFixed(2)}</p>
                      <p className="font-semibold border-t pt-2">Total Cost:</p>
                      <p className="border-t pt-2 font-bold text-lg">₹{totalCost.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Edit Form Section
            <div className="max-h-[75vh] overflow-y-auto p-1">
              <div className="grid grid-cols-3 gap-4 mb-4 px-4">
                <div>
                  <Label htmlFor="doNumber">Delivery Order Number</Label>
                  <Input id="doNumber" value={selectedCheck?.deliveryOrderNo || ""} readOnly />
                </div>
                <div>
                  <Label htmlFor="productName">Product Name</Label>
                  <Input id="productName" value={selectedCheck?.productName || ""} readOnly />
                </div>
                <div>
                  <Label htmlFor="plannedDate">Planned Date</Label>
                  <Input id="plannedDate" value={selectedCheck?.plannedDate || "-"} readOnly className="bg-gray-100" />
                </div>
              </div>

              <div className="flex justify-between items-center mb-2 px-4">
                <Button variant="outline" size="sm" onClick={handlePreviewPDF}>
                  <Eye className="h-4 w-4 mr-2" /> Preview PDF
                </Button>
                <Button onClick={addKittingFormRow} disabled={kittingFormRows.length >= 20} className="bg-purple-600 text-white hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-2" /> Add Row
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] p-2">Sl no</TableHead>
                      <TableHead className="w-[200px] p-2">Particulars</TableHead>
                      <TableHead className="p-2">AL</TableHead>
                      <TableHead className="p-2">FE</TableHead>
                      <TableHead className="p-2">BD</TableHead>
                      <TableHead className="p-2">AP</TableHead>
                      <TableHead className="p-2">Price</TableHead>
                      <TableHead className="bg-yellow-100 w-[100px] p-2">%</TableHead>
                      <TableHead className="p-2">AL</TableHead>
                      <TableHead className="p-2">FE</TableHead>
                      <TableHead className="p-2">BD</TableHead>
                      <TableHead className="p-2">AP</TableHead>
                      <TableHead className="p-2">Price</TableHead>
                      <TableHead className="p-2">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kittingFormRows.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="p-2">{index + 1}</TableCell>
                        <TableCell className="p-2">
                          <Select
                            onValueChange={(value) => handleKittingRowChange(row.id, "productName", value)}
                            value={row.productName}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select mat" />
                            </SelectTrigger>
                            <SelectContent>
                              {kycProducts.map((p) => (
                                <SelectItem key={p.productName} value={p.productName}>
                                  {p.productName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-2">{row.baseAlumina.toFixed(2)}</TableCell>
                        <TableCell className="p-2">{row.baseIron.toFixed(2)}</TableCell>
                        <TableCell className="p-2">{row.baseBd.toFixed(2)}</TableCell>
                        <TableCell className="p-2">{row.baseAp.toFixed(2)}</TableCell>
                        <TableCell className="p-2">{row.basePrice.toFixed(2)}</TableCell>
                        <TableCell className="bg-yellow-100 p-2">
                          <Input
                            type="number"
                            value={row.percentage}
                            onChange={(e) => handleKittingRowChange(row.id, "percentage", e.target.value)}
                            placeholder="Enter %"
                          />
                        </TableCell>
                        <TableCell className="p-2">{row.al.toFixed(4)}</TableCell>
                        <TableCell className="p-2">{row.fe.toFixed(4)}</TableCell>
                        <TableCell className="p-2">{row.bd.toFixed(4)}</TableCell>
                        <TableCell className="p-2">{row.ap.toFixed(4)}</TableCell>
                        <TableCell className="p-2">{row.price.toFixed(2)}</TableCell>
                        <TableCell className="p-2">
                          <Button variant="ghost" size="icon" onClick={() => removeKittingFormRow(row.id)}>
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={7} className="text-right font-medium p-2">
                        Manufacturing Cost
                      </TableCell>
                      <TableCell colSpan={5} className="p-2"></TableCell>
                      <TableCell className="p-2">
                        <Input value={MANUFACTURING_COST.toString()} readOnly className="bg-gray-100" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={7} className="text-right font-medium p-2">
                        Interest (days)
                      </TableCell>
                      <TableCell className="bg-yellow-100 p-2">
                        <Input value={INTEREST_DAYS.toString()} readOnly className="bg-gray-100" />
                      </TableCell>
                      <TableCell colSpan={4} className="p-2"></TableCell>
                      <TableCell className="p-2">
                        <Input value={interestAmount.toFixed(2)} readOnly className="bg-gray-100" />
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell colSpan={7} className="text-right p-2">
                        Total
                      </TableCell>
                      <TableCell className="bg-yellow-100 p-2">{kittingTotals.percentage.toFixed(2)}%</TableCell>
                      <TableCell className="p-2">{kittingTotals.al.toFixed(4)}</TableCell>
                      <TableCell className="p-2">{kittingTotals.fe.toFixed(4)}</TableCell>
                      <TableCell className="p-2">{kittingTotals.bd.toFixed(4)}</TableCell>
                      <TableCell className="p-2">{kittingTotals.ap.toFixed(4)}</TableCell>
                      <TableCell className="p-2">{totalCost.toFixed(2)}</TableCell>
                      <TableCell className="p-2"></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 p-4 border-t">
            {!showPreview ? (
              <>
                <Button variant="outline" onClick={() => {
                  setIsKittingDialogOpen(false)
                  setIsReviseDialogOpen(false)
                }} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSaveKittingForm} disabled={isSubmitting} className="bg-purple-600 text-white hover:bg-purple-700">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Back to Edit
                </Button>
                <Button onClick={() => generatePDF(false)} className="bg-purple-600 text-white hover:bg-purple-700">
                  <FileText className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}