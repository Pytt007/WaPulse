"use client"

import { useEffect, useState, startTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types'
import { useTranslation } from '@/hooks/use-translation'
import { useCurrency } from '@/hooks/use-currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Edit2, Trash2, Package, RefreshCw } from 'lucide-react'

export default function ProductsPage() {
  const { t } = useTranslation()
  const { format: formatPrice } = useCurrency()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Current product state for edit/delete
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('XOF')
  const [sku, setSku] = useState('')
  const [isActive, setIsActive] = useState(true)

  const db = createClient()

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await db.from('products').select('*')
      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      console.error('Error loading products:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleOpenCreate = () => {
    setName('')
    setDescription('')
    setPrice('')
    setCurrency('XOF')
    setSku('')
    setIsActive(true)
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (product: Product) => {
    setCurrentProduct(product)
    setName(product.name)
    setDescription(product.description || '')
    setPrice(product.price.toString())
    setCurrency(product.currency)
    setSku(product.sku || '')
    setIsActive(product.active)
    setIsEditOpen(true)
  }

  const handleOpenDelete = (product: Product) => {
    setCurrentProduct(product)
    setIsDeleteOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !price) return

    try {
      const { error } = await db.from('products').insert({
        name,
        description,
        price: parseFloat(price),
        currency,
        sku: sku || undefined,
        active: isActive,
      })

      if (error) throw error
      setIsCreateOpen(false)
      loadProducts()
    } catch (err) {
      console.error('Error creating product:', err)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProduct || !name || !price) return

    try {
      const { error } = await db
        .from('products')
        .update({
          name,
          description,
          price: parseFloat(price),
          currency,
          sku: sku || undefined,
          active: isActive,
        })
        .eq('id', currentProduct.id)

      if (error) throw error
      setIsEditOpen(false)
      loadProducts()
    } catch (err) {
      console.error('Error updating product:', err)
    }
  }

  const handleDelete = async () => {
    if (!currentProduct) return

    try {
      const { error } = await db
        .from('products')
        .delete()
        .eq('id', currentProduct.id)

      if (error) throw error
      setIsDeleteOpen(false)
      loadProducts()
    } catch (err) {
      console.error('Error deleting product:', err)
    }
  }

  const toggleProductStatus = async (product: Product) => {
    try {
      const { error } = await db
        .from('products')
        .update({ active: !product.active })
        .eq('id', product.id)

      if (error) throw error
      loadProducts()
    } catch (err) {
      console.error('Error toggling product status:', err)
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      filterActive === 'all'
        ? true
        : filterActive === 'active'
        ? p.active
        : !p.active

    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-violet-500" />
            {t("Catalogue Produits & Services")}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("Gérez vos produits, abonnements et prestations de services proposés à vos clients.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadProducts}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="bg-violet-600 hover:bg-violet-700 text-white font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> {t("Ajouter un produit")}
          </Button>
        </div>
      </div>

      {/* Main Dashboard Card */}
      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder={t("Rechercher par nom, SKU ou description...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{t("Filtrer :")}</span>
              <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
                <button
                  onClick={() => startTransition(() => setFilterActive('all'))}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    filterActive === 'all'
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t("Tous")}
                </button>
                <button
                  onClick={() => startTransition(() => setFilterActive('active'))}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    filterActive === 'active'
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t("Actifs")}
                </button>
                <button
                  onClick={() => startTransition(() => setFilterActive('inactive'))}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    filterActive === 'inactive'
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t("Inactifs")}
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-200">{t("Aucun produit trouvé")}</h3>
              <p className="text-sm text-slate-400 max-w-sm mt-1">
                {t("Aucun article ne correspond à vos filtres. Commencez par en ajouter un nouveau.")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-slate-800">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">{t("SKU / Code")}</TableHead>
                    <TableHead className="text-slate-400">{t("Nom & Description")}</TableHead>
                    <TableHead className="text-slate-400">{t("Prix")}</TableHead>
                    <TableHead className="text-slate-400">{t("Statut")}</TableHead>
                    <TableHead className="text-slate-400 text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="border-slate-800/60 hover:bg-slate-800/20 transition-colors"
                    >
                      <TableCell className="font-mono text-xs text-slate-400">
                        {product.sku || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-200">{product.name}</div>
                        <div className="text-xs text-slate-400 max-w-md truncate mt-0.5">
                          {product.description || t('Aucune description')}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-violet-400">
                        {formatPrice(product.price, product.currency)}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleProductStatus(product)}
                          className="focus:outline-none"
                        >
                          <Badge
                            className={`cursor-pointer transition-colors ${
                              product.active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {product.active ? t('Actif') : t('Inactif')}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(product)}
                            className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDelete(product)}
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

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-white">{t("Créer un produit ou service")}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {t("Ajoutez un nouvel article au catalogue pour l'associer aux futures commandes et négociations.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-slate-300">{t("Nom du produit *")}</Label>
                <Input
                  id="name"
                  required
                  placeholder="ex: Abonnement SaaS Premium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sku" className="text-slate-300">{t("SKU / Code Produit")}</Label>
                <Input
                  id="sku"
                  placeholder="ex: WAP-PREM"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="price" className="text-slate-300">{t("Prix de vente *")}</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    required
                    placeholder="99.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency" className="text-slate-300">{t("Devise")}</Label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-sm shadow-sm transition-colors text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-slate-300">{t("Description")}</Label>
                <Textarea
                  id="description"
                  placeholder="Détails, caractéristiques techniques ou limites du service..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500 min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-800 p-3 bg-slate-950/40">
                <div className="space-y-0.5">
                  <Label htmlFor="active" className="text-slate-200">{t("Activer le produit")}</Label>
                  <p className="text-xs text-slate-400">
                    {t("S'il est inactif, il ne pourra pas être recommandé par l'IA ou être ajouté à une commande.")}
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
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
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium"
              >
                {t("Créer le produit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle className="text-white">{t("Modifier le produit")}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {t("Mettez à jour les caractéristiques, le prix ou la disponibilité de cet article.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name" className="text-slate-300">{t("Nom du produit *")}</Label>
                <Input
                  id="edit-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 focus-visible:ring-violet-500"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-sku" className="text-slate-300">{t("SKU / Code Produit")}</Label>
                <Input
                  id="edit-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 focus-visible:ring-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit-price" className="text-slate-300">{t("Prix de vente *")}</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 focus-visible:ring-violet-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-currency" className="text-slate-300">{t("Devise")}</Label>
                  <select
                    id="edit-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-sm shadow-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description" className="text-slate-300">{t("Description")}</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 focus-visible:ring-violet-500 min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-800 p-3 bg-slate-950/40">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-active" className="text-slate-200">{t("Activer le produit")}</Label>
                  <p className="text-xs text-slate-400">
                    {t("Rendre le produit sélectionnable et actif sur les canaux de discussion.")}
                  </p>
                </div>
                <Switch
                  id="edit-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {t("Annuler")}
              </Button>
              <Button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium"
              >
                {t("Enregistrer")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">{t("Confirmer la suppression")}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t("Êtes-vous sûr de vouloir supprimer le produit")} <span className="font-semibold text-slate-200">"{currentProduct?.name}"</span> ? {t("cette action est irréversible.")}
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
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {t("Supprimer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
