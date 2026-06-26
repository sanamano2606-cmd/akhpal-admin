"use client";

import { Search, Filter, Download } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-600 mt-1">Manage platform users and customers</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
            />
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <p className="text-slate-600">📋 Users list coming soon...</p>
      </div>
    </div>
  );
}
