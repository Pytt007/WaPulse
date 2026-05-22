'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';

export interface CustomField {
  id: string;
  user_id: string;
  field_name: string;
  field_type: string;
  created_at: string;
}

export function CustomFieldManager() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchFields(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function fetchFields(userId: string) {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (err) {
      console.error('Failed to fetch custom fields:', err);
      toast.error(t('Failed to load custom fields'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newFieldName.trim()) {
      toast.error(t('Field name is required'));
      return;
    }

    try {
      setSaving(true);
      if (!user) {
        toast.error(t('Not authenticated'));
        return;
      }

      const { error } = await supabase
        .from('custom_fields')
        .insert({
          user_id: user.id,
          field_name: newFieldName.trim(),
          field_type: 'text',
        });

      if (error) throw error;

      toast.success(t('Custom field created successfully'));
      setDialogOpen(false);
      setNewFieldName('');
      await fetchFields(user.id);
    } catch (err) {
      console.error('Create error:', err);
      toast.error(t('Failed to create custom field'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(field: CustomField) {
    setFieldToDelete(field);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!fieldToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', fieldToDelete.id);

      if (error) throw error;

      toast.success(t('Custom field deleted'));
      setFields((prev) => prev.filter((f) => f.id !== fieldToDelete.id));
      setDeleteDialogOpen(false);
      setFieldToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('Failed to delete custom field'));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Custom Fields")}</h2>
          <p className="text-sm text-slate-400">{t("Manage custom fields to qualify your contacts and enrich your CRM.")}</p>
        </div>
        <Button
          onClick={() => {
            setNewFieldName('');
            setDialogOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="size-4 mr-2" />
          {t("New Field")}
        </Button>
      </div>

      {fields.length === 0 ? (
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-slate-400 text-sm">{t("No custom fields yet.")}</p>
            <p className="text-slate-500 text-xs mt-1">{t("Create fields to store specific information like budget or need.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <Card key={field.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-medium text-white capitalize">{field.field_name}</h3>
                  <span className="text-xs text-slate-500">{t("Type:")} {t(field.field_type)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => confirmDelete(field)}
                  className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Custom Field Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">{t("New Custom Field")}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t("Create a new custom field to qualify your leads.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">{t("Field Name")}</Label>
              <Input
                placeholder={t("e.g. budget, need, deadline")}
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
            </div>
          </div>

          <DialogFooter className="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {t("Creating...")}
                </>
              ) : (
                t('Create Field')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">{t("Delete Custom Field")}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t("Are you sure you want to delete the custom field")} &quot;{fieldToDelete?.field_name}&quot;?{' '}
              {t("This will also delete all associated values from your contacts. This action is irreversible.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {t("Deleting...")}
                </>
              ) : (
                t('Delete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
