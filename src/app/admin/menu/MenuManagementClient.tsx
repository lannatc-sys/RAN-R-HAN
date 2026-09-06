'use client';

import { useState, useRef } from 'react';
import { Shop, Category, MenuItem } from '@/lib/types';
import {
  toggleMenuItemAvailabilityAction,
  createMenuItemAction,
  createCategoryAction,
  updateMenuItemAction,
  deleteMenuItemAction,
  uploadMenuImageAction,
} from '@/app/actions/menu';
import {
  Plus,
  Check,
  X,
  Store,
  Loader2,
  Camera,
  Pencil,
  Trash2,
  UploadCloud,
  ImageIcon,
  Link2,
} from 'lucide-react';

interface MenuManagementClientProps {
  shop: Shop;
  categories: Category[];
  initialMenuItems: MenuItem[];
}

export function MenuManagementClient({
  shop,
  categories,
  initialMenuItems,
}: MenuManagementClientProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [selectedCat, setSelectedCat] = useState<string>('all');

  // Add Category Modal
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Add Dish Modal
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishCat, setNewDishCat] = useState<string>('');
  const [newDishDesc, setNewDishDesc] = useState('');
  const [newDishImageUrl, setNewDishImageUrl] = useState('');
  const [isUploadingNewImage, setIsUploadingNewImage] = useState(false);
  const [showUrlInputNew, setShowUrlInputNew] = useState(false);

  // Edit Dish Modal
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editDishName, setEditDishName] = useState('');
  const [editDishPrice, setEditDishPrice] = useState('');
  const [editDishCat, setEditDishCat] = useState<string>('');
  const [editDishDesc, setEditDishDesc] = useState('');
  const [editDishImageUrl, setEditDishImageUrl] = useState('');
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const [showUrlInputEdit, setShowUrlInputEdit] = useState(false);

  // Loading States
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputNewRef = useRef<HTMLInputElement>(null);
  const fileInputEditRef = useRef<HTMLInputElement>(null);

  // Handle Toggle Availability
  const handleToggleAvailable = async (item: MenuItem) => {
    setLoadingItemId(item.id);
    const res = await toggleMenuItemAvailabilityAction(item.id, item.is_available);
    if (res.success) {
      setMenuItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i))
      );
    }
    setLoadingItemId(null);
  };

  // Upload Image Handler
  const handleFileUpload = async (
    file: File,
    onSuccess: (url: string) => void,
    setUploading: (val: boolean) => void
  ) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shop_id', shop.id);

      const res = await uploadMenuImageAction(formData);
      if (res.success && res.url) {
        onSuccess(res.url);
      } else {
        alert(res.error || 'ไม่สามารถอัปโหลดรูปภาพได้');
      }
    } catch (e: any) {
      alert(e.message || 'เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setUploading(false);
    }
  };

  // Handle Add Dish
  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName || !newDishPrice) return;
    setIsSubmitting(true);

    const res = await createMenuItemAction({
      shop_id: shop.id,
      category_id: newDishCat || null,
      name: newDishName,
      price: parseFloat(newDishPrice),
      description: newDishDesc,
      image_url: newDishImageUrl || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setIsAddDishOpen(false);
      setNewDishName('');
      setNewDishPrice('');
      setNewDishDesc('');
      setNewDishImageUrl('');
      setShowUrlInputNew(false);
      window.location.reload();
    } else {
      alert(res.error || 'ไม่สามารถเพิ่มเมนูได้');
    }
  };

  // Handle Open Edit Modal
  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setEditDishName(item.name);
    setEditDishPrice(item.price.toString());
    setEditDishCat(item.category_id || '');
    setEditDishDesc(item.description || '');
    setEditDishImageUrl(item.image_url || '');
    setShowUrlInputEdit(false);
  };

  // Handle Save Edit Dish
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editDishName || !editDishPrice) return;
    setIsSubmitting(true);

    const res = await updateMenuItemAction({
      id: editingItem.id,
      name: editDishName,
      price: parseFloat(editDishPrice),
      category_id: editDishCat || null,
      description: editDishDesc,
      image_url: editDishImageUrl || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      setMenuItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                name: editDishName,
                price: parseFloat(editDishPrice),
                category_id: editDishCat || null,
                description: editDishDesc,
                image_url: editDishImageUrl || null,
              }
            : i
        )
      );
      setEditingItem(null);
    } else {
      alert(res.error || 'ไม่สามารถแก้ไขเมนูได้');
    }
  };

  // Handle Delete Dish
  const handleDeleteDish = async (itemId: string) => {
    if (!confirm('คุณต้องการลบรายการอาหารนี้ใช่หรือไม่?')) return;
    setIsSubmitting(true);
    const res = await deleteMenuItemAction(itemId);
    setIsSubmitting(false);

    if (res.success) {
      setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
      if (editingItem?.id === itemId) {
        setEditingItem(null);
      }
    } else {
      alert(res.error || 'ไม่สามารถลบรายการอาหารได้');
    }
  };

  // Handle Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    const res = await createCategoryAction(shop.id, newCatName);
    if (res.success) {
      setIsAddCatOpen(false);
      setNewCatName('');
      window.location.reload();
    } else {
      alert(res.error || 'ไม่สามารถเพิ่มหมวดหมู่ได้');
    }
  };

  const filtered =
    selectedCat === 'all'
      ? menuItems
      : menuItems.filter((i) => i.category_id === selectedCat);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">จัดการรายการอาหาร</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            เปิด-ปิดรายการอาหารที่หมดชั่วคราว เพิ่มรูปภาพ หรือแก้ไขข้อมูลเมนู
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddCatOpen(true)}
            className="px-4 py-2.5 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มหมวดหมู่</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddDishOpen(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มเมนูอาหาร</span>
          </button>
        </div>
      </div>

      {/* Categories Filter Pills */}
      <div className="overflow-x-auto flex gap-2 pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCat('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            selectedCat === 'all'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
          }`}
        >
          ทั้งหมด ({menuItems.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCat(cat.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              selectedCat === cat.id
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
            }`}
          >
            {cat.name} ({menuItems.filter((i) => i.category_id === cat.id).length})
          </button>
        ))}
      </div>

      {/* Menu Table / Cards */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-400 dark:text-stone-500 text-xs space-y-2">
            <ImageIcon className="w-8 h-8 mx-auto text-stone-300 dark:text-stone-600" />
            <div>ยังไม่มีรายการอาหารในหมวดหมู่นี้</div>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                !item.is_available
                  ? 'bg-stone-50/70 dark:bg-stone-950/40 opacity-60'
                  : 'hover:bg-amber-50/20 dark:hover:bg-stone-850'
              }`}
            >
              {/* Image & Dish Info */}
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                {/* Image Container with Quick Photo Button */}
                <div className="relative group/img w-16 h-16 rounded-2xl bg-stone-100 dark:bg-stone-800 overflow-hidden shrink-0 border border-stone-200/70 dark:border-stone-700">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 dark:text-stone-600 gap-0.5">
                      <Store className="w-5 h-5" />
                      <span className="text-[9px]">ไม่มีรูป</span>
                    </div>
                  )}

                  {/* Change/Add Photo Overlay Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    title="เพิ่ม/เปลี่ยนรูปภาพเมนู"
                    className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="w-5 h-5 drop-shadow-md" />
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-stone-900 dark:text-stone-100 text-sm truncate flex items-center gap-2">
                    <span>{item.name}</span>
                  </div>
                  {item.description && (
                    <div className="text-xs text-stone-400 dark:text-stone-500 truncate max-w-md">
                      {item.description}
                    </div>
                  )}
                  <div className="text-xs font-extrabold text-amber-700 dark:text-amber-400 mt-1">
                    {Number(item.price).toLocaleString('th-TH')} ฿
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Edit Dish Button */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(item)}
                  title="แก้ไขเมนูและรูปภาพ"
                  className="p-2 text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-stone-800 rounded-xl transition-colors border border-stone-200 dark:border-stone-700 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                {/* Status Toggle Button */}
                <button
                  type="button"
                  disabled={loadingItemId === item.id}
                  onClick={() => handleToggleAvailable(item)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    item.is_available
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                      : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50'
                  }`}
                >
                  {loadingItemId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : item.is_available ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  <span>{item.is_available ? 'มีขาย' : 'หมด'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ====================================================================== */}
      {/* Modal: เพิ่มหมวดหมู่ใหม่ */}
      {/* ====================================================================== */}
      {isAddCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleAddCategory}
            className="w-full max-w-sm bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-2xl space-y-4 border border-stone-200/80 dark:border-stone-800"
          >
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">เพิ่มหมวดหมู่ใหม่</h3>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="ชื่อหมวดหมู่ เช่น เมนูข้าว, เครื่องดื่ม"
              required
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCatOpen(false)}
                className="flex-1 py-2.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 rounded-xl text-xs font-bold hover:bg-stone-50 dark:hover:bg-stone-750 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                บันทึก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Modal: เพิ่มเมนูอาหารใหม่ (พร้อมปุ่มเพิ่มรูป) */}
      {/* ====================================================================== */}
      {isAddDishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <form
            onSubmit={handleAddDish}
            className="w-full max-w-md bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-2xl space-y-4 my-8 border border-stone-200/80 dark:border-stone-800"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">เพิ่มเมนูอาหารใหม่</h3>
              <button
                type="button"
                onClick={() => setIsAddDishOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ส่วนเลือก/อัปโหลดรูปภาพอาหาร */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                รูปภาพอาหาร
              </label>

              {newDishImageUrl ? (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 group">
                  <img
                    src={newDishImageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputNewRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-stone-50 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>เปลี่ยนรูป</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDishImageUrl('')}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบรูป</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl p-4 text-center space-y-2 bg-stone-50/60 dark:bg-stone-800/40 transition-colors">
                  <input
                    type="file"
                    ref={fileInputNewRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(file, setNewDishImageUrl, setIsUploadingNewImage);
                      }
                    }}
                  />

                  {isUploadingNewImage ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-xs">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>กำลังอัปโหลดรูปภาพ...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputNewRef.current?.click()}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          เลือกรูปภาพจากเครื่อง
                        </button>
                      </div>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500">
                        รองรับ JPG, PNG, WEBP (ขนาดไม่เกิน 5MB)
                      </p>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowUrlInputNew(!showUrlInputNew)}
                          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>{showUrlInputNew ? 'ซ่อนการใส่ URL' : 'หรือวางลิงก์ URL รูปภาพ'}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* URL Input Toggle */}
              {showUrlInputNew && !newDishImageUrl && (
                <div className="mt-2">
                  <input
                    type="url"
                    value={newDishImageUrl}
                    onChange={(e) => setNewDishImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            {/* ชื่อเมนู */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                ชื่อเมนู <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
                placeholder="เช่น ข้าวกะเพราหมูกรอบ"
                required
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* ราคา & หมวดหมู่ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  ราคา (บาท) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={newDishPrice}
                  onChange={(e) => setNewDishPrice(e.target.value)}
                  placeholder="60"
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  หมวดหมู่
                </label>
                <select
                  value={newDishCat}
                  onChange={(e) => setNewDishCat(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="" className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">-- ไม่ระบุ --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* รายละเอียด */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                คำอธิบาย / รายละเอียด
              </label>
              <textarea
                rows={2}
                value={newDishDesc}
                onChange={(e) => setNewDishDesc(e.target.value)}
                placeholder="เช่น หมูกรอบสูตรพิเศษ ผัดใบกะเพราแท้..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddDishOpen(false)}
                className="flex-1 py-2.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 rounded-xl text-xs font-bold hover:bg-stone-50 dark:hover:bg-stone-750 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isUploadingNewImage}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>บันทึกเมนู</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Modal: แก้ไขเมนูอาหาร (เปลี่ยนรูปภาพ / แก้ไขข้อมูล) */}
      {/* ====================================================================== */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-2xl space-y-4 my-8 border border-stone-200/80 dark:border-stone-800"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">แก้ไขรายการอาหาร</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ส่วนรูปภาพอาหาร (อัปโหลด/เปลี่ยนรูป) */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                รูปภาพอาหาร
              </label>

              <input
                type="file"
                ref={fileInputEditRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file, setEditDishImageUrl, setIsUploadingEditImage);
                  }
                }}
              />

              {editDishImageUrl ? (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 group">
                  <img
                    src={editDishImageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputEditRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-stone-50 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>เปลี่ยนรูป</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDishImageUrl('')}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบรูป</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl p-4 text-center space-y-2 bg-stone-50/60 dark:bg-stone-800/40 transition-colors">
                  {isUploadingEditImage ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-xs">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>กำลังอัปโหลดรูปภาพ...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputEditRef.current?.click()}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          อัปโหลดรูปภาพใหม่
                        </button>
                      </div>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500">
                        รองรับ JPG, PNG, WEBP (ขนาดไม่เกิน 5MB)
                      </p>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowUrlInputEdit(!showUrlInputEdit)}
                          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>{showUrlInputEdit ? 'ซ่อนการใส่ URL' : 'หรือวางลิงก์ URL รูปภาพ'}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {showUrlInputEdit && !editDishImageUrl && (
                <div className="mt-2">
                  <input
                    type="url"
                    value={editDishImageUrl}
                    onChange={(e) => setEditDishImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            {/* ชื่อเมนู */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                ชื่อเมนู <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editDishName}
                onChange={(e) => setEditDishName(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* ราคา & หมวดหมู่ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  ราคา (บาท) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editDishPrice}
                  onChange={(e) => setEditDishPrice(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  หมวดหมู่
                </label>
                <select
                  value={editDishCat}
                  onChange={(e) => setEditDishCat(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="" className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">-- ไม่ระบุ --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* รายละเอียด */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                คำอธิบาย / รายละเอียด
              </label>
              <textarea
                rows={2}
                value={editDishDesc}
                onChange={(e) => setEditDishDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleDeleteDish(editingItem.id)}
                className="py-2.5 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ลบเมนูนี้</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="py-2.5 px-4 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 rounded-xl text-xs font-bold hover:bg-stone-50 dark:hover:bg-stone-750 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingEditImage}
                  className="py-2.5 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
