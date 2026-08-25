import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, Users, Share2, GraduationCap, MapPin, Award, LayoutDashboard,
  ExternalLink, Mail, Phone, Globe, Loader2, AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { resolveMediaUrl } from '../../services/api';
import { sanitizeRichHtml } from '../../utils/htmlContent';
import { CENTER_SECTIONS } from './centerInfoConstants';
import { hasPermission, PERMISSIONS } from '../../constants/permissions';

const SECTION_ICONS = {
  overview: LayoutDashboard,
  staff: Users,
  branch: Building2,
  social: Share2,
  service: GraduationCap,
  exam_venue: MapPin,
  certificate: Award,
};

function EmptyBlock({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
      <AlertCircle className="mx-auto mb-2 text-slate-300" size={28} />
      <p className="text-sm font-semibold">{text}</p>
    </div>
  );
}

function OverviewView({ overview }) {
  if (!overview) return <EmptyBlock text="Chưa có nội dung tổng quan đã xuất bản." />;
  return (
    <div className="space-y-6">
      {overview.bannerUrl ? (
        <div className="rounded-2xl overflow-hidden aspect-[21/9] bg-slate-100 border border-slate-100">
          <img src={resolveMediaUrl(overview.bannerUrl)} alt="" className="w-full h-full object-cover" />
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {overview.logoUrl ? (
          <img
            src={resolveMediaUrl(overview.logoUrl)}
            alt=""
            className="w-20 h-20 rounded-2xl object-contain border border-slate-100 bg-white"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {overview.name || 'Thông tin trung tâm'}
          </h1>
          {overview.intro ? <p className="mt-2 text-slate-600 leading-relaxed">{overview.intro}</p> : null}
          {overview.foundedYear ? (
            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Thành lập {overview.foundedYear}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'Sứ mệnh', value: overview.mission },
          { label: 'Tầm nhìn', value: overview.vision },
          { label: 'Giá trị cốt lõi', value: overview.coreValues },
        ].filter((x) => x.value).map((x) => (
          <div key={x.label} className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-red-600 mb-1">{x.label}</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{x.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 space-y-2 text-sm text-slate-700">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Liên hệ</p>
        {overview.headquartersAddress ? <p>📍 {overview.headquartersAddress}</p> : null}
        {overview.contactPhone ? (
          <p className="flex items-center gap-2"><Phone size={14} /> {overview.contactPhone}</p>
        ) : null}
        {overview.contactEmail ? (
          <p className="flex items-center gap-2"><Mail size={14} /> {overview.contactEmail}</p>
        ) : null}
        {overview.website ? (
          <a href={overview.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-red-600 font-bold hover:underline">
            <Globe size={14} /> {overview.website}
          </a>
        ) : null}
      </div>

      {overview.detailHtml ? (
        <div
          className="prose prose-slate max-w-none rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 text-[15px]
            [&_img]:rounded-xl [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(overview.detailHtml) }}
        />
      ) : null}

      {Array.isArray(overview.galleryUrls) && overview.galleryUrls.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {overview.galleryUrls.map((url) => (
            <img
              key={url}
              src={resolveMediaUrl(url)}
              alt=""
              className="rounded-xl border border-slate-100 aspect-video object-cover w-full bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {overview.introVideoUrl ? (
        <div className="rounded-2xl overflow-hidden border border-slate-100 bg-black aspect-video">
          {/youtube|youtu\.be|vimeo/i.test(overview.introVideoUrl) ? (
            <iframe
              title="Video giới thiệu"
              src={overview.introVideoUrl}
              className="w-full h-full"
              allowFullScreen
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={resolveMediaUrl(overview.introVideoUrl)} controls className="w-full h-full" />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ItemCard({ item, section }) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex gap-3 items-start">
        {item.imageUrl ? (
          <img
            src={resolveMediaUrl(item.imageUrl)}
            alt=""
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-100 shrink-0"
          />
        ) : item.icon ? (
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">
            {item.icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 text-base sm:text-lg">{item.title}</h3>
          {item.subtitle ? <p className="text-sm text-slate-500 font-medium">{item.subtitle}</p> : null}
          {item.code ? <p className="text-xs font-bold text-sky-700 mt-0.5">Mã: {item.code}</p> : null}
        </div>
      </div>
      {item.description ? (
        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{item.description}</p>
      ) : null}
      {item.detailHtml ? (
        <div
          className="prose prose-sm prose-slate max-w-none text-slate-700 [&_img]:rounded-lg [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.detailHtml) }}
        />
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {item.department ? <span>Bộ phận: {item.department}</span> : null}
        {item.expertise ? <span>Chuyên môn: {item.expertise}</span> : null}
        {item.experience ? <span>Kinh nghiệm: {item.experience}</span> : null}
        {item.address ? <span>📍 {item.address}{item.city ? `, ${item.city}` : ''}</span> : null}
        {item.phone ? <span>☎ {item.phone}</span> : null}
        {item.showEmail && item.email ? <span>✉ {item.email}</span> : null}
        {item.managerName ? <span>Phụ trách: {item.managerName}</span> : null}
        {item.hours ? <span>Giờ: {item.hours}</span> : null}
        {item.duration ? <span>Thời lượng: {item.duration}</span> : null}
        {item.learningMode ? <span>Hình thức: {item.learningMode}</span> : null}
        {item.priceInfo ? <span>Học phí: {item.priceInfo}</span> : null}
        {item.examType ? <span>Loại kỳ thi: {item.examType}</span> : null}
        {item.capacity ? <span>Sức chứa: {item.capacity}</span> : null}
        {item.issuer ? <span>Đơn vị cấp: {item.issuer}</span> : null}
        {item.validity ? <span>Thời hạn: {item.validity}</span> : null}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
          >
            {section === 'social' ? 'Mở trang' : 'Mở link'}
            <ExternalLink size={12} />
          </a>
        ) : null}
        {item.mapsUrl ? (
          <a
            href={item.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl border border-sky-200 bg-sky-50 text-sky-800 text-xs font-bold"
          >
            <MapPin size={12} /> Xem bản đồ
          </a>
        ) : null}
        {item.verifyUrl ? (
          <a
            href={item.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
          >
            Xác minh chứng chỉ
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function CenterInfoPage({ session, role = 'student' }) {
  const [section, setSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  const canManage = useMemo(
    () => Boolean(payload?.canManage) || hasPermission(session, PERMISSIONS.MANAGE_CENTER_INFO),
    [payload?.canManage, session],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.centerInfo.getPublic();
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.message || 'Không tải được dữ liệu');
        setPayload(res.data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Lỗi tải Thông tin trung tâm');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const items = payload?.sections?.[section] || [];
  const managePath = role === 'admin' ? '/admin/center-info/manage' : null;

  return (
    <div className="cms-sd cms-sd-page bg-slate-50 min-h-full py-2 sm:py-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Building2 className="text-red-600 shrink-0" size={22} />
            Thông tin trung tâm
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Giới thiệu, chi nhánh, dịch vụ và chứng chỉ của trung tâm
          </p>
        </div>
        {canManage && managePath ? (
          <Link
            to={managePath}
            className="inline-flex items-center justify-center min-h-11 px-4 rounded-2xl bg-slate-900 hover:bg-black text-white text-sm font-bold"
          >
            Quản trị nội dung
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Mobile select */}
        <div className="lg:hidden">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800"
          >
            {CENTER_SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Desktop vertical nav */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-4 rounded-2xl border border-slate-100 bg-white p-2 shadow-sm space-y-1">
            {CENTER_SECTIONS.map((s) => {
              const Icon = SECTION_ICONS[s.key] || LayoutDashboard;
              const active = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={`w-full flex items-center gap-2.5 px-3 min-h-11 rounded-xl text-sm font-bold transition-colors text-left ${
                    active
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Horizontal tabs tablet */}
        <div className="hidden sm:flex lg:hidden gap-1.5 overflow-x-auto pb-1">
          {CENTER_SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={`shrink-0 min-h-10 px-3 rounded-xl text-xs font-bold ${
                section === s.key ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="animate-spin" size={20} /> Đang tải...
            </div>
          ) : error ? (
            <EmptyBlock text={error} />
          ) : !payload?.published ? (
            <EmptyBlock text="Nội dung đang được cập nhật. Vui lòng quay lại sau." />
          ) : section === 'overview' ? (
            <OverviewView overview={payload.overview} />
          ) : items.length === 0 ? (
            <EmptyBlock text="Chưa có mục nào trong phần này." />
          ) : (
            <div className="space-y-3">
              {section === 'branch' ? (
                <p className="text-sm font-bold text-slate-600 mb-1">
                  Tổng số chi nhánh: {items.length}
                </p>
              ) : null}
              {items.map((item) => (
                <ItemCard key={item.id} item={item} section={section} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
