import { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  Users, 
  Calendar, 
  FileSymlink, 
  BrainCircuit, 
  Trash2, 
  X, 
  Search, 
  Sparkles, 
  MessageSquare,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api";
import { Doctor } from "../types";

interface LedgerChatWidgetProps {
  doctors: Doctor[];
}

interface LogEntry {
  id: string;
  timestamp: Date;
  type: "admission" | "consult" | "triage" | "referral" | "prior-auth";
  text: string;
  time: string;
}

export default function LedgerChatWidget({ doctors }: LedgerChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clearedLogsIds, setClearedLogsIds] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  
  const lastViewedTimestampRef = useRef<number>(Date.now());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Poll for logs every 3 seconds (same as the previous dashboard census logs)
  useEffect(() => {
    let active = true;

    const formatLogTime = (d: Date) => {
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + d.toLocaleDateString();
    };

    const fetchLogs = async () => {
      try {
        const [patientsList, appts, inboundRefs, outboundRefs, priorAuths] = await Promise.all([
          api.getPatients().catch(() => []),
          api.getAppointments().catch(() => []),
          api.getInboundReferrals().catch(() => []),
          api.getOutboundReferrals().catch(() => []),
          api.getPriorAuths().catch(() => []),
        ]);

        if (!active) return;

        const compiled: LogEntry[] = [];

        // 1. Patient Registrations (Admissions)
        (patientsList || []).forEach((p: any) => {
          compiled.push({
            id: `pat-${p.id}`,
            timestamp: new Date(p.created_at || Date.now()),
            type: "admission",
            text: `Patient ${p.first_name} ${p.last_name} registered successfully. MRN: ${p.medical_record_number}.`,
            time: formatLogTime(new Date(p.created_at || Date.now()))
          });
        });

        // 2. Appointments (Consults)
        (appts || []).forEach((a: any) => {
          const pat = (patientsList || []).find((p: any) => p.id === a.patient_id);
          const doc = doctors.find(d => d.id === String(a.doctor_id));
          const patName = pat ? `${pat.first_name} ${pat.last_name}` : `Patient #${a.patient_id}`;
          const docName = doc ? doc.name : `Doctor #${a.doctor_id}`;
          compiled.push({
            id: `apt-${a.id}`,
            timestamp: new Date(a.created_at || Date.now()),
            type: "consult",
            text: `Consult scheduled: Attending ${docName} scheduled to see Patient ${patName} for "${a.reason || 'Routine consult'}" (Duration: ${a.duration_minutes}m).`,
            time: formatLogTime(new Date(a.created_at || Date.now()))
          });
        });

        // 3. Inbound Referrals (Triage)
        (inboundRefs || []).forEach((r: any) => {
          compiled.push({
            id: `inref-${r.id}`,
            timestamp: new Date(r.created_at || Date.now()),
            type: "triage",
            text: `AI Inbound Referral processed: Referred by ${r.referring_provider_name} from ${r.referring_facility || 'External Clinic'} for "${r.reason}". Status: ${r.status}.`,
            time: formatLogTime(new Date(r.created_at || Date.now()))
          });
        });

        // 4. Outbound Referrals (Referrals)
        (outboundRefs || []).forEach((r: any) => {
          const pat = (patientsList || []).find((p: any) => p.id === r.patient_id);
          const patName = pat ? `${pat.first_name} ${pat.last_name}` : `Patient #${r.patient_id}`;
          compiled.push({
            id: `outref-${r.id}`,
            timestamp: new Date(r.created_at || Date.now()),
            type: "referral",
            text: `AI Outbound Referral verified: Patient ${patName} referred to ${r.referred_to_provider} for ${r.referred_to_specialty} at ${r.referred_to_facility || 'St. Jude'}.`,
            time: formatLogTime(new Date(r.created_at || Date.now()))
          });
        });

        // 5. Prior Authorizations (Prior-Auth)
        (priorAuths || []).forEach((pa: any) => {
          const pat = (patientsList || []).find((p: any) => p.id === pa.patient_id);
          const patName = pat ? `${pat.first_name} ${pat.last_name}` : `Patient #${pa.patient_id}`;
          compiled.push({
            id: `pa-${pa.id}`,
            timestamp: new Date(pa.created_at || Date.now()),
            type: "prior-auth",
            text: `AI Prior Auth submitted: Procedure ${pa.procedure_code} (${pa.procedure_description}) for ${patName} classified as "${pa.ai_predicted_status || 'pending'}". Status: ${pa.status}.`,
            time: formatLogTime(new Date(pa.created_at || Date.now()))
          });
        });

        // Sort by timestamp descending
        compiled.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setLogs(prev => {
          // Identify newly added logs for unread count
          if (prev.length > 0 && !isOpen) {
            const lastKnownTime = lastViewedTimestampRef.current;
            const newUnreads = compiled.filter(c => c.timestamp.getTime() > lastKnownTime && !clearedLogsIds.has(c.id));
            if (newUnreads.length > 0) {
              setUnreadCount(u => u + newUnreads.length);
              lastViewedTimestampRef.current = Date.now();
            }
          }
          return compiled;
        });

      } catch (err) {
        console.error("Error fetching ledger logs:", err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [doctors, isOpen, clearedLogsIds]);

  // When widget is opened, clear unread count
  const handleToggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
      lastViewedTimestampRef.current = Date.now();
      // Auto scroll to bottom after layout paint
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 150);
    }
  };

  const handleClearLogs = () => {
    const idsToClear = new Set(logs.map(l => l.id));
    setClearedLogsIds(prev => new Set([...prev, ...idsToClear]));
  };

  // Filter and search logs
  const activeLogs = logs.filter(log => !clearedLogsIds.has(log.id));

  const filteredLogs = activeLogs.filter(log => {
    // 1. Text Search matching
    const matchesSearch = log.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 2. Category Filter matching
    if (activeFilter === "all") return matchesSearch;
    if (activeFilter === "admission") return log.type === "admission" && matchesSearch;
    if (activeFilter === "referrals") return (log.type === "referral" || log.type === "triage") && matchesSearch;
    if (activeFilter === "consults") return log.type === "consult" && matchesSearch;
    if (activeFilter === "ai") return (log.type === "prior-auth" || log.type === "triage") && matchesSearch;

    return matchesSearch;
  });

  // Group filtered logs by day
  const groupLogsByDate = (entries: LogEntry[]) => {
    const groups: { today: LogEntry[]; yesterday: LogEntry[]; older: LogEntry[] } = {
      today: [],
      yesterday: [],
      older: []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    entries.forEach(entry => {
      const entryDate = new Date(entry.timestamp);
      entryDate.setHours(0, 0, 0, 0);

      if (entryDate.getTime() === today.getTime()) {
        groups.today.push(entry);
      } else if (entryDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(entry);
      } else {
        groups.older.push(entry);
      }
    });

    return groups;
  };

  const groupedLogs = groupLogsByDate(filteredLogs);

  // Scroll to bottom on new logs if near bottom
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs, isOpen]);

  // Styling helper for message bubbles
  const getBubbleStyles = (type: string) => {
    switch (type) {
      case "admission":
        return {
          bg: "bg-indigo-50/70 border-indigo-100 text-indigo-900",
          iconBg: "bg-indigo-600 text-white",
          icon: Users,
          label: "Admission"
        };
      case "consult":
        return {
          bg: "bg-emerald-50/70 border-emerald-100 text-emerald-900",
          iconBg: "bg-emerald-600 text-white",
          icon: Calendar,
          label: "Consult"
        };
      case "referral":
        return {
          bg: "bg-sky-50/70 border-sky-100 text-sky-900",
          iconBg: "bg-sky-600 text-white",
          icon: FileSymlink,
          label: "Outbound Referral"
        };
      case "triage":
        return {
          bg: "bg-amber-50/70 border-amber-100 text-amber-900",
          iconBg: "bg-amber-500 text-white",
          icon: BrainCircuit,
          label: "AI Inbound Referral"
        };
      case "prior-auth":
        return {
          bg: "bg-purple-50/70 border-purple-100 text-purple-900",
          iconBg: "bg-purple-600 text-white",
          icon: Sparkles,
          label: "AI Prior Auth"
        };
      default:
        return {
          bg: "bg-zinc-50 border-zinc-150 text-zinc-800",
          iconBg: "bg-zinc-500 text-white",
          icon: Activity,
          label: "General"
        };
    }
  };

  return (
    <>
      {/* Collapsed Chat Toggle Button */}
      <button
        onClick={handleToggleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer focus:outline-hidden"
        aria-label="Toggle Clinical Ledger Logs Panel"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <MessageSquare className="w-5 h-5 group-hover:animate-pulse" />
              {unreadCount > 0 && (
                <span className="absolute -top-3.5 -right-3 bg-rose-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-zinc-50 shadow-sm">
                  {unreadCount}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Floating Chat Modal Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-24 right-6 w-96 sm:w-[420px] h-[550px] z-50 bg-white/95 backdrop-blur-md border border-zinc-200/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header with Title and Operations */}
            <div className="bg-gradient-to-r from-zinc-900 to-indigo-950 text-white p-4 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <div>
                  <h3 className="text-xs font-bold font-sans tracking-wide">CLINICAL LEDGER LOGS</h3>
                  <p className="text-[10px] text-zinc-400">Live operational ledger stream</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearLogs}
                  title="Clear Current Feed"
                  className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex flex-col gap-2">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3" />
                <input
                  type="text"
                  placeholder="Search logs by keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg focus:outline-hidden focus:border-indigo-500 transition"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px]">
                {[
                  { id: "all", label: "All" },
                  { id: "admission", label: "Admissions" },
                  { id: "consults", label: "Consults" },
                  { id: "referrals", label: "Referrals" },
                  { id: "ai", label: "AI Actions" }
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-full border transition-all shrink-0 cursor-pointer ${
                      activeFilter === filter.id
                        ? "bg-indigo-600 border-indigo-600 text-white font-medium"
                        : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Message List */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50"
            >
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                  <Activity className="w-8 h-8 text-zinc-300 stroke-1 mb-2 animate-pulse" />
                  <p className="text-xs">No clinical logs found matching filters.</p>
                </div>
              ) : (
                <>
                  {/* Today Group */}
                  {groupedLogs.today.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-[1px] bg-zinc-200 flex-1"></div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Today</span>
                        <div className="h-[1px] bg-zinc-200 flex-1"></div>
                      </div>
                      {groupedLogs.today.map((log) => {
                        const styles = getBubbleStyles(log.type);
                        const Icon = styles.icon;
                        return (
                          <div key={log.id} className="flex gap-3 items-start animate-fade-in">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${styles.iconBg}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className={`flex-1 border rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${styles.bg}`}>
                              <div className="flex justify-between items-center mb-1.5 text-[10px] font-bold tracking-tight uppercase opacity-80">
                                <span>{styles.label}</span>
                                <span className="font-normal normal-case opacity-70">{log.time}</span>
                              </div>
                              <p className="font-medium text-neutral-800">{log.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Yesterday Group */}
                  {groupedLogs.yesterday.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-[1px] bg-zinc-200 flex-1"></div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Yesterday</span>
                        <div className="h-[1px] bg-zinc-200 flex-1"></div>
                      </div>
                      {groupedLogs.yesterday.map((log) => {
                        const styles = getBubbleStyles(log.type);
                        const Icon = styles.icon;
                        return (
                          <div key={log.id} className="flex gap-3 items-start">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${styles.iconBg}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className={`flex-1 border rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${styles.bg}`}>
                              <div className="flex justify-between items-center mb-1.5 text-[10px] font-bold tracking-tight uppercase opacity-80">
                                <span>{styles.label}</span>
                                <span className="font-normal normal-case opacity-70">{log.time}</span>
                              </div>
                              <p className="font-medium text-neutral-800">{log.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Older Group */}
                  {groupedLogs.older.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-[1px] bg-zinc-200 flex-1"></div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Older</span>
                        <div className="h-[1px] bg-zinc-200 flex-1"></div>
                      </div>
                      {groupedLogs.older.map((log) => {
                        const styles = getBubbleStyles(log.type);
                        const Icon = styles.icon;
                        return (
                          <div key={log.id} className="flex gap-3 items-start">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${styles.iconBg}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className={`flex-1 border rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${styles.bg}`}>
                              <div className="flex justify-between items-center mb-1.5 text-[10px] font-bold tracking-tight uppercase opacity-80">
                                <span>{styles.label}</span>
                                <span className="font-normal normal-case opacity-70">{log.time}</span>
                              </div>
                              <p className="font-medium text-neutral-800">{log.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div className="bg-zinc-50 border-t border-zinc-100 p-2 text-center text-[10px] text-zinc-400 font-semibold flex items-center justify-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
              </span>
              Connected to HMS Ingress Routing
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
