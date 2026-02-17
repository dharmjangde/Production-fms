"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Calendar as CalendarIcon, Loader2, FileText, Plus, Settings, Eye } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Type for Production items
interface ProductionItem {
  timestamp: string
  deliveryOrderNo: string
  firmName: string
  partyName: string
  productName: string
  orderQuantity: string
  expectedDeliveryDate: string
  priority: string
  note: string
  crmName: string
  orderCancel: string
  actualProductionPlanned: string
  actualProductionDone: string
  stockTransferred: string
  quantityDelivered: string
  quantityInStock: string
  planningPending: string
  productionPending: string
  status: string
  dateOfCompletePlanning: string
}

// Column Definitions for Job Cards Table
const JOBCARD_COLUMNS_META = [
  { header: "Timestamp", dataKey: "timestamp", toggleable: true },
  { header: "DO No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product", dataKey: "productName", toggleable: true },
  { header: "Qty", dataKey: "orderQuantity", toggleable: true },
  { header: "Exp. Delivery", dataKey: "expectedDeliveryDate", toggleable: true },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Status", dataKey: "status", toggleable: true },
  { header: "CRM Name", dataKey: "crmName", toggleable: true },
  { header: "Order Cancel", dataKey: "orderCancel", toggleable: true },
  { header: "Actual Planned", dataKey: "actualProductionPlanned", toggleable: true },
  { header: "Actual Done", dataKey: "actualProductionDone", toggleable: true },
  { header: "Stock Trans.", dataKey: "stockTransferred", toggleable: true },
  { header: "Qty Del.", dataKey: "quantityDelivered", toggleable: true },
  { header: "In Stock", dataKey: "quantityInStock", toggleable: true },
  { header: "Plan Pend.", dataKey: "planningPending", toggleable: true },
  { header: "Prod Pend.", dataKey: "productionPending", toggleable: true },
  { header: "Complete Plan", dataKey: "dateOfCompletePlanning", toggleable: true },
  { header: "Notes", dataKey: "note", toggleable: true },
]

export default function OrdersPage() {
  const [date, setDate] = useState<Date | undefined>()
  const [priority, setPriority] = useState("")
  const [priorityOptions] = useState(["Normal", "High", "Urgent"])
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({})

  // Central state to hold all production data
  const [productionData, setProductionData] = useState<ProductionItem[]>([])

  // State for dropdown options
  const [firmOptions, setFirmOptions] = useState<string[]>([])
  const [orderNoOptions, setOrderNoOptions] = useState<string[]>([])

  // State for order details from Orders sheet
  const [allOrdersData, setAllOrdersData] = useState<any[]>([])

  const formatDateTime = (value: any) => {
    if (!value) return "-";

    if (typeof value === "string" && value.startsWith("Date(")) {
      const parts = value.match(/\d+/g);
      if (!parts) return value;

      const date = new Date(
        Number(parts[0]),
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3] || 0),
        Number(parts[4] || 0),
        Number(parts[5] || 0)
      );

      const pad = (n: number) => n.toString().padStart(2, "0");

      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date
        .getFullYear()
        .toString()
        .slice(-2)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
          date.getSeconds()
        )}`;
    }

    return value;
  };


  // State for form data
  const [formData, setFormData] = useState({
    firmName: "",
    deliveryOrderNo: "",
    partyName: "",
    productName: "",
    orderQuantity: "",
    note: "",
  })

  const [fetchingOptions, setFetchingOptions] = useState(true)

  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec"
  const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4"

  // Initialize column visibility
  useEffect(() => {
    const visibility: Record<string, boolean> = {
      timestamp: true,
      deliveryOrderNo: true,
      firmName: true,
      partyName: true,
      productName: true,
      orderQuantity: true,
      expectedDeliveryDate: true,
      status: true,
      quantityDelivered: true,

      // बाकी सब hidden by default
      priority: false,
      crmName: false,
      orderCancel: false,
      actualProductionPlanned: false,
      actualProductionDone: false,
      stockTransferred: false,
      quantityInStock: false,
      planningPending: false,
      productionPending: false,
      dateOfCompletePlanning: false,
      note: false,
    }

    setVisibleColumns(visibility)
  }, [])

  // Fetch data from both Orders and Production sheets
  useEffect(() => {
    const fetchAllData = async () => {
      setFetchingData(true)
      try {
        // Fetch Orders sheet for dropdown options
        const ordersUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Orders&headers=1`;
        const ordersResponse = await fetch(ordersUrl);
        if (ordersResponse.ok) {
          const ordersText = await ordersResponse.text();
          const ordersMatch = ordersText.match(/google\.visualization\.Query\.setResponse\((.*)\)/);
          if (ordersMatch && ordersMatch[1]) {
            const gvizResponse = JSON.parse(ordersMatch[1]);
            const rows = gvizResponse.table.rows.map((row: any) => ({
              firmName: row.c[0]?.v,
              partyName: row.c[1]?.v,
              orderNo: row.c[2]?.v,
              productName: row.c[3]?.v,
            }));
            setAllOrdersData(rows);

            // Get unique firm names for the first dropdown
            const uniqueFirms = [...new Set(rows.map((row: any) => row.firmName).filter(Boolean))] as string[];
            setFirmOptions(uniqueFirms);
          }
        }

        // Fetch Production sheet for table data
        const productionUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Production&headers=0`;
        const productionResponse = await fetch(productionUrl);
        if (productionResponse.ok) {
          const productionText = await productionResponse.text();
          const productionMatch = productionText.match(/google\.visualization\.Query\.setResponse\((.*)\)/);
          if (productionMatch && productionMatch[1]) {
            const gvizResponse = JSON.parse(productionMatch[1]);

            // Skip 5 header rows as per the user's request and screenshot structure
            const rows = gvizResponse.table.rows.slice(3).map((row: any) => ({
              timestamp: row.c[0]?.v || "",
              deliveryOrderNo: row.c[1]?.v || "",
              firmName: row.c[2]?.v || "",
              partyName: row.c[3]?.v || "",
              productName: row.c[4]?.v || "",
              orderQuantity: row.c[5]?.v || "",
              expectedDeliveryDate: row.c[6]?.v || "",
              priority: row.c[7]?.v || "",
              note: row.c[8]?.v || "",
              crmName: row.c[9]?.v || "",
              orderCancel: row.c[10]?.v || "",
              actualProductionPlanned: row.c[11]?.v || "",
              actualProductionDone: row.c[12]?.v || "",
              stockTransferred: row.c[13]?.v || "",
              quantityDelivered: row.c[14]?.v || "",
              quantityInStock: row.c[15]?.v || "",
              planningPending: row.c[16]?.v || "",
              productionPending: row.c[17]?.v || "",
              status: row.c[18]?.v || "",
              dateOfCompletePlanning: row.c[19]?.v || "",
            })).filter((row: any) => row.timestamp || row.deliveryOrderNo);

            setProductionData(rows);
          }
        }

      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setFetchingData(false);
        setFetchingOptions(false);
      }
    };

    fetchAllData();
  }, [SHEET_ID]);

  // Handle Firm Name selection
  const handleFirmChange = (selectedFirm: string) => {
    // Filter orders for the selected firm
    const filteredOrders = allOrdersData
      .filter(order => order.firmName === selectedFirm)
      .map(order => order.orderNo)
      .filter(Boolean);

    const uniqueOrderNos = [...new Set(filteredOrders)];
    setOrderNoOptions(uniqueOrderNos);

    // Update form state and reset dependent fields
    setFormData({
      ...formData,
      firmName: selectedFirm,
      deliveryOrderNo: "",
      partyName: "",
      productName: ""
    });
  };

  // Handle Order No. selection
  const handleOrderNoChange = (selectedOrderNo: string) => {
    // Find the full order details
    const selectedOrder = allOrdersData.find(order =>
      order.firmName === formData.firmName && order.orderNo === selectedOrderNo
    );

    // Auto-populate party and product name
    setFormData({
      ...formData,
      deliveryOrderNo: selectedOrderNo,
      partyName: selectedOrder?.partyName || "",
      productName: selectedOrder?.productName || "",
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!formData.firmName.trim() || !formData.deliveryOrderNo.trim()) {
      alert("Please select a Firm Name and a Delivery Order No.")
      return
    }

    setLoading(true)

    try {
      const now = new Date();
      const pad = (num: number) => num.toString().padStart(2, '0');
      const formattedTimestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const expectedDeliveryFormatted = date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : ""

      // Row data array matching columns A to T
      const rowDataArray = [
        formattedTimestamp,                    // A: Timestamp
        formData.deliveryOrderNo.trim(),       // B: Delivery Order No.
        formData.firmName.trim(),               // C: FIRM Name
        formData.partyName.trim(),              // D: Party Name
        formData.productName.trim(),             // E: Product Name
        formData.orderQuantity.trim(),           // F: Order Quantity
        expectedDeliveryFormatted,               // G: Expected Delivery Date
        priority,                                // H: Priority
        formData.note.trim(),                    // I: Note
        "",                                      // J: Crm Name
        "",                                      // K: Order Cancel
        "",                                      // L: Actual Production Planned
        "",                                      // M: Actual Production Done
        "",                                      // N: Stock Transferred
        "",                                      // O: Quantity Delivered
        "",                                      // P: Quantity In Stock
        "",                                      // Q: Planning Pending
        "",                                      // R: Production Pending
        "Pending",                               // S: Status
        "",                                      // T: Date Of Complete Planning
      ];

      const body = new URLSearchParams({
        sheetName: "Production",
        action: 'insert',
        rowData: JSON.stringify(rowDataArray)
      });

      const response = await fetch(WEB_APP_URL, {
        method: 'POST',
        body: body,
      });

      const result = await response.json();

      if (result.success) {
        alert("Job Card created successfully!")

        // Reset form
        setFormData({ firmName: "", deliveryOrderNo: "", partyName: "", productName: "", orderQuantity: "", note: "" })
        setDate(undefined)
        setPriority("")
        setOrderNoOptions([]);
        setIsFormOpen(false); // Close the modal after submission

        // Refresh production data
        const productionUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Production&headers=0&cb=${new Date().getTime()}`;
        const productionResponse = await fetch(productionUrl);
        if (productionResponse.ok) {
          const productionText = await productionResponse.text();
          const productionMatch = productionText.match(/google\.visualization\.Query\.setResponse\((.*)\)/);
          if (productionMatch && productionMatch[1]) {
            const gvizResponse = JSON.parse(productionMatch[1]);
            // Skip 5 header rows as per the user's request and screenshot structure
            const rows = gvizResponse.table.rows.slice(3).map((row: any) => ({
              timestamp: row.c[0]?.v || "",
              deliveryOrderNo: row.c[1]?.v || "",
              firmName: row.c[2]?.v || "",
              partyName: row.c[3]?.v || "",
              productName: row.c[4]?.v || "",
              orderQuantity: row.c[5]?.v || "",
              expectedDeliveryDate: row.c[6]?.v || "",
              priority: row.c[7]?.v || "",
              note: row.c[8]?.v || "",
              crmName: row.c[9]?.v || "",
              orderCancel: row.c[10]?.v || "",
              actualProductionPlanned: row.c[11]?.v || "",
              actualProductionDone: row.c[12]?.v || "",
              stockTransferred: row.c[13]?.v || "",
              quantityDelivered: row.c[14]?.v || "",
              quantityInStock: row.c[15]?.v || "",
              planningPending: row.c[16]?.v || "",
              productionPending: row.c[17]?.v || "",
              status: row.c[18]?.v || "",
              dateOfCompletePlanning: row.c[19]?.v || "",
            })).filter((row: any) => row.timestamp || row.deliveryOrderNo);

            setProductionData(rows);
          }
        }
      } else {
        throw new Error(result.error || "An unknown error occurred during submission.");
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred."
      alert(`Job Card creation failed: ${errorMessage}`);
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Urgent</Badge>
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">High</Badge>
      case 'normal':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Normal</Badge>
      default:
        return <Badge variant="outline">{priority || '-'}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case 'in progress':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In Progress</Badge>
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>
      default:
        return <Badge variant="outline">{status || '-'}</Badge>
    }
  }

  // Filter data based on active tab
  const filteredData = useMemo(() => {
    if (activeTab === "all") return productionData
    if (activeTab === "pending") return productionData.filter(item => item.status?.toLowerCase() === 'pending')
    if (activeTab === "in-progress") return productionData.filter(item => item.status?.toLowerCase() === 'in progress' || item.status?.toLowerCase() === 'in-progress')
    if (activeTab === "completed")
      return productionData.filter(
        item =>
          item.status?.toLowerCase() === 'completed' ||
          item.status?.toLowerCase() === 'complete' ||
          item.status?.toLowerCase() === 'done'
      )
    return productionData
  }, [productionData, activeTab])

  // Get visible columns
  const visibleColumnsMeta = useMemo(
    () => JOBCARD_COLUMNS_META.filter((col) => visibleColumns[col.dataKey]),
    [visibleColumns],
  )

  // Handle column toggle
  const handleToggleColumn = (dataKey: string, checked: boolean) => {
    setVisibleColumns((prev) => ({ ...prev, [dataKey]: checked }))
  }

  // Handle select all columns
  const handleSelectAllColumns = (checked: boolean) => {
    const newVisibility: Record<string, boolean> = {}
    JOBCARD_COLUMNS_META.forEach((col) => {
      newVisibility[col.dataKey] = checked
    })
    setVisibleColumns(newVisibility)
  }

  // Column Toggler Component
  const ColumnToggler = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
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
              onClick={() => handleSelectAllColumns(true)}
            >
              Select All
            </Button>
            <span className="text-gray-300 mx-1">|</span>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => handleSelectAllColumns(false)}
            >
              Deselect All
            </Button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {JOBCARD_COLUMNS_META.map((col) => (
              <div key={`toggle-${col.dataKey}`} className="flex items-center space-x-2">
                <Checkbox
                  id={`toggle-${col.dataKey}`}
                  checked={!!visibleColumns[col.dataKey]}
                  onCheckedChange={(checked) => handleToggleColumn(col.dataKey, Boolean(checked))}
                />
                <Label htmlFor={`toggle-${col.dataKey}`} className="text-xs font-normal cursor-pointer">
                  {col.header}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )

  if (fetchingData && productionData.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
        <p className="ml-4 text-lg">Loading Job Cards...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white min-h-screen">
      {/* Header Card */}
      <Card className="shadow-md border-none">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-t-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-purple-600" />
              <div>
                <CardTitle className="text-gray-800">Job Card Management</CardTitle>
                <CardDescription className="text-gray-700">
                  Create and manage job cards for production orders
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => setIsFormOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/50 w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Job Card
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <CardContent className="p-4">
            <p className="text-xs sm:text-sm text-purple-600 font-medium">Total Job Cards</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{productionData.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-white border-yellow-100">
          <CardContent className="p-4">
            <p className="text-xs sm:text-sm text-yellow-600 font-medium">Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {productionData.filter(item => item.status?.toLowerCase() === 'pending').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="p-4">
            <p className="text-xs sm:text-sm text-blue-600 font-medium">In Progress</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {productionData.filter(item => item.status?.toLowerCase() === 'in progress').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
          <CardContent className="p-4">
            <p className="text-xs sm:text-sm text-green-600 font-medium">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {productionData.filter(item => item.status?.toLowerCase() === 'completed').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Card with Tabs */}
      <Card className="shadow-md border-none">
        <CardHeader className="bg-purple-50/60 rounded-t-lg py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="grid w-full sm:w-[400px] grid-cols-4">
                <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
                <TabsTrigger value="pending" className="text-xs sm:text-sm">Pending</TabsTrigger>
                <TabsTrigger value="in-progress" className="text-xs sm:text-sm">In Progress</TabsTrigger>
                <TabsTrigger value="completed" className="text-xs sm:text-sm">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
            <ColumnToggler />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {visibleColumnsMeta.map((col) => (
                    <TableHead key={col.dataKey} className="whitespace-nowrap text-xs">
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <TableRow key={index} className="hover:bg-purple-50/50">
                      {visibleColumnsMeta.map((col) => (
                        <TableCell key={col.dataKey} className="whitespace-nowrap text-xs sm:text-sm py-2 px-3">
                          {col.dataKey === "priority" ? (
                            getPriorityBadge(item.priority)
                          ) : col.dataKey === "status" ? (
                            getStatusBadge(item.status)
                          ) : col.dataKey === "note" ? (
                            <span className="max-w-[200px] truncate block" title={item.note}>
                              {item.note || '-'}
                            </span>
                          ) : (
                            col.dataKey === "timestamp"
                              ? formatDateTime(item.timestamp)
                              : col.dataKey === "expectedDeliveryDate"
                                ? formatDateTime(item.expectedDeliveryDate)
                                : item[col.dataKey as keyof ProductionItem] || '-'

                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={visibleColumnsMeta.length} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-purple-200/50 bg-purple-50/50 rounded-lg mx-4 my-4 flex-1">
                        <FileText className="h-12 w-12 text-purple-500 mb-3" />
                        <p className="font-medium text-foreground">No Job Cards Found</p>
                        <p className="text-sm text-muted-foreground">
                          Click the "Create New Job Card" button to add one.
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

      {/* Create Job Card Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">Create New Job Card</DialogTitle>
            <DialogDescription className="text-sm">
              Fields marked with <span className="text-purple-500 font-semibold">*</span> are required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firmName" className="text-sm font-medium">
                  Firm Name <span className="text-purple-500">*</span>
                </Label>
                <Select value={formData.firmName} onValueChange={handleFirmChange} required disabled={fetchingOptions}>
                  <SelectTrigger id="firmName">
                    <SelectValue placeholder={fetchingOptions ? "Loading firms..." : "Select a firm"} />
                  </SelectTrigger>
                  <SelectContent>
                    {firmOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryOrderNo" className="text-sm font-medium">
                  Delivery Order No. <span className="text-purple-500">*</span>
                </Label>
                <Select value={formData.deliveryOrderNo} onValueChange={handleOrderNoChange} required disabled={!formData.firmName}>
                  <SelectTrigger id="deliveryOrderNo">
                    <SelectValue placeholder={!formData.firmName ? "Select firm first" : "Select an order no."} />
                  </SelectTrigger>
                  <SelectContent>
                    {orderNoOptions.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partyName" className="text-sm font-medium">Party Name</Label>
                <Input
                  id="partyName"
                  type="text"
                  value={formData.partyName}
                  placeholder="Auto-populated"
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productName" className="text-sm font-medium">Product Name</Label>
                <Input
                  id="productName"
                  type="text"
                  value={formData.productName}
                  placeholder="Auto-populated"
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orderQuantity" className="text-sm font-medium">Order Quantity</Label>
                <Input
                  id="orderQuantity"
                  type="number"
                  min="1"
                  value={formData.orderQuantity}
                  onChange={handleInputChange}
                  placeholder="e.g., 100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Expected Delivery Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-purple-500" />
                      {date ? formatDate(date) : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-purple-200" align="start">
                    <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-sm font-medium">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Set priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((option, index) => (
                      <SelectItem key={index} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="note"
                rows={3}
                value={formData.note}
                onChange={handleInputChange}
                placeholder="Add any special instructions..."
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Creating..." : "Create Job Card"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}