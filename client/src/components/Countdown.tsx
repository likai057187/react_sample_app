import { StyleSheet, Text } from 'react-native';
import { formatClosingIn, formatDuration, useCountdown } from '../hooks/useCountdown';

type Props = {
  endMs: number;
  variant?: 'default' | 'closes';
};

export function Countdown({ endMs, variant = 'default' }: Props) {
  const { leftMs, ended } = useCountdown(endMs);
  const urgent = !ended && leftMs < 1000 * 60 * 60 * 6;

  const text =
    ended ? 'Closed' : variant === 'closes' ? `Closes in ${formatClosingIn(leftMs)}` : `Ends in ${formatDuration(leftMs)}`;

  return <Text style={[styles.text, urgent && styles.urgent]}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: { color: '#c9c5bc', fontSize: 13 },
  urgent: { color: '#f0b429' },
});
