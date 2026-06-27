"use client";

import { useState } from "react";
import { Save, AlertCircle, Plus, Trash2, Edit2 } from "lucide-react";

export default function CommissionsPage() {
  const [defaultCommission, setDefaultCommission] = useState("10");
  const [minOrder, setMinOrder] = useState("500");
  const [saving, setSaving] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);

  const [categoryCommissions] = useState([
    { id: 1, category: "Biryani", commission: "12" },
    { id: 2, category: "Pizza", commission: "10" },
    { id: 3, category: "Chinese", commission: "11" },
    { id: 4, category: "Sweets", commission: "8" },
  ]);

  const [restaurantCommissions] = useState([
    { id: 1, restaurant: "Biryani Place", commission: "12" },
    { id: 2, restaurant: "Pizzeria", commission: "10" },
    { id: 3, restaurant: "Chai Café", commission: "9" },
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("Commission settings saved successfully!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Commission Settings</h1>
        <p className="text-slate-600 mt-1">
          Configure platform commission rates and policies
        </p>
      </div>

      {/* Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-900">Important</h3>
          <p className="text-amber-800 text-sm mt-1">
            Changes to commission rates take effect immediately for all new orders.
            Existing orders retain their original commission rates.
          </p>
        </div>
      </div>

      {/* Default Commission */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Default Commission Rate</h2>
        <p className="text-slate-600 text-sm mb-4">
          Applied to all new restaurants unless overridden
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Commission */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Default Commission Rate (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={defaultCommission}
                onChange={(e) => setDefaultCommission(e.target.value)}
                min="0"
                max="100"
                step="0.5"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
              <span className="text-slate-600 font-medium">%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Recommended: 10-15% for profitability
            </p>
          </div>

          {/* Min Order for Free Delivery */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Min Order Value for Free Delivery
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Rs</span>
              <input
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                min="0"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Orders above this amount get free delivery
            </p>
          </div>
        </div>
      </div>

      {/* Commission by Category */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Commission by Category</h2>
          <button
            onClick={() => setShowCategoryForm(!showCategoryForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        {showCategoryForm && (
          <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Category name"
                className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Commission %"
                  min="0"
                  max="100"
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                />
                <span className="text-slate-600">%</span>
              </div>
              <button className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition">
                Add
              </button>
            </div>
          </div>
        )}

        {/* Category List */}
        <div className="space-y-2">
          {categoryCommissions.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <div className="flex-1">
                <p className="font-medium text-slate-900">{cat.category}</p>
                <p className="text-sm text-slate-600">Commission: {cat.commission}%</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-200 rounded-lg transition">
                  <Edit2 className="w-4 h-4 text-slate-600" />
                </button>
                <button className="p-2 hover:bg-red-100 rounded-lg transition">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commission by Restaurant */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Custom Restaurant Rates</h2>
          <button
            onClick={() => setShowRestaurantForm(!showRestaurantForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Override Rate
          </button>
        </div>

        <p className="text-slate-600 text-sm mb-4">
          Set custom commission rates for specific restaurants
        </p>

        {showRestaurantForm && (
          <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none">
                <option>Select restaurant</option>
                <option>Biryani Place</option>
                <option>Pizzeria</option>
                <option>Chai Café</option>
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Commission %"
                  min="0"
                  max="100"
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                />
                <span className="text-slate-600">%</span>
              </div>
              <button className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition">
                Set
              </button>
            </div>
          </div>
        )}

        {/* Restaurant List */}
        <div className="space-y-2">
          {restaurantCommissions.map((rest) => (
            <div
              key={rest.id}
              className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <div className="flex-1">
                <p className="font-medium text-slate-900">{rest.restaurant}</p>
                <p className="text-sm text-slate-600">Custom Rate: {rest.commission}%</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-200 rounded-lg transition">
                  <Edit2 className="w-4 h-4 text-slate-600" />
                </button>
                <button className="p-2 hover:bg-red-100 rounded-lg transition">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4 sticky bottom-6">
        <button className="px-6 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
