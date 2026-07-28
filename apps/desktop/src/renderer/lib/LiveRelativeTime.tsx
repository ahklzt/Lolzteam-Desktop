import type { ReactElement } from "react";
import { useNowTick } from "./time";

type Props = {
  unix: number;
  format: (unixSec: number) => string;
  title?: string;
  className?: string;
  liveWindowSec?: number;
};

export const LiveRelativeTime = ({
  unix,
  format,
  title,
  className,
  liveWindowSec = 3600,
}: Props): ReactElement => {
  const recent = Math.floor(Date.now() / 1000) - unix < liveWindowSec;
  useNowTick(recent);
  return (
    <span className={className} title={title}>
      {format(unix)}
    </span>
  );
};
