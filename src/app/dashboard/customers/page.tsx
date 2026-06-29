"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Trash2, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = (await apiClient.getCustomers()) as any;
      setCustomers(res?.users || res?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (c: any) => {
    const makeActive = c.is_active === false;
    if (!window.confirm(`${makeActive ? "Unblock" : "Block"} ${c.full_name || "this customer"}?`)) return;
    try {
      setBusyId(String(c.id));
      await apiClient.updateCustomer(String(c.id), { is_active: makeActive });
      toast(makeActive ? "Customer unblocked" : "Customer blocked", "success");
      await fetchCustomers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update customer", "error");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: any) => {
    if (!window.confirm(`Delete ${c.full_name || "this customer"}? This cannot be undone.`)) return;
    try {
      setBusyId(String(c.id));
      await apiClient.deleteCustomer(String(c.id));
      toast("Customer deleted", "success");
      await fetchCustomers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete (they may have order history)", "error");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = customers.filter(
    (c) =>
      (c.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-600 mt-1">{customers.length} registered customers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadCsv("customers.csv", filtered, [
                { key: "full_name", label: "Name" },
                { key: "phone", label: "Phone" },
                { key: "email", label: "Email" },
                { key: "is_active", label: "Active" },
                { key: "created_at", label: "Joined" },
              ])
            }
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={fetchCustomers} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>}

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-600">No customers found</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      <Link href={`/dashboard/customers/${c.id}`} className="text-primary-600 hover:underline">
                        {c.full_name || "N/A"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.phone || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.email || "—"}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${c.is_active === false ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                        {c.is_active === false ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-3">
                        <button
                          onClick={() => toggleActive(c)}
                          disabled={busyId === String(c.id)}
                          className={`font-medium disabled:opacity-50 ${c.is_active === false ? "text-green-600 hover:text-green-700" : "text-yellow-600 hover:text-yellow-700"}`}
                        >
                          {c.is_active === false ? "Unblock" : "Block"}
                        </button>
                        <button
                          onClick={() => remove(c)}
                          disabled={busyId === String(c.id)}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
