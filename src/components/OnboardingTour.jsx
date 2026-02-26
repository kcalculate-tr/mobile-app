import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useLocation } from 'react-router-dom';

const TOUR_STORAGE_KEY = 'hasSeenTour';

export default function OnboardingTour() {
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => [
      {
        target: '.tour-product-macro',
        title: 'Makrolarınızı Keşfedin',
        content:
          'Her öğünün kalori, protein ve karbonhidrat değerlerini buradan görebilir, hedefinize en uygun seçimi yapabilirsiniz.',
        disableBeacon: true,
      },
      {
        target: '.tour-kcal-tracker',
        title: 'Kcal Tracker',
        content:
          'Yediğiniz öğünleri buraya tıklayarak günlüğünüze ekleyin ve günlük makro hedeflerinizi anlık olarak takip edin.',
      },
      {
        target: '.tour-cart-delivery',
        title: 'Sipariş ve Teslimat',
        content:
          'Sepetinize giderek isterseniz Hemen Teslimat ile sıcak sıcak, isterseniz Randevulu seçeneğiyle haftalık soğuk teslimat planlayabilirsiniz.',
      },
    ],
    []
  );

  const completeTour = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    }
    setRun(false);
    setStepIndex(0);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasSeenTour = window.localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    const isHomeRoute = location.pathname === '/';

    if (hasSeenTour || !isHomeRoute) {
      setRun(false);
      return;
    }

    const startTimer = window.setTimeout(() => {
      setStepIndex(0);
      setRun(true);
    }, 350);

    return () => window.clearTimeout(startTimer);
  }, [location.pathname]);

  const handleJoyrideCallback = useCallback(
    (data) => {
      const { action, index, status, type } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        completeTour();
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
        setStepIndex(Math.max(0, nextIndex));
        return;
      }

      if (type === EVENTS.TARGET_NOT_FOUND) {
        if (index >= steps.length - 1) {
          completeTour();
          return;
        }
        setStepIndex(index + 1);
      }
    },
    [completeTour, steps.length]
  );

  return (
    <Joyride
      run={run}
      stepIndex={stepIndex}
      steps={steps}
      callback={handleJoyrideCallback}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      locale={{
        back: 'Geri',
        close: 'Kapat',
        last: 'Bitir',
        next: 'İleri',
        skip: 'Geç',
      }}
      styles={{
        options: {
          zIndex: 10000,
          arrowColor: '#FFFFFF',
          backgroundColor: '#FFFFFF',
          textColor: '#202020',
          overlayColor: 'rgba(32,32,32,0.45)',
          primaryColor: '#84cc16',
        },
        tooltip: {
          borderRadius: 16,
          padding: 14,
        },
        buttonNext: {
          backgroundColor: '#84cc16',
          borderRadius: 9999,
          color: '#FFFFFF',
          fontWeight: 600,
        },
        buttonBack: {
          color: '#202020',
          marginRight: 8,
        },
        buttonSkip: {
          color: 'rgba(32,32,32,0.65)',
        },
      }}
    />
  );
}

