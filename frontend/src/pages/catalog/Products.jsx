import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Tag,
  Layers,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  UploadCloud,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productService } from '../../services/productService';
import { referenceService } from '../../services/referenceService';
import { inr } from '../../lib/format';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, services: 0, goods: 0, addons: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    type: 'SERVICE',
    salesPrice: '',
    costPrice: '',
    description: '',
    taxId: 1,
    imageUrl: '',
    isActive: true,
    variants: [],
  });

  // Variant input sub-state inside modal
  const [variantInput, setVariantInput] = useState({
    attribute: '',
    value: '',
    extraPrice: '',
  });
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);

  const [taxes, setTaxes] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, st] = await Promise.all([
        productService.getAll({ search, type: typeFilter, status: statusFilter }),
        productService.getStats(),
      ]);
      setProducts(data);
      setStats(st);
    } catch (err) {
      toast.error(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    referenceService
      .taxes()
      .then((list) => {
        setTaxes(list);
        setFormData((f) => (f.taxId && list.some((t) => t.id === f.taxId) ? f : { ...f, taxId: list[0]?.id ?? '' }));
      })
      .catch((err) => toast.error(err.message || 'Failed to load taxes'));
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      type: 'SERVICE',
      salesPrice: '',
      costPrice: '',
      description: '',
      taxId: taxes[0]?.id ?? '',
      imageUrl: '',
      isActive: true,
      variants: [],
    });
    setVariantInput({ attribute: '', value: '', extraPrice: '' });
    setEditingVariantIndex(null);
    setEditingProduct(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      type: product.type,
      salesPrice: product.salesPrice,
      costPrice: product.costPrice || '',
      description: product.description || '',
      taxId: product.taxIds?.[0] ?? taxes[0]?.id ?? '',
      imageUrl: product.imageUrl || '',
      isActive: product.isActive,
      variants: product.variants ? JSON.parse(JSON.stringify(product.variants)) : [],
    });
    setVariantInput({ attribute: '', value: '', extraPrice: '' });
    setEditingVariantIndex(null);
    setShowModal(true);
  };

  // Variant Actions
  const handleAddOrUpdateVariant = (e) => {
    e.preventDefault();
    if (!variantInput.attribute.trim() || !variantInput.value.trim()) {
      toast.error('Attribute name and value are required');
      return;
    }

    const newVariant = {
      id: editingVariantIndex !== null ? formData.variants[editingVariantIndex].id : Date.now(),
      attribute: variantInput.attribute.trim(),
      value: variantInput.value.trim(),
      extraPrice: Number(variantInput.extraPrice) || 0,
      isActive: true,
    };

    if (editingVariantIndex !== null) {
      const updated = [...formData.variants];
      updated[editingVariantIndex] = newVariant;
      setFormData({ ...formData, variants: updated });
      setEditingVariantIndex(null);
      toast.success('Variant updated');
    } else {
      setFormData({ ...formData, variants: [...formData.variants, newVariant] });
      toast.success('Variant added');
    }

    setVariantInput({ attribute: '', value: '', extraPrice: '' });
  };

  const handleEditVariant = (index) => {
    const v = formData.variants[index];
    setVariantInput({
      attribute: v.attribute,
      value: v.value,
      extraPrice: v.extraPrice,
    });
    setEditingVariantIndex(index);
  };

  const handleRemoveVariant = (index) => {
    const updated = formData.variants.filter((_, idx) => idx !== index);
    setFormData({ ...formData, variants: updated });
    if (editingVariantIndex === index) {
      setEditingVariantIndex(null);
      setVariantInput({ attribute: '', value: '', extraPrice: '' });
    }
  };

  // Image Upload / Preview Handler
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be under 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, imageUrl: reader.result }));
        toast.success('Product image uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (Number(formData.salesPrice) < 0 || formData.salesPrice === '') {
      toast.error('Valid sales price is required');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      salesPrice: Number(formData.salesPrice),
      costPrice: Number(formData.costPrice) || 0,
      description: formData.description.trim(),
      taxIds: formData.taxId ? [Number(formData.taxId)] : [],
      isActive: formData.isActive,
      variants: formData.variants,
    };

    try {
      if (editingProduct) {
        await productService.update(editingProduct.id, payload);
        toast.success(`Product "${payload.name}" updated successfully`);
      } else {
        await productService.create(payload);
        toast.success(`Product "${payload.name}" created successfully`);
      }
      setShowModal(false);
      resetForm();
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Error saving product');
    }
  };

  const handleToggleStatus = async (id, name) => {
    try {
      const updated = await productService.toggleActive(id);
      toast.success(`"${name}" is now ${updated.isActive ? 'Active' : 'Inactive'}`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to change product status');
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await productService.delete(id);
      toast.success('Product removed successfully');
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      setDeleteConfirmId(null);
      toast.error(err.message || 'Failed to delete product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Products & Services</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your service catalog, tangible goods, recurring plans inventory, and variant pricing.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Product</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Catalog</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-xs text-slate-400 mt-1">Items defined</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active Items</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</div>
          <div className="text-xs text-slate-400 mt-1">Ready for quotations</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Services</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{stats.services}</div>
          <div className="text-xs text-slate-400 mt-1">SaaS & cloud hosting</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Goods</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{stats.goods}</div>
          <div className="text-xs text-slate-400 mt-1">Hardware & supplies</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Add-Ons</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{stats.addons}</div>
          <div className="text-xs text-slate-400 mt-1">Optional attach lines</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or description..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">All Types</option>
              <option value="SERVICE">Services</option>
              <option value="GOODS">Goods / Hardware</option>
              <option value="ADDON">Add-ons</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {(search || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="text-xs text-brand-600 hover:text-brand-800 font-semibold px-2 py-1"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading catalog items...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <div className="font-semibold text-slate-700">No products found</div>
            <div className="text-sm text-slate-400 mt-1">Try adjusting your search criteria or add a new item.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Taxes</th>
                  <th className="py-3 px-4">Variants</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const typeBadgeClass =
                    p.type === 'SERVICE'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : p.type === 'GOODS'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="h-9 w-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900">{p.name}</div>
                            {p.description && (
                              <div className="text-xs text-slate-500 line-clamp-1 max-w-xs">{p.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{p.sku}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${typeBadgeClass}`}
                        >
                          {p.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {inr(p.salesPrice)}
                        {p.costPrice > 0 && (
                          <div className="text-xs text-slate-400 font-normal">Cost: {inr(p.costPrice)}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {p.taxes?.map((t) => (
                          <span
                            key={t.id}
                            className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-xs mr-1"
                          >
                            {t.name}
                          </span>
                        )) || 'No Tax'}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.variants?.length > 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              <Layers className="h-3 w-3" />
                              <span>{p.variants.length} variant(s)</span>
                            </span>
                            <div className="text-[11px] text-slate-500 line-clamp-1 max-w-[180px]">
                              {p.variants.map((v) => `${v.attribute}: ${v.value}`).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleStatus(p.id, p.name)}
                          className="group focus:outline-none"
                          title="Click to toggle status"
                        >
                          {p.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:bg-emerald-100 transition">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 group-hover:bg-slate-200 transition">
                              <XCircle className="h-3 w-3 text-slate-400" />
                              <span>Inactive</span>
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                            title="Edit Product"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(p.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Delete Product?</h3>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to remove this product? It will be removed from your catalog listing.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProduct(deleteConfirmId)}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingProduct ? 'Edit Catalog Product' : 'Add New Catalog Product'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure pricing, SKU codes, tax categorization, and variant options.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Enterprise Cloud ERP Suite"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Code / SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. PRD-ERP-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="SERVICE">SERVICE (SaaS, compute, consulting)</option>
                    <option value="GOODS">GOODS (Physical hardware, materials)</option>
                    <option value="ADDON">ADDON (Optional attach items)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sales Unit Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.salesPrice}
                    onChange={(e) => setFormData({ ...formData, salesPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Applicable Tax</label>
                  <select
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {taxes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.rate}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="relative flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="text-xs font-semibold text-slate-700">
                      {formData.isActive ? 'Product is Active' : 'Product is Inactive'}
                    </span>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Notes</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed specifications, features, or internal provisioning instructions..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Product Image Section */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Product Image Preview (Frontend Only)
                </label>
                <div className="flex items-start gap-4">
                  {formData.imageUrl ? (
                    <div className="relative group shrink-0">
                      <img
                        src={formData.imageUrl}
                        alt="Product Preview"
                        className="h-20 w-20 rounded-xl object-cover border border-slate-200 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-sm hover:bg-rose-700 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-[10px] mt-1">No Image</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs">
                        <UploadCloud className="h-3.5 w-3.5 text-slate-500" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="text-xs text-slate-400">or enter image URL below</span>
                    </div>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://example.com/images/product.jpg"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Product Variants Section */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Product Variants</h3>
                    <p className="text-xs text-slate-500">
                      Define attribute options such as Storage, User tiers, or colors with incremental pricing.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {formData.variants.length} variant(s)
                  </span>
                </div>

                {/* Sub-form to Add/Edit Variant */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Attribute Name *
                      </label>
                      <input
                        type="text"
                        value={variantInput.attribute}
                        onChange={(e) => setVariantInput({ ...variantInput, attribute: e.target.value })}
                        placeholder="e.g. Storage, RAM, Color"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Attribute Value *
                      </label>
                      <input
                        type="text"
                        value={variantInput.value}
                        onChange={(e) => setVariantInput({ ...variantInput, value: e.target.value })}
                        placeholder="e.g. 50 GB, 16 GB, Black"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Extra Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={variantInput.extraPrice}
                        onChange={(e) => setVariantInput({ ...variantInput, extraPrice: e.target.value })}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {editingVariantIndex !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVariantIndex(null);
                          setVariantInput({ attribute: '', value: '', extraPrice: '' });
                        }}
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddOrUpdateVariant}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                    >
                      {editingVariantIndex !== null ? 'Save Variant' : '+ Add Variant'}
                    </button>
                  </div>
                </div>

                {/* Variants List Table */}
                {formData.variants.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-2 px-3">Attribute</th>
                          <th className="py-2 px-3">Value</th>
                          <th className="py-2 px-3">Extra Price</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.variants.map((v, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/75">
                            <td className="py-2 px-3 font-medium text-slate-800">{v.attribute}</td>
                            <td className="py-2 px-3 text-slate-700">{v.value}</td>
                            <td className="py-2 px-3 font-semibold text-emerald-600">
                              {v.extraPrice > 0 ? `+${inr(v.extraPrice)}` : '₹0 (Included)'}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="inline-flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditVariant(idx)}
                                  className="text-slate-500 hover:text-brand-600 p-1"
                                  title="Edit variant"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariant(idx)}
                                  className="text-slate-500 hover:text-rose-600 p-1"
                                  title="Remove variant"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-3 text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    No variants added. Product will be sold as a single standard item.
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

