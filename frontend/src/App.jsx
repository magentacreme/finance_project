import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LogOut, 
  UploadCloud, 
  UserPlus, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  FileSpreadsheet, 
  IndianRupee, 
  ShieldCheck,
  History,
  X,
  Clock,
  CheckCheck
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  // Auth State
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // App State
  const [activeTab, setActiveTab] = useState('csv');
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [formData, setFormData] = useState({
    claimId: '', 
    name: '', 
    email: '', 
    department: '',
    reimbursementType: 'Travel Allowance', 
    claimedAmount: '',
    approvedAmount: '', 
    deductionAmount: '0', 
    deductionReason: '',
    paymentRefNo: '', 
    comments: ''
  });

  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Logout Handler
  const handleLogout = (expired = false) => {
    setToken('');
    localStorage.removeItem('adminToken');
    if (expired) {
      setLoginError('Your session has expired. Please sign in again.');
    }
  };

  // Axios Interceptor for 401/403 Session Expiry
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const isAuthError = error.response && (error.response.status === 401 || error.response.status === 403);
        const isLoginRoute = error.config && error.config.url.includes('/admin/login');
        if (isAuthError && !isLoginRoute) {
          handleLogout(true);
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Fetch History from API
  const fetchHistory = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setHistory(res.data.history);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    if (token) fetchHistory();
  }, [token]);

  // Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post(`${API_BASE}/admin/login`, loginCreds);
      if (res.data.success) {
        setToken(res.data.token);
        localStorage.setItem('adminToken', res.data.token);
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Invalid credentials');
    }
  };

  // CSV File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);
    setStatusMsg({ type: 'info', text: 'Parsing CSV file...' });

    try {
      const res = await axios.post(`${API_BASE}/upload-csv`, data, {
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'multipart/form-data' 
        }
      });
      if (res.data.success) {
        setRecords((prev) => [...prev, ...res.data.data]);
        setStatusMsg({ type: 'success', text: `Loaded ${res.data.data.length} records successfully.` });
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setStatusMsg({ type: 'error', text: `CSV Upload Failed: ${err.response?.data?.message || err.message}` });
      }
    }
    e.target.value = null;
  };

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAddRecord = (e) => {
    e.preventDefault();
    if (!formData.claimId || !formData.email || !formData.name) {
      alert('Claim ID, Name, and Email are required.');
      return;
    }
    setRecords([...records, { ...formData, id: Date.now() }]);
    setFormData({
      claimId: '', name: '', email: '', department: '',
      reimbursementType: 'Travel Allowance', claimedAmount: '',
      approvedAmount: '', deductionAmount: '0', deductionReason: '',
      paymentRefNo: '', comments: ''
    });
    setStatusMsg({ type: 'success', text: 'Record added successfully.' });
  };

  // Send Single Email
  const handleSendIndividual = async (record) => {
    setStatusMsg({ type: 'info', text: `Sending email to ${record.email}...` });
    try {
      const res = await axios.post(
        `${API_BASE}/send-individual`,
        { record },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusMsg({ type: 'success', text: res.data.message });
      fetchHistory(); // Refresh history log
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setStatusMsg({ type: 'error', text: `Failed: ${err.response?.data?.message || err.message}` });
      }
    }
  };

  // Send Batch Emails
  const handleSendAll = async () => {
    if (records.length === 0) return alert('No records to send!');
    if (!window.confirm(`Confirm dispatching reimbursement emails to all ${records.length} recipients?`)) return;

    setLoading(true);
    setStatusMsg({ type: 'info', text: `Dispatching emails to ${records.length} recipients...` });
    try {
      const res = await axios.post(
        `${API_BASE}/send-all`,
        { records },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusMsg({ type: 'success', text: res.data.message });
      fetchHistory(); // Refresh history log
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setStatusMsg({ type: 'error', text: `Batch Dispatch Failed: ${err.response?.data?.message || err.message}` });
      }
    } finally {
      setLoading(false);
    }
  };

  // Core Top Metrics Calculations
  const totalClaimed = records.reduce((sum, r) => sum + (Number(r.claimedAmount) || 0), 0);
  const totalApproved = records.reduce((sum, r) => sum + (Number(r.approvedAmount) || 0), 0);
  const totalDeductions = records.reduce((sum, r) => sum + (Number(r.deductionAmount) || 0), 0);

  // VIEW 1: ADMIN LOGIN
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ maxWidth: '400px', width: '100%', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#4f46e5', padding: '24px', color: '#ffffff', textAlign: 'center' }}>
            <ShieldCheck style={{ width: '40px', height: '40px', margin: '0 auto 8px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Accounts Section Portal</h2>
            <p style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>Reimbursement Settlement & Mailer Service</p>
          </div>

          <form onSubmit={handleLogin} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loginError && (
              <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '13px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Username</label>
              <input
                type="text"
                className="input-field"
                value={loginCreds.username}
                onChange={(e) => setLoginCreds({ ...loginCreds, username: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Password</label>
              <input
                type="password"
                className="input-field"
                value={loginCreds.password}
                onChange={(e) => setLoginCreds({ ...loginCreds, password: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              style={{ width: '100%', padding: '10px', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: '600', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '8px' }}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // VIEW 2: DASHBOARD
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', position: 'relative' }}>
      {/* Top Navbar */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#4f46e5', color: '#ffffff', padding: '8px', borderRadius: '8px', display: 'flex' }}>
              <FileSpreadsheet style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Settlement Advice Dispatcher</h1>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Accounts & Finance Division</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* History Toggle Button */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid #c7d2fe', borderRadius: '6px', backgroundColor: '#eef2ff', color: '#4338ca', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              <History style={{ width: '15px', height: '15px' }} /> Settlement History ({history.length})
            </button>

            <button
              onClick={() => handleLogout(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
            >
              <LogOut style={{ width: '15px', height: '15px' }} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* Status Alert Banner */}
        {statusMsg.text && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: statusMsg.type === 'error' ? '#fef2f2' : statusMsg.type === 'success' ? '#ecfdf5' : '#eff6ff',
            border: `1px solid ${statusMsg.type === 'error' ? '#fecaca' : statusMsg.type === 'success' ? '#a7f3d0' : '#bfdbfe'}`,
            color: statusMsg.type === 'error' ? '#991b1b' : statusMsg.type === 'success' ? '#065f46' : '#1e40af'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {statusMsg.type === 'error' ? <AlertCircle style={{ width: '18px', height: '18px' }} /> : <CheckCircle2 style={{ width: '18px', height: '18px' }} />}
              <span style={{ fontSize: '14px', fontWeight: '500' }}>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg({ type: '', text: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', textDecoration: 'underline' }}>Dismiss</button>
          </div>
        )}

        {/* ---------------- UPDATED TOP METRICS CARDS ---------------- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* Card 1: Total Claimed Value */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '12px', borderRadius: '10px', display: 'flex' }}>
              <IndianRupee style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Total Claimed Value</p>
              <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 0' }}>₹{totalClaimed.toLocaleString('en-IN')}</h3>
            </div>
          </div>

          {/* Card 2: Total Approved Value */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ backgroundColor: '#d1fae5', color: '#059669', padding: '12px', borderRadius: '10px', display: 'flex' }}>
              <CheckCheck style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Total Approved Value</p>
              <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 0' }}>₹{totalApproved.toLocaleString('en-IN')}</h3>
            </div>
          </div>

          {/* Card 3: Total Deductions */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '12px', borderRadius: '10px', display: 'flex' }}>
              <AlertCircle style={{ width: '24px', height: '24px' }} />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Total Deductions</p>
              <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 0' }}>₹{totalDeductions.toLocaleString('en-IN')}</h3>
            </div>
          </div>
        </div>

        {/* Input Option Tabs */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <button
              onClick={() => setActiveTab('csv')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', fontSize: '14px', fontWeight: '600', border: 'none', borderBottom: activeTab === 'csv' ? '2px solid #4f46e5' : '2px solid transparent', backgroundColor: activeTab === 'csv' ? '#ffffff' : 'transparent', color: activeTab === 'csv' ? '#4f46e5' : '#64748b', cursor: 'pointer'
              }}
            >
              <UploadCloud style={{ width: '16px', height: '16px' }} /> Option 1: CSV Bulk Import
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', fontSize: '14px', fontWeight: '600', border: 'none', borderBottom: activeTab === 'manual' ? '2px solid #4f46e5' : '2px solid transparent', backgroundColor: activeTab === 'manual' ? '#ffffff' : 'transparent', color: activeTab === 'manual' ? '#4f46e5' : '#64748b', cursor: 'pointer'
              }}
            >
              <UserPlus style={{ width: '16px', height: '16px' }} /> Option 2: Manual Data Entry
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {activeTab === 'csv' ? (
              <div style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '32px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                <UploadCloud style={{ width: '40px', height: '40px', color: '#94a3b8', margin: '0 auto 8px' }} />
                <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#334155', margin: 0 }}>Upload Settlement CSV File</h4>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 16px' }}>Select institutional reimbursement CSV export file</p>
                
                <input
                  type="file"
                  accept=".csv"
                  id="csv-upload"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="csv-upload"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: '500', fontSize: '14px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Choose CSV File
                </label>
              </div>
            ) : (
              <form onSubmit={handleAddRecord} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <input name="claimId" placeholder="Claim ID (e.g., CLM-1001)" value={formData.claimId} onChange={handleInputChange} required className="input-field" />
                <input name="name" placeholder="Recipient Name" value={formData.name} onChange={handleInputChange} required className="input-field" />
                <input name="email" type="email" placeholder="Recipient Email" value={formData.email} onChange={handleInputChange} required className="input-field" />
                <input name="department" placeholder="Department" value={formData.department} onChange={handleInputChange} className="input-field" />
                <input name="reimbursementType" placeholder="Reimbursement Category" value={formData.reimbursementType} onChange={handleInputChange} className="input-field" />
                <input name="claimedAmount" type="number" placeholder="Claimed Amount (₹)" value={formData.claimedAmount} onChange={handleInputChange} className="input-field" />
                <input name="approvedAmount" type="number" placeholder="Approved Amount (₹)" value={formData.approvedAmount} onChange={handleInputChange} className="input-field" />
                <input name="deductionAmount" type="number" placeholder="Deduction Amount (₹)" value={formData.deductionAmount} onChange={handleInputChange} className="input-field" />
                <input name="deductionReason" placeholder="Deduction Reason" value={formData.deductionReason} onChange={handleInputChange} className="input-field" />
                <input name="paymentRefNo" placeholder="Payment Ref / UTR No." value={formData.paymentRefNo} onChange={handleInputChange} className="input-field" />
                <input name="comments" placeholder="Accounting Remarks / Notes" value={formData.comments} onChange={handleInputChange} className="input-field" style={{ gridColumn: 'span 2' }} />
                
                <button
                  type="submit"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#059669', color: '#ffffff', fontWeight: '600', padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  <UserPlus style={{ width: '16px', height: '16px' }} /> Add Record
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Data Table Section */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Prepared Settlement Records</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>Review recipient entries prior to dispatch</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {records.length > 0 && (
                <button
                  onClick={() => setRecords([])}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', cursor: 'pointer' }}
                >
                  <Trash2 style={{ width: '14px', height: '14px' }} /> Clear All
                </button>
              )}
              <button
                onClick={handleSendAll}
                disabled={loading || records.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '6px', backgroundColor: loading || records.length === 0 ? '#cbd5e1' : '#4f46e5', color: '#ffffff', border: 'none', fontSize: '14px', fontWeight: '600', cursor: loading || records.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Send style={{ width: '15px', height: '15px' }} /> {loading ? 'Dispatching...' : `Send All (${records.length})`}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                  <th style={{ padding: '12px 16px' }}>Claim ID</th>
                  <th style={{ padding: '12px 16px' }}>Recipient</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Claimed Amount</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Approved Amount</th>
                  <th style={{ padding: '12px 16px' }}>Deduction Details</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      No settlement records loaded yet. Upload a CSV or enter records above.
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: '600', color: '#4f46e5' }}>{rec.claimId}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{rec.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{rec.email}</div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#334155' }}>{rec.reimbursementType}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#64748b' }}>
                        ₹{Number(rec.claimedAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                        ₹{Number(rec.approvedAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {Number(rec.deductionAmount) > 0 ? (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '500', backgroundColor: '#fef3c7', color: '#92400e' }}>
                            -₹{rec.deductionAmount} ({rec.deductionReason || 'Deduction'})
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '500', backgroundColor: '#d1fae5', color: '#065f46' }}>
                            Full Settlement
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleSendIndividual(rec)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: '500', color: '#334155', cursor: 'pointer' }}
                        >
                          <Send style={{ width: '12px', height: '12px' }} /> Send
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ---------------- HISTORY SIDEBAR (DRAWER) ---------------- */}
      {isHistoryOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          <div style={{ width: '100%', maxWidth: '420px', height: '100%', backgroundColor: '#ffffff', boxShadow: '-10px 0 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
            {/* Sidebar Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History style={{ width: '20px', height: '20px', color: '#4f46e5' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Past Approved Settlements</h3>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{history.length} Advice(s) Dispatched</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* History List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 16px' }}>
                  <Clock style={{ width: '36px', height: '36px', margin: '0 auto 8px', color: '#cbd5e1' }} />
                  <p style={{ fontSize: '14px', margin: 0 }}>No past settlement history recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {history.map((item, index) => (
                    <div key={index} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', backgroundColor: '#ffffff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#4f46e5', backgroundColor: '#e0e7ff', padding: '2px 6px', borderRadius: '4px' }}>
                            {item.claimId}
                          </span>
                          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', margin: '6px 0 0' }}>{item.name}</h4>
                          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{item.email}</p>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669' }}>
                          ₹{Number(item.approvedAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px dashed #f1f5f9', fontSize: '11px', color: '#64748b' }}>
                        <span>UTR: {item.paymentRefNo || 'N/A'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 style={{ width: '12px', height: '12px', color: '#10b981' }} />
                          {item.sentAt ? new Date(item.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Sent'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}