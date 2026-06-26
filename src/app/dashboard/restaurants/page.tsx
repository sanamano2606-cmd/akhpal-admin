"use client";

import { Search, Filter, Download, Star, ChevronRight } from "lucide-react";

export default function RestaurantsPage() {
  const restaurants = [
    {
      id: 1,
      name: "Biryani Place",
      rating: 4.8,
      orders: 523,
      revenue: "₹4,23,000",
      status: "active",
    },
    {
      id: 2,
      name: "Pizzeria",
      rating: 4.2,
      orders: 234,
      revenue: "₹1,87,000",
      status: "active",
    },
    {
      id: 3,
      name: "Chai Café",
      rating: 4.5,
      orders: 189,
      revenue: "₹95,000",
      status: "pending",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Restaurants</h1>
          <p className="text-slate-600 mt-1">Manage all restaurant vendors</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search restaurants..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
            />
          </div>
        </div>
        <select className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none">
          <option>All Status</option>
          <option>Active</option>
          <option>Suspended</option>
          <option>Pending</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
          <Filter className="w-4 h-4" />
          More
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                Restaurant
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                Rating
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                Orders
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                Revenue
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                Status
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map((restaurant) => (
              <tr key={restaurant.id} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                  {restaurant.name}
                </td>
                <td className="px-6 py-4 text-sm flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  {restaurant.rating}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{restaurant.orders}</td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                  {restaurant.revenue}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      restaurant.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {restaurant.status.charAt(0).toUpperCase() +
                      restaurant.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <button className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium">
                    View <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
