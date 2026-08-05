import { PropsWithChildren } from 'react';
import { Modal, Platform, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeColors } from '@/constants/theme';

// On web the Modal covers the whole viewport, so constrain its content to the
// same phone-width column as the rest of the app and centre it.
const isWeb = Platform.OS === 'web';

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
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: isWeb ? 'center' : undefined }}>
          <View style={{ flex: 1, width: '100%', maxWidth: isWeb ? 480 : undefined }}>{children}</View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}
