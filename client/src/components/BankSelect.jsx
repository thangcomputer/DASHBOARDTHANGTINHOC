/**
 * BankSelect.jsx
 * 
 * Shared component + helper cho VietQR integration.
 * 
 * Exports:
 *  - BankSelect  (controlled <select> component, fetches real bank list from VietQR API)
 */

import { useState, useEffect } from 'react';
import CmsSelect from './ui/CmsSelect';
import { Landmark, Loader2 } from 'lucide-react';

// ── In-memory cache để không fetch lại mỗi lần mount ────────────────────────
let _banksCache = null;
let _fetchPromise = null;

async function fetchBankList() {
  if (_banksCache) return _banksCache;
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = fetch('https://api.vietqr.io/v2/banks')
    .then(r => r.json())
    .then(data => {
      const list = Array.isArray(data?.data) ? data.data : [];
      _banksCache = list;
      return list;
    })
    .catch(() => {
      _fetchPromise = null; // retry on next mount
      return [];
    });
  return _fetchPromise;
}

// ── BankSelect component ─────────────────────────────────────────────────────
/**
 * Dropdown chọn ngân hàng, tự fetch danh sách từ VietQR API.
 * 
 * Props:
 *  - value        : string (bin hoặc shortName hiện tại)
 *  - onChange     : (bank: { bin, shortName, name, logo }) => void
 *  - className    : optional extra className cho <select>
 *  - placeholder  : optional string
 */
export function BankSelect({ value, onChange, className = '', placeholder = '— Chọn ngân hàng —' }) {
  const [banks, setBanks] = useState(_banksCache || []);
  const [loading, setLoading] = useState(!_banksCache);

  useEffect(() => {
    let active = true;
    fetchBankList().then((list) => {
      if (!active) return;
      setBanks(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Find selected bank object to display logo next to name
  return (
    <div className="relative">
      <Landmark size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none z-10" />
      {loading && (
        <Loader2 size={14} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 animate-spin pointer-events-none z-10" />
      )}
      <CmsSelect
        value={value || ''}
        disabled={loading}
        onChange={e => {
          const bank = banks.find(b => b.bin === e.target.value);
          if (bank) onChange(bank);
        }}
        className={`w-full pl-9 pr-8 py-3 bg-white rounded-xl border-2 border-emerald-200 focus:border-emerald-400 outline-none text-sm cursor-pointer transition disabled:opacity-60 ${className}`}
      >
        <option value="">{loading ? 'Đang tải danh sách ngân hàng...' : placeholder}</option>
        {banks.map(b => (
          <option key={b.bin} value={b.bin}>
            {b.shortName} — {b.name}
          </option>
        ))}
      </CmsSelect>
    </div>
  );
}

export default BankSelect;
