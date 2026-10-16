import React from 'react';
import { EXAM_CATEGORIES, ExamCategory } from '@/lib/examCategories';

interface ExamCategoryTabsProps {
  selectedCategory: string; // 'all' | category id
  onSelectCategory: (id: string) => void;
  categoryCounts?: Record<string, number>;
  totalCount?: number;
  className?: string;
}

export const ExamCategoryTabs: React.FC<ExamCategoryTabsProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
  totalCount = 0,
  className = ''
}) => {
  return (
    <div className={`w-full overflow-x-auto pb-2 scrollbar-none ${className}`}>
      <div className="flex items-center gap-2 min-w-max">
        {/* Nút Tất cả */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border shadow-xs ${
            selectedCategory === 'all'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-teal-500 shadow-md scale-[1.02]'
              : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:bg-teal-50/50'
          }`}
        >
          <span>📚 Tất cả</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
              selectedCategory === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {/* Các danh mục */}
        {EXAM_CATEGORIES.map((cat: ExamCategory) => {
          const count = categoryCounts[cat.id] || 0;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 border shadow-xs ${
                isSelected
                  ? `bg-gradient-to-r ${cat.gradient} text-white ${cat.borderColor} shadow-md scale-[1.02]`
                  : `bg-white text-gray-700 border-gray-200 hover:${cat.borderColor} hover:bg-slate-50`
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-black min-w-[20px] text-center ${
                  isSelected
                    ? 'bg-white/25 text-white'
                    : count > 0
                    ? `${cat.badgeBg}`
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExamCategoryTabs;
