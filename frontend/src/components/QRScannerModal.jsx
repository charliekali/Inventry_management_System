import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { X, Camera, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

/**
 * QRScannerModal — Camera-based QR Code scanner.
 *
 * Uses native getUserMedia + jsQR for full control over the camera UI.
 * No third-party UI injection — pure React rendering.
 *
 * Props:
 *   onScanned(data)  — Called with parsed JSON when a valid TTRIMS_SECTION QR is decoded.
 *   onClose()        — Called when the modal is dismissed.
 */
export default function QRScannerModal({ onScanned, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  const [status, setStatus] = useState('starting'); // 'starting' | 'scanning' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [scannedLabel, setScannedLabel] = useState('');

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  // QR decode loop
  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code) {
      stopCamera();
      try {
        const parsed = JSON.parse(code.data);
        if (parsed.type !== 'TTRIMS_SECTION') {
          setStatus('error');
          setErrorMsg('Invalid QR code — please scan a TTRIMS section label.');
          return;
        }
        setScannedLabel(`${parsed.warehouse_name} › ${parsed.section_name}`);
        setStatus('success');
        setTimeout(() => {
          onScanned(parsed);
          onClose();
        }, 1000);
      } catch {
        setStatus('error');
        setErrorMsg('QR code is not a valid TTRIMS section label.');
      }
      return;
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [stopCamera, onScanned, onClose]);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        // Try environment (rear) camera first, fall back to any
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', true);
          await videoRef.current.play();
        }
        setStatus('scanning');
        animFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        console.error('Camera error:', err);
        setStatus('error');
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMsg('Camera permission denied. Please allow camera access in your browser settings and try again.');
        } else if (err.name === 'NotFoundError') {
          setErrorMsg('No camera found on this device.');
        } else {
          setErrorMsg(`Could not start camera: ${err.message}`);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [tick, stopCamera]);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="qr-scanner-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Camera size={18} color="var(--color-primary-light)" />
            <h3 className="modal-title">Scan Section QR Code</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>

          {/* Camera viewport */}
          <div style={{
            position: 'relative',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: '#0a0a0a',
            aspectRatio: '4/3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            {/* Live video */}
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: status === 'scanning' ? 'block' : 'none'
              }}
              muted
              playsInline
            />

            {/* Hidden canvas used for jsQR frame analysis */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Aiming crosshair overlay shown while scanning */}
            {status === 'scanning' && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                {/* Dark vignette corners */}
                <div style={{
                  width: 200, height: 200,
                  border: '3px solid rgba(59, 130, 246, 0.9)',
                  borderRadius: 12,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  animation: 'pulse 1.8s ease-in-out infinite'
                }} />
                {/* Corner ticks */}
                {[
                  { top: 'calc(50% - 100px)', left: 'calc(50% - 100px)', borderTop: '3px solid #3b82f6', borderLeft: '3px solid #3b82f6', borderRadius: '12px 0 0 0' },
                  { top: 'calc(50% - 100px)', right: 'calc(50% - 100px)', borderTop: '3px solid #3b82f6', borderRight: '3px solid #3b82f6', borderRadius: '0 12px 0 0' },
                  { bottom: 'calc(50% - 100px)', left: 'calc(50% - 100px)', borderBottom: '3px solid #3b82f6', borderLeft: '3px solid #3b82f6', borderRadius: '0 0 0 12px' },
                  { bottom: 'calc(50% - 100px)', right: 'calc(50% - 100px)', borderBottom: '3px solid #3b82f6', borderRight: '3px solid #3b82f6', borderRadius: '0 0 12px 0' },
                ].map((s, i) => (
                  <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }} />
                ))}
              </div>
            )}

            {/* Starting state */}
            {status === 'starting' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#888' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13 }}>Starting camera…</span>
              </div>
            )}

            {/* Error state in viewport */}
            {status === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 24, color: '#ef4444', textAlign: 'center' }}>
                <AlertTriangle size={36} />
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{errorMsg}</span>
              </div>
            )}

            {/* Success state */}
            {status === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24, color: '#10b981', textAlign: 'center' }}>
                <CheckCircle size={40} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>{scannedLabel}</span>
                <span style={{ fontSize: 12, color: '#888' }}>Location detected! Applying…</span>
              </div>
            )}
          </div>

          {/* Instruction text */}
          {status === 'scanning' && (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.6, marginBottom: 14 }}>
              📱 Hold the QR label steady inside the blue frame. The scanner reads automatically — no button needed.
            </p>
          )}

          <button className="btn btn-secondary" onClick={handleClose} style={{ width: '100%', justifyContent: 'center' }}>
            Cancel
          </button>
        </div>
      </div>

      {/* Spin keyframe for the loading spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
