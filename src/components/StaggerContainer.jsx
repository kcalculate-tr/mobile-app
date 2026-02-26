import { motion } from 'framer-motion';

/**
 * StaggerContainer - Liste animasyonları için stagger efekti sağlayan kapsayıcı
 * 
 * Liste elemanlarının milisaniye farkla sırayla belirmesini sağlar.
 * 
 * Kullanım:
 * <StaggerContainer>
 *   <StaggerItem><YourCard /></StaggerItem>
 *   <StaggerItem><YourCard /></StaggerItem>
 *   <StaggerItem><YourCard /></StaggerItem>
 * </StaggerContainer>
 * 
 * Ya da custom stagger değerleriyle:
 * <StaggerContainer stagger={0.15} className="grid grid-cols-2 gap-3">
 *   <StaggerItem><YourCard /></StaggerItem>
 * </StaggerContainer>
 */

const CONTAINER_VARIANTS = (staggerDelay = 0.1) => ({
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.05,
    },
  },
});

const ITEM_VARIANTS = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1], // Premium easing
    },
  },
};

/**
 * StaggerContainer - Ana kapsayıcı bileşen
 */
export const StaggerContainer = ({ 
  children, 
  className = '', 
  stagger = 0.1,
  ...props 
}) => {
  return (
    <motion.div
      className={className}
      variants={CONTAINER_VARIANTS(stagger)}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * StaggerItem - Tek liste elemanı wrapper'ı
 */
export const StaggerItem = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      className={className}
      variants={ITEM_VARIANTS}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * Daha esnek kullanım için varyantları export et
 */
export const staggerContainerVariants = CONTAINER_VARIANTS;
export const staggerItemVariants = ITEM_VARIANTS;

export default StaggerContainer;
