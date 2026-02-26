import { motion } from 'framer-motion';

/**
 * PageTransitionWrapper - Sayfa geçişleri için sarmalayıcı bileşen
 * 
 * Bu bileşen sayfalar arası geçişlerde:
 * - Aşağıdan yukarı kayma (y: 10 -> 0)
 * - Şeffaflıktan netliliğe (opacity: 0 -> 1)
 * - Premium easing curve ile yumuşak animasyon
 * 
 * Kullanım:
 * <PageTransitionWrapper>
 *   <YourPageContent />
 * </PageTransitionWrapper>
 */

const PAGE_VARIANTS = {
  initial: { 
    opacity: 0, 
    y: 10 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1], // Premium easing curve
    }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: {
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1],
    }
  },
};

const PageTransitionWrapper = ({ children, className = '' }) => {
  return (
    <motion.div
      className={className}
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
};

export default PageTransitionWrapper;
