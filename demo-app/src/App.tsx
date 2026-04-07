import React, { useState, useEffect, useRef } from 'react';
import { Network, Server, Play, Square, RotateCcw, Activity, Package, CreditCard, Truck, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

type AgentState = "IDLE" | "ORDER_PLACED" | "VERIFIED" | "PACKED" | "SHIPPED" | "DELIVERED" | "FAILED";

interface LogMessage {
  id: number;
  run_id: string;
  agent: string;
  state: AgentState;
  order_id: string;
  payload: any;
  timestamp: string;
}

const API_BASE = "http://localhost:8000/api";

function App() {
  const [seed, setSeed] = useState(42);
  const [orderId, setOrderId] = useState("1");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [currentState, setCurrentState] = useState<AgentState>("IDLE");
  const [activeAgent, setActiveAgent] = useState<string>("System");
  
  const [view, setView] = useState<'tracking' | 'system'>('tracking');

  const pollInterval = useRef<any>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const startRun = async () => {
    resetRun();
    try {
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, seed })
      });
      if (!res.ok) throw new Error("API Route Failed");
      const data = await res.json();
      setActiveRunId(data.run_id); 
    } catch (e) {
      console.error("Falling back to simulated run:", e);
      triggerSimulatedRun();
    }
  };

  const stopRun = () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    setActiveRunId(null);
  };

  const resetRun = () => {
    stopRun();
    setLogs([]);
    setCurrentState("IDLE");
    setActiveAgent("System");
    setActiveRunId(null);
  };

  const triggerSimulatedRun = () => {
     let step = 0;
     setLogs([]);
     setCurrentState("IDLE");
     
     const mockFlow = [
       { agent: "System", state: "IDLE", payload: {"status":"initialized", "seed":seed} },
       { agent: "OrderAgent", state: "ORDER_PLACED", payload: {"customer": "John Doe", "item": "MacBook Pro", "amount": 1999.99} },
       { agent: "InventoryAgent", state: "VERIFIED", payload: {"stock_status": "In Stock", "confidence": 0.85} },
       { agent: "PaymentAgent", state: "PACKED", payload: {"payment_status": "Authorized", "fraud_risk": 0.12} },
       { agent: "DeliveryAgent", state: "SHIPPED", payload: {"pass": true, "stock_confidence": 0.85, "fraud_risk": 0.12, "delivery_days": 3, "partner": "FedEx"} },
       { agent: "System", state: "DELIVERED", payload: {"execution_time_ms": 3200} }
     ];
     
     pollInterval.current = setInterval(() => {
       if (step >= mockFlow.length) {
         clearInterval(pollInterval.current);
         return;
       }
       const currentItem = mockFlow[step] as any;
       setLogs(prev => [...prev, {
         id: step, run_id: "demo", agent: currentItem.agent, state: currentItem.state, order_id: orderId, 
         payload: currentItem.payload, timestamp: new Date().toISOString()
       }]);
       setCurrentState(currentItem.state);
       setActiveAgent(currentItem.agent);
       step++;
     }, 1000);
  };

  useEffect(() => {
    if (!activeRunId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/logs/${activeRunId}`);
        const data = await res.json();
        
        if (data.history && data.history.length > 0) {
           const parsedLogs = data.history.map((log: any, idx: number) => {
             let parsedPayload = log.payload;
             if (typeof log.payload === 'string') {
               try { parsedPayload = JSON.parse(log.payload); } catch (e) {}
             }
             return {
               id: idx,
               run_id: log.run_id,
               agent: log.agent,
               state: log.state,
               order_id: log.order_id,
               payload: parsedPayload,
               timestamp: log.timestamp
             };
           });
           setLogs(parsedLogs);
           
           const lastLog = parsedLogs[parsedLogs.length - 1];
           setCurrentState(lastLog.state as AgentState);
           setActiveAgent(lastLog.agent);
           
           if (lastLog.state === 'DELIVERED' || lastLog.state === 'FAILED') {
              clearInterval(interval);
           }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRunId]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const extractMetrics = () => {
     let conf = 0, fraud = 0, days = 0, time = 0, pass = false;
     logs.forEach(l => {
         const p = l.payload || {};
         if (p.stock_confidence !== undefined) conf = p.stock_confidence;
         if (p.fraud_risk !== undefined) fraud = p.fraud_risk;
         if (p.delivery_days !== undefined) days = p.delivery_days;
         if (p.execution_time_ms !== undefined) time = p.execution_time_ms;
         if (p.pass !== undefined) pass = p.pass;
     });
     return { conf, fraud, days, time, pass };
  };

  const metrics = extractMetrics();

  // Extract dynamic agent data
  const orderData = logs.find(l => l.agent === "OrderAgent")?.payload || null;
  const inventoryData = [...logs].reverse().find(l => l.agent === "InventoryAgent")?.payload || null;
  const paymentData = [...logs].reverse().find(l => l.agent === "PaymentAgent")?.payload || null;
  const deliveryData = [...logs].reverse().find(l => l.agent === "DeliveryAgent")?.payload || null;

  const ControlsPanel = () => (
    <div className="panel" style={{ marginBottom: '1.5rem' }}>
      <div className="panel-title"><Play size={18} /> Run Controls</div>
      <div className="controls-wrapper" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="metric-label">Dataset Order Selection</label>
            <select className="input-field mt-1" value={orderId} onChange={e => setOrderId(e.target.value)}>
              <option value="1">1 - MacBook Pro M3</option>
              <option value="2">2 - Samsung S24 Ultra</option>
              <option value="3">3 - Nike Air Max</option>
              <option value="4">4 - Sony WH-1000XM5</option>
              <option value="5">5 - Nintendo Switch</option>
            </select>
          </div>
          
          <div style={{ flex: 1 }}>
            <label className="metric-label">PRNG Base Seed</label>
            <input type="number" className="input-field mt-1" value={seed} onChange={e => setSeed(Number(e.target.value))} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={startRun}>
              <Play size={16} /> Process Order
            </button>
            <button className="btn" onClick={stopRun}><Square size={16} /></button>
            <button className="btn" onClick={resetRun}><RotateCcw size={16} /></button>
          </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button 
          className={`btn ${view === 'tracking' ? 'btn-primary' : ''}`}
          onClick={() => setView('tracking')}
        >
          <Package size={16} /> Live Order Tracking
        </button>
        <button 
          className={`btn ${view === 'system' ? 'btn-primary' : ''}`}
          onClick={() => setView('system')}
        >
          <Server size={16} /> System Logs & Metrics
        </button>
      </div>

      <ControlsPanel />

      {view === 'tracking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Order Agent */}
          <div className="panel" style={{ borderLeft: activeAgent === 'OrderAgent' ? '4px solid var(--color-fetch)' : '1px solid rgba(255,255,255,0.05)' }}>
            <div className="panel-title" style={{ color: 'var(--color-fetch)' }}><Network size={18} /> 1. Order Agent</div>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              <div style={{ flex: 1 }}>
                <p className="text-slate-400 text-sm mb-2">Role: Receives user order details & generates Order ID.</p>
                <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  {orderData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Order ID:</span> <strong>ORD-{logs[0]?.order_id || orderId}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Customer:</span> <strong>{orderData.customer_name || orderData.customer}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Product:</span> <strong style={{ color: 'var(--color-fetch-light)' }}>{orderData.item_name || orderData.item}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Total:</span> <strong>${orderData.total_amount || orderData.amount}</strong></div>
                    </div>
                  ) : <div className="text-slate-500 text-center">Awaiting order...</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Agent */}
          <div className="panel" style={{ borderLeft: activeAgent === 'InventoryAgent' ? '4px solid var(--color-analyze)' : '1px solid rgba(255,255,255,0.05)', opacity: currentState === 'IDLE' ? 0.5 : 1 }}>
            <div className="panel-title" style={{ color: 'var(--color-analyze)' }}><Package size={18} /> 2. Inventory Agent</div>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              <div style={{ flex: 1 }}>
                <p className="text-slate-400 text-sm mb-2">Role: Checks product availability & updates stock database.</p>
                <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  {inventoryData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Status:</span> 
                        <strong style={{ color: inventoryData.stock_status === 'Low Stock' ? 'var(--color-danger-light)' : 'var(--color-success-light)'}}>
                          {inventoryData.stock_status}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Confidence Match:</span> <strong>{Math.round((inventoryData.stock_confidence || inventoryData.confidence) * 100)}%</strong></div>
                      <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {inventoryData.stock_status === 'Low Stock' ? "Decision: Out of Stock → Cancel Order" : "Decision: In Stock → Continue"}
                      </div>
                    </div>
                  ) : <div className="text-slate-500 text-center">Awaiting inventory check...</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Agent */}
          <div className="panel" style={{ borderLeft: activeAgent === 'PaymentAgent' ? '4px solid var(--color-summarize)' : '1px solid rgba(255,255,255,0.05)', opacity: currentState === 'IDLE' || currentState === 'ORDER_PLACED' ? 0.5 : 1 }}>
            <div className="panel-title" style={{ color: 'var(--color-summarize)' }}><CreditCard size={18} /> 3. Payment Agent</div>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              <div style={{ flex: 1 }}>
                <p className="text-slate-400 text-sm mb-2">Role: Verifies payment & ensures fraud/security checks.</p>
                <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  {paymentData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Transaction:</span> 
                        <strong style={{ color: paymentData.payment_status === 'Authorized' ? 'var(--color-success-light)' : 'var(--color-summarize-light)'}}>
                          {paymentData.payment_status}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Fraud Risk:</span> <strong>{Math.round((paymentData.fraud_risk) * 100)}%</strong></div>
                      {(paymentData.attempt || 1) > 1 && (
                        <div className="mt-2 text-xs" style={{ color: 'var(--color-summarize-light)' }}>
                          ⚠️ Fraud risk detected. Executing payment retry attempt {paymentData.attempt}...
                        </div>
                      )}
                    </div>
                  ) : <div className="text-slate-500 text-center">Awaiting payment verification...</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Agent */}
          <div className="panel" style={{ borderLeft: activeAgent === 'DeliveryAgent' || currentState === 'DELIVERED' ? '4px solid var(--color-evaluate)' : '1px solid rgba(255,255,255,0.05)', opacity: currentState === 'IDLE' || currentState === 'ORDER_PLACED' || currentState === 'VERIFIED' ? 0.5 : 1 }}>
            <div className="panel-title" style={{ color: 'var(--color-evaluate)' }}><Truck size={18} /> 4. Delivery Agent</div>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              <div style={{ flex: 1 }}>
                <p className="text-slate-400 text-sm mb-2">Role: Assigns courier partner & updates delivery status.</p>
                <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  {deliveryData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Courier Partner:</span> <strong>{deliveryData.shipping_partner && deliveryData.shipping_partner !== 'None' ? deliveryData.shipping_partner : (deliveryData.partner || 'Unassigned')}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Est. Delivery Time:</span> <strong>{deliveryData.delivery_time_estimate || deliveryData.delivery_days} days</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-slate-400">Tracking Status:</span> 
                         <strong style={{ color: (deliveryData.pass !== undefined ? deliveryData.pass : deliveryData.metrics?.pass_rate > 0) ? 'var(--color-success-light)' : 'var(--color-danger-light)'}}>
                           {(deliveryData.pass !== undefined ? deliveryData.pass : deliveryData.metrics?.pass_rate > 0) ? "Shipped successfully" : "Delivery Assignment Failed"}
                         </strong>
                      </div>
                    </div>
                  ) : <div className="text-slate-500 text-center">Awaiting delivery assignment...</div>}
                </div>
              </div>
            </div>
          </div>

          {currentState === 'DELIVERED' && (
            <div className="panel" style={{ textAlign: 'center', borderColor: 'var(--color-success-light)', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
              <CheckCircle size={32} color="var(--color-success-light)" style={{ margin: '0 auto', marginBottom: '0.5rem' }} />
              <h3 style={{ color: 'var(--color-success-light)', margin: 0 }}>Order Pipeline Completed</h3>
              <p className="text-slate-400 text-sm mt-2">All agents processed successfully.</p>
            </div>
          )}

          {currentState === 'FAILED' && (
            <div className="panel" style={{ textAlign: 'center', borderColor: 'var(--color-danger-light)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
              <AlertTriangle size={32} color="var(--color-danger-light)" style={{ margin: '0 auto', marginBottom: '0.5rem' }} />
              <h3 style={{ color: 'var(--color-danger-light)', margin: 0 }}>Pipeline Halted</h3>
              <p className="text-slate-400 text-sm mt-2">Order was cancelled due to system constraints.</p>
            </div>
          )}
        </div>
      )}

      {view === 'system' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="panel">
              <div className="panel-title"><Activity size={18} /> State Machine Trace</div>
              <div className="p-3 mb-2" style={{textAlign: 'center', marginTop: '1rem', marginBottom: '1rem'}}>
                 <span className={`badge badge-${currentState.replace('_', '-')}`}>{currentState}</span>
              </div>
              <div className="transitions">
                {logs.map((log, i) => (
                  <div key={i} className="transition-item">
                    <span style={{color: 'var(--text-muted)'}}>↳</span> 
                    <span className={`badge badge-${log.state.replace('_', '-')}`} style={{fontSize: '0.65rem'}}>{log.state}</span>
                    <span>{log.agent} transitioned payload.</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-title"><Activity size={18} /> Quantitative Metrics</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem' }}>
                 <div className="metric-box">
                    <div className="metric-val">{metrics.conf ? `${Math.round(metrics.conf * 100)}%` : '-'}</div>
                    <div className="metric-label">Inventory Accuracy (%)</div>
                 </div>
                 <div className="metric-box">
                    <div className="metric-val">{metrics.fraud !== undefined ? `${Math.round(metrics.fraud * 100)}%` : '-'}</div>
                    <div className="metric-label">Payment Failure Rate (%)</div>
                 </div>
                 <div className="metric-box">
                    <div className="metric-val">{metrics.days ? `${metrics.days} days` : '-'}</div>
                    <div className="metric-label">Delivery Time (hours/days)</div>
                 </div>
                 <div className="metric-box">
                    <div className="metric-val" style={{ color: metrics.pass ? 'var(--color-success-light)' : 'var(--text-main)'}}>
                      {metrics.pass ? '100%' : (currentState === 'FAILED' ? '0%' : '-')}
                    </div>
                    <div className="metric-label">Order Success Rate (%)</div>
                 </div>
              </div>

               <div className="text-xs mt-4" style={{ padding: '0.75rem', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  <strong className="text-slate-300">Run Health / Failure Cases (Live Tracking):</strong>
                  <ul className="mt-2 space-y-1">
                     <li style={{ color: (currentState === 'FAILED' && metrics.conf && metrics.conf <= 0.6) ? 'var(--color-danger-light)' : 'var(--text-muted)' }}>
                       {currentState === 'FAILED' && metrics.conf && metrics.conf <= 0.6 ? '🔴 Out of stock → Order cancelled' : '⚪ Out of stock → Order cancelled (Not triggered)'}
                     </li>
                     <li style={{ color: logs.some(l => (l.payload?.attempt > 1 || (typeof l.payload === "string" && l.payload.includes('"attempt": 2')))) ? 'var(--color-summarize-light)' : 'var(--text-muted)' }}>
                       {logs.some(l => (l.payload?.attempt > 1 || (typeof l.payload === "string" && l.payload.includes('"attempt": 2')))) ? '🟠 Payment failed → Retry option executed' : '⚪ Payment failed → Retry option (Not triggered)'}
                     </li>
                     <li style={{ color: (metrics.days && metrics.pass === false && currentState === 'FAILED' && metrics.conf > 0.6) ? 'var(--color-danger-light)' : 'var(--text-muted)' }}>
                       {(metrics.days && metrics.pass === false && currentState === 'FAILED' && metrics.conf > 0.6) ? '🔴 Delivery issue → Max Retries Reached' : '⚪ Delivery issue → Reassign courier (Not triggered)'}
                     </li>
                  </ul>
               </div>
            </div>
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-title"><Server size={18} /> JSON Message Protocol Logs</div>
            <div className="log-panel" ref={logContainerRef} style={{ flex: 1 }}>
              {logs.map((log, i) => (
                <div key={i} className="log-message">
                  <div className="log-meta">
                    <span style={{ color: 'var(--color-summarize-light)', fontWeight: 600 }}>{log.agent}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="log-json">
                    {`{ "run_id": "${log.run_id}",\n  "agent": "${log.agent}",\n  "state": "${log.state}",\n  "order_id": "${log.order_id}",\n  "payload": ${JSON.stringify(log.payload, null, 2)} }`}
                  </div>
                </div>
              ))}
              {currentState !== 'IDLE' && currentState !== 'DELIVERED' && currentState !== 'FAILED' && (
                <div className="text-center" style={{color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center'}}>Awaiting next transition...</div>
              )}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}

export default App;
