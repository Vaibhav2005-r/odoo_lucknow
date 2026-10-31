import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Tag, AlertCircle, CheckCircle, Percent, Layers, Calendar, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { inr, date } from '../../lib/format';

export default function DiscountList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discounts', { search, scopeFilter, activeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (scopeFilter) params.append('scope', scopeFilter);
      if (activeFilter !== 'all') params.append('active', activeFilter);
      const res = await api.get(`/discounts?${params.toString()}`);
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Discount Rules</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure product and subscription-level discount rules for billing.
          </p>
        </div>

        {isAdmin && (
          <Link
            to="/app/discounts/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Discount
          </Link>
        )}
      </div>

      {/* Staff Notice if not admin */}
      {!isAdmin && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Staff members have read-only access to discount rules. Only Administrators can create or modify discounts.</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search discount rules by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <div className="flex items-center gap-2 min-w-36">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Scopes</option>
              <option value="PRODUCT">Product Scope</option>
              <option value="SUBSCRIPTION">Subscription Scope</option>
            </select>
          </div>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-brand-600 rounded-full mb-2" />
            <p>Loading discounts...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            <p>Failed to load discounts: {error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs font-semibold underline hover:text-red-700"
            >
              Retry
            </button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Tag className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No discount rules found</p>
            <p className="text-sm mt-1 text-slate-400">
              {search || scopeFilter || activeFilter !== 'all'
                ? 'Try adjusting your filters or search query.'
                : 'Create your first discount rule to automatically apply savings at invoice time.'}
            </p>
            {isAdmin && !search && !scopeFilter && activeFilter === 'all' && (
              <Link
                to="/app/discounts/new"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Discount Rule
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Rule Name</th>
                  <th className="py-3.5 px-4">Type & Value</th>
                  <th className="py-3.5 px-4">Scope</th>
                  <th className="py-3.5 px-4">Conditions</th>
                  <th className="py-3.5 px-4">Validity</th>
                  <th className="py-3.5 px-4">Usage</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  const isExpired = item.endDate && new Date(item.endDate) < new Date();
                  const isExhausted = item.usageLimit != null && item.usedCount >= item.usageLimit;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded text-xs">
                          {item.type === 'PERCENTAGE' ? (
                            <>
                              <Percent className="w-3 h-3" />
                              {item.value}% Off
                            </>
                          ) : (
                            <>
                              {inr(item.value)} Flat
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded w-fit ${
                            item.scope === 'PRODUCT'
                              ? 'bg-purple-50 text-purple-700 border border-purple-100'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            <Layers className="w-3 h-3" />
                            {item.scope === 'PRODUCT' ? 'Product Scope' : 'Whole Subscription'}
                          </span>
                          {item.scope === 'PRODUCT' && item.products?.length > 0 && (
                            <span className="text-xs text-slate-500 line-clamp-1">
                              {item.products.map((p) => p.name).join(', ')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="space-y-0.5">
                          {item.minQuantity && (
                            <div>Min Qty: <span className="font-medium text-slate-800">{item.minQuantity}</span></div>
                          )}
                          {item.minPurchase && (
                            <div>Min Purchase: <span className="font-medium text-slate-800">{inr(item.minPurchase)}</span></div>
                          )}
                          {!item.minQuantity && !item.minPurchase && (
                            <span className="text-slate-400">None</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {item.startDate ? date(item.startDate) : 'Always'}
                            {' → '}
                            {item.endDate ? date(item.endDate) : 'Open'}
                          </span>
                        </div>
                        {isExpired && (
                          <span className="text-[11px] text-amber-600 font-medium">Expired</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-800">
                          {item.usedCount}
                          {item.usageLimit != null ? ` / ${item.usageLimit}` : ' (unlimited)'}
                        </div>
                        {isExhausted && (
                          <span className="text-[11px] text-red-600 font-medium">Limit reached</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.isActive && !isExpired && !isExhausted
                            ? 'bg-green-50 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.isActive && !isExpired && !isExhausted ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              Active
                            </>
                          ) : (
                            'Inactive'
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isAdmin ? (
                          <Link
                            to={`/app/discounts/${item.id}`}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded transition-colors"
                          >
                            Edit
                          </Link>
                        ) : (
                          <Link
                            to={`/app/discounts/${item.id}`}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
