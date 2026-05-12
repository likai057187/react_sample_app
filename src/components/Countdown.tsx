import { formatDuration, useCountdown } from "../hooks/useCountdown";

type Props = {
  endMs: number;
  className?: string;
};

export function Countdown({ endMs, className }: Props) {
  const { leftMs, ended } = useCountdown(endMs);
  const urgent = !ended && leftMs < 1000 * 60 * 60 * 6;

  return (
    <span className={`countdown${urgent ? " countdown--urgent" : ""}${className ? ` ${className}` : ""}`}>
      {ended ? "Closed" : `Ends in ${formatDuration(leftMs)}`}
    </span>
  );
}
