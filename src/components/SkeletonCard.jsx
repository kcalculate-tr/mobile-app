import React from 'react';

/**
 * SkeletonCard - Premium yükleme iskelet bileşeni
 * 
 * Kullanım örnekleri:
 * <SkeletonCard variant="product" />
 * <SkeletonCard variant="order" />
 * <SkeletonCard variant="list" count={3} />
 * <SkeletonCard className="h-40" />
 */

const SkeletonCard = ({ 
  variant = 'default', 
  count = 1, 
  className = '',
  animate = true 
}) => {
  // Tek iskelet elemanı
  const SingleSkeleton = ({ customClass = '' }) => (
    <div className={`${animate ? 'animate-pulse' : ''} ${customClass}`}>
      {variant === 'product' && (
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {/* Ürün görseli */}
          <div className="aspect-[1260/1025] w-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
          {/* Ürün detayları */}
          <div className="flex flex-1 flex-col gap-2 p-2.5">
            <div className="h-4 w-3/4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            <div className="h-3 w-full rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="mt-auto flex items-center justify-between pt-1">
              <div className="h-5 w-16 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-100" />
            </div>
          </div>
        </div>
      )}

      {variant === 'order' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            {/* Sipariş görseli */}
            <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
            {/* Sipariş detayları */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <div className="h-3 w-full rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
              <div className="h-4 w-20 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            </div>
          </div>
        </div>
      )}

      {variant === 'list' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="h-4 w-3/4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            <div className="h-3 w-full rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="h-3 w-5/6 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
          </div>
        </div>
      )}

      {variant === 'cart' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="flex gap-3">
            {/* Ürün görseli */}
            <div className="h-24 w-24 shrink-0 rounded-xl bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
            {/* Ürün bilgileri */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <div className="h-3 w-full rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
              {/* Makro badge'ler grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="h-12 rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
                <div className="h-12 rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
              </div>
              <div className="flex items-end justify-between pt-1">
                <div className="h-5 w-16 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <div className="h-8 w-24 rounded-full bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
              </div>
            </div>
          </div>
        </div>
      )}

      {variant === 'favorite' && (
        <div className="flex h-full w-[214px] shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm min-[390px]:w-[226px] min-[414px]:w-[234px] min-[430px]:w-[242px]">
          {/* Favori ürün görseli */}
          <div className="aspect-[1260/1025] w-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
          {/* Favori ürün detayları */}
          <div className="flex flex-1 flex-col gap-2 p-2.5">
            <div className="h-4 w-3/4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            <div className="h-3 w-full rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="mt-auto flex items-center justify-between pt-1">
              <div className="h-5 w-16 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-100" />
            </div>
          </div>
        </div>
      )}

      {variant === 'banner' && (
        <div className="h-[200px] w-full rounded-2xl bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
      )}

      {variant === 'address' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-50" />
            </div>
            <div className="h-3 w-full rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="h-3 w-4/5 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="flex gap-2 pt-2">
              <div className="h-10 flex-1 rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
              <div className="h-10 flex-1 rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            </div>
          </div>
        </div>
      )}

      {variant === 'tracker' && (
        <div className="space-y-4">
          {/* Başlık */}
          <div className="h-4 w-40 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          {/* Dairesel grafik */}
          <div className="mx-auto h-[210px] w-[210px] rounded-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
          {/* Makro kartları */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-24 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="h-24 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="h-24 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
            <div className="h-24 rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
          </div>
        </div>
      )}

      {variant === 'default' && (
        <div className={`h-32 rounded-2xl border border-gray-100 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 shadow-sm ${className}`} />
      )}
    </div>
  );

  // Çoklu iskelet render
  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <SingleSkeleton 
            key={`skeleton-${variant}-${index}`} 
            customClass={className}
          />
        ))}
      </>
    );
  }

  return <SingleSkeleton customClass={className} />;
};

export default SkeletonCard;
