import { useEffect, useRef, useState } from "react";
import loadingVideo from "~/assets/loading.webm";
import styles from "./Splash.module.scss";

interface SplashProps {
  onDone: () => void;
}

const MAX_DURATION = 8000;

export const Splash = ({ onDone }: SplashProps) => {
  const [leaving, setLeaving] = useState(false);
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLeaving(true);
  };

  useEffect(() => {
    const timer = window.setTimeout(finish, MAX_DURATION);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`${styles.splash} ${leaving ? styles.hidden : ""}`}
      onTransitionEnd={() => leaving && onDone()}
    >
      <video
        className={styles.video}
        src={loadingVideo}
        autoPlay
        muted
        playsInline
        onEnded={finish}
        onError={finish}
      />
    </div>
  );
};
