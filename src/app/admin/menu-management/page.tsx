'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, Category } from '@/types/database';
import { formatCurrency, cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Plus, Pencil, Trash2, UtensilsCrossed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MenuManagementPage() {
  const supabase = createClient();
  const [items, setItems] = useState<(MenuItem & { category?: Category })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: '',
    is_available: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('menu_items').select('*, category:categories(*)').order('name'),
      supabase.from('categories').select('*').order('display_order'),
    ]);
    setItems(itemsRes.data || []);
    setCategories(catsRes.data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditingItem(null);
    setForm({ name: '', description: '', price: '', category_id: '', image_url: '', is_available: true });
    setModalOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category_id: item.category_id || '',
      image_url: item.image_url || '',
      is_available: item.is_available,
    });
    setModalOpen(true);
  }

  async function saveItem() {
    if (!form.name || !form.price) {
      toast.error('Name and price are required');
      return;
    }

    const payload = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      category_id: form.category_id || null,
      image_url: form.image_url || null,
      is_available: form.is_available,
    };

    if (editingItem) {
      const { error } = await supabase.from('menu_items').update(payload).eq('id', editingItem.id);
      if (error) toast.error('Failed to update'); else toast.success('Item updated');
    } else {
      const { error } = await supabase.from('menu_items').insert(payload);
      if (error) toast.error('Failed to add'); else toast.success('Item added');
    }

    setModalOpen(false);
    fetchData();
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (!error) { toast.success('Item deleted'); fetchData(); }
    else toast.error('Cannot delete — item may be in existing orders');
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    const { error } = await supabase.from('categories').insert({ name: newCategory.trim() });
    if (!error) { toast.success('Category added'); setNewCategory(''); fetchData(); setCategoryModalOpen(false); }
    else toast.error('Failed to add category');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Menu Management</h1>
          <p className="text-sm text-text-muted mt-1">Add, edit, and manage menu items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCategoryModalOpen(true)}>
            + Category
          </Button>
          <Button variant="primary" size="sm" onClick={openAdd} icon={<Plus className="w-4 h-4" />}>
            Add Item
          </Button>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <Card className="text-center py-12">
            <UtensilsCrossed className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
            <p className="text-text-muted text-sm">No menu items yet</p>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="animate-slide-up">
              <div className="flex items-center gap-4">
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-xl bg-bg-tertiary overflow-hidden shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted/30">
                      <UtensilsCrossed className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{item.name}</h3>
                    {!item.is_available && <Badge variant="cancelled">Unavailable</Badge>}
                  </div>
                  <p className="text-xs text-text-muted truncate">{item.description || 'No description'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold gradient-text">{formatCurrency(item.price)}</span>
                    {item.category && (
                      <Badge>{item.category.name}</Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-2 rounded-lg glass glass-hover text-text-secondary hover:text-accent-primary transition-all cursor-pointer">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="p-2 rounded-lg glass glass-hover text-text-secondary hover:text-accent-danger transition-all cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Item Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingItem ? 'Edit Item' : 'Add Item'} size="lg">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Category</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-text-primary bg-bg-tertiary border border-border focus:outline-none focus:border-accent-primary/50 transition-all"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Input label="Image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} className="rounded border-border" />
            <span className="text-sm text-text-secondary">Available</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveItem}>{editingItem ? 'Update' : 'Add'} Item</Button>
          </div>
        </div>
      </Modal>

      {/* Add Category Modal */}
      <Modal isOpen={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title="Add Category" size="sm">
        <div className="space-y-4">
          <Input label="Category Name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g., Beverages" onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={addCategory}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
