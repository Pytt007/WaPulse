"use client"

import { useEffect, useState, startTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/use-translation'
import type { Order, Contact, Product } from '@/types'
import { Button } from '@/components/ui/button'
import { useCurrency } from '@/hooks/use-currency'
import { convertCurrency } from '@/lib/currency'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Clock,
  Plus,
  Search,
  Eye,
  RefreshCw,
  Trash2,
  Calendar,
} from 'lucide-react'

export default function OrdersPage() {
  const { t } = useTranslation()
  const { format } = useCurrency()
  const [orders, setOrders] = useState<Order[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Selected Order for detail or delete
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Simulation form states
  const [selectedContactId, setSelectedContactId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('stripe')
  const [orderStatus, setOrderStatus] = useState<'pending' | 'paid' | 'cancelled' | 'shipped'>('pending')
  const [orderItems, setOrderItems] = useState<{ product_id: string; quantity: number }[]>([
    { product_id: '', quantity: 1 },
  ])

  const db = createClient()

  const loadData = async () => {
    setLoading(true)
    try {
      const [ordersRes, contactsRes, productsRes] = await Promise.all([
        db.from('orders').select('*'),
        db.from('contacts').select('*'),
        db.from('products').select('*').eq('active', true),
      ])

      if (ordersRes.error) throw ordersRes.error
      if (contactsRes.error) throw contactsRes.error
      if (productsRes.error) throw productsRes.error

      setOrders(ordersRes.data || [])
      setContacts(contactsRes.data || [])
      setProducts(productsRes.data || [])

      if (contactsRes.data && contactsRes.data.length > 0) {
        setSelectedContactId(contactsRes.data[0].id)
      }
      if (productsRes.data && productsRes.data.length > 0) {
        setOrderItems([{ product_id: productsRes.data[0].id, quantity: 1 }])
      }
    } catch (err) {
      console.error('Error loading orders data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenCreate = () => {
    if (contacts.length > 0) setSelectedContactId(contacts[0].id)
    setPaymentMethod('stripe')
    setOrderStatus('pending')
    if (products.length > 0) {
      setOrderItems([{ product_id: products[0].id, quantity: 1 }])
    } else {
      setOrderItems([{ product_id: '', quantity: 1 }])
    }
    setIsCreateOpen(true)
  }

  const handleOpenDetails = (order: Order) => {
    setSelectedOrder(order)
    setIsDetailsOpen(true)
  }

  const handleOpenDelete = (order: Order) => {
    setSelectedOrder(order)
    setIsDeleteOpen(true)
  }

  const handleAddItem = () => {
    const defaultProduct = products[0]?.id || ''
    setOrderItems((prev) => [...prev, { product_id: defaultProduct, quantity: 1 }])
  }

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, key: 'product_id' | 'quantity', value: any) => {
    setOrderItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    )
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContactId || orderItems.some((item) => !item.product_id || item.quantity <= 0)) return

    try {
      // Calculate total amount
      let totalAmount = 0
      const itemsPayload = orderItems.map((item) => {
        const product = products.find((p) => p.id === item.product_id)
        const price = product ? product.price : 0
        totalAmount += price * item.quantity
        return {
          product_id: item.product_id,
          quantity: item.quantity,
          price,
        }
      })

      const firstSelectedProductId = orderItems[0]?.product_id
      const firstSelectedProduct = products.find((p) => p.id === firstSelectedProductId)
      const orderCurrency = firstSelectedProduct?.currency || 'XOF'

      const { error } = await db.from('orders').insert({
        contact_id: selectedContactId,
        total_amount: totalAmount,
        currency: orderCurrency,
        status: orderStatus,
        payment_method: paymentMethod,
        items: itemsPayload,
      })

      if (error) throw error
      setIsCreateOpen(false)
      loadData()
    } catch (err) {
      console.error('Error creating order:', err)
    }
  }

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return

    try {
      const { error } = await db.from('orders').delete().eq('id', selectedOrder.id)
      if (error) throw error
      setIsDeleteOpen(false)
      loadData()
    } catch (err) {
      console.error('Error deleting order:', err)
    }
  }

  // Financial KPIs Calculations
  const paidOrders = orders.filter((o) => o.status === 'paid' || o.status === 'shipped')
  const totalRevenueInXOF = paidOrders.reduce((sum, o) => sum + convertCurrency(o.total_amount, o.currency || 'XOF', 'XOF'), 0)
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const averageBasketInXOF = paidOrders.length > 0 ? totalRevenueInXOF / paidOrders.length : 0

  const filteredOrders = orders.filter((order) => {
    const contactName = order.contact?.name || ''
    const contactPhone = order.contact?.phone || ''
    const contactEmail = order.contact?.email || ''
    const matchesSearch =
      contactName.toLowerCase().includes(search.toLowerCase()) ||
      contactPhone.toLowerCase().includes(search.toLowerCase()) ||
      contactEmail.toLowerCase().includes(search.toLowerCase()) ||
      order.id.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      filterStatus === 'all' ? true : order.status === filterStatus

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {t("Payée")}
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {t("En Attente")}
          </Badge>
        )
      case 'shipped':
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {t("Expédiée")}
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge className="bg-red-500/10 text-red-400 border border-red-500/20">
            {t("Annulée")}
          </Badge>
        )
      default:
        return <Badge className="bg-slate-800 text-slate-400">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-violet-500" />
            {t("Suivi des Commandes")}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("Suivez les ventes, le chiffre d'affaires et gérez le statut des transactions clients.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadData}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="bg-violet-600 hover:bg-violet-700 text-white font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> {t("Créer une commande")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400">{t("Chiffre d'Affaires")}</span>
              <p className="text-2xl font-bold text-white">
                {format(totalRevenueInXOF, 'XOF')}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400">{t("Total Commandes")}</span>
              <p className="text-2xl font-bold text-white">{orders.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400">{t("En Attente de Paiement")}</span>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400">{t("Panier Moyen Payé")}</span>
              <p className="text-2xl font-bold text-white">
                {format(averageBasketInXOF, 'XOF')}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List & Filters */}
      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder={t("Rechercher par client ou n° de commande...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{t("Filtrer :")}</span>
              <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
                {['all', 'paid', 'pending', 'shipped', 'cancelled'].map((status) => (
                  <button
                    key={status}
                    onClick={() => startTransition(() => setFilterStatus(status))}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      filterStatus === status
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {status === 'all'
                      ? t('Tous')
                      : status === 'paid'
                      ? t('Payées')
                      : status === 'pending'
                      ? t('En Attente')
                      : status === 'shipped'
                      ? t('Expédiées')
                      : t('Annulées')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-200">{t("Aucune commande")}</h3>
              <p className="text-sm text-slate-400 max-w-sm mt-1">
                {t("Aucune transaction ne correspond aux critères. Créez-en une manuellement pour tester.")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-slate-800">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">{t("Commande")}</TableHead>
                    <TableHead className="text-slate-400">{t("Client")}</TableHead>
                    <TableHead className="text-slate-400">{t("Date")}</TableHead>
                    <TableHead className="text-slate-400">{t("Paiement")}</TableHead>
                    <TableHead className="text-slate-400">{t("Total")}</TableHead>
                    <TableHead className="text-slate-400">{t("Statut")}</TableHead>
                    <TableHead className="text-slate-400 text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="border-slate-800/60 hover:bg-slate-800/20 transition-colors"
                    >
                      <TableCell className="font-mono text-xs text-slate-400">
                        #{order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-200">
                          {order.contact?.name || t('Client Inconnu')}
                        </div>
                        <div className="text-xs text-slate-400">
                          {order.contact?.phone || ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {new Date(order.created_at).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 capitalize">
                        {order.payment_method === 'bank_transfer'
                          ? t('Virement')
                          : order.payment_method === 'stripe'
                          ? t('Stripe / Carte')
                          : order.payment_method === 'cash'
                          ? t('Espèces')
                          : order.payment_method === 'link'
                          ? t('Lien de paiement')
                          : order.payment_method}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-200">
                        {format(order.total_amount, order.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDetails(order)}
                            className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDelete(order)}
                            className="h-8 w-8 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE ORDER SIMULATION MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <form onSubmit={handleCreateOrder}>
            <DialogHeader>
              <DialogTitle className="text-white">{t("Créer une commande (Simulation)")}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {t("Enregistrez manuellement une commande pour un contact CRM. Idéal pour valider le social commerce.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
              <div className="grid gap-2">
                <Label htmlFor="contact" className="text-slate-300">{t("Client CRM *")}</Label>
                <select
                  id="contact"
                  required
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-sm shadow-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.phone} ({c.company || t('Sans entreprise')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="status" className="text-slate-300">{t("Statut initial")}</Label>
                  <select
                    id="status"
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as any)}
                    className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-sm shadow-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="pending">{t("En Attente")}</option>
                    <option value="paid">{t("Payée")}</option>
                    <option value="shipped">{t("Expédiée")}</option>
                    <option value="cancelled">{t("Annulée")}</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payment" className="text-slate-300">{t("Méthode de Paiement")}</Label>
                  <select
                    id="payment"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-955 px-3 py-1 text-sm shadow-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="stripe">{t("Stripe / Carte")}</option>
                    <option value="bank_transfer">{t("Virement Bancaire")}</option>
                    <option value="cash">{t("Espèces")}</option>
                    <option value="link">{t("Lien de paiement")}</option>
                  </select>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <Label className="text-slate-200">{t("Articles commandés *")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddItem}
                    className="text-violet-400 hover:text-violet-300 hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> {t("Ajouter")}
                  </Button>
                </div>

                {products.length === 0 ? (
                  <p className="text-xs text-amber-400">
                    {t("Veuillez d'abord créer des produits actifs dans le catalogue.")}
                  </p>
                ) : (
                  orderItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <select
                          value={item.product_id}
                          onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                          className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                          <option value="" disabled>{t("Sélectionnez un produit...")}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({format(p.price, p.currency)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)
                          }
                          className="bg-slate-955 border-slate-800 text-slate-100 text-center"
                        />
                      </div>
                      {orderItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-400 hover:bg-red-950/20 hover:text-red-300 h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {t("Annuler")}
              </Button>
              <Button
                type="submit"
                disabled={products.length === 0}
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium animate-pulse"
              >
                {t("Enregistrer la commande")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DETAIL DIALOG */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{t("Détails de la commande")}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t("ID :")} {selectedOrder?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-3">
              {/* Client Info */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 space-y-1">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  {t("Client")}
                </span>
                <p className="text-sm font-medium text-slate-200">
                  {selectedOrder.contact?.name || t('Client Inconnu')}
                </p>
                <p className="text-xs text-slate-400">{selectedOrder.contact?.phone}</p>
                <p className="text-xs text-slate-400">{selectedOrder.contact?.email}</p>
              </div>

              {/* Items Summary */}
              <div className="space-y-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  {t("Produits commandés")}
                </span>
                <div className="rounded-lg border border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-955/40 border-slate-800">
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="h-8 text-slate-400 text-xs">{t("Produit")}</TableHead>
                        <TableHead className="h-8 text-slate-400 text-xs text-center">{t("Qté")}</TableHead>
                        <TableHead className="h-8 text-slate-400 text-xs text-right">{t("Prix")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((item, idx) => (
                        <TableRow key={idx} className="border-slate-800/40">
                          <TableCell className="py-2 text-xs text-slate-200">
                            {item.product?.name || t('Produit Supprimé')}
                            {item.product?.sku && (
                              <span className="block font-mono text-[10px] text-slate-500">
                                {item.product.sku}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-slate-300 text-center">
                            x{item.quantity}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-slate-200 text-right font-medium">
                            {format(item.price * item.quantity, selectedOrder.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total */}
                      <TableRow className="bg-slate-955/20 border-t border-slate-800">
                        <TableCell colSpan={2} className="py-2.5 text-xs font-semibold text-slate-300">
                          {t("Total")}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm font-bold text-violet-400 text-right">
                          {format(selectedOrder.total_amount, selectedOrder.currency)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Status and Payment details */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">{t("Statut")}</span>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    {t("Paiement")}
                  </span>
                  <p className="text-xs font-medium text-slate-300 mt-1 capitalize">
                    {selectedOrder.payment_method === 'bank_transfer'
                      ? t('Virement Bancaire')
                      : selectedOrder.payment_method === 'stripe'
                      ? t('Stripe / Carte')
                      : selectedOrder.payment_method === 'cash'
                      ? t('Espèces')
                      : selectedOrder.payment_method === 'link'
                      ? t('Lien de paiement')
                      : selectedOrder.payment_method}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              onClick={() => setIsDetailsOpen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 w-full"
            >
              {t("Fermer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">{t("Confirmer la suppression")}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t("Êtes-vous sûr de vouloir supprimer la commande")}{' '}
              <span className="font-mono text-slate-200">
                #{selectedOrder?.id.slice(0, 8)}
              </span>{' '}
              {t("? Cette action est irréversible.")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteOpen(false)}
              className="text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              {t("Annuler")}
            </Button>
            <Button
              onClick={handleDeleteOrder}
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {t("Supprimer la commande")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
