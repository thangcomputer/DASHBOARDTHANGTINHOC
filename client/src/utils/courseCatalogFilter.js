export const CATALOG_CATEGORY_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'my-courses', label: 'Khóa của tôi' },
  { id: 'cap-1', label: 'Tiểu học' },
  { id: 'cap-2', label: 'THCS' },
  { id: 'cap-3', label: 'THPT' },
  { id: 'mos', label: 'MOS' },
  { id: 'hs-sv', label: 'Sinh viên' },
  { id: 'nguoi-di-lam', label: 'Người đi làm' },
];

export const CATALOG_LEVEL_FILTERS = [
  { id: 'all', label: 'Mọi trình độ' },
  { id: 'basic', label: 'Cơ bản' },
  { id: 'intermediate', label: 'Trung cấp' },
  { id: 'advanced', label: 'Nâng cao' },
];

const VALID_LEVELS = new Set(['basic', 'intermediate', 'advanced']);

export function normalizeVietnameseSearch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveCourseLevel(cls) {
  const explicit = String(cls?.level || '').trim().toLowerCase();
  if (VALID_LEVELS.has(explicit)) return explicit;

  const tier = String(cls?.tier || '').trim().toLowerCase();
  const curriculum = String(cls?.curriculumSource || '').trim().toUpperCase();
  const grade = Number(cls?.grade);
  const text = normalizeVietnameseSearch([
    cls?.name,
    cls?.badge,
    cls?.shortDescription,
    cls?.description,
  ].filter(Boolean).join(' '));

  if (
    tier === 'mos'
    || tier === 'chung-chi'
    || curriculum === 'CERTIPORT'
    || curriculum === 'TT03_IC3'
    || /\b(luyen thi|nang cao|chung chi|mos|ic3|thpt quoc gia|chuyen sau)\b/i.test(text)
  ) {
    return 'advanced';
  }

  if (
    tier === 'cap-1'
    || (Number.isFinite(grade) && grade > 0 && grade <= 5)
    || /\b(khoi dong|co ban|mat goc|lam quen|nhap mon|nen tang)\b/i.test(text)
  ) {
    return 'basic';
  }

  return 'intermediate';
}

export function filterCatalogCourses(
  items = [],
  {
    selectedCategory = 'all',
    selectedLevel = 'all',
    searchQuery = '',
    myCourseIds = new Set(),
  } = {},
) {
  const list = Array.isArray(items) ? items : [];
  const normalizedQuery = normalizeVietnameseSearch(searchQuery);
  const ownedSet = myCourseIds instanceof Set
    ? myCourseIds
    : new Set(Array.isArray(myCourseIds) ? myCourseIds.map(String) : []);

  return list.filter((cls) => {
    if (selectedCategory && selectedCategory !== 'all') {
      if (selectedCategory === 'my-courses') {
        const id = String(cls?._id || cls?.id || '');
        if (!ownedSet.has(id) && cls?.accessLevel !== 'full') return false;
      } else if (cls?.tier !== selectedCategory) {
        return false;
      }
    }

    if (selectedLevel && selectedLevel !== 'all') {
      if (resolveCourseLevel(cls) !== selectedLevel) return false;
    }

    if (normalizedQuery) {
      const hay = normalizeVietnameseSearch([
        cls?.name,
        cls?.code,
        cls?.badge,
        cls?.shortDescription,
        cls?.tier,
      ].filter(Boolean).join(' '));
      if (!hay.includes(normalizedQuery)) return false;
    }

    return true;
  });
}
