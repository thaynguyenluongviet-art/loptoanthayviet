export interface ExamCategory {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  gradient: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  description: string;
}

export const EXAM_CATEGORIES: ExamCategory[] = [
  {
    id: 'gk1',
    name: 'Giữa Kì I',
    shortName: 'Giữa Kì 1',
    icon: '📝',
    gradient: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-400',
    description: 'Đề kiểm tra giữa học kì I'
  },
  {
    id: 'hk1',
    name: 'Học Kì I',
    shortName: 'Học Kì 1',
    icon: '🏆',
    gradient: 'from-blue-600 to-indigo-700',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-300',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-400',
    description: 'Đề thi cuối học kì I'
  },
  {
    id: 'gk2',
    name: 'Giữa Kì II',
    shortName: 'Giữa Kì 2',
    icon: '🌟',
    gradient: 'from-emerald-500 to-teal-700',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-400',
    description: 'Đề kiểm tra giữa học kì II'
  },
  {
    id: 'hk2',
    name: 'Học Kì II',
    shortName: 'Học Kì 2',
    icon: '🎖️',
    gradient: 'from-purple-600 to-violet-700',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-300',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-400',
    description: 'Đề thi cuối học kì II'
  },
  {
    id: 'vao10',
    name: 'Đề Ôn Thi Vào Lớp 10',
    shortName: 'Vào Lớp 10',
    icon: '🎯',
    gradient: 'from-rose-500 to-pink-600',
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-300',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-400',
    description: 'Tuyển sinh & luyện thi vào 10'
  },
  {
    id: 'thptqg',
    name: 'Đề Ôn Thi THPT Quốc Gia',
    shortName: 'THPT Quốc Gia',
    icon: '🎓',
    gradient: 'from-indigo-600 to-cyan-700',
    badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-400',
    description: 'Luyện thi Tốt nghiệp THPT & Đại học'
  },
  {
    id: 'other',
    name: 'Đề Ôn Tập / Khác',
    shortName: 'Ôn Tập Khác',
    icon: '📚',
    gradient: 'from-slate-600 to-gray-700',
    badgeBg: 'bg-slate-50 text-slate-800 border-slate-300',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-400',
    description: 'Đề ôn thường xuyên & chuyên đề'
  }
];

/**
 * Nhận diện danh mục đề thi dựa vào tiêu đề
 */
export function getExamCategory(title: string): ExamCategory {
  if (!title) return EXAM_CATEGORIES.find(c => c.id === 'other')!;

  const lower = title.toLowerCase().trim();

  // 1. Đề thi vào lớp 10
  if (
    lower.includes('vào 10') ||
    lower.includes('vào lớp 10') ||
    lower.includes('tuyển sinh 10') ||
    lower.includes('tuyển sinh lớp 10') ||
    lower.includes('lớp 9 lên 10') ||
    lower.includes('ts 10') ||
    lower.includes('ts10') ||
    lower.includes('ôn thi 10')
  ) {
    return EXAM_CATEGORIES.find(c => c.id === 'vao10')!;
  }

  // 2. Đề thi THPT Quốc Gia
  if (
    lower.includes('thptqg') ||
    lower.includes('thpt quốc gia') ||
    lower.includes('tốt nghiệp thpt') ||
    lower.includes('tn thpt') ||
    lower.includes('đại học') ||
    lower.includes('đgnl') ||
    lower.includes('đgtd') ||
    lower.includes('ôn thi thpt') ||
    lower.includes('thpt')
  ) {
    return EXAM_CATEGORIES.find(c => c.id === 'thptqg')!;
  }

  // 3. Giữa kì 1
  if (
    lower.includes('giữa kì 1') ||
    lower.includes('giữa kì i') ||
    lower.includes('giữa kỳ 1') ||
    lower.includes('giữa kỳ i') ||
    lower.includes('gk1') ||
    lower.includes('gki') ||
    lower.includes('giữa hk1') ||
    lower.includes('giữa hki')
  ) {
    return EXAM_CATEGORIES.find(c => c.id === 'gk1')!;
  }

  // 4. Giữa kì 2
  if (
    lower.includes('giữa kì 2') ||
    lower.includes('giữa kì ii') ||
    lower.includes('giữa kỳ 2') ||
    lower.includes('giữa kỳ ii') ||
    lower.includes('gk2') ||
    lower.includes('gkii') ||
    lower.includes('giữa hk2') ||
    lower.includes('giữa hkii')
  ) {
    return EXAM_CATEGORIES.find(c => c.id === 'gk2')!;
  }

  // 5. Học kì 1
  if (
    lower.includes('học kì 1') ||
    lower.includes('học kì i') ||
    lower.includes('học kỳ 1') ||
    lower.includes('học kỳ i') ||
    lower.includes('hk1') ||
    lower.includes('hki') ||
    lower.includes('cuối kì 1') ||
    lower.includes('cuối kỳ 1') ||
    lower.includes('cuối kì i') ||
    lower.includes('cuối kỳ i')
  ) {
    return EXAM_CATEGORIES.find(c => c.id === 'hk1')!;
  }

  // 6. Học kì 2
  if (
    lower.includes('học kì 2') ||
    lower.includes('học kì ii') ||
    lower.includes('học kỳ 2') ||
    lower.includes('học kỳ ii') ||
    lower.includes('hk2') ||
    lower.includes('hkii') ||
    lower.includes('cuối kì 2') ||
    lower.includes('cuối kỳ 2') ||
    lower.includes('cuối kì ii') ||
    lower.includes('cuối kỳ ii')
  ) {
    return EXAM_CATEGORIES.find(c => c.id === 'hk2')!;
  }

  return EXAM_CATEGORIES.find(c => c.id === 'other')!;
}
