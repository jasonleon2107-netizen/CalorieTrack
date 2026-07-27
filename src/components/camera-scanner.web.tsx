import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Spacing, ThemeColors } from '@/constants/theme';

// The food barcodes we care about. Restricting formats makes decoding faster
// and less prone to misreads than leaving every format enabled.
const FORMATS = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E];

type WebState =
  | { phase: 'starting' }
  | { phase: 'scanning' }
  | { phase: 'denied' }
  | { phase: 'error'; message: string };

// Web live barcode camera, backed by ZXing decoding a getUserMedia stream.
// Quality is below the native scanner; good light and a steady hold help.
export function CameraScanner({
  colors,
  onScanned,
  onManualFallback,
}: {
  colors: ThemeColors;
  onScanned: (barcode: string) => void;
  onManualFallback: () => void;
}) {
  const styles = createStyles(colors);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handled = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WebState>({ phase: 'starting' });

  useEffect(() => {
    handled.current = false;
    let cancelled = false;
    setState({ phase: 'starting' });

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    const reader = new BrowserMultiFormatReader(hints);

    (async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video,
          (result) => {
            if (result && !handled.current) {
              handled.current = true;
              controlsRef.current?.stop();
              onScanned(result.getText());
            }
            // Errors here are almost all "no barcode in this frame" and fire
            // continuously — ignore them; real failures surface at start-up.
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState({ phase: 'scanning' });
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setState({ phase: 'denied' });
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setState({ phase: 'error', message: 'No camera was found on this device.' });
        } else {
          setState({ phase: 'error', message: 'Could not start the camera. Try again.' });
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [attempt, onScanned]);

  return (
    <View style={styles.cameraWrap}>
      {/* Raw DOM video element — Expo web renders through react-dom. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {state.phase === 'scanning' && (
        <>
          <View style={styles.scanFrame} pointerEvents="none" />
          <Text style={styles.scanHint}>Point your camera at a barcode</Text>
        </>
      )}

      {state.phase === 'starting' && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.overlayBody}>Starting camera…</Text>
        </View>
      )}

      {(state.phase === 'denied' || state.phase === 'error') && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>
            {state.phase === 'denied' ? 'Camera access needed' : 'Camera unavailable'}
          </Text>
          <Text style={styles.overlayBody}>
            {state.phase === 'denied'
              ? 'Allow camera access in your browser to scan barcodes. Nothing is stored or shared.'
              : state.message}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setAttempt((a) => a + 1)}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onManualFallback}>
            <Text style={styles.secondaryButtonText}>Enter manually instead</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cameraWrap: { flex: 1, margin: Spacing.three, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
    scanFrame: {
      position: 'absolute',
      top: '30%',
      left: '15%',
      right: '15%',
      height: '25%',
      borderWidth: 2,
      borderColor: colors.accent,
      borderRadius: 12,
    },
    scanHint: {
      position: 'absolute',
      bottom: Spacing.four,
      alignSelf: 'center',
      color: '#FFFFFF',
      fontSize: 13,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      borderRadius: 8,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
      gap: Spacing.two,
      backgroundColor: 'rgba(0,0,0,0.75)',
    },
    overlayTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
    overlayBody: { fontSize: 13, color: '#D0D3D8', textAlign: 'center' },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: Spacing.five,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    secondaryButton: { paddingVertical: Spacing.two },
    secondaryButtonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  });
}
