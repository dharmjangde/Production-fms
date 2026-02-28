"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CheckCircle, History, Settings, User, Eye, Package, FlaskConical, Calendar, Hash, Building2, Tag, Layers, Clock, FileText, X } from "lucide-react"
import { format } from "date-fns"
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

// --- Type Definitions ---
interface ActualProductionItem {
  timestamp: string
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  supervisorName: string
  productName: string
  quantityFG: number
  serialNumber: string
  rawMaterials: Array<{ name: string; quantity: number }>
  machineRunningHour: string
  remarks1: string
  ppBagUsed: string
  ppBagToBeUsed: string
  partyName: string
  ppBagSmall: string
  costingAmount: string
  colorCondition: string
  orderNo: string
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
  planned5: string
  actual5: string
  remarks2_5: string
  planned6: string
  actual6: string
  remarks3_6: string
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
  machineRunningHour?: string
  remarks1?: string
  ppBagUsed?: string
  ppBagToBeUsed?: string
  ppBagSmall?: string
  costingAmount?: string
  colorCondition?: string
  orderNo?: string
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
  machineRunningHour?: string
  remarks1?: string
  ppBagUsed?: string
  ppBagToBeUsed?: string
  ppBagSmall?: string
  costingAmount?: string
  colorCondition?: string
  orderNo?: string
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
  labTest1: string
  labTest2: string
  chemicalTest: string
  rowIndex: number
  machineRunningHour?: string
  remarks1?: string
  ppBagUsed?: string
  ppBagToBeUsed?: string
  ppBagSmall?: string
  costingAmount?: string
  colorCondition?: string
  orderNo?: string
  timeDelay1?: string
  remarks?: string
  planned2?: string
  actual2?: string
  timeDelay2?: string
  remarks2?: string
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

// --- Compact Column Definitions ---
const HEMLAL_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", alwaysVisible: true },
  { header: "Product Name", dataKey: "productName", alwaysVisible: true },
  { header: "Party Name", dataKey: "partyName", alwaysVisible: true },
  { header: "Planned Date", dataKey: "planned5", alwaysVisible: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor", dataKey: "supervisorName", toggleable: true },
  { header: "Quantity FG", dataKey: "quantityFG", toggleable: true },
  { header: "Serial Number", dataKey: "serialNumber", toggleable: true },
]
for (let i = 1; i <= 20; i++) {
  HEMLAL_COLUMNS_META.push(
    { header: `Raw Material ${i}`, dataKey: `rawMaterial${i}`, toggleable: true },
    { header: `Qty RM ${i}`, dataKey: `rawMaterialQty${i}`, toggleable: true }
  )
}

const JITENDRA_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", alwaysVisible: true },
  { header: "Product Name", dataKey: "productName", alwaysVisible: true },
  { header: "Party Name", dataKey: "partyName", alwaysVisible: true },
  { header: "Planned Date", dataKey: "planned6", alwaysVisible: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor", dataKey: "supervisorName", toggleable: true },
  { header: "Quantity FG", dataKey: "quantityFG", toggleable: true },
  { header: "Serial Number", dataKey: "serialNumber", toggleable: true },
]
for (let i = 1; i <= 20; i++) {
  JITENDRA_COLUMNS_META.push(
    { header: `Raw Material ${i}`, dataKey: `rawMaterial${i}`, toggleable: true },
    { header: `Qty RM ${i}`, dataKey: `rawMaterialQty${i}`, toggleable: true }
  )
}

const DEVSHREE_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", alwaysVisible: true },
  { header: "Product Name", dataKey: "productName", alwaysVisible: true },
  { header: "Party Name", dataKey: "partyName", alwaysVisible: true },
  { header: "Planned Test", dataKey: "plannedTest", alwaysVisible: true },
  { header: "Lab Test 1", dataKey: "labTest1", alwaysVisible: true },
  { header: "Lab Test 2", dataKey: "labTest2", alwaysVisible: true },
  { header: "Chemical Test", dataKey: "chemicalTest", alwaysVisible: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor", dataKey: "supervisorName", toggleable: true },
  { header: "Quantity FG", dataKey: "quantityFG", toggleable: true },
  { header: "Serial Number", dataKey: "serialNumber", toggleable: true },
  { header: "Actual Qty ", dataKey: "actualQty1", toggleable: true },
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
  { header: "Firm Name", dataKey: "firmName", alwaysVisible: true },
  { header: "Product Name", dataKey: "productName", alwaysVisible: true },
  { header: "Party Name", dataKey: "partyName", alwaysVisible: true },
  { header: "Completed At", dataKey: "completedAt", alwaysVisible: true },
  { header: "Status/Remarks", dataKey: "statusOrRemarks", alwaysVisible: true },
  { header: "Actual Qty", dataKey: "actualQty", toggleable: true },
]

// --- Helpers ---
function parseGvizDate(gvizDateString: string | null | undefined): Date | null {
  if (!gvizDateString || typeof gvizDateString !== "string" || !gvizDateString.startsWith("Date(")) return null
  const numbers = gvizDateString.match(/\d+/g)
  if (!numbers || numbers.length < 3) return null
  const [year, month, day, hours = 0, minutes = 0, seconds = 0] = numbers.map(Number)
  return new Date(year, month, day, hours, minutes, seconds)
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-"
  if (typeof date === 'string') return date
  return format(date, "dd/MM/yy HH:mm")
}

function parseActualProductionRow(row: any, index: number): ActualProductionItem {
  const rawMaterials: Array<{ name: string; quantity: number }> = []
  for (let i = 0; i < 20; i++) {
    const nameCol = 8 + (i * 2)
    const qtyCol = 9 + (i * 2)
    const name = row[`col${nameCol}`]
    const qty = row[`col${qtyCol}`]
    if (name && String(name).trim() !== "") {
      rawMaterials.push({ name: String(name || ""), quantity: Number(qty) || 0 })
    } else {
      break
    }
  }
  return {
    timestamp: formatDate(parseGvizDate(row.col0)),
    jobCardNo: String(row.col1 || ""),
    firmName: String(row.col2 || ""),
    dateOfProduction: formatDate(parseGvizDate(row.col3)),
    supervisorName: String(row.col4 || ""),
    productName: String(row.col5 || ""),
    quantityFG: Number(row.col6) || 0,
    serialNumber: String(row.col7 || ""),
    rawMaterials,
    machineRunningHour: String(row.col48 || ""),
    remarks1: String(row.col49 || ""),
    ppBagUsed: String(row.col50 || ""),
    ppBagToBeUsed: String(row.col51 || ""),
    partyName: String(row.col52 || ""),
    ppBagSmall: String(row.col53 || ""),
    costingAmount: String(row.col54 || ""),
    colorCondition: String(row.col55 || ""),
    orderNo: String(row.col56 || ""),
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
    planned5: formatDate(parseGvizDate(row.col72)),
    actual5: formatDate(parseGvizDate(row.col73)),
    remarks2_5: String(row.col74 || ""),
    planned6: formatDate(parseGvizDate(row.col75)),
    actual6: formatDate(parseGvizDate(row.col76)),
    remarks3_6: String(row.col77 || ""),
    rowIndex: index + 6,
  }
}

// --- Detail Field Component ---
function DetailField({ icon: Icon, label, value, fullWidth = false }: { icon?: any; label: string; value: any; fullWidth?: boolean }) {
  const displayValue = value !== undefined && value !== null && value !== "" && value !== "-" ? String(value) : "—"
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{displayValue}</span>
    </div>
  )
}

// --- Detail Section Header ---
function SectionHeader({ title, color = "gray" }: { title: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    green: "bg-green-50 text-green-700 border-green-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  }
  return (
    <div className={`px-3 py-1.5 rounded-md border text-xs font-semibold uppercase tracking-wider ${colors[color]}`}>
      {title}
    </div>
  )
}

// --- Test Badge ---
function TestBadge({ value }: { value: string }) {
  const isPass = value === "Pass" || value === "Accepted"
  const isNA = !value || value === "N/A" || value === "null"
  if (isNA) return <Badge variant="outline" className="text-xs">N/A</Badge>
  return (
    <Badge variant={isPass ? "default" : "destructive"} className="text-xs">
      {value}
    </Badge>
  )
}

// --- Hemlal View Popup ---
function HemlalViewDialog({ item, open, onClose }: { item: HemlalPendingItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-blue-700">
                <User className="h-5 w-5" />
                Hemlal / ANAND — Production Details
              </DialogTitle>
              <DialogDescription className="mt-1">
                <Badge variant="outline" className="mr-2 text-blue-600 border-blue-300">{item.jobCardNo}</Badge>
                {item.productName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Basic Info */}
          <div>
            <SectionHeader title="Basic Information" color="blue" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3 px-1">
              <DetailField icon={Hash} label="Job Card No." value={item.jobCardNo} />
              <DetailField icon={Building2} label="Firm Name" value={item.firmName} />
              <DetailField icon={Calendar} label="Date of Production" value={item.dateOfProduction} />
              <DetailField icon={User} label="Supervisor" value={item.supervisorName} />
              <DetailField icon={Package} label="Product Name" value={item.productName} />
              <DetailField icon={Tag} label="Party Name" value={item.partyName} />
              <DetailField icon={Layers} label="Quantity FG" value={item.quantityFG} />
              <DetailField icon={Hash} label="Serial Number" value={item.serialNumber} />
              <DetailField icon={Calendar} label="Planned Date (Planned5)" value={item.planned5} />
            </div>
          </div>

          {/* Production Info */}
          <div>
            <SectionHeader title="Production Information" color="amber" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3 px-1">
              <DetailField icon={Clock} label="Machine Running Hour" value={item.machineRunningHour} />
              <DetailField icon={Hash} label="Order No." value={item.orderNo} />
              <DetailField icon={Tag} label="Color Condition" value={item.colorCondition} />
              <DetailField icon={FileText} label="Costing Amount" value={item.costingAmount} />
              <DetailField label="PP Bag Used" value={item.ppBagUsed} />
              <DetailField label="PP Bag To Be Used" value={item.ppBagToBeUsed} />
              <DetailField label="PP Bag Small" value={item.ppBagSmall} />
              <DetailField icon={FileText} label="Remarks" value={item.remarks1} />
            </div>
          </div>

          {/* Raw Materials */}
          {item.rawMaterials && item.rawMaterials.length > 0 && (
            <div>
              <SectionHeader title={`Raw Materials (${item.rawMaterials.length})`} color="green" />
              <div className="mt-3 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-green-50/60">
                    <TableRow>
                      <TableHead className="text-xs font-semibold text-green-700">#</TableHead>
                      <TableHead className="text-xs font-semibold text-green-700">Material Name</TableHead>
                      <TableHead className="text-xs font-semibold text-green-700">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.rawMaterials.map((rm, idx) => (
                      <TableRow key={idx} className="hover:bg-green-50/30">
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{rm.name}</TableCell>
                        <TableCell className="text-sm">{rm.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t mt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Jitendra View Popup ---
function JitendraViewDialog({ item, open, onClose }: { item: JitendraPendingItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <User className="h-5 w-5" />
            Jitendra — Production Details
          </DialogTitle>
          <DialogDescription className="mt-1">
            <Badge variant="outline" className="mr-2 text-green-600 border-green-300">{item.jobCardNo}</Badge>
            {item.productName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <SectionHeader title="Basic Information" color="green" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3 px-1">
              <DetailField icon={Hash} label="Job Card No." value={item.jobCardNo} />
              <DetailField icon={Building2} label="Firm Name" value={item.firmName} />
              <DetailField icon={Calendar} label="Date of Production" value={item.dateOfProduction} />
              <DetailField icon={User} label="Supervisor" value={item.supervisorName} />
              <DetailField icon={Package} label="Product Name" value={item.productName} />
              <DetailField icon={Tag} label="Party Name" value={item.partyName} />
              <DetailField icon={Layers} label="Quantity FG" value={item.quantityFG} />
              <DetailField icon={Hash} label="Serial Number" value={item.serialNumber} />
              <DetailField icon={Calendar} label="Planned Date (Planned6)" value={item.planned6} />
            </div>
          </div>

          <div>
            <SectionHeader title="Production Information" color="amber" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3 px-1">
              <DetailField icon={Clock} label="Machine Running Hour" value={item.machineRunningHour} />
              <DetailField icon={Hash} label="Order No." value={item.orderNo} />
              <DetailField icon={Tag} label="Color Condition" value={item.colorCondition} />
              <DetailField icon={FileText} label="Costing Amount" value={item.costingAmount} />
              <DetailField label="PP Bag Used" value={item.ppBagUsed} />
              <DetailField label="PP Bag To Be Used" value={item.ppBagToBeUsed} />
              <DetailField label="PP Bag Small" value={item.ppBagSmall} />
              <DetailField icon={FileText} label="Remarks" value={item.remarks1} />
            </div>
          </div>

          {item.rawMaterials && item.rawMaterials.length > 0 && (
            <div>
              <SectionHeader title={`Raw Materials (${item.rawMaterials.length})`} color="green" />
              <div className="mt-3 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-green-50/60">
                    <TableRow>
                      <TableHead className="text-xs font-semibold text-green-700">#</TableHead>
                      <TableHead className="text-xs font-semibold text-green-700">Material Name</TableHead>
                      <TableHead className="text-xs font-semibold text-green-700">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.rawMaterials.map((rm, idx) => (
                      <TableRow key={idx} className="hover:bg-green-50/30">
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{rm.name}</TableCell>
                        <TableCell className="text-sm">{rm.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t mt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Devshree View Popup ---
function DevshreeViewDialog({ item, open, onClose }: { item: DevshreePendingItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <FlaskConical className="h-5 w-5" />
            Devshree — Verification Details
          </DialogTitle>
          <DialogDescription className="mt-1">
            <Badge variant="outline" className="mr-2 text-purple-600 border-purple-300">{item.jobCardNo}</Badge>
            {item.productName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Basic Info */}
          <div>
            <SectionHeader title="Basic Information" color="purple" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3 px-1">
              <DetailField icon={Hash} label="Job Card No." value={item.jobCardNo} />
              <DetailField icon={Building2} label="Firm Name" value={item.firmName} />
              <DetailField icon={Calendar} label="Date of Production" value={item.dateOfProduction} />
              <DetailField icon={User} label="Supervisor" value={item.supervisorName} />
              <DetailField icon={Package} label="Product Name" value={item.productName} />
              <DetailField icon={Tag} label="Party Name" value={item.partyName} />
              <DetailField icon={Layers} label="Quantity FG" value={item.quantityFG} />
              <DetailField icon={Hash} label="Serial Number" value={item.serialNumber} />
              <DetailField icon={Calendar} label="Planned Test (Planned1)" value={item.plannedTest} />
              <DetailField icon={Layers} label="Actual Qty 1" value={item.actualQty1} />
            </div>
          </div>

          {/* Lab Tests */}
          <div>
            <SectionHeader title="Lab & Quality Tests" color="purple" />
            <div className="grid grid-cols-3 gap-4 mt-3 px-1">
              <div className="flex flex-col gap-1 items-start p-3 border rounded-lg bg-purple-50/40">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" /> Lab Test 1
                </span>
                <TestBadge value={item.labTest1} />
              </div>
              <div className="flex flex-col gap-1 items-start p-3 border rounded-lg bg-purple-50/40">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" /> Lab Test 2
                </span>
                <TestBadge value={item.labTest2} />
              </div>
              <div className="flex flex-col gap-1 items-start p-3 border rounded-lg bg-purple-50/40">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" /> Chemical Test
                </span>
                <TestBadge value={item.chemicalTest} />
              </div>
            </div>
          </div>

          {/* Cycle Info */}
          <div>
            <SectionHeader title="Cycle Timing" color="gray" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3 px-1">
              <DetailField icon={Calendar} label="Planned 2" value={item.planned2} />
              <DetailField icon={Calendar} label="Actual 2" value={item.actual2} />
              <DetailField icon={FileText} label="Remarks 2" value={item.remarks2} />
            </div>
          </div>

          {/* Production Info */}
          <div>
            <SectionHeader title="Production Information" color="amber" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3 px-1">
              <DetailField icon={Clock} label="Machine Running Hour" value={item.machineRunningHour} />
              <DetailField icon={Hash} label="Order No." value={item.orderNo} />
              <DetailField icon={Tag} label="Color Condition" value={item.colorCondition} />
              <DetailField icon={FileText} label="Costing Amount" value={item.costingAmount} />
              <DetailField label="PP Bag Used" value={item.ppBagUsed} />
              <DetailField label="PP Bag To Be Used" value={item.ppBagToBeUsed} />
              <DetailField label="PP Bag Small" value={item.ppBagSmall} />
              <DetailField icon={FileText} label="Remarks 1" value={item.remarks1} />
            </div>
          </div>

          {/* Raw Materials */}
          {item.rawMaterials && item.rawMaterials.length > 0 && (
            <div>
              <SectionHeader title={`Raw Materials (${item.rawMaterials.length})`} color="green" />
              <div className="mt-3 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-green-50/60">
                    <TableRow>
                      <TableHead className="text-xs font-semibold text-green-700">#</TableHead>
                      <TableHead className="text-xs font-semibold text-green-700">Material Name</TableHead>
                      <TableHead className="text-xs font-semibold text-green-700">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.rawMaterials.map((rm, idx) => (
                      <TableRow key={idx} className="hover:bg-green-50/30">
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{rm.name}</TableCell>
                        <TableCell className="text-sm">{rm.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t mt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Column Toggler ---
function ColumnToggler({ tab, columnsMeta, visibilityMap, onToggle, onSelectAll }: {
  tab: string
  columnsMeta: any[]
  visibilityMap: Record<string, boolean>
  onToggle: (dataKey: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent ml-auto">
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3">
        <div className="grid gap-2">
          <p className="text-sm font-medium">Toggle Columns</p>
          <div className="flex items-center justify-between mt-1 mb-2">
            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => onSelectAll(true)}>Select All</Button>
            <span className="text-gray-300 mx-1">|</span>
            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => onSelectAll(false)}>Deselect All</Button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {columnsMeta.filter((col) => col.toggleable).map((col) => (
              <div key={col.dataKey} className="flex items-center space-x-2">
                <Checkbox
                  id={`toggle-${tab}-${col.dataKey}`}
                  checked={!!visibilityMap[col.dataKey]}
                  onCheckedChange={(checked) => onToggle(col.dataKey, Boolean(checked))}
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
}

// ============================
// MAIN COMPONENT
// ============================
export default function CheckPage() {
  const [hemlalPending, setHemlalPending] = useState<HemlalPendingItem[]>([])
  const [jitendraPending, setJitendraPending] = useState<JitendraPendingItem[]>([])
  const [devshreePending, setDevshreePending] = useState<DevshreePendingItem[]>([])
  const [combinedHistory, setCombinedHistory] = useState<CombinedHistoryItem[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Action dialogs (mark done / verify)
  const [isHemlalDialogOpen, setIsHemlalDialogOpen] = useState(false)
  const [isJitendraDialogOpen, setIsJitendraDialogOpen] = useState(false)
  const [isDevshreeDialogOpen, setIsDevshreeDialogOpen] = useState(false)

  // View detail dialogs
  const [isHemlalViewOpen, setIsHemlalViewOpen] = useState(false)
  const [isJitendraViewOpen, setIsJitendraViewOpen] = useState(false)
  const [isDevshreeViewOpen, setIsDevshreeViewOpen] = useState(false)

  const [selectedHemlal, setSelectedHemlal] = useState<HemlalPendingItem | null>(null)
  const [selectedJitendra, setSelectedJitendra] = useState<JitendraPendingItem | null>(null)
  const [selectedDevshree, setSelectedDevshree] = useState<DevshreePendingItem | null>(null)

  const [hemlalFormData, setHemlalFormData] = useState({ remarks: "" })
  const [jitendraFormData, setJitendraFormData] = useState({ remarks: "" })
  const [devshreeFormData, setDevshreeFormData] = useState({ status: "", actualQty: "" })

  const [hemlalFormErrors, setHemlalFormErrors] = useState<Record<string, string | null>>({})
  const [jitendraFormErrors, setJitendraFormErrors] = useState<Record<string, string | null>>({})
  const [devshreeFormErrors, setDevshreeFormErrors] = useState<Record<string, string | null>>({})

  const [activeTab, setActiveTab] = useState("hemlal")

  // Column visibility - show alwaysVisible + non-raw-material toggleable cols by default
  const initVisibility = (meta: any[]) => {
    const v: Record<string, boolean> = {}
    meta.forEach(col => {
      // Always show alwaysVisible columns
      // For toggleable: show basic info columns, hide raw material columns by default
      const isRawMaterial = col.dataKey.startsWith('rawMaterial')
      v[col.dataKey] = !!col.alwaysVisible || (!!col.toggleable && !isRawMaterial)
    })
    return v
  }
  const [visibleHemlalColumns, setVisibleHemlalColumns] = useState<Record<string, boolean>>(() => initVisibility(HEMLAL_COLUMNS_META))
  const [visibleJitendraColumns, setVisibleJitendraColumns] = useState<Record<string, boolean>>(() => initVisibility(JITENDRA_COLUMNS_META))
  const [visibleDevshreeColumns, setVisibleDevshreeColumns] = useState<Record<string, boolean>>(() => initVisibility(DEVSHREE_COLUMNS_META))
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>(() => initVisibility(HISTORY_COLUMNS_META))

  const fetchDataWithGviz = useCallback(async (sheetName: string) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&cb=${new Date().getTime()}`
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

        const startIndex = table.rows.findIndex((r: any) =>
          r.c?.[1]?.v && r.c?.[1]?.v !== "Job Card No."
        )

        return table.rows.slice(startIndex).map((row: GvizRow, index: number) => {
          if (!row.c || !row.c.some((cell) => cell && cell.v !== null)) return null

          const rowData: { [key: string]: any } = {}
          row.c.forEach((cell, cellIndex) => {
            rowData[`col${cellIndex}`] = cell ? cell.v : null
          })

          return {
            ...rowData,
            __sheetRow: index + startIndex + 1, // actual sheet row
          }
        }).filter(Boolean)
      }

      const actualProductionRows = processGvizTable(actualProductionTable)
      const masterDataRows = processGvizTable(masterTable)
      const jobCardsRows = processGvizTable(jobCardsTable)

      const allItems = actualProductionRows.map((row: any, index: number) => parseActualProductionRow(row, index))

      // Hemlal Pending
      const hemlalPendingData: HemlalPendingItem[] = allItems
        .filter(item => item.jobCardNo && item.planned5 && item.planned5 !== "-" && (!item.actual5 || item.actual5 === "-"))
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
          machineRunningHour: item.machineRunningHour,
          remarks1: item.remarks1,
          ppBagUsed: item.ppBagUsed,
          ppBagToBeUsed: item.ppBagToBeUsed,
          ppBagSmall: item.ppBagSmall,
          costingAmount: item.costingAmount,
          colorCondition: item.colorCondition,
          orderNo: item.orderNo,
        }))
      setHemlalPending(hemlalPendingData)

      // Jitendra Pending
      const jitendraPendingData: JitendraPendingItem[] = allItems
        .filter(item => item.jobCardNo && item.planned6 && item.planned6 !== "-" && (!item.actual6 || item.actual6 === "-"))
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
          machineRunningHour: item.machineRunningHour,
          remarks1: item.remarks1,
          ppBagUsed: item.ppBagUsed,
          ppBagToBeUsed: item.ppBagToBeUsed,
          ppBagSmall: item.ppBagSmall,
          costingAmount: item.costingAmount,
          colorCondition: item.colorCondition,
          orderNo: item.orderNo,
        }))
      setJitendraPending(jitendraPendingData)

      // Devshree Pending
      const devshreePendingData: DevshreePendingItem[] = allItems
        .filter(item => item.jobCardNo && item.planned1 && item.planned1 !== "-" && (!item.actual1 || item.actual1 === "-"))
        .map(item => {
          const jobCard = jobCardsRows.find((jc: any) => String(jc.col1 || '').trim() === String(item.jobCardNo).trim())
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
            labTest1: String(jobCard?.col21 || "N/A"),
            labTest2: String(jobCard?.col33 || "N/A"),
            chemicalTest: String(jobCard?.col44 || "N/A"),
            rowIndex: item.rowIndex,
            machineRunningHour: item.machineRunningHour,
            remarks1: item.remarks1,
            ppBagUsed: item.ppBagUsed,
            ppBagToBeUsed: item.ppBagToBeUsed,
            ppBagSmall: item.ppBagSmall,
            costingAmount: item.costingAmount,
            colorCondition: item.colorCondition,
            orderNo: item.orderNo,
            timeDelay1: item.timeDelay1,
            remarks: item.remarks,
            planned2: item.planned2,
            actual2: item.actual2,
            timeDelay2: item.timeDelay2,
            remarks2: item.remarks2,
          }
        })
      setDevshreePending(devshreePendingData)

      // Combined History
      const historyData: CombinedHistoryItem[] = []
      allItems.filter(item => item.actual1 && item.actual1 !== "-").forEach(item => {
        historyData.push({ id: `devshree-${item.jobCardNo}-${item.actual1}`, type: 'devshree', jobCardNo: item.jobCardNo, firmName: item.firmName, productName: item.productName, partyName: item.partyName, completedAt: item.actual1, status: item.remarks || "Completed", actualQty: item.actualQty1 })
      })
      allItems.filter(item => item.actual5 && item.actual5 !== "-").forEach(item => {
        historyData.push({ id: `hemlal-${item.jobCardNo}-${item.actual5}`, type: 'hemlal', jobCardNo: item.jobCardNo, firmName: item.firmName, productName: item.productName, partyName: item.partyName, completedAt: item.actual5, remarks: item.remarks2_5 })
      })
      allItems.filter(item => item.actual6 && item.actual6 !== "-").forEach(item => {
        historyData.push({ id: `jitendra-${item.jobCardNo}-${item.actual6}`, type: 'jitendra', jobCardNo: item.jobCardNo, firmName: item.firmName, productName: item.productName, partyName: item.partyName, completedAt: item.actual6, remarks: item.remarks3_6 })
      })
      historyData.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      setCombinedHistory(historyData)

      const statuses: string[] = [...new Set(masterDataRows.map((row: any) => String(row.col5 || "")).filter(Boolean))]
      setStatusOptions(statuses)

    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [fetchDataWithGviz])

  useEffect(() => { loadAllData() }, [loadAllData])

  // Validation
  const validateHemlalForm = () => {
    const errors: Record<string, string> = {}
    if (!hemlalFormData.remarks?.trim()) errors.remarks = "Remarks are required."
    setHemlalFormErrors(errors)
    return Object.keys(errors).length === 0
  }
  const validateJitendraForm = () => {
    const errors: Record<string, string> = {}
    if (!jitendraFormData.remarks?.trim()) errors.remarks = "Remarks are required."
    setJitendraFormErrors(errors)
    return Object.keys(errors).length === 0
  }
  const validateDevshreeForm = () => {
    const errors: Record<string, string> = {}
    if (!devshreeFormData.status) errors.status = "Status is required."
    if (!devshreeFormData.actualQty || Number(devshreeFormData.actualQty) <= 0) errors.actualQty = "Valid actual quantity is required."
    setDevshreeFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Save handlers
  const handleSaveHemlal = async () => {
    if (!validateHemlalForm() || !selectedHemlal) return
    setIsSubmitting(true)
    try {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss")
      const columnUpdates = { "74": timestamp, "75": hemlalFormData.remarks }
      const body = new URLSearchParams({ sheetName: ACTUAL_PRODUCTION_SHEET, action: "updateCells", rowIndex: String(selectedHemlal.rowIndex), cellUpdates: JSON.stringify(columnUpdates) })
      const res = await fetch(WEB_APP_URL, { method: "POST", body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || "Failed to update Hemlal data.")
      alert("Hemlal production marked as done successfully!")
      setIsHemlalDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
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
      const columnUpdates = { "77": timestamp, "78": jitendraFormData.remarks }
      const body = new URLSearchParams({ sheetName: ACTUAL_PRODUCTION_SHEET, action: "updateCells", rowIndex: String(selectedJitendra.rowIndex), cellUpdates: JSON.stringify(columnUpdates) })
      const res = await fetch(WEB_APP_URL, { method: "POST", body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || "Failed to update Jitendra data.")
      alert("Jitendra production marked as done successfully!")
      setIsJitendraDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
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
      const columnUpdates = { "59": timestamp, "61": devshreeFormData.status, "62": devshreeFormData.actualQty }
      const body = new URLSearchParams({ sheetName: ACTUAL_PRODUCTION_SHEET, action: "updateCells", rowIndex: String(selectedDevshree.rowIndex), cellUpdates: JSON.stringify(columnUpdates) })
      const res = await fetch(WEB_APP_URL, { method: "POST", body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || "Failed to update verification data.")
      alert("Devshree verification completed successfully!")
      setIsDevshreeDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      alert(`Error: ${err instanceof Error ? err.message : "An unknown error occurred"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Column toggle helpers
  const makeToggler = (setter: any) => (dataKey: string, checked: boolean) => setter((prev: any) => ({ ...prev, [dataKey]: checked }))
  const makeSelectAll = (setter: any, meta: any[]) => (checked: boolean) => {
    const updates: Record<string, boolean> = {}
    meta.filter(c => c.toggleable).forEach(c => { updates[c.dataKey] = checked })
    setter((prev: any) => ({ ...prev, ...updates }))
  }

  const visibleHemlalMeta = useMemo(() => HEMLAL_COLUMNS_META.filter(c => visibleHemlalColumns[c.dataKey]), [visibleHemlalColumns])
  const visibleJitendraMeta = useMemo(() => JITENDRA_COLUMNS_META.filter(c => visibleJitendraColumns[c.dataKey]), [visibleJitendraColumns])
  const visibleDevshreeMeta = useMemo(() => DEVSHREE_COLUMNS_META.filter(c => visibleDevshreeColumns[c.dataKey]), [visibleDevshreeColumns])
  const visibleHistoryMeta = useMemo(() => HISTORY_COLUMNS_META.filter(c => visibleHistoryColumns[c.dataKey]), [visibleHistoryColumns])

  // Cell renderer helpers
  const renderRawMaterialCell = (col: any, rawMaterials: Array<{ name: string; quantity: number }>) => {
    if (col.dataKey.startsWith('rawMaterial') && !col.dataKey.includes('Qty')) {
      const idx = parseInt(col.dataKey.replace('rawMaterial', '')) - 1
      return rawMaterials[idx]?.name || "-"
    }
    if (col.dataKey.startsWith('rawMaterialQty')) {
      const idx = parseInt(col.dataKey.replace('rawMaterialQty', '')) - 1
      return rawMaterials[idx]?.quantity || "-"
    }
    return null
  }

  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
      <p className="ml-4 text-lg">Loading Production Data...</p>
    </div>
  )

  if (error) return (
    <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
      <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
      <p className="text-lg font-semibold">Error Loading Data</p>
      <p>{error}</p>
      <Button onClick={loadAllData} className="mt-4">Retry</Button>
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
          <CardDescription className="text-gray-700">Track production stages from Actual Production sheet.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="hemlal" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Supervisor
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">{hemlalPending.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="devshree" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Devshree
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">{devshreePending.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> All History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">{combinedHistory.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ===== HEMLAL TAB ===== */}
            <TabsContent value="hemlal">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-blue-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground flex items-center">
                      <User className="h-5 w-5 text-blue-600 mr-2" />
                      Hemlal / ANAND Pending ({hemlalPending.length})
                    </CardTitle>
                    <ColumnToggler
                      tab="hemlal"
                      columnsMeta={HEMLAL_COLUMNS_META}
                      visibilityMap={visibleHemlalColumns}
                      onToggle={makeToggler(setVisibleHemlalColumns)}
                      onSelectAll={makeSelectAll(setVisibleHemlalColumns, HEMLAL_COLUMNS_META)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleHemlalMeta.map(col => <TableHead key={col.dataKey}>{col.header}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hemlalPending.length > 0 ? hemlalPending.map((item, index) => (
                          <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-blue-50/50">
                            {visibleHemlalMeta.map(col => {
                              if (col.dataKey === "actionColumn") return (
                                <TableCell key={col.dataKey} className="whitespace-nowrap">
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => { setSelectedHemlal(item); setIsHemlalViewOpen(true) }} className="h-8 px-2 border-blue-200 text-blue-600 hover:bg-blue-50">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" onClick={() => { setSelectedHemlal(item); setHemlalFormData({ remarks: "" }); setHemlalFormErrors({}); setIsHemlalDialogOpen(true) }} className="bg-blue-600 text-white hover:bg-blue-700 h-8">
                                      <CheckCircle className="mr-1 h-4 w-4" /> Done
                                    </Button>
                                  </div>
                                </TableCell>
                              )
                              const rmVal = renderRawMaterialCell(col, item.rawMaterials)
                              if (rmVal !== null) return <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">{rmVal}</TableCell>
                              if (col.dataKey in item) return <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">{(item as any)[col.dataKey] || "-"}</TableCell>
                              return <TableCell key={col.dataKey}>-</TableCell>
                            })}
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={visibleHemlalMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-blue-200/50 bg-blue-50/50 rounded-lg mx-4 my-4">
                                <User className="h-12 w-12 text-blue-500 mb-3" />
                                <p className="font-medium">No ANAND Pending Items</p>
                                <p className="text-sm text-muted-foreground">All tasks are completed.</p>
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

            {/* ===== JITENDRA TAB ===== */}
            <TabsContent value="jitendra">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-green-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground flex items-center">
                      <User className="h-5 w-5 text-green-600 mr-2" />
                      Jitendra Pending ({jitendraPending.length})
                    </CardTitle>
                    <ColumnToggler
                      tab="jitendra"
                      columnsMeta={JITENDRA_COLUMNS_META}
                      visibilityMap={visibleJitendraColumns}
                      onToggle={makeToggler(setVisibleJitendraColumns)}
                      onSelectAll={makeSelectAll(setVisibleJitendraColumns, JITENDRA_COLUMNS_META)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleJitendraMeta.map(col => <TableHead key={col.dataKey}>{col.header}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jitendraPending.length > 0 ? jitendraPending.map((item, index) => (
                          <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-green-50/50">
                            {visibleJitendraMeta.map(col => {
                              if (col.dataKey === "actionColumn") return (
                                <TableCell key={col.dataKey} className="whitespace-nowrap">
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => { setSelectedJitendra(item); setIsJitendraViewOpen(true) }} className="h-8 px-2 border-green-200 text-green-600 hover:bg-green-50">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" onClick={() => { setSelectedJitendra(item); setJitendraFormData({ remarks: "" }); setJitendraFormErrors({}); setIsJitendraDialogOpen(true) }} className="bg-green-600 text-white hover:bg-green-700 h-8">
                                      <CheckCircle className="mr-1 h-4 w-4" /> Done
                                    </Button>
                                  </div>
                                </TableCell>
                              )
                              const rmVal = renderRawMaterialCell(col, item.rawMaterials)
                              if (rmVal !== null) return <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">{rmVal}</TableCell>
                              if (col.dataKey in item) return <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">{(item as any)[col.dataKey] || "-"}</TableCell>
                              return <TableCell key={col.dataKey}>-</TableCell>
                            })}
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={visibleJitendraMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-green-200/50 bg-green-50/50 rounded-lg mx-4 my-4">
                                <User className="h-12 w-12 text-green-500 mb-3" />
                                <p className="font-medium">No Jitendra Pending Items</p>
                                <p className="text-sm text-muted-foreground">All tasks are completed.</p>
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

            {/* ===== DEVSHREE TAB ===== */}
            <TabsContent value="devshree">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-purple-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground flex items-center">
                      <CheckCircle className="h-5 w-5 text-purple-600 mr-2" />
                      Devshree Pending ({devshreePending.length})
                    </CardTitle>
                    <ColumnToggler
                      tab="devshree"
                      columnsMeta={DEVSHREE_COLUMNS_META}
                      visibilityMap={visibleDevshreeColumns}
                      onToggle={makeToggler(setVisibleDevshreeColumns)}
                      onSelectAll={makeSelectAll(setVisibleDevshreeColumns, DEVSHREE_COLUMNS_META)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleDevshreeMeta.map(col => <TableHead key={col.dataKey}>{col.header}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {devshreePending.length > 0 ? devshreePending.map((item, index) => (
                          <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-purple-50/50">
                            {visibleDevshreeMeta.map(col => {
                              if (col.dataKey === "actionColumn") return (
                                <TableCell key={col.dataKey} className="whitespace-nowrap">
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => { setSelectedDevshree(item); setIsDevshreeViewOpen(true) }} className="h-8 px-2 border-purple-200 text-purple-600 hover:bg-purple-50">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" onClick={() => { setSelectedDevshree(item); setDevshreeFormData({ status: "", actualQty: "" }); setDevshreeFormErrors({}); setIsDevshreeDialogOpen(true) }} className="bg-purple-600 text-white hover:bg-purple-700 h-8">
                                      <CheckCircle className="mr-1 h-4 w-4" /> Verify
                                    </Button>
                                  </div>
                                </TableCell>
                              )
                              if (col.dataKey === "labTest1" || col.dataKey === "labTest2" || col.dataKey === "chemicalTest") return (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  <TestBadge value={String((item as any)[col.dataKey] || "N/A")} />
                                </TableCell>
                              )
                              const rmVal = renderRawMaterialCell(col, item.rawMaterials)
                              if (rmVal !== null) return <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">{rmVal}</TableCell>
                              if (col.dataKey in item) return <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">{(item as any)[col.dataKey] || "-"}</TableCell>
                              return <TableCell key={col.dataKey}>-</TableCell>
                            })}
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={visibleDevshreeMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-purple-200/50 bg-purple-50/50 rounded-lg mx-4 my-4">
                                <CheckCircle className="h-12 w-12 text-purple-500 mb-3" />
                                <p className="font-medium">No Devshree Pending Items</p>
                                <p className="text-sm text-muted-foreground">All production items have been verified.</p>
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

            {/* ===== HISTORY TAB ===== */}
            <TabsContent value="history">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground flex items-center">
                      <History className="h-5 w-5 text-gray-600 mr-2" />
                      Complete History ({combinedHistory.length})
                    </CardTitle>
                    <ColumnToggler
                      tab="history"
                      columnsMeta={HISTORY_COLUMNS_META}
                      visibilityMap={visibleHistoryColumns}
                      onToggle={makeToggler(setVisibleHistoryColumns)}
                      onSelectAll={makeSelectAll(setVisibleHistoryColumns, HISTORY_COLUMNS_META)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleHistoryMeta.map(col => <TableHead key={col.dataKey}>{col.header}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {combinedHistory.length > 0 ? combinedHistory.map((item, index) => (
                          <TableRow key={item.id || index} className="hover:bg-gray-50/50">
                            {visibleHistoryMeta.map(col => {
                              if (col.dataKey === "type") return (
                                <TableCell key={col.dataKey}>
                                  <Badge variant="outline" className={item.type === 'hemlal' ? 'bg-blue-50 text-blue-700 border-blue-200' : item.type === 'jitendra' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                  </Badge>
                                </TableCell>
                              )
                              if (col.dataKey === "statusOrRemarks") return (
                                <TableCell key={col.dataKey}>
                                  {item.type === 'devshree' ? <Badge variant="default">{item.status || "Completed"}</Badge> : item.remarks || "-"}
                                </TableCell>
                              )
                              if (col.dataKey === "actualQty") return <TableCell key={col.dataKey}>{item.actualQty || "-"}</TableCell>
                              if (col.dataKey in item) return <TableCell key={col.dataKey}>{(item as any)[col.dataKey] || "-"}</TableCell>
                              return <TableCell key={col.dataKey}>-</TableCell>
                            })}
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200/50 bg-gray-50/50 rounded-lg mx-4 my-4">
                                <History className="h-12 w-12 text-gray-500 mb-3" />
                                <p className="font-medium">No History Available</p>
                                <p className="text-sm text-muted-foreground">Completed tasks will appear here.</p>
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

      {/* ===== VIEW DETAIL POPUPS ===== */}
      <HemlalViewDialog item={selectedHemlal} open={isHemlalViewOpen} onClose={() => setIsHemlalViewOpen(false)} />
      <JitendraViewDialog item={selectedJitendra} open={isJitendraViewOpen} onClose={() => setIsJitendraViewOpen(false)} />
      <DevshreeViewDialog item={selectedDevshree} open={isDevshreeViewOpen} onClose={() => setIsDevshreeViewOpen(false)} />

      {/* ===== HEMLAL MARK DONE DIALOG ===== */}
      <Dialog open={isHemlalDialogOpen} onOpenChange={setIsHemlalDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Mark ANAND Production Done</DialogTitle>
            <DialogDescription>Job Card: {selectedHemlal?.jobCardNo} — {selectedHemlal?.productName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveHemlal() }} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-blue-50/60">
              <div><Label className="text-xs">Firm Name</Label><p className="text-sm font-semibold">{selectedHemlal?.firmName}</p></div>
              <div><Label className="text-xs">Product</Label><p className="text-sm font-semibold">{selectedHemlal?.productName}</p></div>
              <div><Label className="text-xs">Supervisor</Label><p className="text-sm font-semibold">{selectedHemlal?.supervisorName}</p></div>
              <div><Label className="text-xs">Planned Date (Planned5)</Label><p className="text-sm font-semibold">{selectedHemlal?.planned5}</p></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hemlalRemarks">Remarks (Remarks2) *</Label>
              <Textarea id="hemlalRemarks" value={hemlalFormData.remarks} onChange={(e) => setHemlalFormData(p => ({ ...p, remarks: e.target.value }))} placeholder="Enter completion remarks..." className={hemlalFormErrors.remarks ? "border-red-500" : ""} rows={3} />
              {hemlalFormErrors.remarks && <p className="text-xs text-red-600 mt-1">{hemlalFormErrors.remarks}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsHemlalDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark as Done
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== JITENDRA MARK DONE DIALOG ===== */}
      <Dialog open={isJitendraDialogOpen} onOpenChange={setIsJitendraDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Mark Jitendra Production Done</DialogTitle>
            <DialogDescription>Job Card: {selectedJitendra?.jobCardNo} — {selectedJitendra?.productName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveJitendra() }} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-green-50/60">
              <div><Label className="text-xs">Firm Name</Label><p className="text-sm font-semibold">{selectedJitendra?.firmName}</p></div>
              <div><Label className="text-xs">Product</Label><p className="text-sm font-semibold">{selectedJitendra?.productName}</p></div>
              <div><Label className="text-xs">Supervisor</Label><p className="text-sm font-semibold">{selectedJitendra?.supervisorName}</p></div>
              <div><Label className="text-xs">Planned Date (Planned6)</Label><p className="text-sm font-semibold">{selectedJitendra?.planned6}</p></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jitendraRemarks">Remarks (Remarks3) *</Label>
              <Textarea id="jitendraRemarks" value={jitendraFormData.remarks} onChange={(e) => setJitendraFormData(p => ({ ...p, remarks: e.target.value }))} placeholder="Enter completion remarks..." className={jitendraFormErrors.remarks ? "border-red-500" : ""} rows={3} />
              {jitendraFormErrors.remarks && <p className="text-xs text-red-600 mt-1">{jitendraFormErrors.remarks}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsJitendraDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-green-600 text-white hover:bg-green-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark as Done
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== DEVSHREE VERIFY DIALOG ===== */}
      <Dialog open={isDevshreeDialogOpen} onOpenChange={setIsDevshreeDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Devshree Verification</DialogTitle>
            <DialogDescription>Job Card: {selectedDevshree?.jobCardNo} — {selectedDevshree?.productName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveDevshree() }} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-purple-50/60">
              <div><Label className="text-xs">Firm Name</Label><p className="text-sm font-semibold">{selectedDevshree?.firmName}</p></div>
              <div><Label className="text-xs">Product</Label><p className="text-sm font-semibold">{selectedDevshree?.productName}</p></div>
              <div><Label className="text-xs">Supervisor</Label><p className="text-sm font-semibold">{selectedDevshree?.supervisorName}</p></div>
              <div><Label className="text-xs">Planned Test (Planned1)</Label><p className="text-sm font-semibold">{selectedDevshree?.plannedTest}</p></div>
              <div>
                <Label className="text-xs">Lab Test 1</Label>
                <p className="text-sm font-semibold mt-0.5"><TestBadge value={selectedDevshree?.labTest1 || "N/A"} /></p>
              </div>
              <div>
                <Label className="text-xs">Lab Test 2</Label>
                <p className="text-sm font-semibold mt-0.5"><TestBadge value={selectedDevshree?.labTest2 || "N/A"} /></p>
              </div>
              <div>
                <Label className="text-xs">Chemical Test</Label>
                <p className="text-sm font-semibold mt-0.5"><TestBadge value={selectedDevshree?.chemicalTest || "N/A"} /></p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="devshreeStatus">Status *</Label>
              <Select value={devshreeFormData.status} onValueChange={(v) => setDevshreeFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger className={devshreeFormErrors.status ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select verification status..." />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
              {devshreeFormErrors.status && <p className="text-xs text-red-600 mt-1">{devshreeFormErrors.status}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="devshreeActualQty">Actual Quantity *</Label>
              <Input id="devshreeActualQty" type="number" step="1" min="0" value={devshreeFormData.actualQty} onChange={(e) => setDevshreeFormData(p => ({ ...p, actualQty: e.target.value }))} className={devshreeFormErrors.actualQty ? "border-red-500" : ""} />
              {devshreeFormErrors.actualQty && <p className="text-xs text-red-600 mt-1">{devshreeFormErrors.actualQty}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDevshreeDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-purple-600 text-white hover:bg-purple-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete Verification
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}