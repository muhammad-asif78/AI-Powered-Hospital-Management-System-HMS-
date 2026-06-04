import React, { useState } from "react";
import { 
  FileText, 
  Search, 
  PlusCircle, 
  X, 
  CreditCard, 
  CheckCircle, 
  Printer, 
  Download, 
  TrendingUp, 
  Coins, 
  User,
  Trash2,
  Lock,
  DollarSign
} from "lucide-react";
import { Invoice, Patient, InvoiceItem } from "../types";

interface BillingProps {
  invoices: Invoice[];
  patients: Patient[];
  onAddInvoice: (inv: Invoice) => void;
  onUpdateInvoice: (inv: Invoice) => void;
}

export default function Billing({ invoices, patients, onAddInvoice, onUpdateInvoice }: BillingProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(invoices[0]?.id || null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  // New Invoice State
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "General Consultation Fee", amount: 120 }
  ]);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemAmount, setNewItemAmount] = useState<number>(50);

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
  const selectedInvoicePatient = selectedInvoice ? patients.find(p => p.id === selectedInvoice.patientId) : null;

  const handleAddItem = () => {
    if (!newItemDesc || newItemAmount <= 0) return;
    setItems([...items, { description: newItemDesc, amount: newItemAmount }]);
    setNewItemDesc("");
    setNewItemAmount(50);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleCreateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || items.length === 0) return;

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    const created: Invoice = {
      id: `inv-${Date.now().toString().slice(-4)}`,
      patientId,
      date: new Date().toISOString().split("T")[0],
      items,
      total,
      status: "Outstanding"
    };

    onAddInvoice(created);
    setSelectedInvoiceId(created.id);
    setIsCreatingInvoice(false);
    resetForm();
  };

  const resetForm = () => {
    setPatientId("");
    setItems([{ description: "General Consultation Fee", amount: 120 }]);
    setNewItemDesc("");
  };

  const handleMarkAsPaid = (invId: string) => {
    const inv = invoices.find(i => i.id === invId);
    if (!inv) return;
    onUpdateInvoice({ ...inv, status: "Paid" });
  };

  const filteredInvoices = invoices.filter(inv => {
    const pat = patients.find(p => p.id === inv.patientId);
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      inv.id.toLowerCase().includes(term) || 
      (pat?.name.toLowerCase().includes(term) ?? false);

    const matchesFilter = statusFilter === "All" || inv.status === statusFilter;

    return matchesSearch && matchesFilter;
  });

  // Calculate high-level stats
  const totalRevenue = invoices.filter(i => i.status === "Paid").reduce((sum, i) => sum + i.total, 0);
  const totalOutstanding = invoices.filter(i => i.status === "Outstanding").reduce((sum, i) => sum + i.total, 0);

  return (
    <div id="billing-panel" className="space-y-6">
      
      {/* Financial Health Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Audited Revenue Realized</span>
            <span className="text-2xl font-bold text-neutral-900">${totalRevenue.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-600 block font-medium">Clear of insurance delays</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Outstanding Receivables</span>
            <span className="text-2xl font-bold text-neutral-900">${totalOutstanding.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-400 block font-medium">Pending insurance approval</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 transition flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Admin Services</span>
            <h3 className="text-sm font-bold text-neutral-900">Custom Invoice Engine</h3>
            <button 
              onClick={() => setIsCreatingInvoice(true)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 mt-1 animate-pulse cursor-pointer"
            >
              <PlusCircle className="w-3" /> New Patient Invoice
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ledger list of Invoices */}
        <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 font-sans">Revenue Ledger</h2>
            <p className="text-xs text-zinc-400">Manage draft invoice status and historical receipts.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2" />
              <input 
                type="text" 
                placeholder="Search Invoice ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs border border-zinc-200 bg-zinc-50 py-1.5 px-2 rounded-xl text-zinc-800 font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Outstanding">Outstanding</option>
            </select>
          </div>

          {/* Ledger Stack */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {filteredInvoices.map(inv => {
              const patient = patients.find(p => p.id === inv.patientId);
              let labelColor = "bg-zinc-50 text-zinc-500 border-zinc-150";
              if (inv.status === "Paid") {
                labelColor = "bg-emerald-50 text-emerald-700 border-emerald-150";
              } else if (inv.status === "Outstanding") {
                labelColor = "bg-rose-50 text-rose-700 border-rose-150";
              }

              return (
                <div 
                  key={inv.id} 
                  onClick={() => setSelectedInvoiceId(inv.id)}
                  className={`p-3 border rounded-xl flex items-center justify-between text-xs cursor-pointer transition ${
                    selectedInvoiceId === inv.id 
                      ? "border-indigo-600 bg-indigo-50/20" 
                      : "border-zinc-150 hover:bg-neutral-50/50"
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-900 line-clamp-1">{patient?.name || "EHR Client"}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">ID: {inv.id} • {inv.date}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold text-neutral-900">${inv.total.toLocaleString()}</p>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${labelColor}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredInvoices.length === 0 && (
              <div className="text-center py-10 text-zinc-400">
                No matching billing statements found.
              </div>
            )}
          </div>
        </div>

        {/* Audit Sheet printout / Dynamic Receipt display */}
        <div className="lg:col-span-2 bg-zinc-50 border border-zinc-200 rounded-2xl p-6 shadow-sm min-h-[460px] flex flex-col justify-between">
          {selectedInvoice && selectedInvoicePatient ? (
            <div id="invoice-sheet" className="bg-white border border-zinc-200 rounded-xl p-6.5 space-y-6 flex-1 shadow-xs ring-1 ring-zinc-150/50">
              
              {/* Document Header resembling real invoice */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-150">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-indigo-600 tracking-wider font-mono">ST. JUDE CLINICS & LABS</span>
                  <p className="text-[10px] text-zinc-400 font-medium">704 Medical Plaza Dr, Suite B • NYC • +1 (555) 011-2233</p>
                </div>
                <div className="sm:text-right">
                  <h3 className="text-base font-bold text-neutral-900">BILLING INVOICE</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Invoice ID: {selectedInvoice.id} • {selectedInvoice.date}</p>
                </div>
              </div>

              {/* Patient Info Column */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Account Patient</span>
                  <p className="font-bold text-stone-900">{selectedInvoicePatient.name}</p>
                  <p className="text-zinc-500 text-[10px] mt-0.5">Mobile: {selectedInvoicePatient.phone}</p>
                  <p className="text-zinc-500 text-[10px] font-mono leading-none">Record: {selectedInvoicePatient.id}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Plan Coverage</span>
                  <p className="font-semibold text-stone-900">{selectedInvoicePatient.insurance}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Status: <span className={selectedInvoice.status === "Paid" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{selectedInvoice.status}</span></p>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="space-y-1">
                <div className="grid grid-cols-4 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider border-b border-zinc-150 pb-2">
                  <span className="col-span-3">Itemized Indication / Diagnostics</span>
                  <span className="text-right">Amount (USD)</span>
                </div>

                <div className="divide-y divide-zinc-100 text-xs">
                  {selectedInvoice.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-4 py-3 leading-relaxed">
                      <span className="col-span-3 font-semibold text-zinc-700">{item.description}</span>
                      <span className="text-right font-mono text-zinc-900 font-medium">${item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Totals Summary */}
                <div className="border-t border-zinc-150 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold text-neutral-900 text-sm">
                    <span>Total Net Amount Due</span>
                    <span className="text-base font-mono">${selectedInvoice.total.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 italic leading-relaxed">
                    Charges listed are reflective of diagnostic protocols, medicine formulations, and physical block accommodations. All rates are regulated by clinical code standards.
                  </p>
                </div>
              </div>

              {/* Print actions / Marks Paid */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-zinc-150">
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()} 
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold p-2.5 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Print Document
                  </button>
                  <button 
                    onClick={() => alert("Mocking PDF statement export...")}
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-750 font-semibold p-2.5 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Export Raw
                  </button>
                </div>

                {selectedInvoice.status === "Outstanding" ? (
                  <button 
                    onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" /> Mark Account Settled
                  </button>
                ) : (
                  <div className="text-emerald-700 font-semibold text-xs flex items-center gap-1 bg-emerald-50 border border-emerald-100 py-1.5 px-3 rounded-full">
                    <CheckCircle className="w-4 h-4" /> Payment Confirmed
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-24 text-zinc-400 space-y-3">
              <FileText className="w-12 h-12 text-zinc-200 stroke-1" />
              <div>
                <p className="text-xs font-bold text-stone-850">No Document Selected</p>
                <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px] leading-relaxed">
                  Click on any invoice ledger on the left side to view detailed itemized fees and process client checkouts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COMPREHENSIVE MODAL: GENERATE DIRECT CUSTOM INVOICE */}
      {isCreatingInvoice && (
        <div className="fixed inset-0 z-50 bg-neutral-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-zinc-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center text-xs">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Custom Invoice Configuration</h3>
                <p className="text-zinc-400 text-[10px] mt-0.5">Assemble medicine packages, diagnostic fees, and room rent.</p>
              </div>
              <button onClick={() => setIsCreatingInvoice(false)} className="p-1 rounded-sm hover:bg-zinc-100 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Select Account Patient *</label>
                  <select
                    value={patientId}
                    required
                    onChange={e => setPatientId(e.target.value)}
                    className="w-full border border-zinc-200 p-2.5 rounded-xl bg-white focus:outline-hidden"
                  >
                    <option value="" disabled>Select patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (UUID: {p.id})</option>
                    ))}
                  </select>
                </div>

                {/* Current Items List */}
                <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50 space-y-2">
                  <span className="text-[10px] font-bold text-zinc-500 block uppercase">ITEM LIST</span>
                  
                  <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                    {items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-xs bg-white border border-zinc-150 p-2 rounded-lg">
                        <span className="font-semibold text-zinc-700">{item.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-900 font-bold">${item.amount}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveItem(index)}
                            className="text-zinc-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Item formlet */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-200/50">
                    <input 
                      type="text" 
                      placeholder="Add charge, e.g. Lab Test" 
                      value={newItemDesc}
                      onChange={e => setNewItemDesc(e.target.value)}
                      className="col-span-2 border border-zinc-200 p-1.5 rounded-lg text-xs"
                    />
                    <input 
                      type="number" 
                      placeholder="Amount" 
                      value={newItemAmount}
                      onChange={e => setNewItemAmount(Number(e.target.value))}
                      className="border border-zinc-200 p-1.5 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 rounded-lg text-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => setIsCreatingInvoice(false)} 
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={items.length === 0 || !patientId}
                  className="bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl"
                >
                  Generate Statement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
