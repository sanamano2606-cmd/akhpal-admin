"use client";

import { useState } from "react";
import { Save, AlertCircle, Plus, Trash2, Edit2, MapPin, Clock } from "lucide-react";

export default function DeliveryFeesPage() {
  const [baseFee, setBaseFee] = useState("30");
  const [perKmRate, setPerKmRate] = useState("5");
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState("500");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("zones");

  const [zones] = useState([
    { id: 1, name: "Downtown", baseFee: "40", perKm: "5" },
    { id: 2, name: "Suburbs", baseFee: "50", perKm: "6" },
    { id: 3, name: "Remote Area", baseFee: "60", perKm: "7" },
  ]);

  const [timeSurcharges] = useState([
    { id: 1, period: "Peak Hours (12:00 PM - 2:00 PM)", surcharge: "10" },
    { id: 2, period: "Evening Peak (7:00 PM - 9:00 PM)", surcharge: "10" },
    { id: 3, period: "Late Night (10:00 PM - 12:00 AM)", surcharge: "15" },
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("Delivery fees saved successfully!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Delivery Fees Management</h1>
        <p className="text-slate-600 mt-1">Configure delivery charges, zones, and special rates</p>
      </div>

      {/* Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-900">Note</h3>
          <p className="text-amber-800 text-sm mt-1">
            Delivery fee calculations: Base Fee + (Distance × Per KM Rate) + Time Surcharge (if applicable)
          </p>
        </div>
      </div>

      {/* Global Settings */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Global Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Base Fee */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Base Delivery Fee
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Rs</span>
              <input
                type="number"
                value={baseFee}
                onChange={(e) => setBaseFee(e.target.value)}
                min="0"
                step="5"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Minimum delivery charge for any order
            </p>
          </div>

          {/* Per KM Rate */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Per KM Rate
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Rs</span>
              <input
                type="number"
                value={perKmRate}
                onChange={(e) => setPerKmRate(e.target.value)}
                min="0"
                step="0.5"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
              <span className="text-slate-600 text-sm">/km</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Charge per kilometer of delivery distance
            </p>
          </div>

          {/* Free Delivery Above */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Free Delivery Above Order Value
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Rs</span>
              <input
                type="number"
                value={freeDeliveryAbove}
                onChange={(e) => setFreeDeliveryAbove(e.target.value)}
                min="0"
                step="50"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Orders above this amount get free delivery
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("zones")}
            className={`flex-1 px-6 py-4 font-medium flex items-center justify-center gap-2 transition ${
              activeTab === "zones"
                ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MapPin className="w-4 h-4" />
            By Zone
          </button>
          <button
            onClick={() => setActiveTab("time")}
            className={`flex-1 px-6 py-4 font-medium flex items-center justify-center gap-2 transition ${
              activeTab === "time"
                ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            Time Surcharges
          </button>
        </div>

        <div className="p-6">
          {activeTab === "zones" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Delivery Zones</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  Add Zone
                </button>
              </div>

              {zones.map((zone) => (
                <div key={zone.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-slate-900">{zone.name}</h4>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-slate-100 rounded-lg transition">
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </button>
                      <button className="p-2 hover:bg-red-100 rounded-lg transition">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-600">Base Fee</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span>Rs</span>
                        <input
                          type="number"
                          defaultValue={zone.baseFee}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-slate-600">Per KM Rate</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span>Rs</span>
                        <input
                          type="number"
                          defaultValue={zone.perKm}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <span className="text-sm text-slate-600">/km</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "time" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Time-Based Surcharges</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  Add Surcharge
                </button>
              </div>

              {timeSurcharges.map((surcharge) => (
                <div key={surcharge.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{surcharge.period}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Add Rs{surcharge.surcharge} to delivery fee
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition">
                      <Edit2 className="w-4 h-4 text-slate-600" />
                    </button>
                    <button className="p-2 hover:bg-red-100 rounded-lg transition">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Example Calculation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-4">📐 Example Calculation</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <span className="font-medium">Order:</span> 12 km distance, Rs600 order value
          </p>
          <p>
            <span className="font-medium">Time:</span> 1:00 PM (Peak hours surcharge applies)
          </p>
          <p>
            <span className="font-medium">Calculation:</span>
          </p>
          <ul className="ml-4 space-y-1 text-blue-800">
            <li>• Base Fee: Rs30</li>
            <li>• Distance: 12 km × Rs5/km = Rs60</li>
            <li>• Peak Hour Surcharge: Rs10</li>
            <li>• Subtotal: Rs100</li>
            <li>• Free Delivery: Order &gt; Rs500 ✓</li>
            <li className="font-bold text-blue-900">• Final: Rs0 (Free delivery applied)</li>
          </ul>
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
