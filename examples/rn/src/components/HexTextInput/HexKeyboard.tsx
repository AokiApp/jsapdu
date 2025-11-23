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

export default function HexKeyboard({
  onKeyPress,
  onBackspace,
  onEnter,
  onMoveLeft,
  onMoveRight,
  onCopyAll,
  onPasteFromClipboard,
}: HexKeyboardProps) {
  return (
    <View style={styles.grid}>
      {keys.map((k, i) => (
        <Key
          key={k + i}
          label={k}
          onPress={() => {
            if (k === '⌫') return onBackspace();
            if (k === '⏎') return onEnter();
            if (k === '<') return onMoveLeft();
            if (k === '>') return onMoveRight();
            onKeyPress(k);
          }}
          repeatable={k === '⌫' || k === '<' || k === '>'}
          variant={
            /^[0-9]$/.test(k)
              ? 'digit'
              : /^[A-F]$/.test(k)
                ? 'alphabet'
                : /^[<>]$/.test(k)
                  ? 'cursor'
                  : 'control'
          }
          suppressPressIn={k === 'C' || k === '7'}
          onLongPressAction={
            k === 'C'
              ? onCopyAll
              : k === '7'
                ? onPasteFromClipboard
                : undefined
          }
          cornerIcon={k === 'C' ? 'copy' : k === '7' ? 'paste' : undefined}
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