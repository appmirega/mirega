import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 3000 }: SplashScreenProps) {
  const [dots, setDots] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  useEffect(() => {
    const duration = minDuration;
    const steps = 100;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const progressInterval = setInterval(() => {
      currentStep++;
      setProgress(currentStep);

      if (currentStep >= steps) {
        clearInterval(progressInterval);
        if (onComplete) {
          setTimeout(() => onComplete(), 300);
        }
      }
    }, stepDuration);

    return () => clearInterval(progressInterval);
  }, [minDuration, onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-40 h-40 bg-gradient-to-r from-blue-500 to-green-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
          </div>

          <div className="relative animate-float">
            <img
              src="/logo-circular_2.png"
              alt="MIREGA"
              className="w-40 h-40 mx-auto drop-shadow-2xl"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white tracking-wide">
            MIREGA LTDA.
          </h1>
          <p className="text-xl text-slate-300 font-light">
            Confianza que sube, seguridad que se mantiene
          </p>

          <div className="flex items-center justify-center gap-2 pt-6">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>

          <p className="text-slate-400 text-sm font-medium pt-4">
            Cargando{dots}
          </p>
        </div>

        <div className="mt-12 space-y-2">
          <div className="flex justify-center">
            <div className="w-64 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          <p className="text-center text-slate-500 text-xs font-medium">
            {progress}%
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
