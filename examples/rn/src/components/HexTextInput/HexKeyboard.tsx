import React from 'react';
import { StyleSheet, View } from 'react-native';
import Key from './Key';

export type HexKeyboardProps = {
  onKeyPress: (k: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onCopyAll?: () => void;
  onPasteFromClipboard?: () => void;
};

const keys = [
  'C',
  '7',
  '8',
  '9',
  'F',
  'B',
  '4',
  '5',
  '6',
  'E',
  'A',
  '1',
  '2',
  '3',
  'D',
  '<',
  '>',
  '0',
  '⌫',
  '⏎',
];

const getVariant = (k: string): 'digit' | 'alphabet' | 'cursor' | 'control' => {
  if (/^[0-9]$/.test(k)) return 'digit';
  if (/^[A-F]$/.test(k)) return 'alphabet';
  if (/^[<>]$/.test(k)) return 'cursor';
  return 'control';
};

const isRepeatable = (k: string) => k === '⌫' || k === '<' || k === '>';

const getCornerIcon = (k: string): 'copy' | 'paste' | undefined =>
  k === 'C' ? 'copy' : k === '7' ? 'paste' : undefined;

export default function HexKeyboard({
  onKeyPress,
  onBackspace,
  onEnter,
  onMoveLeft,
  onMoveRight,
  onCopyAll,
  onPasteFromClipboard,
}: HexKeyboardProps) {
  const handlePress = (k: string) => {
    if (k === '⌫') return onBackspace();
    if (k === '⏎') return onEnter();
    if (k === '<') return onMoveLeft();
    if (k === '>') return onMoveRight();
    onKeyPress(k);
  };

  const getLongPressAction = (k: string) =>
    k === 'C' ? onCopyAll : k === '7' ? onPasteFromClipboard : undefined;

  return (
    <View style={styles.grid}>
      {keys.map((k) => (
        <Key
          key={k}
          label={k}
          onPress={() => handlePress(k)}
          repeatable={isRepeatable(k)}
          variant={getVariant(k)}
          suppressPressIn={k === 'C' || k === '7'}
          onLongPressAction={getLongPressAction(k)}
          cornerIcon={getCornerIcon(k)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'space-between',
  },
});