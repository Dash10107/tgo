import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { Area } from 'react-easy-crop';
import { Check, Crop, ZoomIn, ZoomOut } from 'lucide-react';
import { Modal, PrimaryButton, SecondaryButton } from './ModalKit';

import { useTranslation } from 'react-i18next';
interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string; // object URL or data URL
  aspect?: number; // default 1
  mimeType?: string; // default 'image/png'
  title?: string; // modal title, default 'Crop Image'
  onCancel: () => void;
  onConfirm: (blob: Blob, dataUrl: string) => void;
}

// Helper: crop image via canvas and return Blob + dataURL
async function cropImageToBlob(
  imageSrc: string,
  cropPixels: Area,
  mimeType: string = 'image/png',
  quality = 0.92
): Promise<{ blob: Blob; dataUrl: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create a canvas context');

  const { width, height, x, y } = cropPixels;
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));

  ctx.drawImage(
    img,
    x,
    y,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b as Blob), mimeType, quality);
  });

  const dataUrl = canvas.toDataURL(mimeType, quality);
  return { blob, dataUrl };
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  aspect = 1,
  mimeType = 'image/png',
  title = 'Crop Image',
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const workingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedAreaPixels(null);
      setPreviewDataUrl('');
    }
  }, [isOpen]);

  const onCropComplete = useCallback(async (_: Area, cropped: Area) => {
    setCroppedAreaPixels(cropped);
    // Update preview (best-effort)
    try {
      if (!imageSrc) return;
      // Avoid overlapping work
      if (workingRef.current) return;
      workingRef.current = true;
      const { dataUrl } = await cropImageToBlob(imageSrc, cropped, mimeType);
      setPreviewDataUrl(dataUrl);
    } catch {
      // Silent preview failure; final confirm will show proper errors if any
    } finally {
      workingRef.current = false;
    }
  }, [imageSrc, mimeType]);

  const handleConfirm = useCallback(async () => {
    try {
      if (!croppedAreaPixels) throw new Error(t('imageCrop.adjustFirst', 'Please adjust the crop area first'));
      const { blob, dataUrl } = await cropImageToBlob(imageSrc, croppedAreaPixels, mimeType);
      onConfirm(blob, dataUrl);
    } catch (err) {
      alert((err as Error)?.message || t('imageCrop.failed', 'Crop failed, please try again'));
    }
  }, [croppedAreaPixels, imageSrc, mimeType, onConfirm, t]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title === 'Crop Image' ? t('imageCrop.title', 'Crop Image') : title}
      icon={Crop}
      size="lg"
      zIndex="z-[10000]"
      footer={
        <>
          <SecondaryButton onClick={onCancel}>{t('common.cancel', 'Cancel')}</SecondaryButton>
          <PrimaryButton type="button" onClick={handleConfirm} icon={<Check className="h-4 w-4" />}>
            {t('common.confirm', 'Confirm')}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="relative h-[300px] overflow-hidden rounded-3xl bg-gray-900 ring-1 ring-black/10 dark:ring-white/10">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape="rect"
            showGrid={false}
            restrictPosition
          />
        </div>
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="image-crop-zoom" className="tgo-label !mb-0">{t('imageCrop.zoom', 'Zoom')}</label>
              <span className="text-[11px] tabular-nums text-gray-400">{zoom.toFixed(1)}×</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <ZoomOut className="h-3.5 w-3.5 shrink-0" />
              <input
                id="image-crop-zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full cursor-pointer accent-ink-900 dark:accent-acid-400"
              />
              <ZoomIn className="h-3.5 w-3.5 shrink-0" />
            </div>
          </div>
          <div>
            <p className="tgo-label">{t('imageCrop.preview', 'Preview (1:1)')}</p>
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-gray-50 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
              {previewDataUrl ? (
                <img src={previewDataUrl} alt={t('imageCrop.previewAlt', 'Preview')} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">{t('imageCrop.none', 'None')}</span>
              )}
            </div>
            <p className="tgo-hint">{t('imageCrop.recommendedSize', 'Recommended size: 72x72 pixels')}</p>
          </div>
        </div>
      </div>
    </Modal>,
    document.body
  );
};

export default ImageCropModal;

