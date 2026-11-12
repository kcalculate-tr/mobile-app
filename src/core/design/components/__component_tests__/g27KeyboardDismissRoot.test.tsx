// G27-S1 md.1 — "Kapat" barı yok; kökte dokunma klavyeyi kapatır, liste öğesine
// dokunma hem klavyeyi kapatır hem öğeyi açar (kök dokunmayı çalmaz).
import React from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { KeyboardDismissRoot } from '../../KeyboardDismissRoot';
import { keepKeyboardOnTouch } from '../../keyboardDismiss';

const focusedInput = { id: 'focused' };
type StateLike = { currentlyFocusedInput: () => unknown; isTextInput?: (t: unknown) => boolean };
const State = (TextInput as unknown as { State: StateLike }).State;

function touch(pageX = 10, pageY = 10, target: unknown = { id: 'blank' }) {
  return { nativeEvent: { pageX, pageY, touches: [{}] }, target };
}

describe('KeyboardDismissRoot', () => {
  let dismiss: jest.SpyInstance;
  let focused: jest.SpyInstance;

  beforeEach(() => {
    dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    focused = jest.spyOn(State, 'currentlyFocusedInput').mockReturnValue(focusedInput);
  });
  afterEach(() => {
    dismiss.mockRestore();
    focused.mockRestore();
  });

  function setup(onItem = jest.fn()) {
    const r = render(
      <KeyboardDismissRoot>
        <View testID="blank" style={{ flex: 1 }}>
          <Pressable testID="item" onPress={onItem} accessibilityRole="button">
            <Text>Öğe</Text>
          </Pressable>
          <Pressable testID="send" onPress={() => {}} onTouchStart={keepKeyboardOnTouch}>
            <Text>Gönder</Text>
          </Pressable>
        </View>
      </KeyboardDismissRoot>,
    );
    return { ...r, onItem };
  }

  it('kökte dokunma klavyeyi kapatır', () => {
    const { getByTestId } = setup();
    const root = getByTestId('keyboard-dismiss-root');
    fireEvent(root, 'touchStart', touch());
    fireEvent(root, 'touchEnd', touch());
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('liste öğesine dokunma hem kapatır hem öğeyi açar', () => {
    const { getByTestId, onItem } = setup();
    const item = getByTestId('item');
    fireEvent(item, 'touchStart', touch(10, 10, { id: 'item' }));
    fireEvent.press(item);
    fireEvent(item, 'touchEnd', touch(10, 10, { id: 'item' }));
    expect(onItem).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('kaydırma (sürükleme) dokunma sayılmaz; iptal edilen dokunma kapatmaz', () => {
    const { getByTestId } = setup();
    const root = getByTestId('keyboard-dismiss-root');
    fireEvent(root, 'touchStart', touch(10, 10));
    fireEvent(root, 'touchMove', touch(10, 80));
    fireEvent(root, 'touchEnd', touch(10, 80));
    fireEvent(root, 'touchStart', touch(10, 10));
    fireEvent(root, 'touchCancel', touch(10, 10));
    fireEvent(root, 'touchEnd', touch(10, 10));
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('odaklı alanın kendisine dokunma kapatmaz; klavye kapalıyken hiçbir şey yapmaz', () => {
    const { getByTestId } = setup();
    const root = getByTestId('keyboard-dismiss-root');
    fireEvent(root, 'touchStart', touch(10, 10, focusedInput));
    fireEvent(root, 'touchEnd', touch(10, 10, focusedInput));
    focused.mockReturnValue(null);
    fireEvent(root, 'touchStart', touch());
    fireEvent(root, 'touchEnd', touch());
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('başka bir giriş alanına dokunma kapatmaz', () => {
    const other = { id: 'other-input' };
    const orig = State.isTextInput;
    State.isTextInput = (t: unknown) => t === other;
    try {
      const { getByTestId } = setup();
      const root = getByTestId('keyboard-dismiss-root');
      fireEvent(root, 'touchStart', touch(10, 10, other));
      fireEvent(root, 'touchEnd', touch(10, 10, other));
      expect(dismiss).not.toHaveBeenCalled();
    } finally {
      State.isTextInput = orig;
    }
  });

  it('keepKeyboardOnTouch işaretli Gönder klavyeyi kapatmaz', () => {
    const { getByTestId } = setup();
    const send = getByTestId('send');
    // Olay yapraktan köke kabarır: önce Gönder'in onTouchStart'ı, sonra kökünki.
    send.props.onTouchStart?.(touch());
    fireEvent(getByTestId('keyboard-dismiss-root'), 'touchStart', touch());
    fireEvent(getByTestId('keyboard-dismiss-root'), 'touchEnd', touch());
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('kök erişilebilirlik ağacına girmez (Kapat düğmesi yok)', () => {
    const { getByTestId, queryByText } = setup();
    expect(getByTestId('keyboard-dismiss-root').props.accessible).toBeFalsy();
    expect(queryByText('Kapat')).toBeNull();
  });
});
