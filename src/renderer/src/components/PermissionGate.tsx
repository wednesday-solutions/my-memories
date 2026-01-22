import { useState, useEffect, useCallback } from 'react';
import { motion, stagger, useAnimate } from 'motion/react';
import { StarsBackground } from './ui/stars-background';
import { ShootingStars } from './ui/shooting-stars';
import { BorderBeam } from './ui/border-beam';
import { cn } from '@renderer/lib/utils';
import { Shield, Eye, Check, X, Settings, RefreshCw } from 'lucide-react';

interface PermissionGateProps {
  children: React.ReactNode;
}

// Text Generate Effect for the title
function TextGenerate({ words, className, delay = 0 }: { words: string; className?: string; delay?: number }) {
  const [scope, animate] = useAnimate();
  const wordsArray = words.split(" ");

  useEffect(() => {
    const timer = setTimeout(() => {
      animate(
        "span",
        { opacity: 1, filter: "blur(0px)" },
        { duration: 0.4, delay: stagger(0.08) }
      );
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [animate, delay]);

  return (
    <motion.div ref={scope} className={cn("inline", className)}>
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          className="opacity-0 inline-block"
          style={{ filter: "blur(8px)" }}
        >
          {word}{idx < wordsArray.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </motion.div>
  );
}

export function PermissionGate({ children }: PermissionGateProps) {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkPermissions = useCallback(async () => {
    try {
      const status = await window.api.getPermissionStatus();
      console.log('Permission status:', status);
      setPermissionStatus(status);
      setIsChecking(false);
      return status.allGranted;
    } catch (e) {
      console.error('Failed to check permissions:', e);
      setIsChecking(false);
      return false;
    }
  }, []);

  // Initial check
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Poll for permission changes when permissions are not granted
  useEffect(() => {
    if (permissionStatus?.allGranted) return;

    const interval = setInterval(() => {
      checkPermissions();
    }, 2000);

    return () => clearInterval(interval);
  }, [permissionStatus?.allGranted, checkPermissions]);

  const handleOpenAccessibilitySettings = async () => {
    try {
      await window.api.openAccessibilitySettings();
    } catch (e) {
      console.error('Failed to open accessibility settings:', e);
    }
  };

  const handleOpenScreenRecordingSettings = async () => {
    try {
      await window.api.openScreenRecordingSettings();
    } catch (e) {
      console.error('Failed to open screen recording settings:', e);
    }
  };

  const handleRefresh = () => {
    setIsChecking(true);
    checkPermissions();
  };

  // Loading state
  if (isChecking && !permissionStatus) {
    return (
      <div className="h-screen w-screen bg-neutral-950 flex items-center justify-center fixed inset-0">
        <StarsBackground className="absolute inset-0 z-0" />
        <motion.div
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative z-10 text-center"
        >
          <div className="w-8 h-8 mx-auto mb-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm">Checking permissions</p>
        </motion.div>
      </div>
    );
  }

  // Permissions granted - render children with transition
  if (permissionStatus?.allGranted) {
    return (
      children
    );
  }

  // Permissions not granted - show permission request UI
  return (
    <div className="h-screen w-screen bg-neutral-950 fixed inset-0 overflow-hidden">
      <StarsBackground className="absolute inset-0 z-0" />
      <ShootingStars className="absolute inset-0 z-0" />

      <div className="relative z-10 h-full w-full flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-md"
        >
          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex justify-center mb-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-center backdrop-blur-xl">
              <Shield className="w-7 h-7 text-neutral-500" />
            </div>
          </motion.div>

          {/* Title with text generate effect */}
          <div className="text-center mb-3">
            <TextGenerate
              words="Permissions Required"
              className="text-4xl font-light text-white tracking-tight"
              delay={0.2}
            />
          </div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center text-neutral-500 text-sm mb-10 max-w-xs mx-auto leading-relaxed"
          >
            Grant access to capture and understand your AI conversations. Everything stays on your device.
          </motion.p>

          {/* Permission Cards */}
          <div className="space-y-3 mb-8">
            <PermissionCard
              title="Accessibility"
              description="Read text from AI chat windows"
              icon={<Eye className="w-5 h-5" />}
              granted={permissionStatus?.accessibility ?? false}
              onOpenSettings={handleOpenAccessibilitySettings}
              delay={0.6}
            />

            <PermissionCard
              title="Screen Recording"
              description="Capture visual context for OCR"
              icon={<Shield className="w-5 h-5" />}
              granted={permissionStatus?.screenRecording ?? false}
              onOpenSettings={handleOpenScreenRecordingSettings}
              delay={0.7}
            />
          </div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-neutral-900/40 border border-neutral-800/60 rounded-xl p-4 mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-3.5 h-3.5 text-neutral-600" />
              <span className="text-[10px] font-medium text-neutral-600 uppercase tracking-widest">
                How to enable
              </span>
            </div>
            <div className="space-y-2 text-sm text-neutral-500">
              <p>1. Click <span className="text-neutral-400">Open Settings</span></p>
              <p>2. Find <span className="text-neutral-400">My Memories</span> in the list</p>
              <p>3. Toggle the switch to enable</p>
            </div>
          </motion.div>

          {/* Refresh Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={handleRefresh}
            disabled={isChecking}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={cn(
              "w-full py-3 rounded-xl font-medium transition-all",
              "bg-neutral-900/80 border border-neutral-800 text-neutral-300",
              "hover:bg-neutral-800 hover:border-neutral-700 hover:text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", isChecking && "animate-spin")} />
            {isChecking ? 'Checking' : 'Check Again'}
          </motion.button>

          {/* Status indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex items-center justify-center gap-2 mt-4"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 animate-pulse" />
            <span className="text-[10px] text-neutral-600 uppercase tracking-widest">
              Auto-checking
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

interface PermissionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  granted: boolean;
  onOpenSettings: () => void;
  delay?: number;
}

function PermissionCard({ title, description, icon, granted, onOpenSettings, delay = 0 }: PermissionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        "relative rounded-xl border p-4 transition-all duration-300 overflow-hidden",
        granted
          ? "bg-neutral-900/60 border-neutral-700"
          : "bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60"
      )}
    >
      {granted && (
        <BorderBeam
          size={200}
          duration={10}
          borderWidth={1.5}
        />
      )}

      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-300",
          granted
            ? "bg-neutral-800 border-neutral-700 text-neutral-300"
            : "bg-neutral-800/60 border-neutral-800 text-neutral-500"
        )}>
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-white text-sm">{title}</h3>
            <div className={cn(
              "w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300",
              granted ? "bg-neutral-700" : "bg-neutral-800/60"
            )}>
              {granted ? (
                <Check className="w-2.5 h-2.5 text-neutral-300" />
              ) : (
                <X className="w-2.5 h-2.5 text-neutral-600" />
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>

        {/* Status/Actions */}
        <div className="flex-shrink-0">
          {granted ? (
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest">
              Enabled
            </span>
          ) : (
            <button
              onClick={onOpenSettings}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200",
                "bg-neutral-800 border border-neutral-700 text-neutral-300",
                "hover:bg-neutral-700 hover:text-white"
              )}
            >
              Open Settings
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
