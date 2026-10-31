import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Tag, Percent, Check, AlertCircle, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const discountSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.coerce.number().positive('Value must be greater than 0'),
  scope: z.enum(['PRODUCT', 'SUBSCRIPTION']),
  minPurchase: z.coerce.number().min(0, 'Min purchase cannot be negative').nullable().optional(),
  minQuantity: z.coerce.number().int().positive('Min quantity must be at least 1').nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  usageLimit: z.coerce.number().int().positive('Usage limit must be a positive number').nullable().optional(),
  isActive: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.type === 'PERCENTAGE' && data.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    });
  }
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be on or after start date',
      path: ['endDate'],
    });
  }
});

export default function DiscountForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'new';
  const isAdmin = user?.role === 'ADMIN';

  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productError, setProductError] = useState('');

  // Fetch products for product-scope selection
  const { data: productsData } = useQuery({
    queryKey: ['products-for-discount'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data || [];
    },
  });

  // Fetch discount if editing
  const { data: discount, isLoading: isLoadingDiscount } = useQuery({
    queryKey: ['discount', id],
    queryFn: async () => {
      if (isNew) return null;
      return api.get(`/discounts/${id}`);
    },
    enabled: !isNew,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      name: '',
      type: 'PERCENTAGE',
      value: '',
      scope: 'PRODUCT',
      minPurchase: '',
      minQuantity: '',
      startDate: '',
      endDate: '',
      usageLimit: '',
      isActive: true,
    },
  });

  const scope = watch('scope');
  const type = watch('type');

  useEffect(() => {
    if (discount) {
      reset({
        name: discount.name || '',
        type: discount.type || 'PERCENTAGE',
        value: Number(discount.value) || '',
        scope: discount.scope || 'PRODUCT',
        minPurchase: discount.minPurchase != null ? Number(discount.minPurchase) : '',
        minQuantity: discount.minQuantity != null ? Number(discount.minQuantity) : '',
        startDate: discount.startDate ? discount.startDate.slice(0, 10) : '',
        endDate: discount.endDate ? discount.endDate.slice(0, 10) : '',
        usageLimit: discount.usageLimit != null ? Number(discount.usageLimit) : '',
        isActive: discount.isActive ?? true,
      });

      if (discount.products) {
        setSelectedProductIds(discount.products.map((p) => p.id));
      }
    }
  }, [discount, reset]);

  const toggleProduct = (productId) => {
    if (!isAdmin) return;
    setProductError('');
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((pid) => pid !== productId) : [...prev, productId],
    );
  };

  const onSubmit = async (values) => {
    if (!isAdmin) return;

    if (values.scope === 'PRODUCT' && selectedProductIds.length === 0) {
      setProductError('Select at least one product for product-scoped discounts.');
      return;
    }

    const payload = {
      name: values.name,
      type: values.type,
      value: Number(values.value),
      scope: values.scope,
      minPurchase: values.minPurchase ? Number(values.minPurchase) : null,
      minQuantity: values.minQuantity ? Number(values.minQuantity) : null,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      usageLimit: values.usageLimit ? Number(values.usageLimit) : null,
      isActive: values.isActive,
      productIds: values.scope === 'PRODUCT' ? selectedProductIds : [],
    };

    try {
      if (isNew) {
        await api.post('/discounts', payload);
        toast.success(`Discount rule "${payload.name}" created successfully`);
      } else {
        await api.patch(`/discounts/${id}`, payload);
        toast.success(`Discount rule "${payload.name}" updated successfully`);
      }
      navigate('/app/discounts');
    } catch (err) {
      toast.error(err.message || 'Failed to save discount');
    }
  };

  if (!isNew && isLoadingDiscount) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-brand-600 rounded-full mb-2" />
        <p>Loading discount rule...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/app/discounts"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isNew ? 'New Discount Rule' : `Edit: ${discount?.name || 'Discount'}`}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isNew
                ? 'Create a rule to apply fixed or percentage savings automatically.'
                : 'Modify criteria, validity dates, or attached products.'}
            </p>
          </div>
        </div>

        {!isNew && discount && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total Invoices Applied:</span>
            <span className="px-2.5 py-1 text-xs font-semibold bg-brand-50 text-brand-700 rounded-full">
              {discount.usedCount} {discount.usageLimit ? `/ ${discount.usageLimit}` : 'uses'}
            </span>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
          <Info className="w-4 h-4 shrink-0" />
          <span>You are viewing this rule in read-only mode. Only Administrators may make changes.</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Core Details */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-600" />
            General Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Discount Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                placeholder="e.g. Bulk CRM Seats 10%, Early Bird ₹500 Off"
                {...register('name')}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Discount Type <span className="text-red-500">*</span>
              </label>
              <select
                disabled={!isAdmin}
                {...register('type')}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Value {type === 'PERCENTAGE' ? '(%)' : '(₹)'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
                  placeholder={type === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 500'}
                  {...register('value')}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  {type === 'PERCENTAGE' ? '%' : '₹'}
                </span>
              </div>
              {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Scope <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <label className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                  scope === 'PRODUCT'
                    ? 'border-brand-600 bg-brand-50/30 ring-1 ring-brand-600'
                    : 'border-slate-200 hover:bg-slate-50'
                } ${!isAdmin ? 'pointer-events-none' : ''}`}>
                  <input
                    type="radio"
                    value="PRODUCT"
                    disabled={!isAdmin}
                    {...register('scope')}
                    className="mt-0.5 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-800">Product-Specific</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Applies to specific line items. The best eligible product discount is selected per line.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                  scope === 'SUBSCRIPTION'
                    ? 'border-brand-600 bg-brand-50/30 ring-1 ring-brand-600'
                    : 'border-slate-200 hover:bg-slate-50'
                } ${!isAdmin ? 'pointer-events-none' : ''}`}>
                  <input
                    type="radio"
                    value="SUBSCRIPTION"
                    disabled={!isAdmin}
                    {...register('scope')}
                    className="mt-0.5 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-800">Whole Subscription</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Attached to subscriptions directly. Spreads proportionately across line items.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Product Selection if Scope is PRODUCT */}
        {scope === 'PRODUCT' && (
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-2 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-brand-600" />
                Applicable Products
              </span>
              <span className="text-xs font-normal text-slate-500">
                {selectedProductIds.length} product(s) selected
              </span>
            </h2>

            {productError && (
              <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {productError}
              </p>
            )}

            <div className="border border-slate-200 rounded-lg p-3 max-h-56 overflow-y-auto space-y-1.5 bg-slate-50/50">
              {!productsData || productsData.length === 0 ? (
                <p className="text-xs text-slate-400 p-2 text-center">No products found in catalog.</p>
              ) : (
                productsData.map((prod) => {
                  const isChecked = selectedProductIds.includes(prod.id);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => toggleProduct(prod.id)}
                      className={`flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-brand-50 text-brand-900 font-medium'
                          : 'bg-white hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isChecked
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <span>{prod.name}</span>
                        <span className="text-xs text-slate-400 uppercase font-mono">({prod.type})</span>
                      </div>
                      <span className="text-xs text-slate-500">₹{Number(prod.salesPrice).toFixed(2)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Eligibility Conditions */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Eligibility & Qualification Criteria
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Minimum Quantity
              </label>
              <input
                type="number"
                min="1"
                disabled={!isAdmin}
                placeholder="e.g. 5 units (optional)"
                {...register('minQuantity')}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
              />
              <p className="text-xs text-slate-400 mt-1">
                {scope === 'PRODUCT' ? 'Required quantity of the specific line item.' : 'Total units across the whole order.'}
              </p>
              {errors.minQuantity && <p className="text-xs text-red-500 mt-1">{errors.minQuantity.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Minimum Purchase Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isAdmin}
                placeholder="e.g. 5000.00 (optional)"
                {...register('minPurchase')}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
              />
              <p className="text-xs text-slate-400 mt-1">
                {scope === 'PRODUCT' ? 'Minimum line subtotal required.' : 'Minimum gross order subtotal required.'}
              </p>
              {errors.minPurchase && <p className="text-xs text-red-500 mt-1">{errors.minPurchase.message}</p>}
            </div>
          </div>
        </div>

        {/* Dates & Usage Limits */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Validity & Usage Limits
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valid From (Start Date)
              </label>
              <input
                type="date"
                disabled={!isAdmin}
                {...register('startDate')}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valid Until (End Date)
              </label>
              <input
                type="date"
                disabled={!isAdmin}
                {...register('endDate')}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Total Usage Limit
              </label>
              <input
                type="number"
                min="1"
                disabled={!isAdmin}
                placeholder="Leave blank for unlimited"
                {...register('usageLimit')}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
              />
              <p className="text-xs text-slate-400 mt-1">Maximum times this rule can be applied across all invoices.</p>
              {errors.usageLimit && <p className="text-xs text-red-500 mt-1">{errors.usageLimit.message}</p>}
            </div>
          </div>
        </div>

        {/* Active Toggle */}
        <div className="pt-2">
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              disabled={!isAdmin}
              {...register('isActive')}
              className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 disabled:opacity-50"
            />
            <span className="text-sm font-medium text-slate-800">
              Rule is Active and available for invoices
            </span>
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Link
            to="/app/discounts"
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isAdmin ? 'Cancel' : 'Back'}
          </Link>

          {isAdmin && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : isNew ? 'Create Discount' : 'Save Changes'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
