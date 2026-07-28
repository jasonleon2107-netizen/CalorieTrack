import { PropsWithChildren } from 'react';
import { Modal, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeColors } from '@/constants/theme';

// Full-screen Add Food sheet. Slides up from the bottom using the Modal's own
// animation. An earlier drag-to-dismiss version was removed: gesture handlers
// don't work inside a RN Modal (it renders outside the app's gesture root) and
// the feature wasn't worth the complexity. Dismiss via the Close button.
export function Sheet({
  visible,
  onClose,
  colors,
  children,
}: PropsWithChildren<{ visible: boolean; onClose: () => void; colors: ThemeColors }>) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Safe-area context does not cross a Modal boundary, so give it its own. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>
      </SafeAreaProvider>
    </Modal>
  );
}
