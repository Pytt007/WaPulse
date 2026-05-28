"use client"

import { useEffect, useState, startTransition, useRef, useCallback } from 'react'
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
  CardHeader,
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
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  RefreshCw,
  ImagePlus,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Upload,
  Images,
} from 'lucide-react'

// ─── Image Upload Helper ─────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.url as string
}

// ─── Image Dropzone ──────────────────────────────────────────────────────────

interface ImageDropzoneProps {
  existingUrls: string[]
  onUrlsChange: (urls: string[]) => void
  uploading: boolean
  setUploading: (v: boolean) => void
}

function ImageDropzone({ existingUrls, onUrlsChange, uploading, setUploading }: ImageDropzoneProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(imageFiles.map(uploadFile))
      onUrlsChange([...existingUrls, ...uploaded])
    } catch (e) {
      console.error('Upload error:', e)
    } finally {
      setUploading(false)
    }
  }, [existingUrls, onUrlsChange, setUploading])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [handleFiles])

  const removeImage = (idx: number) => {
    const next = existingUrls.filter((_, i) => i !== idx)
    onUrlsChange(next)
  }

  return (
    <div className="space-y-3">
      <Label className="text-slate-300 flex items-center gap-2">
        <Images className="h-4 w-4 text-violet-400" />
        {t("Photos du produit")}
      </Label>

      {/* Existing images grid */}
      {existingUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existingUrls.map((url, idx) => (
            <div key={url + idx} className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-square bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`photo-${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {idx === 0 && (
                <span className="absolute top-1 left-1 text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded font-medium">
                  {t("Principal")}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-slate-700 bg-slate-950/50 hover:border-violet-600/60 hover:bg-violet-500/5'
        }`}
      >
        {uploading ? (
          <>
            <RefreshCw className="h-6 w-6 text-violet-400 animate-spin" />
            <p className="text-sm text-slate-400">{t("Envoi en cours…")}</p>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20">
              <ImagePlus className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">
                {t("Glissez vos photos ici")}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("ou cliquez pour sélectionner")} · PNG, JPG, WEBP
              </p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
        />
      </div>
    </div>
  )
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────

interface ProductDetailProps {
  product: Product | null
  open: boolean
  onClose: () => void
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  formatPrice: (price: number, currency: string) => string
}

function ProductDetailModal({ product, open, onClose, onEdit, onDelete, formatPrice }: ProductDetailProps) {
  const { t } = useTranslation()
  const [slideIdx, setSlideIdx] = useState(0)

  const allImages: string[] = []
  if (product?.images && product.images.length > 0) allImages.push(...product.images)
  else if (product?.image_url) allImages.push(product.image_url)

  useEffect(() => { setSlideIdx(0) }, [product])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !product) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 h-7 w-7 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image gallery */}
        <div className="relative bg-slate-950 h-64 w-full flex items-center justify-center flex-shrink-0 overflow-hidden">
          {allImages.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={slideIdx}
                src={allImages[slideIdx]}
                alt={product.name}
                className="h-full w-full object-contain"
              />
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => setSlideIdx(i => Math.max(0, i - 1))}
                    disabled={slideIdx === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setSlideIdx(i => Math.min(allImages.length - 1, i + 1))}
                    disabled={slideIdx === allImages.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* Dots */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSlideIdx(i)}
                        className={`rounded-full transition-all ${i === slideIdx ? 'w-4 h-2 bg-violet-500' : 'w-2 h-2 bg-slate-600 hover:bg-slate-400'}`}
                      />
                    ))}
                  </div>
                  {/* Counter */}
                  <span className="absolute top-3 left-3 z-20 text-xs bg-slate-900/80 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                    {slideIdx + 1} / {allImages.length}
                  </span>
                  {/* Thumbnails */}
                  <div className="absolute bottom-0 left-0 right-0 flex gap-1.5 justify-center pb-7 px-3 bg-gradient-to-t from-slate-950/70 to-transparent pt-4">
                    {allImages.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setSlideIdx(i)}
                        className={`h-9 w-9 rounded overflow-hidden border-2 flex-shrink-0 transition-all ${i === slideIdx ? 'border-violet-500' : 'border-transparent opacity-50 hover:opacity-80'}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-600">
              <Package className="h-14 w-14" />
              <p className="text-sm">{t("Aucune photo")}</p>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name + badge */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-white text-lg font-bold leading-snug">{product.name}</h2>
              {product.sku && (
                <p className="text-xs font-mono text-slate-500 mt-0.5">SKU: {product.sku}</p>
              )}
            </div>
            <Badge
              className={`flex-shrink-0 mt-1 text-xs ${
                product.active
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {product.active ? t('Actif') : t('Inactif')}
            </Badge>
          </div>

          {/* Price */}
          <p className="text-3xl font-extrabold text-violet-400 tracking-tight">
            {formatPrice(product.price, product.currency)}
          </p>

          {/* Description */}
          {product.description && (
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-3">
              <p className="text-slate-500 text-xs mb-1">{t("Photos")}</p>
              <p className="text-slate-200 font-medium">{allImages.length} {t("photo(s)")}</p>
            </div>
            <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-3">
              <p className="text-slate-500 text-xs mb-1">{t("Devise")}</p>
              <p className="text-slate-200 font-medium">{product.currency}</p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800 bg-slate-900">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t("Fermer")}
          </button>
          <button
            onClick={() => { onClose(); onDelete(product) }}
            className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("Supprimer")}
          </button>
          <button
            onClick={() => { onClose(); onEdit(product) }}
            className="px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors flex items-center gap-1.5 font-medium"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {t("Modifier")}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Product Form Fields ──────────────────────────────────────────────────────

interface ProductFormFieldsProps {
  prefix: string
  name: string; setName: (v: string) => void
  sku: string; setSku: (v: string) => void
  price: string; setPrice: (v: string) => void
  currency: string; setCurrency: (v: any) => void
  description: string; setDescription: (v: string) => void
  isActive: boolean; setIsActive: (v: boolean) => void
  images: string[]; setImages: (v: string[]) => void
  uploading: boolean; setUploading: (v: boolean) => void
}

function ProductFormFields({
  prefix, name, setName, sku, setSku, price, setPrice,
  currency, setCurrency, description, setDescription,
  isActive, setIsActive, images, setImages, uploading, setUploading,
}: ProductFormFieldsProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4 py-4">
      {/* Photo gallery */}
      <ImageDropzone
        existingUrls={images}
        onUrlsChange={setImages}
        uploading={uploading}
        setUploading={setUploading}
      />

      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-name`} className="text-slate-300">{t("Nom du produit *")}</Label>
        <Input
          id={`${prefix}-name`}
          required
          placeholder="ex: Abonnement SaaS Premium"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-sku`} className="text-slate-300">{t("SKU / Code Produit")}</Label>
        <Input
          id={`${prefix}-sku`}
          placeholder="ex: WAP-PREM"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-price`} className="text-slate-300">{t("Prix de vente *")}</Label>
          <Input
            id={`${prefix}-price`}
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
          <Label htmlFor={`${prefix}-currency`} className="text-slate-300">{t("Devise")}</Label>
          <Input
            id={`${prefix}-currency`}
            value={currency}
            disabled
            className="bg-slate-950/50 border-slate-800 text-slate-400 focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-description`} className="text-slate-300">{t("Description")}</Label>
        <Textarea
          id={`${prefix}-description`}
          placeholder="Détails, caractéristiques techniques ou limites du service..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500 min-h-[80px]"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-800 p-3 bg-slate-950/40">
        <div className="space-y-0.5">
          <Label htmlFor={`${prefix}-active`} className="text-slate-200">{t("Activer le produit")}</Label>
          <p className="text-xs text-slate-400">
            {t("S'il est inactif, il ne pourra pas être recommandé par l'IA ou être ajouté à une commande.")}
          </p>
        </div>
        <Switch
          id={`${prefix}-active`}
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { t } = useTranslation()
  const { format: formatPrice, currency: activeCurrency } = useCurrency()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState(activeCurrency)
  const [sku, setSku] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

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

  useEffect(() => { loadProducts() }, [])

  const resetForm = () => {
    setName(''); setDescription(''); setPrice('')
    setCurrency(activeCurrency); setSku(''); setIsActive(true); setImages([])
  }

  const handleOpenCreate = () => { resetForm(); setIsCreateOpen(true) }

  const handleOpenEdit = (product: Product) => {
    setCurrentProduct(product)
    setName(product.name)
    setDescription(product.description || '')
    setPrice(product.price.toString())
    setCurrency(product.currency as any)
    setSku(product.sku || '')
    setIsActive(product.active)
    setImages(product.images || (product.image_url ? [product.image_url] : []))
    setIsEditOpen(true)
  }

  const handleOpenDelete = (product: Product) => {
    setCurrentProduct(product)
    setIsDeleteOpen(true)
  }

  const handleOpenDetail = (product: Product) => {
    setCurrentProduct(product)
    setIsDetailOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !price || uploading) return
    try {
      const { error } = await db.from('products').insert({
        name, description,
        price: parseFloat(price),
        currency,
        sku: sku || undefined,
        active: isActive,
        images,
        image_url: images[0] || undefined,
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
    if (!currentProduct || !name || !price || uploading) return
    try {
      const { error } = await db
        .from('products')
        .update({
          name, description,
          price: parseFloat(price),
          currency,
          sku: sku || undefined,
          active: isActive,
          images,
          image_url: images[0] || undefined,
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
      const { error } = await db.from('products').delete().eq('id', currentProduct.id)
      if (error) throw error
      setIsDeleteOpen(false)
      loadProducts()
    } catch (err) {
      console.error('Error deleting product:', err)
    }
  }

  const toggleProductStatus = async (product: Product) => {
    try {
      const { error } = await db.from('products').update({ active: !product.active }).eq('id', product.id)
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
      filterActive === 'all' ? true : filterActive === 'active' ? p.active : !p.active
    return matchesSearch && matchesStatus
  })

  const getFirstImage = (p: Product) =>
    (p.images && p.images.length > 0) ? p.images[0] : p.image_url

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Main Card */}
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
                {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => startTransition(() => setFilterActive(f))}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      filterActive === f ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? t("Tous") : f === 'active' ? t("Actifs") : t("Inactifs")}
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
                    <TableHead className="text-slate-400 w-14">{t("Photo")}</TableHead>
                    <TableHead className="text-slate-400">{t("SKU / Code")}</TableHead>
                    <TableHead className="text-slate-400">{t("Nom & Description")}</TableHead>
                    <TableHead className="text-slate-400">{t("Prix")}</TableHead>
                    <TableHead className="text-slate-400">{t("Statut")}</TableHead>
                    <TableHead className="text-slate-400 text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const firstImg = getFirstImage(product)
                    const imgCount = (product.images?.length ?? 0) || (product.image_url ? 1 : 0)
                    return (
                      <TableRow
                        key={product.id}
                        className="border-slate-800/60 hover:bg-slate-800/20 transition-colors cursor-pointer"
                        onClick={() => handleOpenDetail(product)}
                      >
                        {/* Thumbnail */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div
                            className="relative h-10 w-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center cursor-pointer hover:border-violet-500 transition-colors"
                            onClick={() => handleOpenDetail(product)}
                          >
                            {firstImg ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={firstImg} alt={product.name} className="w-full h-full object-cover" />
                                {imgCount > 1 && (
                                  <span className="absolute bottom-0 right-0 text-[9px] bg-slate-900/90 text-slate-300 px-1 leading-4">
                                    +{imgCount - 1}
                                  </span>
                                )}
                              </>
                            ) : (
                              <Package className="h-5 w-5 text-slate-600" />
                            )}
                          </div>
                        </TableCell>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleProductStatus(product)} className="focus:outline-none">
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
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDetail(product)}
                              className="h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-violet-400"
                              title={t("Voir le produit")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
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
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAIL MODAL */}
      <ProductDetailModal
        product={currentProduct}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        formatPrice={formatPrice}
      />

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-xl max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-violet-400" />
                {t("Créer un produit ou service")}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {t("Ajoutez un nouvel article au catalogue pour l'associer aux futures commandes et négociations.")}
              </DialogDescription>
            </DialogHeader>

            <ProductFormFields
              prefix="create"
              name={name} setName={setName}
              sku={sku} setSku={setSku}
              price={price} setPrice={setPrice}
              currency={currency} setCurrency={setCurrency}
              description={description} setDescription={setDescription}
              isActive={isActive} setIsActive={setIsActive}
              images={images} setImages={setImages}
              uploading={uploading} setUploading={setUploading}
            />

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
                disabled={uploading}
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
              >
                {uploading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("Créer le produit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-xl max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-violet-400" />
                {t("Modifier le produit")}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {t("Mettez à jour les caractéristiques, le prix ou la disponibilité de cet article.")}
              </DialogDescription>
            </DialogHeader>

            <ProductFormFields
              prefix="edit"
              name={name} setName={setName}
              sku={sku} setSku={setSku}
              price={price} setPrice={setPrice}
              currency={currency} setCurrency={setCurrency}
              description={description} setDescription={setDescription}
              isActive={isActive} setIsActive={setIsActive}
              images={images} setImages={setImages}
              uploading={uploading} setUploading={setUploading}
            />

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
                disabled={uploading}
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
              >
                {uploading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("Enregistrer")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
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
